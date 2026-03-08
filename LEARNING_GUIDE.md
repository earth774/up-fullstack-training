# 📚 คู่มือการเรียนรู้ Medium Clone — แผน 4 วัน

คู่มือนี้แบ่งการเรียนรู้ออกเป็นวันๆ พร้อมคำอธิบายแต่ละขั้นตอน และ **code ตัวอย่าง** ในแต่ละ step

**Theme:** ขาวดำ minimal — พื้นหลังขาว, ตัวอักษรดำ, เส้นขอบเทา, ปุ่มใช้ `px-5 py-2.5` ให้สมส่วน

**Database:** PostgreSQL — ใช้ Prisma ORM กับ PostgreSQL (หรือ SQLite สำหรับ development ง่าย)

---

## 📂 โครงสร้างไฟล์

| ไฟล์ | เนื้อหา |
|------|---------|
| [DAY_1.md](DAY_1.md) | วันที่ 1 — Foundation (Setup, Prisma, Database, API, Feed) |
| [DAY_2.md](DAY_2.md) | วันที่ 2 — Auth (JWT, Login, Register, Middleware) |
| [Day_3.md](Day_3.md) | วันที่ 3 — Editor + Profile (Markdown Editor, Write, Categories, Profile) |
| [Day_4.md](Day_4.md) | วันที่ 4 — Advanced Features (Edit/Delete, Like, Comments, Git) |
| [schema.dbml](schema.dbml) | โครงสร้างฐานข้อมูล (DBML — ตาราง status, user, article, category, article_like, comment) |

---

## 📋 สรุป Scope ทั้งหมด

### ✅ Must Have (ทำได้ใน 4 วัน)
- สมัครสมาชิก / Login (JWT + bcrypt + jose)
- เขียนบทความ (Markdown Editor)
- แสดงรายการบทความ (feed + pagination)
- หน้าอ่านบทความ
- Profile ของแต่ละคน (ดูด้วย username หรือ id)
- แก้ไขโปรไฟล์ + เปลี่ยนรหัสผ่าน
- Like บทความ
- Tag / หมวดหมู่ (Categories)
- Draft / Publish บทความ
- Soft Delete บทความ
- Comment system
- Edit บทความ (HTML → Markdown)

### ⚡ Nice to Have (ถ้าเวลาเหลือ)
- Follow คนอื่น
- Search
- Notification
- Paywall / Member

---

## 🛠 Tech Stack ที่ใช้

| ส่วน | เทคโนโลยี | เหตุผล |
|------|-----------|--------|
| Framework | Next.js 16+ App Router | Full-stack, SSR, API Routes, Server Components |
| Database | PostgreSQL + Prisma | Production-ready, type-safe ORM |
| Auth | JWT (jose + bcryptjs) | Edge-compatible, รองรับ Middleware |
| Editor | @uiw/react-md-editor + marked | Markdown editor + HTML conversion |
| Styling | Tailwind CSS | Utility-first, responsive, design tokens |
| Deploy | Vercel | Serverless deployment, easy CI/CD |

---

## 📌 สรุปลำดับการทำ

### [วันที่ 1 — Foundation](DAY_1.md)
1. Setup Next.js 16 + Prisma + PostgreSQL
2. Database schema (DBML + Prisma)
3. API: GET /api/articles (feed with pagination)
4. หน้า Feed แสดงบทความ
5. Header component

### [วันที่ 2 — Authentication](DAY_2.md)
1. JWT Auth with jose (Edge-compatible)
2. Register / Login API
3. Middleware for route protection
4. Edit Profile + Change Password API
5. Profile UI with auth state

### [วันที่ 3 — Editor & Content](Day_3.md)
1. Markdown Editor (@uiw/react-md-editor)
2. API: POST /api/articles (Create)
3. API: GET /api/categories
4. Draft / Publish workflow
5. Popular Articles & Recommended Topics sidebar
6. Public Profile page

### [วันที่ 4 — Advanced Features](Day_4.md)
1. Soft Delete articles
2. Update Article (HTML → Markdown with turndown)
3. Edit Article Page
4. Like Article system
5. Comment system
6. Git & GitHub workflow  

---

## 💡 Tips การเรียนรู้

- **เริ่มจากเล็กไปใหญ่** — ทำให้แต่ละ step ทำงานได้ก่อนค่อยไปขั้นถัดไป
- **ใช้ TypeScript** — ช่วยลด bug และเข้าใจโครงสร้างข้อมูล
- **อ่าน error message** — Prisma และ Next.js มักบอกสาเหตุชัดเจน
- **Commit บ่อยๆ** — แบ่ง commit ตาม step เพื่อ rollback ง่าย
- **Hydration error** — ดู [DAY_1.md#hydration](DAY_1.md#-hydration-error--วิธีแก้) และ [DAY_2.md#hydration](DAY_2.md#-hydration-error--สรุปวิธีแก้): ใช้ `mounted` state, `dynamic(ssr: false)`, `suppressHydrationWarning`

---

*เมื่อพร้อมแล้ว ค่อยเริ่มสร้างโปรเจกต์ตามคู่มือนี้ได้เลยครับ*

[ตารางสรุปการทำงาน](https://docs.google.com/spreadsheets/d/16LxuNjHf3cL8XkVwCs1K2hIcP8EBtaMDzKXBq4Cs3RQ/edit?usp=sharing)