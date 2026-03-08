# Day 4: Soft Delete Article

## 4.1 Implementation

### API - DELETE /api/articles/[id]

**File:** `web/app/api/articles/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { marked } from "marked";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/articles/[id]
 * Soft delete article by changing statusId from 1 (published) to 3 (deleted)
 * Only the article owner can delete their own article
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const session = await getSession();

    // Check authentication
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find article and verify ownership
    const article = await prisma.article.findUnique({
      where: { id },
      select: { id: true, authorId: true, statusId: true },
    });

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Verify the current user is the author
    if (article.authorId !== session.userId) {
      return NextResponse.json(
        { error: "Forbidden: You can only delete your own articles" },
        { status: 403 }
      );
    }

    // Check if article is already deleted
    if (article.statusId === 3) {
      return NextResponse.json(
        { error: "Article is already deleted" },
        { status: 400 }
      );
    }

    // Soft delete: update statusId to 3 (deleted)
    await prisma.article.update({
      where: { id },
      data: { statusId: 3 },
    });

    return NextResponse.json({
      success: true,
      message: "Article deleted successfully",
      articleId: id,
    });
  } catch (error) {
    console.error("DELETE /api/articles/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete article" },
      { status: 500 }
    );
  }
}

```

### UI - DeleteArticleButton

**File:** `web/app/articles/[id]/DeleteArticleButton.tsx`

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

interface DeleteArticleButtonProps {
  articleId: string;
}

export function DeleteArticleButton({ articleId }: DeleteArticleButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/articles/${articleId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete article");
      }

      // Redirect to home page after successful deletion
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Failed to delete article:", error);
      alert(error instanceof Error ? error.message : "Failed to delete article");
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-600 font-medium">
          Delete this article?
        </span>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {isDeleting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Deleting...
            </>
          ) : (
            "Yes, Delete"
          )}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isDeleting}
          className="px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="flex items-center gap-1.5 text-red-600 text-sm font-medium hover:text-red-700 transition-colors"
    >
      <Trash2 className="w-4 h-4" />
      Delete
    </button>
  );
}

```

### Article Detail Page

**File:** `web/app/articles/[id]/page.tsx`

```typescript
import { notFound } from "next/navigation";
import Link from "next/link";
import { Heart, Share2, FilePen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CommentSection } from "./CommentSection";
import { DeleteArticleButton } from "./DeleteArticleButton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getReadTime(content: string): number {
  const text = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const words = text.trim().split(" ").filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  const currentUserId = session?.userId;

  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true } },
      categories: {
        where: { statusId: 1 },
        include: { category: { select: { id: true, name: true } } },
      },
      _count: { select: { likes: true } },
    },
  });

  if (!article) notFound();

  const isDraft = article.statusId === 2;
  const isOwner = currentUserId === article.author.id;

  // Draft articles are only accessible by the owner
  if (isDraft && !isOwner) {
    notFound();
  }

  const readTime = getReadTime(article.content);
  const initials = getInitials(article.author.name);
  const plainContent = article.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const excerpt = plainContent.slice(0, 200);
  const dateStr = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(article.createdAt);

  return (
    <article className={`max-w-[680px] mx-auto pt-12 pb-12 flex flex-col gap-6 ${isDraft ? "relative" : ""}`}>
      {isDraft && (
        <div className="absolute -top-2 left-0 right-0 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
            <FilePen className="w-4 h-4" />
            Draft — Only visible to you
          </span>
        </div>
      )}
      {/* Title */}
      <h1 className="font-logo text-[42px] font-bold leading-[1.2] text-text-1">
        {article.title}
      </h1>

      {/* Subtitle - from article or excerpt from content */}
      {(article.subtitle || excerpt) && (
        <p className="font-logo text-2xl font-semibold leading-[1.4] text-text-2">
          {article.subtitle ?? `${excerpt}${plainContent.length > 200 ? "…" : ""}`}
        </p>
      )}

      {/* Category chips */}
      {article.categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {article.categories.map((ac) => (
            <span
              key={ac.category.id}
              className="inline-flex items-center px-3.5 py-1.5 rounded-full text-[13px] font-medium text-text-1 bg-surface border border-border"
            >
              {ac.category.name}
            </span>
          ))}
        </div>
      )}

      {/* Author bar */}
      <div className="flex items-center gap-3">
        <Link
          href={`/profile/${article.author.id}`}
          className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-[15px] shrink-0"
        >
          {initials}
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${article.author.id}`}
            className="text-base font-semibold text-text-1 hover:text-primary transition-colors block"
          >
            {article.author.name}
          </Link>
          <p className="text-[13px] text-text-2">
            {dateStr} · {readTime} min read
          </p>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-full border border-primary text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
        >
          Follow
        </button>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-5 py-3 border-y border-border">
        <span className={`flex items-center gap-1.5 text-[15px] ${article._count.likes > 0 ? "text-like" : "text-text-2"}`}>
          <Heart
            className="size-[15px]"
            strokeWidth={2}
            fill={article._count.likes > 0 ? "currentColor" : "none"}
          />
          {article._count.likes}
        </span>
        <div className="flex-1" />
        {/* Delete button - only visible to article owner */}
        {isOwner && (
          <DeleteArticleButton articleId={article.id} />
        )}
        <span className="flex items-center gap-1.5 text-sm text-text-2">
          <Share2 className="size-[14px]" strokeWidth={2} />
          Share
        </span>
      </div>

      {/* Body content */}
      <div
        className="prose prose-neutral max-w-none text-text-1
          /* Headings */
          [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4
          [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3
          [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2
          /* Paragraphs */
          [&_p]:text-lg [&_p]:leading-[1.8] [&_p]:mb-4
          /* Lists */
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4
          [&_li]:mb-1
          /* Code */
          [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono
          [&_pre]:bg-surface [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:mb-4
          [&_pre_code]:bg-transparent [&_pre_code]:p-0
          /* Blockquotes */
          [&_blockquote]:border-l-4 [&_blockquote]:border-text-1 [&_blockquote]:pl-4 [&_blockquote]:font-logo [&_blockquote]:text-xl [&_blockquote]:font-semibold [&_blockquote]:leading-normal [&_blockquote]:not-italic [&_blockquote]:mb-4
          /* Links */
          [&_a]:text-primary [&_a]:underline [&_a]:hover:opacity-80
          /* Images */
          [&_img]:rounded-lg [&_img]:max-w-full [&_img]:my-4
          /* Horizontal rule */
          [&_hr]:my-8 [&_hr]:border-border
          /* Bold and Italic */
          [&_strong]:font-bold
          [&_em]:italic"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Bottom author card */}
      <div className="flex gap-6 pt-6">
        <Link
          href={`/profile/${article.author.id}`}
          className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white font-bold text-[28px] shrink-0"
        >
          {initials}
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${article.author.id}`}
            className="text-xl font-semibold text-text-1 hover:text-primary transition-colors block"
          >
            {article.author.name}
          </Link>
          <p className="text-[15px] text-text-2 leading-[1.6] mt-2">
            Staff writer. Writing about technology and human experience.
          </p>
          <button
            type="button"
            className="mt-2 px-4 py-2 rounded-full border border-primary text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
          >
            Follow
          </button>
        </div>
      </div>

      <CommentSection />
    </article>
  );
}

