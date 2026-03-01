# 📅 วันที่ 2 — Features + Deploy

เป้าหมายวันนี้: Register API, Login API, Editor, Profile, และ Deploy

> 📖 [กลับไปหน้าหลัก](LEARNING_GUIDE.md)

---

## Step 2.1 — Register API และเชื่อมต่อ Form

### ทำอะไร

- สร้าง API `POST /api/auth/register` สำหรับสมัครสมาชิก
- Hash รหัสผ่านด้วย bcrypt ก่อนเก็บในฐานข้อมูล
- เชื่อม RegisterForm กับ API
- แสดง error และ loading state

### อธิบาย

- **Register API** — รับ `name`, `email`, `password`, `username` (optional) — ถ้าไม่ส่ง username จะสร้างจากส่วนก่อน @ ของ email
- **Validation** — ตรวจสอบ email format, ความยาวรหัสผ่าน (อย่างน้อย 8 ตัวอักษร), username format (a-z, 0-9, _ เท่านั้น)
- **bcrypt** — ใช้ `bcryptjs` hash รหัสผ่านก่อน `prisma.user.create`
- **Form** — เรียก `axios.post("/api/auth/register", { ... })` เมื่อกด Create account, redirect ไป `/login?registered=1` (หรือ `/login?registered=1&redirect=<path>` ถ้ามี redirect param จาก Step 2.4)

### Backend

1. ติดตั้ง `bcryptjs` และ `@types/bcryptjs`
2. สร้าง `app/api/auth/register/route.ts` — POST handler
3. Validate input, ตรวจสอบ email/username ซ้ำ, hash password, สร้าง user
4. Return `{ user: { id, name, email, username, createdAt } }` (ไม่ส่ง password)

### Frontend

1. อัปเดต `RegisterForm.tsx` — เพิ่มช่อง Username (optional), ใช้ axios สำหรับเรียก API
2. `handleSubmit` — เรียก `axios.post`, แสดง error จาก `err.response.data.error` ถ้า fail, redirect ไป login ถ้าสำเร็จ
3. แสดง loading state บนปุ่ม Create account

### Code

`**app/api/auth/register/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const MIN_PASSWORD_LENGTH = 8;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

function slugFromUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, username: rawUsername } = body;

    const nameStr = typeof name === "string" ? name.trim() : "";
    const emailStr = typeof email === "string" ? email.trim().toLowerCase() : "";
    const passwordStr = typeof password === "string" ? password : "";
    let username = rawUsername
      ? slugFromUsername(String(rawUsername))
      : slugFromUsername(emailStr.split("@")[0] || "user");
    if (!username) username = "user" + Date.now().toString(36);

    if (!nameStr) {
      return NextResponse.json(
        { error: "Full name is required" },
        { status: 400 }
      );
    }

    if (!emailStr) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailStr)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (!passwordStr || passwordStr.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (!USERNAME_PATTERN.test(username) || username.length < 2) {
      return NextResponse.json(
        { error: "Username must be 2+ characters, letters, numbers, underscores only" },
        { status: 400 }
      );
    }

    const [existingEmail, existingUsername] = await Promise.all([
      prisma.user.findUnique({ where: { email: emailStr } }),
      prisma.user.findUnique({ where: { username } }),
    ]);

    if (existingEmail) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    if (existingUsername) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(passwordStr, 10);

    const user = await prisma.user.create({
      data: {
        name: nameStr,
        email: emailStr,
        username,
        password: hashedPassword,
        statusId: 1,
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("POST /api/auth/register error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}

```

`**app/(auth)/register/RegisterForm.tsx`** — เชื่อม API (ใช้ axios) + redirect (Step 2.4)

