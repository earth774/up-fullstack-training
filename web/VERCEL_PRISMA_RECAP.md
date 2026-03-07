# Vercel Prisma Issue Recap

## Summary

มีปัญหาใน production บน Vercel ที่ API `GET /api/articles` เรียก Prisma ไม่ได้ และ error หลักคือ:

```txt
Prisma Client could not locate the Query Engine for runtime "rhel-openssl-3.0.x"
```

ผลคือ endpoint ฝั่ง server ตอบ `500` แม้ว่าโค้ด query เองจะถูกต้อง

## Symptom

- หน้าเว็บที่พึ่งพา `GET /api/articles` ใช้งานไม่ได้
- ใน Vercel log ขึ้น `PrismaClientInitializationError`
- Prisma หาไฟล์ `libquery_engine-rhel-openssl-3.0.x.so.node` ไม่เจอใน deployment output

## Root Cause

สาเหตุหลักมาจากการ generate Prisma Client ไปไว้ที่ custom path:

```prisma
generator client {
  provider      = "prisma-client"
  output        = "../app/generated/prisma"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}
```

และในโค้ดมีการ import จาก generated path ตรงๆ:

```ts
import { PrismaClient } from "../app/generated/prisma/client";
```

รูปแบบนี้ทำให้ตอน Next.js/Vercel bundle server function ตัว Prisma query engine สำหรับ runtime ของ Vercel (`rhel-openssl-3.0.x`) ไม่ได้ถูก include เข้าไปใน deployment อย่างถูกต้อง

สรุปสั้นๆ:

- โค้ด query ไม่ได้พัง
- Database connection string ไม่ใช่สาเหตุหลักของ error นี้
- ปัญหาอยู่ที่ Prisma client generation + deployment bundling

## Changes Applied

### 1. Switch back to standard Prisma Client generation

เปลี่ยน `web/prisma/schema.prisma` ให้ใช้ generator มาตรฐาน:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}
```

จุดสำคัญคือเลิกใช้ custom `output` เพื่อให้ Prisma และ Next.js ใช้เส้นทางมาตรฐานที่รองรับการ bundle บน Vercel ได้ดีกว่า

### 2. Update Prisma import path

เปลี่ยน `web/lib/prisma.ts` จาก custom generated path มาใช้ package มาตรฐาน:

```ts
import { PrismaClient } from "@prisma/client";
```

### 3. Ensure Prisma Client is generated during install/deploy

เพิ่ม script นี้ใน `web/package.json`:

```json
"postinstall": "prisma generate"
```

เพื่อให้ทุกครั้งที่มีการ install dependencies บน Vercel ระบบ generate Prisma Client ให้อัตโนมัติ

### 4. Fix dev script สำหรับ Next.js 16 (Turbopack vs Webpack)

Next.js 16 ใช้ Turbopack เป็น default แต่โปรเจกต์มี `webpack` config ใน `next.config.ts` (PrismaPlugin) ทำให้เกิด error ตอนรัน `npm run dev`

แก้โดยเพิ่ม flag `--webpack` ใน script `dev`:

```json
"dev": "next dev --webpack"
```

## Local Development Setup

### Environment Variable

Prisma ต้องใช้ `DATABASE_URL` เพื่อเชื่อมต่อฐานข้อมูล สร้างไฟล์ `web/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
```

- แทนที่ `USER`, `PASSWORD`, `HOST`, `PORT`, `DATABASE` ด้วยค่าจริง
- ไฟล์ `.env` ถูก ignore ใน git แล้ว ไม่ต้องกังวลเรื่อง commit

### Lock File (กรณีรัน dev ซ้ำ)

ถ้าเจอ `Unable to acquire lock at .next/dev/lock` แปลว่ามี Next.js dev server รันอยู่แล้ว:

- ใช้ server ที่รันอยู่ได้เลย หรือ
- ปิด process เดิมก่อน: `pkill -f "next dev"`
- หรือลบ lock ถ้า process หายไปแล้ว: `rm -f web/.next/dev/lock`

## Validation Performed

ตรวจสอบหลังแก้ไขแล้ว:

- `npx prisma generate` ผ่าน
- `npx eslint lib/prisma.ts app/api/articles/route.ts` ผ่าน
- `npx next build --webpack` ผ่าน

ดังนั้นในระดับ local build ถือว่าการตั้งค่า Prisma/Next.js กลับมาอยู่ในสภาพที่ deploy ได้ตามปกติ

## Important Note

ใน IDE อาจยังมี warning เกี่ยวกับ `datasource url` ใน `schema.prisma` เพราะโปรเจกต์นี้มี `prisma.config.ts` อยู่แล้ว

แต่จากการทดสอบจริง:

- ถ้าลบ `url = env("DATABASE_URL")` ออกจาก `schema.prisma`
- `prisma generate` ของ Prisma `6.19.2` ในโปรเจกต์นี้จะ fail

ดังนั้นตอนนี้ยังคง `url` ไว้เพื่อให้ workflow ปัจจุบันใช้งานได้ก่อน

## Recommended Deployment Step

หลัง merge หรือ push การแก้ไขนี้แล้ว ควร:

1. Redeploy บน Vercel ใหม่
2. ถ้ายังเจอ error เดิม ให้ redeploy แบบไม่ใช้ cache
3. ตรวจสอบ log ของ `GET /api/articles` อีกครั้ง

## Expected Result After Redeploy

- `GET /api/articles` ควรกลับมาทำงานได้
- ไม่ควรเจอ `Prisma Client could not locate the Query Engine` อีก
- Prisma ควรโหลด query engine ของ runtime `rhel-openssl-3.0.x` ได้ถูกต้องใน production