```

### Profile Page - ProfileArticleCard

**File:** `web/app/profile/ProfileArticleCard.tsx`

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Pencil, Trash2, Loader2 } from "lucide-react";

type ProfileArticleCardProps = {
  id: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readTimeMinutes: number;
  likeCount: number;
  onDelete?: (id: string) => Promise<void>;
};

export default function ProfileArticleCard({
  id,
  title,
  excerpt,
  publishedAt,
  readTimeMinutes,
  likeCount,
  onDelete,
}: ProfileArticleCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(id);
    } catch {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <article className="border-b border-border py-6">
      <div className="flex flex-col gap-3">
        <Link href={`/articles/${id}`} className="block group">
          <h2 className="text-xl font-semibold text-text-1 group-hover:text-primary transition-colors line-clamp-2">
            {title}
          </h2>
        </Link>
        <p className="text-sm text-text-2 line-clamp-2">{excerpt}</p>
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-text-2">
          <span>{publishedAt}</span>
          <span>{readTimeMinutes} min read</span>
          <span
            className={`flex items-center gap-1 ${likeCount > 0 ? "text-like" : ""}`}
          >
            <Heart
              className="w-3.5 h-3.5"
              strokeWidth={2}
              fill={likeCount > 0 ? "currentColor" : "none"}
            />
            {likeCount}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            className="rounded border border-border px-3 py-1.5 text-sm text-text-1 hover:bg-surface transition-colors flex items-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
            Edit
          </button>

          {showConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600">Delete?</span>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    ...
                  </>
                ) : (
                  "Yes"
                )}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="rounded border border-border px-3 py-1.5 text-sm text-text-1 hover:bg-surface transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

```

### Profile Page

**File:** `web/app/profile/page.tsx`

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import ProfileHeader from "./ProfileHeader";
import ProfileTabs from "./ProfileTabs";
import ProfileArticleCard from "./ProfileArticleCard";
import { FilePen } from "lucide-react";

type Article = {
  id: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readTimeMinutes: number;
  likeCount: number;
  statusId: number;
};

type ProfileData = {
  user: {
    id: string;
    name: string;
    username: string | null;
    bio: string;
    followersCount: string;
    followingCount: string;
    isOwnProfile: boolean;
  };
  articles: Article[];
};