```tsx
"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type RegisterFormProps = { redirectTo?: string };

export default function RegisterForm({ redirectTo = "/" }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = (formData.get("name") as string)?.trim() ?? "";
    const username = (formData.get("username") as string)?.trim() ?? "";
    const email = (formData.get("email") as string)?.trim() ?? "";
    const password = (formData.get("password") as string) ?? "";

    if (!name || !email || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post("/api/auth/register", {
        name,
        username: username || undefined,
        email,
        password,
      });
      const loginUrl =
        redirectTo === "/"
          ? "/login?registered=1"
          : `/login?registered=1&redirect=${encodeURIComponent(redirectTo)}`;
      router.push(loginUrl);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-[13px] font-medium text-text-1">
          Full Name
        </label>
        <input
          id="name"
          type="text"
          name="name"
          placeholder="Your name"
          className="h-10 w-full px-3 border border-border rounded text-[15px] text-text-1 placeholder:text-text-3 bg-white focus:outline-none focus:border-primary"
          autoComplete="name"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-[13px] font-medium text-text-1">
          Username <span className="text-text-3 font-normal">(optional)</span>
        </label>
        <input
          id="username"
          type="text"
          name="username"
          placeholder="johndoe"
          className="h-10 w-full px-3 border border-border rounded text-[15px] text-text-1 placeholder:text-text-3 bg-white focus:outline-none focus:border-primary"
          autoComplete="username"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-[13px] font-medium text-text-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          name="email"
          placeholder="you@example.com"
          className="h-10 w-full px-3 border border-border rounded text-[15px] text-text-1 placeholder:text-text-3 bg-white focus:outline-none focus:border-primary"
          autoComplete="email"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-[13px] font-medium text-text-1">
          Password
        </label>
        <div className="flex h-10 w-full items-center justify-between gap-2 rounded border border-border bg-white px-3 focus-within:border-primary focus-within:outline-none focus-within:ring-1 focus-within:ring-primary">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="••••••••"
            className="flex-1 min-w-0 bg-transparent text-[15px] text-text-1 placeholder:text-text-3 focus:outline-none"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="text-[13px] text-text-2 hover:text-text-1 shrink-0"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="h-11 w-full rounded-full bg-primary text-white font-medium text-base hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-sm text-text-2">
        Already have an account?{" "}
        <Link
          href={
            redirectTo === "/"
              ? "/login"
              : `/login?redirect=${encodeURIComponent(redirectTo)}`
          }
          className="font-semibold text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

```

หน้า `register/page.tsx` ต้องอ่าน `redirect` จาก `searchParams` validate path แล้วส่ง `redirectTo` ให้ `RegisterForm` — ดู Step 2.4

### คำสั่งที่ต้องรัน


| ลำดับ | คำสั่ง                           | ทำอะไร                                                        |
| ----- | -------------------------------- | ------------------------------------------------------------- |
| 1     | `npm install bcryptjs axios`     | ติดตั้ง bcrypt สำหรับ hash รหัสผ่าน และ axios สำหรับเรียก API |
| 2     | `npm install -D @types/bcryptjs` | TypeScript types สำหรับ bcryptjs                              |


---

## Step 2.2 — Login API และเชื่อมต่อ Form

### ทำอะไร

- สร้าง API `POST /api/auth/login` สำหรับเข้าสู่ระบบ
- ตรวจสอบรหัสผ่านด้วย bcrypt และสร้าง session (JWT ใน cookie)
- เชื่อม LoginForm กับ API
- แสดง error และ loading state
- เชื่อม Header ให้แสดงสถานะ login (Write, Profile, Log out) เมื่อเข้าสู่ระบบแล้ว

### อธิบาย

- **Login API** — รับ `email`, `password` — ตรวจสอบกับฐานข้อมูล ถ้าถูกต้องสร้าง session และ set cookie
- **Session** — ใช้ `jose` สร้าง JWT เก็บใน httpOnly cookie ชื่อ `session` อายุ 7 วัน
- **Validation** — ตรวจสอบ email และ password ไม่ว่าง, ถ้า email/password ไม่ถูกต้อง return 401 พร้อม `{ error: "Invalid email or password" }`
- **Form** — เรียก `axios.post("/api/auth/login", { email, password })` เมื่อกด Sign in, redirect ไป `/` (หรือ path จาก `redirect` param เมื่อมี Step 2.4) เมื่อสำเร็จ
- **Header** — Layout ดึง session จาก cookie ส่งให้ Header แสดง Write, Profile avatar (ตัวอักษรแรกของชื่อ), Log out เมื่อ login แล้ว

### Backend

1. ติดตั้ง `jose` สำหรับ JWT
2. สร้าง `lib/auth.ts` — ฟังก์ชัน `createSession`, `getSession`, `setSessionCookie`, `clearSessionCookie`
3. สร้าง `app/api/auth/login/route.ts` — POST handler รับ email/password, ตรวจสอบด้วย bcrypt.compare, สร้าง session, set cookie, return `{ user: { id, name, email, username } }`
4. สร้าง `app/api/auth/session/route.ts` — GET handler อ่าน session จาก cookie return `{ user }` หรือ `{ user: null }`
5. สร้าง `app/api/auth/logout/route.ts` — POST handler ลบ session cookie

