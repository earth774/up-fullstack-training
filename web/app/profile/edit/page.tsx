"use client";

import Link from "next/link";
import { useState } from "react";
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

// Mock data for UI — TODO: wire to API/auth
const MOCK_PROFILE = {
  name: "Sarah Chen",
  username: "sarahchen",
  bio: "Staff writer. I cover technology, culture, and the messy places where they meet. Based in San Francisco. Previously at Wired.",
};

export default function EditProfilePage() {
  const [name, setName] = useState(MOCK_PROFILE.name);
  const [username, setUsername] = useState(MOCK_PROFILE.username);
  const [bio, setBio] = useState(MOCK_PROFILE.bio);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const bioCount = bio.length;
  const bioOverLimit = bioCount > BIO_MAX;

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

        {/* Buttons — gap-3, h-[44px] to match design */}
        <div className="flex flex-row gap-3">
          <button
            type="button"
            className="h-[44px] rounded-full bg-primary px-6 text-white font-medium text-[15px] hover:opacity-90 transition-opacity"
          >
            Save changes
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
          className="h-[44px] w-fit rounded-full bg-primary px-6 text-white font-semibold text-[15px] hover:opacity-90 transition-opacity"
        >
          Update password
        </button>
      </section>
    </div>
  );
}