async function deleteArticle(id: string): Promise<void> {
  const response = await fetch(`/api/articles/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to delete article");
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"home" | "about">("home");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setIsLoading(true);
        // First, get current user session
        const sessionRes = await axios.get("/api/profile");
        const userId = sessionRes.data.user.id;

        // Then, fetch public profile data
        const profileRes = await axios.get<ProfileData>(`/api/users/${userId}`);
        setProfile(profileRes.data);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          router.push("/login?redirect=/profile");
          return;
        }
        setError("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [router]);

  // All hooks must be before early returns
  const handleDelete = useCallback(async (id: string) => {
    await deleteArticle(id);
    setProfile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        articles: prev.articles.filter((a) => a.id !== id),
      };
    });
  }, []);

  if (isLoading) {
    return (
      <div className="w-full max-w-[728px] mx-auto pt-12 pb-12">
        <p className="text-text-2">Loading profile…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="w-full max-w-[728px] mx-auto pt-12 pb-12">
        <p className="text-red-600">{error || "Failed to load profile"}</p>
      </div>
    );
  }

  const { user, articles } = profile;

  return (
    <div className="w-full max-w-[728px] mx-auto pt-12 pb-12 flex flex-col gap-8">
      <ProfileHeader
        name={user.name}
        bio={user.bio}
        followersCount={user.followersCount}
        followingCount={user.followingCount}
      />

      <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "home" && (
        <div className="flex flex-col">
          {articles.length === 0 ? (
            <p className="py-12 text-center text-text-2">No articles yet.</p>
          ) : (
            articles.map((article) => (
              <div key={article.id} className="relative">
                {article.statusId === 2 && (
                  <div className="absolute -top-2 left-0">
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                      <FilePen className="w-3 h-3" />
                      Draft
                    </span>
                  </div>
                )}
                <div className={article.statusId === 2 ? "pt-4" : ""}>
                  <ProfileArticleCard
                    id={article.id}
                    title={article.title}
                    excerpt={article.excerpt}
                    publishedAt={article.publishedAt}
                    readTimeMinutes={article.readTimeMinutes}
                    likeCount={article.likeCount}
                    onDelete={handleDelete}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "about" && (
        <div className="py-8">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-text-1">About</h2>
            <p className="text-text-2">
              {user.bio || "No bio yet."}
            </p>
            {user.username && (
              <p className="text-text-2">
                <span className="font-medium">Username:</span> @{user.username}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

```

### Files Changed


| File                                            | Type     |
| ----------------------------------------------- | -------- |
| `web/app/api/articles/[id]/route.ts`            | New      |
| `web/app/articles/[id]/DeleteArticleButton.tsx` | New      |
| `web/app/articles/[id]/page.tsx`                | Modified |
| `web/app/profile/ProfileArticleCard.tsx`        | Modified |
| `web/app/profile/page.tsx`                      | Modified |


## 4.2 Update Article

### Libraries Installed


| Package           | Version | Purpose                                                       |
| ----------------- | ------- | ------------------------------------------------------------- |
| `turndown`        | ^7.2.0  | Convert HTML content from database to Markdown for the editor |
| `@types/turndown` | ^7.2.0  | TypeScript type definitions for turndown                      |


**Why we need these:**

- `**turndown`**: Article content is stored as HTML in the database (converted from Markdown via `marked` when writing). To edit existing articles, we need to convert HTML back to Markdown so the MarkdownEditor can display and edit it properly.
- `**marked`**: Already installed (from POST /api/articles), used in PATCH to convert updated Markdown content back to HTML before saving.

```bash
npm install turndown
npm install -D @types/turndown
```

### API - PATCH /api/articles/[id]

**File:** `web/app/api/articles/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { marked } from "marked";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/articles/[id]
 * Get article by ID
 * - Owner can see all statuses (published, draft, deleted)
 * - Others can only see published articles
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const session = await getSession();

    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true } },
        categories: {
          where: { statusId: 1 },
          include: { category: { select: { id: true, name: true } } },
        },
        _count: { select: { likes: true } },
      },
    });

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    const isOwner = session?.userId === article.authorId;

    // Non-owners can only see published articles
    if (!isOwner && article.statusId !== 1) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(article);
  } catch (error) {
    console.error("GET /api/articles/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch article" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/articles/[id]
 * Update article (title, subtitle, content, statusId)
 * Only the article owner can update their own article
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const session = await getSession();

    // Check authentication
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find article and verify ownership
    const article = await prisma.article.findUnique({
      where: { id },
      select: { id: true, authorId: true, statusId: true },
    });

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Verify the current user is the author
    if (article.authorId !== session.userId) {
      return NextResponse.json(
        { error: "Forbidden: You can only edit your own articles" },
        { status: 403 }
      );
    }

    // Check if article is deleted
    if (article.statusId === 3) {
      return NextResponse.json(
        { error: "Cannot edit deleted article" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { title, subtitle, content, statusId } = body;

    // Validate required fields if provided
    if (title !== undefined && (!title || title.trim() === "")) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (content !== undefined && (!content || content.trim() === "")) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Validate statusId if provided
    if (statusId !== undefined && ![1, 2].includes(statusId)) {
      return NextResponse.json(
        { error: "Invalid status. Only 1 (published) or 2 (draft) allowed" },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: {
      title?: string;
      subtitle?: string | null;
      content?: string;
      statusId?: number;
    } = {};

    if (title !== undefined) updateData.title = title.trim();
    if (subtitle !== undefined) updateData.subtitle = subtitle.trim() || null;
    if (content !== undefined) {
      // Convert Markdown to HTML before saving
      const htmlContent = marked.parse(content.trim(), { async: false }) as string;
      updateData.content = htmlContent;
    }
    if (statusId !== undefined) updateData.statusId = statusId;

    // Update article
    const updatedArticle = await prisma.article.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, name: true } },
        categories: {
          where: { statusId: 1 },
          include: { category: { select: { id: true, name: true } } },
        },
        _count: { select: { likes: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Article updated successfully",
      article: updatedArticle,
    });
  } catch (error) {
    console.error("PATCH /api/articles/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update article" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/articles/[id]
 * Soft delete article by changing statusId from 1 (published) to 3 (deleted)
 * Only the article owner can delete their own article
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const session = await getSession();

    // Check authentication
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find article and verify ownership
    const article = await prisma.article.findUnique({
      where: { id },
      select: { id: true, authorId: true, statusId: true },
    });

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Verify the current user is the author
    if (article.authorId !== session.userId) {
      return NextResponse.json(
        { error: "Forbidden: You can only delete your own articles" },
        { status: 403 }
      );
    }

    // Check if article is already deleted
    if (article.statusId === 3) {
      return NextResponse.json(
        { error: "Article is already deleted" },
        { status: 400 }
      );
    }

    // Soft delete: update statusId to 3 (deleted)
    await prisma.article.update({
      where: { id },
      data: { statusId: 3 },
    });

    return NextResponse.json({
      success: true,
      message: "Article deleted successfully",
      articleId: id,
    });
  } catch (error) {
    console.error("DELETE /api/articles/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete article" },
      { status: 500 }
    );
  }
}

```

### UI - Edit Article Page

**File:** `web/app/articles/[id]/edit/page.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import TurndownService from "turndown";
import MarkdownEditor from "../../../write/MarkdownEditor";

const MARKDOWN_PLACEHOLDER = `# Write your article in Markdown

**Bold** *Italic* ~~Strikethrough~~ \`inline code\`

## Headings: # H1 ## H2 ### H3

## Lists: - bullet 1. ordered

> Blockquotes | \`\`\` Code blocks \`\`\``;

// Initialize turndown for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

interface EditArticlePageProps {
  params: Promise<{ id: string }>;
}

interface Article {
  id: string;
  title: string;
  subtitle: string | null;
  content: string;
  statusId: number;
  authorId: string;
}

export default function EditArticlePage({ params }: EditArticlePageProps) {
  const router = useRouter();
  const [articleId, setArticleId] = useState<string>("");
  const [article, setArticle] = useState<Article | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [statusId, setStatusId] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve params
  useEffect(() => {
    params.then((p) => setArticleId(p.id));
  }, [params]);

  // Fetch article data
  useEffect(() => {
    if (!articleId) return;

    async function fetchArticle() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/articles/${articleId}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Article not found");
          }
          throw new Error("Failed to load article");
        }

        const data = await response.json();

        // Check if user is the owner
        const sessionRes = await fetch("/api/profile");
        if (!sessionRes.ok) {
          router.push("/login?redirect=/articles/" + articleId + "/edit");
          return;
        }
        const session = await sessionRes.json();

        if (data.authorId !== session.user.id) {
          setError("You can only edit your own articles");
          return;
        }

        setArticle(data);
        setTitle(data.title);
        setSubtitle(data.subtitle || "");
        // Convert HTML content to Markdown for the editor
        const markdownContent = turndownService.turndown(data.content);
        setContent(markdownContent);
        setStatusId(data.statusId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load article");
      } finally {
        setIsLoading(false);
      }
    }

    fetchArticle();
  }, [articleId, router]);

  const handleSave = async (publish: boolean) => {
    if (!articleId) return;

    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!content.trim()) {
      setError("Content is required");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/articles/${articleId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          content: content.trim(),
          statusId: publish ? 1 : 2,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update article");
      }

      const data = await response.json();
      setArticle(data.article);
      setStatusId(data.article.statusId);

      // Redirect after successful save
      router.push(`/articles/${articleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update article");
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col w-full min-h-0">
        <div className="relative z-10 flex items-center justify-between gap-4 py-3 px-4 sm:px-6 lg:px-11 border-b border-border bg-bg -mx-4 sm:-mx-6 lg:-mx-11 -mt-8">
          <div className="flex items-center gap-4">
            <Link
              href={`/articles/${articleId}`}
              className="flex items-center gap-1.5 text-text-2 hover:text-text-1 text-sm sm:text-[15px]"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              Back
            </Link>
          </div>
        </div>
        <div className="flex justify-center w-full py-12">
          <div className="w-full max-w-[740px] flex items-center justify-center">
            <div className="flex items-center gap-2 text-text-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading article...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state - unauthorized or not found
  if (error || !article) {
    return (
      <div className="flex flex-col w-full min-h-0">
        <div className="relative z-10 flex items-center justify-between gap-4 py-3 px-4 sm:px-6 lg:px-11 border-b border-border bg-bg -mx-4 sm:-mx-6 lg:-mx-11 -mt-8">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-text-2 hover:text-text-1 text-sm sm:text-[15px]"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            Back
          </Link>
        </div>
        <div className="flex justify-center w-full py-12">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error || "Article not found"}</p>
            <Link
              href="/"
              className="text-primary hover:underline font-medium"
            >
              Go back home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-0">
      {/* Editor Top Bar - full width, flush with navbar */}
      <div className="relative z-10 flex items-center justify-between gap-4 py-3 px-4 sm:px-6 lg:px-11 border-b border-border bg-bg flex-wrap sm:flex-nowrap -mx-4 sm:-mx-6 lg:-mx-11 -mt-8">
        <div className="flex items-center gap-4 order-1 sm:order-1 min-w-0">
          <Link
            href={`/articles/${articleId}`}
            className="flex items-center gap-1.5 text-text-2 hover:text-text-1 text-sm sm:text-[15px] whitespace-nowrap"
            aria-label="Back to article"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            Back
          </Link>
          {statusId === 2 ? (
            <span className="text-xs sm:text-[13px] text-orange-600 font-medium px-2 py-0.5 bg-orange-50 rounded-full">
              Draft
            </span>
          ) : (
            <span className="text-xs sm:text-[13px] text-green-600 font-medium px-2 py-0.5 bg-green-50 rounded-full">
              Published
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 order-2 sm:order-2 w-full sm:w-auto justify-end">
          {error && (
            <span className="text-red-500 text-sm">{error}</span>
          )}
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="px-4 py-2 text-text-2 hover:text-text-1 text-sm disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="rounded-full bg-primary text-white px-5 py-2.5 text-[15px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Publish"
            )}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex justify-center w-full py-8 sm:py-12">
        <div className="w-full max-w-[740px] flex flex-col gap-6 px-0">
          {/* Title */}
          <div className="border-b border-border pb-2">
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full font-logo text-2xl sm:text-[42px] font-bold leading-tight text-text-1 placeholder:text-text-3 bg-transparent border-none outline-none focus:ring-0"
            />
          </div>

          {/* Subtitle */}
          <div className="border-b border-border pb-2">
            <input
              type="text"
              placeholder="Tell your story..."
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full font-logo text-xl sm:text-2xl leading-snug text-text-1 placeholder:text-text-3 bg-transparent border-none outline-none focus:ring-0"
            />
          </div>

          {/* Body (Markdown) - Rich text editor */}
          <div className="border border-border rounded-sm min-h-[400px] flex flex-col overflow-hidden">
            <span className="text-text-3 text-xs font-medium px-3 pt-4 pb-2">
              Markdown
            </span>
            <MarkdownEditor
              value={content}
              onChange={(v) => setContent(v ?? "")}
              placeholder={MARKDOWN_PLACEHOLDER}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

### UI - Article Detail Page (Add Edit Button)

**File:** `web/app/articles/[id]/page.tsx`

```typescript
import { notFound } from "next/navigation";
import Link from "next/link";
import { Heart, Share2, FilePen, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CommentSection } from "./CommentSection";
import { DeleteArticleButton } from "./DeleteArticleButton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getReadTime(content: string): number {
  const text = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const words = text.trim().split(" ").filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  const currentUserId = session?.userId;

  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true } },
      categories: {
        where: { statusId: 1 },
        include: { category: { select: { id: true, name: true } } },
      },
      _count: { select: { likes: true } },
    },
  });

  if (!article) notFound();

  const isDraft = article.statusId === 2;
  const isOwner = currentUserId === article.author.id;

  // Draft articles are only accessible by the owner
  if (isDraft && !isOwner) {
    notFound();
  }

  const readTime = getReadTime(article.content);
  const initials = getInitials(article.author.name);
  const plainContent = article.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const excerpt = plainContent.slice(0, 200);
  const dateStr = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(article.createdAt);

  return (
    <article className={`max-w-[680px] mx-auto pt-12 pb-12 flex flex-col gap-6 ${isDraft ? "relative" : ""}`}>
      {isDraft && (
        <div className="absolute -top-2 left-0 right-0 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
            <FilePen className="w-4 h-4" />
            Draft — Only visible to you
          </span>
        </div>
      )}
      {/* Title */}
      <h1 className="font-logo text-[42px] font-bold leading-[1.2] text-text-1">
        {article.title}
      </h1>

      {/* Subtitle - from article or excerpt from content */}
      {(article.subtitle || excerpt) && (
        <p className="font-logo text-2xl font-semibold leading-[1.4] text-text-2">
          {article.subtitle ?? `${excerpt}${plainContent.length > 200 ? "…" : ""}`}
        </p>
      )}

      {/* Category chips */}
      {article.categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {article.categories.map((ac) => (
            <span
              key={ac.category.id}
              className="inline-flex items-center px-3.5 py-1.5 rounded-full text-[13px] font-medium text-text-1 bg-surface border border-border"
            >
              {ac.category.name}
            </span>
          ))}
        </div>
      )}

      {/* Author bar */}
      <div className="flex items-center gap-3">
        <Link
          href={`/profile/${article.author.id}`}
          className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-[15px] shrink-0"
        >
          {initials}
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${article.author.id}`}
            className="text-base font-semibold text-text-1 hover:text-primary transition-colors block"
          >
            {article.author.name}
          </Link>
          <p className="text-[13px] text-text-2">
            {dateStr} · {readTime} min read
          </p>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-full border border-primary text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
        >
          Follow
        </button>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-5 py-3 border-y border-border">
        <span className={`flex items-center gap-1.5 text-[15px] ${article._count.likes > 0 ? "text-like" : "text-text-2"}`}>
          <Heart
            className="size-[15px]"
            strokeWidth={2}
            fill={article._count.likes > 0 ? "currentColor" : "none"}
          />
          {article._count.likes}
        </span>
        <div className="flex-1" />
        {/* Edit & Delete buttons - only visible to article owner */}
        {isOwner && (
          <>
            <Link
              href={`/articles/${article.id}/edit`}
              className="flex items-center gap-1.5 text-text-2 text-sm font-medium hover:text-primary transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </Link>
            <DeleteArticleButton articleId={article.id} />
          </>
        )}
        <span className="flex items-center gap-1.5 text-sm text-text-2">
          <Share2 className="size-[14px]" strokeWidth={2} />
          Share
        </span>
      </div>

      {/* Body content */}
      <div
        className="prose prose-neutral max-w-none text-text-1
          /* Headings */
          [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4
          [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3
          [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2
          /* Paragraphs */
          [&_p]:text-lg [&_p]:leading-[1.8] [&_p]:mb-4
          /* Lists */
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4
          [&_li]:mb-1
          /* Code */
          [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono
          [&_pre]:bg-surface [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:mb-4
          [&_pre_code]:bg-transparent [&_pre_code]:p-0
          /* Blockquotes */
          [&_blockquote]:border-l-4 [&_blockquote]:border-text-1 [&_blockquote]:pl-4 [&_blockquote]:font-logo [&_blockquote]:text-xl [&_blockquote]:font-semibold [&_blockquote]:leading-normal [&_blockquote]:not-italic [&_blockquote]:mb-4
          /* Links */
          [&_a]:text-primary [&_a]:underline [&_a]:hover:opacity-80
          /* Images */
          [&_img]:rounded-lg [&_img]:max-w-full [&_img]:my-4
          /* Horizontal rule */
          [&_hr]:my-8 [&_hr]:border-border
          /* Bold and Italic */
          [&_strong]:font-bold
          [&_em]:italic"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Bottom author card */}
      <div className="flex gap-6 pt-6">
        <Link
          href={`/profile/${article.author.id}`}
          className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white font-bold text-[28px] shrink-0"
        >
          {initials}
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${article.author.id}`}
            className="text-xl font-semibold text-text-1 hover:text-primary transition-colors block"
          >
            {article.author.name}
          </Link>
          <p className="text-[15px] text-text-2 leading-[1.6] mt-2">
            Staff writer. Writing about technology and human experience.
          </p>
          <button
            type="button"
            className="mt-2 px-4 py-2 rounded-full border border-primary text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
          >
            Follow
          </button>
        </div>
      </div>

      <CommentSection />
    </article>
  );
}