### Frontend

1. อัปเดต `LoginForm.tsx` — ใช้ axios เรียก `POST /api/auth/login`, แสดง error จาก `err.response.data.error`, แสดง loading state บนปุ่ม Sign in, redirect ไป `/` (หรือ `redirectTo` จาก Step 2.4) และ `router.refresh()` เมื่อสำเร็จ
2. อัปเดต `app/layout.tsx` — เรียก `getSession()` ส่ง `user` ให้ Header
3. อัปเดต `Header.tsx` — รับ prop `user`, แสดง Write + Profile avatar + Log out เมื่อ `user` มีค่า, ปุ่ม Log out เรียก `POST /api/auth/logout` แล้ว `router.refresh()`

### Code

`**lib/auth.ts`** — Session helpers (JWT + cookie)

```ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.CRYPTO_SECRET || "dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  username: string;
  exp: number;
};

export async function createSession(payload: Omit<SessionPayload, "exp">): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  return new SignJWT({ ...payload, exp: expires })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

```

`**app/api/auth/login/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, setSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const emailStr = typeof email === "string" ? email.trim().toLowerCase() : "";
    const passwordStr = typeof password === "string" ? password : "";

    if (!emailStr) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!passwordStr) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: emailStr, statusId: 1 },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(passwordStr, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = await createSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json(
      { error: "Failed to sign in" },
      { status: 500 }
    );
  }
}
```

`**app/(auth)/login/LoginForm.tsx`** — เชื่อม API + redirect (Step 2.4)

```tsx
"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginFormProps = { redirectTo?: string };

export default function LoginForm({ redirectTo = "/" }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const email = (formData.get("email") as string)?.trim() ?? "";
    const password = (formData.get("password") as string) ?? "";

    if (!email || !password) {
      setError("Please fill in email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post("/api/auth/login", { email, password });
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-[13px] font-medium text-text-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          name="email"
          placeholder="you@example.com"
          className="h-10 w-full px-3 border border-border rounded text-[15px] text-text-1 placeholder:text-text-3 bg-white focus:outline-none focus:border-primary"
          autoComplete="email"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-[13px] font-medium text-text-1">
          Password
        </label>
        <div className="flex h-10 w-full items-center justify-between gap-2 rounded border border-border bg-white px-3 focus-within:border-primary focus-within:outline-none focus-within:ring-1 focus-within:ring-primary">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="••••••••"
            className="flex-1 min-w-0 bg-transparent text-[15px] text-text-1 placeholder:text-text-3 focus:outline-none"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="text-[13px] text-text-2 hover:text-text-1 shrink-0"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="h-11 w-full rounded-full bg-primary text-white font-medium text-base hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-text-2">
        No account?{" "}
        <Link
          href={
            redirectTo === "/"
              ? "/register"
              : `/register?redirect=${encodeURIComponent(redirectTo)}`
          }
          className="font-semibold text-primary hover:underline"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}
```

หน้า `login/page.tsx` ต้องอ่าน `redirect` จาก `searchParams` validate path แล้วส่ง `redirectTo` ให้ `LoginForm` — ดู Step 2.4

`**app/components/Header.tsx`** — เชื่อม API

```tsx
"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type HeaderProps = {
  user: { id: string; name: string } | null;
};

export default function Header({ user }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isLoggedIn = !!user;

  const router = useRouter();

  async function handleLogout() {
    try {
      await axios.post("/api/auth/logout");
      router.push("/");
      router.refresh();
    } catch {
      router.refresh();
    }
  }

  return (
    <header className="relative h-[57px] flex items-center justify-between px-4 sm:px-6 lg:px-11 border-b border-border bg-bg">
      <Link
        href="/"
        className="font-logo text-2xl font-bold text-text-1 hover:text-primary transition-colors"
      >
        Medium
      </Link>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-4">
        {isLoggedIn ? (
          <>
            <Link
              href="/write"
              className="text-text-2 hover:text-text-1 text-sm"
            >
              Write
            </Link>
            <Link
              href="/profile"
              className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-medium text-sm"
              aria-label="Profile"
            >
              {user.name.charAt(0).toUpperCase()}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="text-text-2 hover:text-text-1 text-sm"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="text-text-2 hover:text-text-1 text-sm"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="text-text-2 hover:text-text-1 text-sm"
            >
              Register
            </Link>
          </>
        )}
      </nav>

      {/* Mobile: hamburger + condensed nav */}
      <div className="flex md:hidden items-center gap-2">
        <button
          type="button"
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="p-2 -mr-2 text-text-1"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {mobileMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div
          className="absolute top-[57px] left-0 right-0 bg-bg border-b border-border shadow-md md:hidden z-10"
          role="dialog"
          aria-label="Mobile menu"
        >
          <nav className="flex flex-col p-4 gap-2">
            {isLoggedIn ? (
              <>
                <Link
                  href="/write"
                  className="py-2 text-text-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Write
                </Link>
                <Link
                  href="/profile"
                  className="py-2 text-text-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="py-2 text-text-1 text-left w-full"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="py-2 text-text-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="py-2 text-text-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
```

