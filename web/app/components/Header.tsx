"use client";

import Link from "next/link";
import { useState } from "react";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isLoggedIn = false; // TODO: wire to auth

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
              A
            </Link>
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