```

### UI - ProfileArticleCard (Add Edit Link)

**File:** `web/app/profile/ProfileArticleCard.tsx`

```typescript
// Change Edit button to Link
<Link
  href={`/articles/${id}/edit`}
  className="rounded border border-border px-3 py-1.5 text-sm text-text-1 hover:bg-surface transition-colors flex items-center gap-1.5"
>
  <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
  Edit
</Link>
```

### Files Changed


| File                                     | Type     |
| ---------------------------------------- | -------- |
| `web/app/api/articles/[id]/route.ts`     | Modified |
| `web/app/articles/[id]/edit/page.tsx`    | New      |
| `web/app/articles/[id]/page.tsx`         | Modified |
| `web/app/profile/ProfileArticleCard.tsx` | Modified |


## 4.3 Like Article

### API - POST/GET /api/articles/[id]/like

**File:** `web/app/api/articles/[id]/like/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/articles/[id]/like
 * Toggle like on an article
 * - If user hasn't liked the article yet, create a new like
 * - If user has already liked, soft delete the like (statusId = 3)
 * - Only authenticated users can like articles
 */
export async function POST(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const session = await getSession();

    // Check authentication
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find the article
    const article = await prisma.article.findUnique({
      where: { id },
      select: { id: true, statusId: true },
    });

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Cannot like deleted articles
    if (article.statusId === 3) {
      return NextResponse.json(
        { error: "Cannot like deleted article" },
        { status: 400 }
      );
    }

    // Check if user has already liked this article
    const existingLike = await prisma.articleLike.findUnique({
      where: {
        userId_articleId: {
          userId: session.userId,
          articleId: id,
        },
      },
    });

    let isLiked: boolean;
    let likeCount: number;

    if (existingLike) {
      // Toggle like status
      if (existingLike.statusId === 1) {
        // Unlike: soft delete by setting statusId to 3
        await prisma.articleLike.update({
          where: { id: existingLike.id },
          data: { statusId: 3 },
        });
        isLiked = false;
      } else {
        // Re-like: restore by setting statusId to 1
        await prisma.articleLike.update({
          where: { id: existingLike.id },
          data: { statusId: 1 },
        });
        isLiked = true;
      }
    } else {
      // Create new like
      await prisma.articleLike.create({
        data: {
          userId: session.userId,
          articleId: id,
          statusId: 1,
        },
      });
      isLiked = true;
    }

    // Get updated like count
    const countResult = await prisma.articleLike.count({
      where: {
        articleId: id,
        statusId: 1,
      },
    });
    likeCount = countResult;

    return NextResponse.json({
      success: true,
      isLiked,
      likeCount,
    });
  } catch (error) {
    console.error("POST /api/articles/[id]/like error:", error);
    return NextResponse.json(
      { error: "Failed to toggle like" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/articles/[id]/like
 * Get like status for current user and total like count
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const session = await getSession();

    // Find the article
    const article = await prisma.article.findUnique({
      where: { id },
      select: { id: true, statusId: true },
    });

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Get total like count
    const likeCount = await prisma.articleLike.count({
      where: {
        articleId: id,
        statusId: 1,
      },
    });

    // Check if current user has liked (only if authenticated)
    let isLiked = false;
    if (session) {
      const existingLike = await prisma.articleLike.findUnique({
        where: {
          userId_articleId: {
            userId: session.userId,
            articleId: id,
          },
        },
      });
      isLiked = existingLike?.statusId === 1;
    }

    return NextResponse.json({
      isLiked,
      likeCount,
    });
  } catch (error) {
    console.error("GET /api/articles/[id]/like error:", error);
    return NextResponse.json(
      { error: "Failed to fetch like status" },
      { status: 500 }
    );
  }
}

```

### UI - LikeButton Component

**File:** `web/app/articles/[id]/LikeButton.tsx`

```typescript
"use client";

import { useState, useCallback } from "react";
import { Heart, Loader2 } from "lucide-react";

interface LikeButtonProps {
  articleId: string;
  initialLikeCount: number;
  initialIsLiked: boolean;
  isAuthenticated: boolean;
}

export function LikeButton({
  articleId,
  initialLikeCount,
  initialIsLiked,
  isAuthenticated,
}: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLoading, setIsLoading] = useState(false);

  const handleLike = useCallback(async () => {
    if (!isAuthenticated) {
      // Redirect to login if not authenticated
      window.location.href = `/login?redirect=/articles/${articleId}`;
      return;
    }

    if (isLoading) return;

    setIsLoading(true);

    try {
      const response = await fetch(`/api/articles/${articleId}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to toggle like");
      }

      const data = await response.json();
      setIsLiked(data.isLiked);
      setLikeCount(data.likeCount);
    } catch (error) {
      console.error("Failed to toggle like:", error);
      alert(error instanceof Error ? error.message : "Failed to toggle like");
    } finally {
      setIsLoading(false);
    }
  }, [articleId, isAuthenticated, isLoading]);

  const hasLikes = likeCount > 0;

  return (
    <button
      onClick={handleLike}
      disabled={isLoading}
      className={`flex items-center gap-1.5 text-[15px] transition-colors ${
        isLiked ? "text-like" : hasLikes ? "text-like" : "text-text-2"
      } hover:text-like disabled:opacity-50`}
      title={isAuthenticated ? (isLiked ? "Unlike" : "Like") : "Sign in to like"}
    >
      {isLoading ? (
        <Loader2 className="w-[15px] h-[15px] animate-spin" />
      ) : (
        <Heart
          className="w-[15px] h-[15px]"
          strokeWidth={2}
          fill={isLiked || hasLikes ? "currentColor" : "none"}
        />
      )}
      {likeCount}
    </button>
  );
}

```

### UI - Article Detail Page (Add LikeButton)

**File:** `web/app/articles/[id]/page.tsx`

```typescript
import { notFound } from "next/navigation";
import Link from "next/link";
import { Share2, FilePen, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CommentSection } from "./CommentSection";
import { DeleteArticleButton } from "./DeleteArticleButton";
import { LikeButton } from "./LikeButton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getReadTime(content: string): number {
  const text = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const words = text.trim().split(" ").filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  const currentUserId = session?.userId;

  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true } },
      categories: {
        where: { statusId: 1 },
        include: { category: { select: { id: true, name: true } } },
      },
      _count: {
        select: {
          likes: {
            where: { statusId: 1 },
          },
        },
      },
    },
  });

  if (!article) notFound();

  const isDraft = article.statusId === 2;
  const isOwner = currentUserId === article.author.id;
  const isAuthenticated = !!session;

  // Check if current user has liked this article
  let userLike = null;
  if (currentUserId) {
    userLike = await prisma.articleLike.findUnique({
      where: {
        userId_articleId: {
          userId: currentUserId,
          articleId: id,
        },
      },
    });
  }
  const isLiked = userLike?.statusId === 1;

  // Draft articles are only accessible by the owner
  if (isDraft && !isOwner) {
    notFound();
  }

  const readTime = getReadTime(article.content);
  const initials = getInitials(article.author.name);
  const plainContent = article.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const excerpt = plainContent.slice(0, 200);
  const dateStr = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(article.createdAt);

  return (
    <article className={`max-w-[680px] mx-auto pt-12 pb-12 flex flex-col gap-6 ${isDraft ? "relative" : ""}`}>
      {isDraft && (
        <div className="absolute -top-2 left-0 right-0 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
            <FilePen className="w-4 h-4" />
            Draft — Only visible to you
          </span>
        </div>
      )}
      {/* Title */}
      <h1 className="font-logo text-[42px] font-bold leading-[1.2] text-text-1">
        {article.title}
      </h1>

      {/* Subtitle - from article or excerpt from content */}
      {(article.subtitle || excerpt) && (
        <p className="font-logo text-2xl font-semibold leading-[1.4] text-text-2">
          {article.subtitle ?? `${excerpt}${plainContent.length > 200 ? "…" : ""}`}
        </p>
      )}

      {/* Category chips */}
      {article.categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {article.categories.map((ac) => (
            <span
              key={ac.category.id}
              className="inline-flex items-center px-3.5 py-1.5 rounded-full text-[13px] font-medium text-text-1 bg-surface border border-border"
            >
              {ac.category.name}
            </span>
          ))}
        </div>
      )}

      {/* Author bar */}
      <div className="flex items-center gap-3">
        <Link
          href={`/profile/${article.author.id}`}
          className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-[15px] shrink-0"
        >
          {initials}
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${article.author.id}`}
            className="text-base font-semibold text-text-1 hover:text-primary transition-colors block"
          >
            {article.author.name}
          </Link>
          <p className="text-[13px] text-text-2">
            {dateStr} · {readTime} min read
          </p>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-full border border-primary text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
        >
          Follow
        </button>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-5 py-3 border-y border-border">
        <LikeButton
          articleId={article.id}
          initialLikeCount={article._count.likes}
          initialIsLiked={isLiked}
          isAuthenticated={isAuthenticated}
        />
        <div className="flex-1" />
        {/* Edit & Delete buttons - only visible to article owner */}
        {isOwner && (
          <>
            <Link
              href={`/articles/${article.id}/edit`}
              className="flex items-center gap-1.5 text-text-2 text-sm font-medium hover:text-primary transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </Link>
            <DeleteArticleButton articleId={article.id} />
          </>
        )}
        <span className="flex items-center gap-1.5 text-sm text-text-2">
          <Share2 className="size-[14px]" strokeWidth={2} />
          Share
        </span>
      </div>

      {/* Body content */}
      <div
        className="prose prose-neutral max-w-none text-text-1
          /* Headings */
          [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4
          [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3
          [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2
          /* Paragraphs */
          [&_p]:text-lg [&_p]:leading-[1.8] [&_p]:mb-4
          /* Lists */
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4
          [&_li]:mb-1
          /* Code */
          [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono
          [&_pre]:bg-surface [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:mb-4
          [&_pre_code]:bg-transparent [&_pre_code]:p-0
          /* Blockquotes */
          [&_blockquote]:border-l-4 [&_blockquote]:border-text-1 [&_blockquote]:pl-4 [&_blockquote]:font-logo [&_blockquote]:text-xl [&_blockquote]:font-semibold [&_blockquote]:leading-normal [&_blockquote]:not-italic [&_blockquote]:mb-4
          /* Links */
          [&_a]:text-primary [&_a]:underline [&_a]:hover:opacity-80
          /* Images */
          [&_img]:rounded-lg [&_img]:max-w-full [&_img]:my-4
          /* Horizontal rule */
          [&_hr]:my-8 [&_hr]:border-border
          /* Bold and Italic */
          [&_strong]:font-bold
          [&_em]:italic"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Bottom author card */}
      <div className="flex gap-6 pt-6">
        <Link
          href={`/profile/${article.author.id}`}
          className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white font-bold text-[28px] shrink-0"
        >
          {initials}
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${article.author.id}`}
            className="text-xl font-semibold text-text-1 hover:text-primary transition-colors block"
          >
            {article.author.name}
          </Link>
          <p className="text-[15px] text-text-2 leading-[1.6] mt-2">
            Staff writer. Writing about technology and human experience.
          </p>
          <button
            type="button"
            className="mt-2 px-4 py-2 rounded-full border border-primary text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
          >
            Follow
          </button>
        </div>
      </div>

      <CommentSection />
    </article>
  );
}

```

### Files Changed


| File                                      | Type     |
| ----------------------------------------- | -------- |
| `web/app/api/articles/[id]/like/route.ts` | New      |
| `web/app/articles/[id]/LikeButton.tsx`    | New      |
| `web/app/articles/[id]/page.tsx`          | Modified |


## 4.4 Article Profile Owner (by Username)

### API - GET /api/users/[id]

**File:** `web/app/api/users/[id]/route.ts`

API นี้รองรับทั้ง `id` (UUID) และ `username` ในหน้าเดียวกัน โดยตรวจสอบรูปแบบของ identifier:
- หากเป็น UUID → ค้นหาด้วย user ID
- หากไม่ใช่ UUID → ค้นหาด้วย username (case-insensitive)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function excerptFromContent(content: string, maxLength = 150): string {
  const plain = content.replace(/<[^>]+>/g, "").trim();
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).trim() + "…";
}

function estimateReadTime(content: string): number {
  const words = content.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function formatCount(count: number): string {
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return String(count);
}

// Check if the identifier looks like a UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: identifier } = await params;
    const session = await getSession();
    const currentUserId = session?.userId;

    let user;

    if (isUUID(identifier)) {
      // Search by user ID
      user = await prisma.user.findUnique({
        where: { id: identifier, statusId: 1 },
        select: {
          id: true,
          name: true,
          username: true,
          bio: true,
        },
      });
    } else {
      // Search by username (case-insensitive)
      user = await prisma.user.findFirst({
        where: {
          username: {
            equals: identifier,
            mode: "insensitive",
          },
          statusId: 1,
        },
        select: {
          id: true,
          name: true,
          username: true,
          bio: true,
        },
      });
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // NOTE: Follow feature is not implemented yet
    const followersCount = 0;
    const followingCount = 0;
    const isFollowing = false;

    // Fetch user's articles
    const articlesWhere = {
      authorId: user.id,
      OR: [
        { statusId: 1 },
        ...(currentUserId === user.id ? [{ statusId: 2 }] : []),
      ],
    };

    const articles = await prisma.article.findMany({
      where: articlesWhere,
      include: {
        _count: { select: { likes: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const articlesData = articles.map((article) => ({
      id: article.id,
      title: article.title,
      excerpt: excerptFromContent(article.content),
      publishedAt: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(article.createdAt),
      readTimeMinutes: estimateReadTime(article.content),
      likeCount: article._count.likes,
      statusId: article.statusId,
    }));

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        bio: user.bio ?? "",
        followersCount: formatCount(followersCount),
        followersCountRaw: followersCount,
        followingCount: formatCount(followingCount),
        followingCountRaw: followingCount,
        isFollowing,
        isOwnProfile: currentUserId === user.id,
      },
      articles: articlesData,
    });
  } catch (error) {
    console.error("GET /api/users/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
```

**การใช้งาน:**
- `GET /api/users/johndoe` → ค้นหาด้วย username "johndoe"
- `GET /api/users/550e8400-e29b-41d4-a716-446655440000` → ค้นหาด้วย user ID

### UI - Public Profile Page (by Username)

**File:** `web/app/profile/[username]/page.tsx`

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import ProfileHeader from "../ProfileHeader";
import ProfileTabs from "../ProfileTabs";
import ProfileArticleCard from "../ProfileArticleCard";
import { FilePen } from "lucide-react";

type Article = {
  id: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readTimeMinutes: number;
  likeCount: number;
  statusId: number;
};

type ProfileData = {
  user: {
    id: string;
    name: string;
    username: string | null;
    bio: string;
    followersCount: string;
    followingCount: string;
    isOwnProfile: boolean;
  };
  articles: Article[];
};

type Props = {
  params: Promise<{ username: string }>;
};

async function deleteArticle(id: string): Promise<void> {
  const response = await fetch(`/api/articles/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to delete article");
  }
}

export default function PublicProfilePage({ params }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"home" | "about">("home");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    async function loadParams() {
      const { username: uname } = await params;
      setUsername(uname);
    }
    loadParams();
  }, [params]);

  useEffect(() => {
    if (!username) return;

    async function fetchProfile() {
      try {
        setIsLoading(true);
        const profileRes = await axios.get<ProfileData>(`/api/users/${username}`);
        setProfile(profileRes.data);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setError("User not found");
        } else {
          setError("Failed to load profile");
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [username]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteArticle(id);
    setProfile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        articles: prev.articles.filter((a) => a.id !== id),
      };
    });
  }, []);

  if (isLoading) {
    return (
      <div className="w-full max-w-[728px] mx-auto pt-12 pb-12">
        <p className="text-text-2">Loading profile…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="w-full max-w-[728px] mx-auto pt-12 pb-12">
        <p className="text-red-600">{error || "Failed to load profile"}</p>
      </div>
    );
  }

  const { user, articles } = profile;

  return (
    <div className="w-full max-w-[728px] mx-auto pt-12 pb-12 flex flex-col gap-8">
      <ProfileHeader
        name={user.name}
        bio={user.bio}
        followersCount={user.followersCount}
        followingCount={user.followingCount}
        isOwnProfile={user.isOwnProfile}
        username={user.username}
      />

      <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "home" && (
        <div className="flex flex-col">
          {articles.length === 0 ? (
            <p className="py-12 text-center text-text-2">No articles yet.</p>
          ) : (
            articles.map((article) => (
              <div key={article.id} className="relative">
                {article.statusId === 2 && (
                  <div className="absolute -top-2 left-0">
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                      <FilePen className="w-3 h-3" />
                      Draft
                    </span>
                  </div>
                )}
                <div className={article.statusId === 2 ? "pt-4" : ""}>
                  <ProfileArticleCard
                    id={article.id}
                    title={article.title}
                    excerpt={article.excerpt}
                    publishedAt={article.publishedAt}
                    readTimeMinutes={article.readTimeMinutes}
                    likeCount={article.likeCount}
                    onDelete={user.isOwnProfile ? handleDelete : undefined}
                    isOwnProfile={user.isOwnProfile}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "about" && (
        <div className="py-8">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-text-1">About</h2>
            <p className="text-text-2">{user.bio || "No bio yet."}</p>
            {user.username && (
              <p className="text-text-2">
                <span className="font-medium">Username:</span> @{user.username}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

### UI - ProfileHeader (Updated)

**File:** `web/app/profile/ProfileHeader.tsx`

```typescript
"use client";

import Link from "next/link";
import { Pencil, UserPlus } from "lucide-react";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

type ProfileHeaderProps = {
  name: string;
  bio: string;
  followersCount: string;
  followingCount: string;
  isOwnProfile?: boolean;
  username?: string | null;
};

export default function ProfileHeader({
  name,
  bio,
  followersCount,
  followingCount,
  isOwnProfile = false,
  username,
}: ProfileHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div
          className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white font-bold text-[28px] shrink-0"
          aria-hidden
        >
          {getInitials(name)}
        </div>
        <div className="flex flex-col gap-4 min-w-0 flex-1">
          <h1 className="font-logo text-3xl sm:text-[32px] font-bold text-text-1">
            {name}
          </h1>
          {username && (
            <p className="text-sm text-text-3">@{username}</p>
          )}
          <p className="text-base text-text-2 max-w-[728px]">{bio || "No bio yet."}</p>
          <div className="flex items-center gap-6 text-sm text-text-1">
            <span>{followersCount} Followers</span>
            <span>{followingCount} Following</span>
          </div>
          {isOwnProfile ? (
            <Link
              href="/profile/edit"
              className="self-start rounded-full border border-border bg-white px-4 py-2 text-sm font-normal text-text-1 hover:bg-surface transition-colors flex items-center gap-2"
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
              Edit profile
            </Link>
          ) : (
            <button
              type="button"
              className="self-start rounded-full border border-primary text-primary px-4 py-2 text-sm font-medium hover:bg-primary/5 transition-colors flex items-center gap-2"
            >
              <UserPlus className="w-3.5 h-3.5" strokeWidth={2} />
              Follow
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Files Changed


| File                                           | Type     | Description                                      |
| ---------------------------------------------- | -------- | ------------------------------------------------ |
| `web/app/api/users/[id]/route.ts`              | Modified | รองรับทั้ง UUID และ username ในหน้าเดียวกัน       |
| `web/app/profile/[username]/page.tsx`          | New      | หน้า profile สาธารณะแบบ username-based           |
| `web/app/profile/ProfileHeader.tsx`            | Modified | เพิ่ม isOwnProfile, username props               |
| `web/app/articles/[id]/page.tsx`               | Modified | ลิงก์ profile ใช้ username แทน id                |
| `web/app/layout.tsx`                           | Modified | ส่ง username ไป Header                          |
| `web/app/components/Header.tsx`              | Modified | ลิงก์ profile ใช้ username ใน URL               |
| `web/app/profile/ProfileArticleCard.tsx`       | Modified | ซ่อน Edit/Delete เมื่อไม่ใช่เจ้าของ              |
| `web/app/profile/page.tsx`                   | Modified | ส่ง isOwnProfile ไป ProfileArticleCard           |

### Testing Checklist

- [ ] API `/api/users/johndoe` คืนค่า user ที่มี username johndoe
- [ ] API `/api/users/UUID` คืนค่า user ตาม UUID
- [ ] หน้า `/profile/johndoe` แสดงข้อมูล user ถูกต้อง
- [ ] หน้า profile ตัวเองแสดงปุ่ม Edit profile
- [ ] หน้า profile คนอื่นแสดงปุ่ม Follow
- [ ] หน้า profile คนอื่นไม่แสดงปุ่ม Edit/Delete บทความ
- [ ] Header avatar ลิงก์ไป `/profile/[username]` ถูกต้อง
- [ ] Article detail ลิงก์ author ไป `/profile/[username]` ถูกต้อง

## 4.5 Comment System

### Database Schema - Prisma

**File:** `web/prisma/schema.prisma`

เพิ่ม `Comment` model และ relations:

```prisma
model Status {
  id                Int               @id
  name              String
  users             User[]
  articles          Article[]
  likes             ArticleLike[]
  categories        Category[]
  articleCategories ArticleCategory[]
  comments          Comment[]

  @@map("status")
}

model User {
  id        String        @id @default(cuid())
  email     String        @unique
  username  String        @unique
  password  String
  name      String
  bio       String?       @db.Text
  statusId  Int           @default(1) @map("status_id")
  status    Status        @relation(fields: [statusId], references: [id])
  createdAt DateTime      @default(now()) @map("created_at")
  updatedAt DateTime      @default(now()) @updatedAt @map("updated_at")
  articles  Article[]
  likes     ArticleLike[]
  comments  Comment[]

  @@map("user")
}

model Article {
  id        String        @id @default(cuid())
  title     String
  subtitle  String?       @db.Text
  content   String        @db.Text
  authorId  String        @map("user_id")
  author    User          @relation(fields: [authorId], references: [id])
  statusId  Int           @default(1) @map("status_id")
  status    Status        @relation(fields: [statusId], references: [id])
  createdAt DateTime      @default(now()) @map("created_at")
  updatedAt DateTime      @default(now()) @updatedAt @map("updated_at")
  likes     ArticleLike[]
  categories ArticleCategory[]
  comments  Comment[]

  @@map("article")
}

model Comment {
  id        String   @id @default(cuid())
  content   String   @db.Text
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id])
  articleId String   @map("article_id")
  article   Article  @relation(fields: [articleId], references: [id])
  statusId  Int      @default(1) @map("status_id")
  status    Status   @relation(fields: [statusId], references: [id])
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")

  @@map("comment")
}
```

**Run migration:**
```bash
cd web
npx prisma migrate dev --name add_comment_model
npx prisma generate
```

### API - GET/POST /api/articles/[id]/comments

**File:** `web/app/api/articles/[id]/comments/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/articles/[id]/comments
 * Get all comments for an article
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const article = await prisma.article.findUnique({
      where: { id },
      select: { id: true, statusId: true },
    });

    if (!article || article.statusId === 3) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    const comments = await prisma.comment.findMany({
      where: { articleId: id, statusId: 1 },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedComments = comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      authorName: comment.user.name,
      authorId: comment.user.id,
      createdAt: comment.createdAt.toISOString(),
    }));

    return NextResponse.json({
      comments: formattedComments,
      count: formattedComments.length,
    });
  } catch (error) {
    console.error("GET /api/articles/[id]/comments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/articles/[id]/comments
 * Create a new comment on an article
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const article = await prisma.article.findUnique({
      where: { id },
      select: { id: true, statusId: true },
    });

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    if (article.statusId === 3) {
      return NextResponse.json(
        { error: "Cannot comment on deleted article" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim() === "") {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        userId: session.userId,
        articleId: id,
        statusId: 1,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      comment: {
        id: comment.id,
        content: comment.content,
        authorName: comment.user.name,
        authorId: comment.user.id,
        createdAt: comment.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("POST /api/articles/[id]/comments error:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
```

### UI - CommentSection Component

**File:** `web/app/articles/[id]/CommentSection.tsx`

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, MessageCircle } from "lucide-react";

type Comment = {
  id: string;
  content: string;
  authorName: string;
  authorId: string;
  createdAt: string;
};

type CommentSectionProps = {
  articleId: string;
  isAuthenticated: boolean;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? "" : "s"} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? "" : "s"} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays === 1 ? "" : "s"} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths === 1 ? "" : "s"} ago`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears === 1 ? "" : "s"} ago`;
}

export function CommentSection({ articleId, isAuthenticated }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/articles/${articleId}/comments`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch comments");
      }

      const data = await response.json();
      setComments(data.comments || []);
    } catch (err) {
      console.error("Failed to fetch comments:", err);
      setError(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      setIsLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleRespond() {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!isAuthenticated) {
      window.location.href = `/login?redirect=/articles/${articleId}`;
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/articles/${articleId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to post comment");
      }

      const data = await response.json();
      setComments((prev) => [data.comment, ...prev]);
      setText("");
    } catch (err) {
      console.error("Failed to post comment:", err);
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="pt-8 flex flex-col gap-6">
      <div className="h-px bg-border" />

      <div className="flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-text-2" />
        <h2 className="font-logo text-2xl font-bold text-text-1">
          Comments ({comments.length})
        </h2>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <textarea
          placeholder={isAuthenticated ? "Write a comment..." : "Sign in to comment..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isSubmitting || !isAuthenticated}
          className="w-full rounded-lg bg-surface border border-border p-4 min-h-[106px] text-[15px] text-text-1 placeholder:text-text-3 resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
          rows={3}
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleRespond}
            disabled={!text.trim() || isSubmitting || !isAuthenticated}
            className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Posting...
              </>
            ) : (
              "Respond"
            )}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-text-3" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-text-3 text-[15px]">No comments yet. Be the first to share your thoughts!</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-4 py-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-white">
                {getInitials(comment.authorName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-sm text-text-1">{comment.authorName}</div>
                  <div className="text-xs text-text-3">{formatTimeAgo(comment.createdAt)}</div>
                </div>
                <p className="text-[15px] leading-normal text-text-1 mt-1 whitespace-pre-wrap">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

### UI - Article Detail Page (Add Props)

**File:** `web/app/articles/[id]/page.tsx`

```typescript
      <CommentSection articleId={article.id} isAuthenticated={isAuthenticated} />
```

### Files Changed

| File | Type |
|------|------|
| `web/prisma/schema.prisma` | Modified |
| `web/app/api/articles/[id]/comments/route.ts` | New |
| `web/app/articles/[id]/CommentSection.tsx` | Modified |
| `web/app/articles/[id]/page.tsx` | Modified |

### Testing Checklist

- [ ] API `GET /api/articles/[id]/comments` คืนค่า comments ทั้งหมด
- [ ] API `POST /api/articles/[id]/comments` สร้าง comment ใหม่
- [ ] CommentSection แสดง comments จาก API
- [ ] User ที่ไม่ login เห็น placeholder "Sign in to comment"
- [ ] User ที่ login สามารถ post comment ได้
- [ ] Comment ใหม่แสดงทันทีหลัง post
- [ ] Time ago แสดงถูกต้อง (Just now, 2 hours ago, etc.)

### UI - ProfileArticleCard (Edit/Delete Visibility)

**File:** `web/app/profile/ProfileArticleCard.tsx`

ซ่อนปุ่ม Edit และ Delete เมื่อไม่ใช่เจ้าของ profile:

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Pencil, Trash2, Loader2 } from "lucide-react";

type ProfileArticleCardProps = {
  id: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readTimeMinutes: number;
  likeCount: number;
  onDelete?: (id: string) => Promise<void>;
  isOwnProfile?: boolean;
};

export default function ProfileArticleCard({
  id,
  title,
  excerpt,
  publishedAt,
  readTimeMinutes,
  likeCount,
  onDelete,
  isOwnProfile = false,
}: ProfileArticleCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(id);
    } catch {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <article className="border-b border-border py-6">
      <div className="flex flex-col gap-3">
        <Link href={`/articles/${id}`} className="block group">
          <h2 className="text-xl font-semibold text-text-1 group-hover:text-primary transition-colors line-clamp-2">
            {title}
          </h2>
        </Link>
        <p className="text-sm text-text-2 line-clamp-2">{excerpt}</p>
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-text-2">
          <span>{publishedAt}</span>
          <span>{readTimeMinutes} min read</span>
          <span className={`flex items-center gap-1 ${likeCount > 0 ? "text-like" : ""}`}>
            <Heart className="w-3.5 h-3.5" strokeWidth={2} fill={likeCount > 0 ? "currentColor" : "none"} />
            {likeCount}
          </span>
          <span className="flex-1" />
          {isOwnProfile && (
            <>
              <Link
                href={`/articles/${id}/edit`}
                className="rounded border border-border px-3 py-1.5 text-sm text-text-1 hover:bg-surface transition-colors flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                Edit
              </Link>

              {showConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600">Delete?</span>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        ...
                      </>
                    ) : (
                      "Yes"
                    )}
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    disabled={isDeleting}
                    className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConfirm(true)}
                  className="rounded border border-border px-3 py-1.5 text-sm text-text-1 hover:bg-surface transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
```

### UI - Profile Pages (Pass isOwnProfile)

**Files:** `web/app/profile/page.tsx`, `web/app/profile/[username]/page.tsx`

```typescript
<ProfileArticleCard
  id={article.id}
  title={article.title}
  excerpt={article.excerpt}
  publishedAt={article.publishedAt}
  readTimeMinutes={article.readTimeMinutes}
  likeCount={article.likeCount}
  onDelete={user.isOwnProfile ? handleDelete : undefined}
  isOwnProfile={user.isOwnProfile}
/>
```

### UI - Header (Profile Link with Username)

**Files:** `web/app/layout.tsx`, `web/app/components/Header.tsx`

อัปเดตให้ avatar ใน header ลิงก์ไปยัง `/profile/[username]` แทน `/profile` ธรรมดา:

**layout.tsx:**
```typescript
<Header user={session ? { id: session.userId, name: session.name, username: session.username } : null} />
```

**Header.tsx:**
```typescript
type HeaderProps = {
  user: { id: string; name: string; username: string } | null;
};

// Build profile URL: use username if available, fallback to id
const profileUrl = user?.username
  ? `/profile/${user.username}`
  : user?.id
    ? `/profile/${user.id}`
    : "/profile";

// ใช้ profileUrl แทน "/profile"
<Link href={profileUrl} aria-label="Profile">
  {user.name.charAt(0).toUpperCase()}
</Link>
```

### UI - Article Detail Page (Profile Link Update)

**File:** `web/app/articles/[id]/page.tsx`

อัปเดตให้ลิงก์ไปยัง profile ใช้ `username` ถ้ามี (fallback เป็น `id` ถ้าไม่มี username):

```typescript
// Prisma query - ดึง username ด้วย
const article = await prisma.article.findUnique({
  where: { id },
  include: {
    author: { select: { id: true, name: true, username: true } },  // ← เพิ่ม username
    // ... rest
  },
});

// สร้าง profile identifier
const profileIdentifier = article.author.username || article.author.id;

// ใช้ในลิงก์
<Link href={`/profile/${profileIdentifier}`}>
  {article.author.name}
</Link>
```

**การทำงาน:**
- ถ้า author มี username (e.g., "johndoe") → ลิงก์เป็น `/profile/johndoe`
- ถ้า author ไม่มี username → ลิงก์เป็น `/profile/USER-ID`