### คำสั่งที่ต้องรัน


| ลำดับ | คำสั่ง             | ทำอะไร                          |
| ----- | ------------------ | ------------------------------- |
| 1     | `npm install jose` | ติดตั้ง jose สำหรับ JWT session |


### ตัวแปร environment (แนะนำ)

- `AUTH_SECRET` หรือ `CRYPTO_SECRET` — ใช้สำหรับ sign JWT (production ควรตั้งค่าให้ปลอดภัย)

---

## Step 2.3 — Edit Profile API และเชื่อมต่อ Form

### ทำอะไร

- เพิ่มฟิลด์ `bio` ใน User model
- สร้าง API `GET /api/profile` สำหรับดึงข้อมูลโปรไฟล์ของผู้ใช้ที่ล็อกอิน
- สร้าง API `PATCH /api/profile` สำหรับแก้ไข name, username, bio
- สร้าง API `PATCH /api/profile/password` สำหรับเปลี่ยนรหัสผ่าน
- เชื่อม Edit Profile page กับ API
- แสดง error, success และ loading state

### อธิบาย

- **GET /api/profile** — ต้องล็อกอิน ใช้ session ตรวจสอบ identity แล้วดึงข้อมูล user จาก DB (id, name, email, username, bio)
- **PATCH /api/profile** — รับ `name`, `username` (optional), `bio` (optional) — validate username format (a-z, 0-9, _), ตรวจสอบ username ซ้ำ (ยกเว้นของตัวเอง), อัปเดต session cookie เมื่อ name/username เปลี่ยน
- **PATCH /api/profile/password** — รับ `currentPassword`, `newPassword` — ตรวจสอบ current password ด้วย bcrypt, hash new password ก่อนบันทึก
- **Edit Profile page** — โหลดข้อมูลจาก GET /api/profile เมื่อ mount, redirect ไป `/login?redirect=/profile/edit` ถ้า 401, กด Save changes เรียก PATCH /api/profile, กด Update password เรียก PATCH /api/profile/password

### Backend

1. เพิ่ม `bio` (optional, String?) ใน Prisma schema และ schema.dbml
2. รัน `npx prisma migrate dev --name add-user-bio`
3. สร้าง `app/api/profile/route.ts` — GET (ดึง profile), PATCH (อัปเดต name, username, bio)
4. สร้าง `app/api/profile/password/route.ts` — PATCH (เปลี่ยนรหัสผ่าน)

### Frontend

1. อัปเดต `app/profile/edit/page.tsx` — ใช้ axios เรียก GET /api/profile ใน useEffect โหลดข้อมูล, แสดง loading state, redirect ถ้า 401
2. ปุ่ม Save changes — เรียก PATCH /api/profile พร้อม name, username, bio, แสดง error/success, loading state
3. ปุ่ม Update password — เรียก PATCH /api/profile/password พร้อม currentPassword, newPassword, ตรวจสอบ confirm password ตรงกันก่อนส่ง, แสดง error/success, loading state

### Code

`**prisma/schema.prisma`** — เพิ่ม bio

```prisma
model User {
  ...
  name      String
  bio       String?       @db.Text
  statusId  Int           @default(1) @map("status_id")
  ...
}
```

