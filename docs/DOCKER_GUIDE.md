# คู่มือ Docker สำหรับโปรเจกต์ Up Fullstack Training

เอกสารนี้อธิบายว่า Docker คืออะไร Dockerfile และ Docker Compose คืออะไร รวมถึงวิธีการนำมาใช้งานกับโปรเจกต์นี้

---

## สารบัญ

1. [Docker คืออะไร](#1-docker-คืออะไร)
2. [Dockerfile คืออะไร](#2-dockerfile-คืออะไร)
3. [Docker Compose คืออะไร](#3-docker-compose-คืออะไร)
4. [วิธีการใช้งาน](#4-วิธีการใช้งาน)
5. [คำสั่งที่ใช้บ่อย](#5-คำสั่งที่ใช้บ่อย)

---

## 1. Docker คืออะไร

**Docker** เป็นแพลตฟอร์มสำหรับสร้าง แพ็กเกจ และรันแอปพลิเคชันใน **Container** ซึ่งเป็นสภาพแวดล้อมที่แยกออกมา (isolated) คล้ายกับเครื่องเสมือน (virtual machine) แต่เบากว่าและเริ่มทำงานได้เร็วมาก

### ประโยชน์หลักของ Docker

| ประโยชน์ | คำอธิบาย |
|----------|----------|
| **ความสอดคล้อง (Consistency)** | รันแอปได้เหมือนกันทุกที่ ไม่ว่าเครื่อง dev, staging หรือ production จะต่างกัน |
| **แยกสภาพแวดล้อม (Isolation)** | แอปและ dependencies อยู่ใน container แยกจากระบบหลัก ไม่รบกวนกัน |
| **ง่ายต่อการ deploy** | สร้าง image ครั้งเดียว แล้วนำไปรันได้ทุกที่ |
| **รวดเร็ว** | Container เริ่มทำงานได้เร็วกว่า VM และใช้ทรัพยากรน้อยกว่า |

### แนวคิดสำคัญ

- **Image** = เทมเพลตแบบ read-only สำหรับสร้าง container (คล้าย class ใน OOP)
- **Container** = instance ที่รันจริงของ image (คล้าย object)
- **Registry** = ที่เก็บ image เช่น Docker Hub

---

## 2. Dockerfile คืออะไร

**Dockerfile** เป็นไฟล์ข้อความที่ใช้กำหนดวิธี **build Docker image** โดยเขียนเป็นคำสั่งทีละขั้นตอน (instruction) Docker จะอ่านไฟล์นี้แล้วสร้าง image ตามลำดับ

### คำสั่งพื้นฐานใน Dockerfile

| คำสั่ง | ความหมาย |
|--------|----------|
| `FROM` | กำหนด base image ที่จะใช้ (เช่น `node:20-alpine`) |
| `WORKDIR` | กำหนดโฟลเดอร์ทำงานภายใน container |
| `COPY` | คัดลอกไฟล์จากเครื่อง host เข้าไปใน image |
| `RUN` | รันคำสั่งขณะ build (เช่น `npm install`) |
| `ENV` | ตั้งตัวแปรสภาพแวดล้อม |
| `EXPOSE` | ประกาศพอร์ตที่แอปจะใช้ (ไม่ได้เปิดพอร์ตจริง) |
| `CMD` | คำสั่งที่จะรันเมื่อ container เริ่มทำงาน |

### Multi-stage Build

เป็นการแบ่ง Dockerfile เป็นหลาย **stage** เพื่อลดขนาด image สุดท้าย โดยใช้เฉพาะสิ่งที่จำเป็นสำหรับ production

```
Stage 1 (deps)    → ติดตั้ง dependencies
Stage 2 (builder) → build แอป
Stage 3 (runner)  → copy เฉพาะ output ที่จำเป็น → image ขนาดเล็ก
```

### ตัวอย่างจากโปรเจกต์นี้

โปรเจกต์ใช้ Dockerfile แบบ multi-stage:

1. **base** – ใช้ Node.js 20 Alpine เป็นฐาน
2. **deps** – ติดตั้ง npm packages
3. **builder** – generate Prisma client และ build Next.js
4. **runner** – copy เฉพาะไฟล์ที่จำเป็นสำหรับ production และรัน migrate + seed ก่อน start app

---

## 3. Docker Compose คืออะไร

**Docker Compose** เป็นเครื่องมือสำหรับกำหนดและรันแอปที่ประกอบด้วย **หลาย container** จากไฟล์ `docker-compose.yml` แทนที่จะต้องรันคำสั่ง `docker run` หลายครั้ง

### ประโยชน์หลัก

- **กำหนด services ทั้งหมดในไฟล์เดียว** – database, web app, cache ฯลฯ
- **จัดการเครือข่าย** – services สื่อสารกันได้ด้วยชื่อ service
- **จัดการ volumes** – เก็บข้อมูลให้อยู่ต่อแม้ container จะหยุด
- **กำหนดลำดับการรัน** – เช่น web รอ database พร้อมก่อน

### โครงสร้าง docker-compose.yml

```yaml
version: "3.9"

services:
  db:           # service ชื่อ db
    image: postgres:16
    environment: ...
    volumes: ...
    healthcheck: ...

  web:          # service ชื่อ web
    build: .
    depends_on:
      db:
        condition: service_healthy
    environment: ...
```

### ตัวอย่างจากโปรเจกต์นี้

| Service | รายละเอียด |
|---------|-------------|
| **db** | PostgreSQL 16 สำหรับฐานข้อมูล |
| **web** | Next.js app ที่ build จาก Dockerfile |

- `web` ใช้ `depends_on` + `condition: service_healthy` เพื่อรอให้ DB พร้อมก่อน
- `db` มี healthcheck ด้วย `pg_isready`
- ใช้ volume `postgres_data` เพื่อเก็บข้อมูล DB

---

## 4. วิธีการใช้งาน

### 4.1 ความต้องการของระบบ

- ติดตั้ง [Docker Desktop](https://www.docker.com/products/docker-desktop/) (รวม Docker และ Docker Compose)
- หรือติดตั้ง Docker Engine + Docker Compose แยกต่างหาก

### 4.2 โครงสร้างโปรเจกต์

```
up-fullstack-training1/
├── web/
│   ├── Dockerfile          # อยู่ภายในโฟลเดอร์ web
│   ├── docker-compose.yml  # อยู่ภายในโฟลเดอร์ web
│   ├── .env                # ต้องสร้างเอง (ดู .env.example)
│   ├── prisma/
│   ├── app/
│   └── ...
```

### 4.3 ขั้นตอนการรัน

#### ขั้นตอนที่ 1: สร้างไฟล์ .env

สร้างไฟล์ `.env` ในโฟลเดอร์ `web/` (หรือคัดลอกจาก `.env.example`) โดยมีตัวแปรอย่างน้อย:

```
DATABASE_URL=postgresql://postgres:postgres@db:5432/up_training
AUTH_SECRET=changeme-super-secret
```

> **หมายเหตุ:** ค่า `DATABASE_URL` ใช้ `db` เป็น host เพราะเป็นชื่อ service ใน docker-compose

#### ขั้นตอนที่ 2: รัน Docker Compose

```bash
cd web
docker compose up --build
```

- `--build` = build image ใหม่ก่อนรัน (ใช้เมื่อมีการแก้ Dockerfile หรือโค้ด)
- ครั้งแรกอาจใช้เวลาสักพักเพราะต้อง build image และดาวน์โหลด PostgreSQL

#### ขั้นตอนที่ 3: เข้าใช้งาน

- **Web app:** http://localhost:3000
- **PostgreSQL:** localhost:5432 (user: postgres, password: postgres, db: up_training)

### 4.4 รันในโหมด background

```bash
docker compose up -d --build
```

- `-d` = detached mode รันในพื้นหลัง

### 4.5 หยุดการทำงาน

```bash
docker compose down
```

- หยุดและลบ containers
- ข้อมูลใน volume `postgres_data` ยังอยู่

---

## 5. คำสั่งที่ใช้บ่อย

### Docker Compose

| คำสั่ง | ความหมาย |
|--------|----------|
| `docker compose up -d --build` | รัน services ในพื้นหลัง และ build ใหม่ |
| `docker compose up --build` | รันและแสดง log บนหน้าจอ |
| `docker compose down` | หยุดและลบ containers |
| `docker compose ps` | แสดงสถานะของ containers |
| `docker compose logs -f web` | ดู log ของ service web แบบ real-time |

### Docker ทั่วไป

| คำสั่ง | ความหมาย |
|--------|----------|
| `docker images` | แสดง images ที่มี |
| `docker ps` | แสดง containers ที่กำลังรัน |
| `docker ps -a` | แสดง containers ทั้งหมดรวมที่หยุดแล้ว |
| `docker exec -it up_training_web sh` | เข้า shell ใน container web |
| `docker exec -it up_training_db psql -U postgres -d up_training` | เข้า PostgreSQL ใน container |

### การแก้ไขและ build ใหม่

เมื่อแก้โค้ดหรือ Dockerfile:

```bash
docker compose down
docker compose up --build -d
```

หรือถ้าต้องการลบ images เก่าด้วย:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## สรุป

| หัวข้อ | สรุป |
|--------|------|
| **Docker** | แพลตฟอร์มสำหรับรันแอปใน container ให้สภาพแวดล้อมสอดคล้องกัน |
| **Dockerfile** | ไฟล์กำหนดวิธี build image (เช่น multi-stage build) |
| **Docker Compose** | เครื่องมือรันหลาย services พร้อมกันจากไฟล์ YAML |
| **การใช้งาน** | `cd web` → สร้าง `.env` → `docker compose up --build` |

---

## อ้างอิง

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Docker Documentation](https://nextjs.org/docs/app/api-reference/next-config-js/output)
