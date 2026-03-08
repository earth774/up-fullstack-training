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
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const session = await getSession();

    // Check authentication
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find article and verify ownership
    const article = await prisma.article.findUnique({
      where: { id },
      select: { id: true, authorId: true, statusId: true },
    });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Verify the current user is the author
    if (article.authorId !== session.userId) {
      return NextResponse.json(
        { error: "Forbidden: You can only delete your own articles" },
        { status: 403 },
      );
    }

    // Check if article is already deleted
    if (article.statusId === 3) {
      return NextResponse.json(
        { error: "Article is already deleted" },
        { status: 400 },
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
      { status: 500 },
    );
  }
}