`**app/api/profile/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createSession, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const BIO_MAX = 160;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

function slugFromUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId, statusId: 1 },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      bio: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      bio: user.bio ?? "",
    },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, username: rawUsername, bio } = body;

    const nameStr = typeof name === "string" ? name.trim() : "";
    const bioStr = typeof bio === "string" ? bio.trim().slice(0, BIO_MAX) : undefined;
    const username = rawUsername
      ? slugFromUsername(String(rawUsername))
      : undefined;

    if (!nameStr) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (username !== undefined) {
      if (!USERNAME_PATTERN.test(username) || username.length < 2) {
        return NextResponse.json(
          {
            error:
              "Username must be 2+ characters, letters, numbers, underscores only",
          },
          { status: 400 }
        );
      }

      const existingUsername = await prisma.user.findFirst({
        where: {
          username,
          id: { not: session.userId },
        },
      });

      if (existingUsername) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 409 }
        );
      }
    }

    const updateData: { name: string; username?: string; bio?: string } = {
      name: nameStr,
    };
    if (username !== undefined) updateData.username = username;
    if (bioStr !== undefined) updateData.bio = bioStr;

    const user = await prisma.user.update({
      where: { id: session.userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        bio: true,
      },
    });

    const newToken = await createSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
    });
    await setSessionCookie(newToken);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        bio: user.bio ?? "",
      },
    });
  } catch (error) {
    console.error("PATCH /api/profile error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
```

`**app/api/profile/password/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MIN_PASSWORD_LENGTH = 8;

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    const currentStr = typeof currentPassword === "string" ? currentPassword : "";
    const newStr = typeof newPassword === "string" ? newPassword : "";

    if (!currentStr) {
      return NextResponse.json(
        { error: "Current password is required" },
        { status: 400 }
      );
    }

    if (!newStr || newStr.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const valid = await bcrypt.compare(currentStr, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const hashedPassword = await bcrypt.hash(newStr, 10);

    await prisma.user.update({
      where: { id: session.userId },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/profile/password error:", error);
    return NextResponse.json(
      { error: "Failed to update password" },
      { status: 500 }
    );
  }
}
```

`**app/profile/edit/page.tsx`** — เชื่อม API

- ใช้ `useEffect` โหลด profile จาก GET /api/profile
- redirect ไป `/login?redirect=/profile/edit` เมื่อได้ 401
- ปุ่ม Save changes เรียก PATCH /api/profile พร้อม name, username, bio
- ปุ่ม Update password เรียก PATCH /api/profile/password พร้อม currentPassword, newPassword
- แสดง error, success message และ loading state บนปุ่ม

---

### Step 2.3.1 — Change Password

#### ทำอะไร

- สร้างฟอร์มเปลี่ยนรหัสผ่านในหน้า Edit Profile
- รับ current password, new password, confirm password
- เรียก `PATCH /api/profile/password` เมื่อกด Update password

#### อธิบาย

- **ฟิลด์** — Current password (ตรวจสอบกับ DB), New password (อย่างน้อย 8 ตัวอักษร), Confirm password (ต้องตรงกับ new password)
- **Validation** — ตรวจสอบทุกฟิลด์ไม่ว่าง, newPassword === confirmPassword ก่อนส่ง API
- **หลังสำเร็จ** — แสดง success message, เคลียร์ฟิลด์รหัสผ่านทั้ง 3 ช่อง

#### AP File

`**web/app/api/profile/password/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MIN_PASSWORD_LENGTH = 8;

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    const currentStr = typeof currentPassword === "string" ? currentPassword : "";
    const newStr = typeof newPassword === "string" ? newPassword : "";

    if (!currentStr) {
      return NextResponse.json(
        { error: "Current password is required" },
        { status: 400 }
      );
    }

    if (!newStr || newStr.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const valid = await bcrypt.compare(currentStr, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const hashedPassword = await bcrypt.hash(newStr, 10);

    await prisma.user.update({
      where: { id: session.userId },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/profile/password error:", error);
    return NextResponse.json(
      { error: "Failed to update password" },
      { status: 500 }
    );
  }
}
```

web/app/profile/edit/page.tsx

