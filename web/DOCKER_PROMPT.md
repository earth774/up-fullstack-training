# Prompt สำหรับสร้าง Dockerfile และ Docker Compose

ใช้ prompt ด้านล่างนี้กับ AI (เช่น ChatGPT, Claude) เพื่อให้สร้าง Dockerfile และ docker-compose สำหรับโปรเจกต์นี้

---

## โครงสร้างโปรเจกต์ (Project Structure)

```
up-fullstack-training/
├── Dockerfile              # อยู่ level เดียวกับ docker-compose
├── docker-compose.yml      # อยู่ level เดียวกับ Dockerfile
├── .env.example
└── web/                    # Next.js application (build context)
    ├── app/                # Next.js App Router
    │   ├── api/            # API routes (auth, articles, profile)
    │   ├── (auth)/         # Login, Register pages
    │   ├── articles/       # Article pages
    │   ├── profile/        # Profile pages
    │   └── generated/      # Prisma client (generated, อยู่ใน .gitignore)
    ├── lib/                # prisma.ts, auth.ts
    ├── prisma/
    │   ├── schema.prisma   # PostgreSQL schema
    │   ├── migrations/     # SQL migrations
    │   └── seed.ts         # Seed script (tsx)
    ├── package.json
    ├── next.config.ts
    └── tsconfig.json
```

---

## สรุปเทคโนโลยีและ dependencies

| รายการ | รายละเอียด |
|--------|-------------|
| Framework | Next.js 16.1.6 (App Router) |
| Runtime | Node.js |
| Database | PostgreSQL (Prisma ORM) |
| Package manager | npm |
| Prisma client output | `app/generated/prisma` |

---

## Environment Variables ที่ต้องใช้

| Variable | ใช้สำหรับ | ตัวอย่าง |
|----------|------------|----------|
| `DATABASE_URL` | Prisma เชื่อมต่อ PostgreSQL | `postgresql://user:pass@db:5432/dbname` |
| `AUTH_SECRET` หรือ `CRYPTO_SECRET` | JWT signing (production) | random string 32+ chars |

---

## ขั้นตอน build และ run (manual)

```bash
cd web
npm install
npx prisma generate
npx prisma migrate deploy   # รัน migrations
npx prisma db seed          # seed ข้อมูล
npm run build
npm run start               # port 3000
```

**Docker:** ตอน `docker compose up` จะรัน migrate + seed อัตโนมัติก่อน start app

---

## สิ่งที่ต้องมีใน Docker setup

1. **Dockerfile และ docker-compose.yml** – อยู่ที่ root ของโปรเจกต์ (level เดียวกัน)
2. **PostgreSQL service** – รันก่อน Next.js เพื่อให้ migrate ได้
3. **Next.js service** – รอ DB พร้อมก่อน migrate/build
4. **Auto migrate + seed** – ตอน `docker compose up` ให้รัน `prisma migrate deploy` และ `prisma db seed` อัตโนมัติก่อน start app
5. **Health check** – DB พร้อมก่อน start app
6. **Multi-stage build** – ลดขนาด image (optional แต่แนะนำ)
7. **`.env` หรือ env ใน docker-compose** – `DATABASE_URL` ชี้ไปที่ service ชื่อ `db` (หรือชื่อที่ใช้)

---

## Prompt สำหรับ AI

```
โปรดสร้าง Dockerfile และ docker-compose.yml สำหรับโปรเจกต์ Next.js นี้:

**ตำแหน่งไฟล์:**
- Dockerfile และ docker-compose.yml อยู่ที่ root ของโปรเจกต์ (level เดียวกัน)
- Build context คือโฟลเดอร์ `web/`

**โครงสร้าง app:**
- Next.js 16, TypeScript, Prisma (PostgreSQL)
- Prisma client ถูก generate ไปที่ `app/generated/prisma`
- มี seed script: `npx tsx prisma/seed.ts`

**Requirements:**
1. Dockerfile: multi-stage build (build stage + production stage)
   - Build: npm install, prisma generate, next build
   - Production: ใช้ output จาก build เท่านั้น (standalone ถ้า Next.js รองรับ หรือ copy .next)
2. docker-compose.yml:
   - Service `db`: PostgreSQL 15+ (หรือ latest stable)
   - Service `web`: Next.js app
   - web ต้องรอ db พร้อม (depends_on + healthcheck)
   - ใช้ DATABASE_URL ชี้ไปที่ db service (host: db, port: 5432)
   - Expose port 3000 สำหรับ web
3. สร้างไฟล์ .env.example ที่ root ระบุ DATABASE_URL และ AUTH_SECRET
4. ใช้ Node.js 20 LTS เป็น base image

**สำคัญ: ตอน start container web ต้องรัน migrate และ seed อัตโนมัติ:**
- npx prisma migrate deploy
- npx prisma db seed
- npm run start

(ใช้ entrypoint script หรือ CMD ที่รัน 3 คำสั่งนี้ตามลำดับก่อน start app)

โปรดเขียน Dockerfile, docker-compose.yml และ .env.example ให้ครบ
```

---

## หมายเหตุเพิ่มเติม

- Next.js 16 รองรับ `output: 'standalone'` ใน next.config สำหรับ production build ที่เล็กลง
- ถ้าใช้ standalone ต้อง copy โฟลเดอร์ `standalone` และ `public`, `.next/static` ตาม [Next.js Docker docs](https://nextjs.org/docs/app/api-reference/next-config-js/output)
- Prisma ต้อง `generate` ก่อน `migrate` และ `build`