```typescript
"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const BIO_MAX = 160;

const inputBase =
  "h-10 w-full rounded border border-border bg-white px-3 text-text-1 placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-[15px]";

function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder = "••••••••",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[13px] font-medium text-text-1">
        {label}
      </label>
      <div className="flex h-10 w-full items-center justify-between gap-2 rounded border border-border bg-white px-3 text-text-1 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-text-3 focus:outline-none"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="shrink-0 text-text-3 hover:text-text-2 transition-colors"
          aria-label={show ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {show ? (
            <EyeOff className="w-5 h-5" aria-hidden />
          ) : (
            <Eye className="w-5 h-5" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}

export default function EditProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await axios.get("/api/profile");
        const { user } = res.data;
        setName(user.name ?? "");
        setUsername(user.username ?? "");
        setBio(user.bio ?? "");
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          router.push("/login?redirect=/profile/edit");
          return;
        }
        setProfileError("Failed to load profile");
      } finally {
        setIsLoadingProfile(false);
      }
    }
    fetchProfile();
  }, [router]);

  async function handleSaveProfile() {
    setProfileError(null);
    setProfileSuccess(false);
    if (!name.trim()) {
      setProfileError("Name is required");
      return;
    }
    setIsSavingProfile(true);
    try {
      await axios.patch("/api/profile", {
        name: name.trim(),
        username: username.trim() || undefined,
        bio: bio.trim(),
      });
      setProfileSuccess(true);
      router.refresh();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        setProfileError(err.response.data.error);
      } else {
        setProfileError("Failed to update profile");
      }
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleUpdatePassword() {
    setPasswordError(null);
    setPasswordSuccess(false);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match");
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await axios.patch("/api/profile/password", {
        currentPassword,
        newPassword,
      });
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        setPasswordError(err.response.data.error);
      } else {
        setPasswordError("Failed to update password");
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  const bioCount = bio.length;
  const bioOverLimit = bioCount > BIO_MAX;

  if (isLoadingProfile) {
    return (
      <div className="w-full max-w-[500px] mx-auto pt-8 sm:pt-12 pb-12 flex justify-center">
        <p className="text-text-2">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[500px] mx-auto pt-8 sm:pt-12 pb-12 flex flex-col gap-6">
      {/* Profile card — matches epProfileCard */}
      <section
        className="rounded-lg border border-border bg-white px-10 py-12 flex flex-col gap-6"
        aria-labelledby="edit-profile-title"
      >
        <h1
          id="edit-profile-title"
          className="font-logo text-2xl font-semibold text-text-1"
        >
          Edit profile
        </h1>

        {profileError && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded" role="alert">
            {profileError}
          </p>
        )}
        {profileSuccess && (
          <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded" role="status">
            Profile updated successfully.
          </p>
        )}

        {/* Avatar */}
        <div className="flex flex-col items-center sm:items-start gap-3">
          <div
            className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white font-bold text-[28px] shrink-0"
            aria-hidden
          >
            {getInitials(name)}
          </div>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-name" className="text-[13px] font-medium text-text-1">
            Name
          </label>
          <input
            id="edit-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputBase}
            placeholder="Your name"
          />
        </div>

        {/* Username — with @ prefix like design */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="edit-username"
            className="text-[13px] font-medium text-text-1"
          >
            Username
          </label>
          <div className="flex h-10 w-full items-center gap-0.5 rounded border border-border bg-white px-3 text-text-1 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary">
            <span className="text-[15px] text-text-3 shrink-0">@</span>
            <input
              id="edit-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-text-3 focus:outline-none"
              placeholder="username"
            />
          </div>
        </div>

        {/* Bio */}
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-bio" className="text-[13px] font-medium text-text-1">
            Bio
          </label>
          <textarea
            id="edit-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={BIO_MAX}
            rows={4}
            className="min-h-[80px] w-full rounded border border-border bg-white px-3 py-2 text-text-1 placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y text-[14px]"
            placeholder="Tell readers about yourself"
          />
          <p
            className={`text-xs ${bioOverLimit ? "text-like" : "text-text-3"}`}
          >
            {bioCount} / {BIO_MAX}
          </p>
        </div>

        {/* Buttons — gap-3, h-11 → h-[44px] to match design */}
        <div className="flex flex-row gap-3">
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={isSavingProfile}
            className="h-[44px] rounded-full bg-primary px-6 text-white font-medium text-[15px] hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSavingProfile ? "Saving…" : "Save changes"}
          </button>
          <Link
            href="/profile"
            className="h-[44px] rounded-full flex items-center justify-center px-6 text-text-2 text-[15px] hover:text-text-1 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </section>

      {/* Password card — matches epPasswordCard */}
      <section
        className="rounded-lg border border-border bg-white px-10 py-12 flex flex-col gap-6"
        aria-labelledby="change-password-title"
      >
        <h2
          id="change-password-title"
          className="text-sm font-semibold text-text-1"
        >
          Change password
        </h2>

        {passwordError && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded" role="alert">
            {passwordError}
          </p>
        )}
        {passwordSuccess && (
          <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded" role="status">
            Password updated successfully.
          </p>
        )}

        <div className="flex flex-col gap-6">
          <PasswordInput
            id="edit-current-password"
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
          />
          <PasswordInput
            id="edit-new-password"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
          />
          <PasswordInput
            id="edit-confirm-password"
            label="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
        </div>

        <button
          type="button"
          onClick={handleUpdatePassword}
          disabled={isUpdatingPassword}
          className="h-[44px] w-fit rounded-full bg-primary px-6 text-white font-semibold text-[15px] hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isUpdatingPassword ? "Updating…" : "Update password"}
        </button>
      </section>
    </div>
  );
}

```

#### Dependencies

- `lucide-react` — ไอคอน Eye, EyeOff สำหรับปุ่ม show/hide password → `npm install lucide-react`

### คำสั่งที่ต้องรัน


| ลำดับ | คำสั่ง                                       | ทำอะไร                                           |
| ----- | -------------------------------------------- | ------------------------------------------------ |
| 1     | `npx prisma migrate dev --name add-user-bio` | สร้าง migration สำหรับฟิลด์ bio                  |
| 2     | `npm install lucide-react`                   | ไอคอน Eye/EyeOff สำหรับ PasswordInput (optional) |


---

## Step 2.4 — Guard Route (Middleware ป้องกัน route ที่ต้องล็อกอิน)

### ทำอะไร

- สร้าง Next.js middleware สำหรับ guard route ที่ต้องล็อกอิน
- redirect ผู้ใช้ที่ยังไม่ล็อกอินไป `/login?redirect=<path>` เมื่อพยายามเข้า `/write`, `/profile/edit`
- redirect ผู้ใช้ที่ล็อกอินแล้วไป `/` (หรือ `redirect` param) เมื่อพยายามเข้า `/login`, `/register`

### อธิบาย

- **Protected routes** — `/write`, `/profile/edit` ต้องมี session ที่ valid ถ้าไม่มี redirect ไป `/login?redirect=<path>` เพื่อให้หลัง login แล้ว redirect กลับไปหน้าที่ต้องการ
- **Auth routes** — `/login`, `/register` ถ้าผู้ใช้ล็อกอินแล้ว redirect ไป `/` หรือไป path ที่ระบุใน query `redirect`
- **Session verification** — ใช้ `jose` (jwtVerify) ตรวจสอบ JWT ใน cookie ชื่อ `session` เพราะ middleware รันบน Edge Runtime ต้องใช้ library ที่รองรับ Web Crypto API
- **Matcher** — กำหนด `config.matcher` ให้ middleware รันเฉพาะ path ที่เกี่ยวข้อง เพื่อลด overhead

### Backend

1. สร้าง `middleware.ts` ที่ root ของโปรเจกต์ (ระดับเดียวกับ `app/`)
2. ใช้ `jwtVerify` จาก `jose` ตรวจสอบ session cookie
3. กำหนด `PROTECTED_PATHS` และ `AUTH_PATHS` เป็น array
4. ใช้ `NextResponse.redirect()` สำหรับ redirect

### Code

`**middleware.ts`** — Guard route

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "session";

const PROTECTED_PATHS = ["/write", "/profile/edit"];
const AUTH_PATHS = ["/login", "/register"];

function getSecret(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.CRYPTO_SECRET ||
    "dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loggedIn = await hasValidSession(request);

  if (isProtectedPath(pathname) && !loggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPath(pathname) && loggedIn) {
    const redirectTo = request.nextUrl.searchParams.get("redirect") || "/";
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/write/:path*",
    "/profile/edit/:path*",
    "/login",
    "/register",
  ],
};
```

### การทำงาน


| สถานะผู้ใช้ | Path ที่เข้า    | ผลลัพธ์                                    |
| ----------- | --------------- | ------------------------------------------ |
| ไม่ล็อกอิน  | `/write`        | redirect → `/login?redirect=/write`        |
| ไม่ล็อกอิน  | `/profile/edit` | redirect → `/login?redirect=/profile/edit` |
| ล็อกอินแล้ว | `/login`        | redirect → `/` (หรือ `redirect` param)     |
| ล็อกอินแล้ว | `/register`     | redirect → `/`                             |
| ไม่ล็อกอิน  | `/login`        | ผ่าน (แสดงหน้า login)                      |
| ล็อกอินแล้ว | `/write`        | ผ่าน (แสดงหน้า write)                      |


### คำสั่งที่ต้องรัน

ไม่ต้องติดตั้ง package เพิ่ม — ใช้ `jose` ที่มีอยู่แล้วจาก Step 2.2

### Frontend (เชื่อม redirect กับ Login, Register, Edit Profile)

**Login**

`**app/(auth)/login/page.tsx`** — อ่าน redirect จาก searchParams, validate path

```tsx
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; redirect?: string }>;
}) {
  const params = await searchParams;
  const showRegistered = params.registered === "1";
  const rawRedirect = params.redirect ?? "/";
  const redirectTo =
    typeof rawRedirect === "string" && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/";

  return (
    // ...
    <LoginForm redirectTo={redirectTo} />
  );
}
```

`**app/(auth)/login/LoginForm.tsx`** — รับ `redirectTo`, หลัง login สำเร็จ redirect ไป path นั้น, ลิงก์ "Create one" ส่ง redirect ต่อ

```tsx
type LoginFormProps = { redirectTo?: string };

export default function LoginForm({ redirectTo = "/" }: LoginFormProps) {
  // ...
  router.push(redirectTo);  // แทน router.push("/")
  // ...
  <Link
    href={
      redirectTo === "/"
        ? "/register"
        : `/register?redirect=${encodeURIComponent(redirectTo)}`
    }
  >
    Create one
  </Link>
}
```

**Register**

`**app/(auth)/register/page.tsx`** — อ่าน redirect จาก searchParams, validate ด้วย safeRedirect

```tsx
function safeRedirect(path: string | undefined): string {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }
  return path;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = safeRedirect(params.redirect);

  return (
    // ...
    <RegisterForm redirectTo={redirectTo} />
  );
}
```

`**app/(auth)/register/RegisterForm.tsx`** — รับ `redirectTo`, หลังสมัครสำเร็จ redirect ไป login พร้อม redirect param, ลิงก์ "Sign in" ส่ง redirect ต่อ

```tsx
type RegisterFormProps = { redirectTo?: string };

export default function RegisterForm({ redirectTo = "/" }: RegisterFormProps) {
  // ...
  const loginUrl =
    redirectTo === "/"
      ? "/login?registered=1"
      : `/login?registered=1&redirect=${encodeURIComponent(redirectTo)}`;
  router.push(loginUrl);
  // ...
  <Link
    href={
      redirectTo === "/"
        ? "/login"
        : `/login?redirect=${encodeURIComponent(redirectTo)}`
    }
  >
    Sign in
  </Link>
}
```

**Edit Profile**

`**app/profile/edit/page.tsx`** — เมื่อ GET /api/profile ได้ 401 redirect ไป login พร้อม redirect

```tsx
useEffect(() => {
  async function fetchProfile() {
    try {
      const res = await axios.get("/api/profile");
      // ...
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        router.push("/login?redirect=/profile/edit");
        return;
      }
      setProfileError("Failed to load profile");
    } finally {
      setIsLoadingProfile(false);
    }
  }
  fetchProfile();
}, [router]);
```

### Flow การ redirect ข้ามหน้า


| ขั้นตอน                               | ผลลัพธ์                                      |
| ------------------------------------- | -------------------------------------------- |
| เข้า `/write` โดยไม่ล็อกอิน           | Middleware → `/login?redirect=/write`        |
| กด "Create one" บนหน้า login          | ไป `/register?redirect=/write`               |
| สมัครสำเร็จ                           | ไป `/login?registered=1&redirect=/write`     |
| Login สำเร็จ                          | ไป `/write`                                  |
| กด "Sign in" บนหน้า register          | ไป `/login?redirect=/write`                  |
| เข้า `/profile/edit` โดยไม่ล็อกอิน    | Middleware → `/login?redirect=/profile/edit` |
| API profile ได้ 401 (session หมดอายุ) | redirect → `/login?redirect=/profile/edit`   |


### หมายเหตุ

- Middleware รันบน **Edge Runtime** — ใช้ `jose` แทน `jsonwebtoken` เพราะ Edge ไม่รองรับ Node.js crypto

