"use client";

import Link from "next/link";
import { useState } from "react";

import MarkdownEditor from "./MarkdownEditor";

const TOPICS = [
  { id: "tech", label: "Technology" },
  { id: "design", label: "Design" },
  { id: "business", label: "Business" },
  { id: "science", label: "Science" },
  { id: "culture", label: "Culture" },
  { id: "more", label: "+ More" },
];

const MARKDOWN_PLACEHOLDER = `# Write your article in Markdown

**Bold** *Italic* ~~Strikethrough~~ \`inline code\`

## Headings: # H1 ## H2 ### H3

## Lists: - bullet 1. ordered

> Blockquotes | \`\`\` Code blocks \`\`\``;

export default function WritePage() {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>("business");
  const [draftStatus, setDraftStatus] = useState<string | null>("Draft saved 2:34 PM");

  return (
    <div className="flex flex-col w-full min-h-0">
      {/* Editor Top Bar - full width, flush with navbar */}
      <div
        className="flex items-center justify-between gap-4 py-3 px-4 sm:px-6 lg:px-11 border-b border-border bg-bg flex-wrap sm:flex-nowrap -mx-4 sm:-mx-6 lg:-mx-11 -mt-8"
      >
        <div className="flex items-center gap-4 order-1 sm:order-1 min-w-0">
          <Link
            href="/"
            className="text-text-2 hover:text-text-1 text-sm sm:text-[15px] whitespace-nowrap"
          >
            ← Back
          </Link>
          {draftStatus && (
            <span className="text-text-3 text-xs sm:text-[13px] truncate">
              {draftStatus}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 order-2 sm:order-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            className="px-4 py-2 text-text-2 hover:text-text-1 text-sm"
          >
            Save draft
          </button>
          <button
            type="button"
            className="rounded-full bg-primary text-white px-5 py-2.5 text-[15px] font-medium hover:opacity-90 transition-opacity"
          >
            Publish
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

          {/* Add a topic */}
          <div className="flex flex-col gap-2.5">
            <span className="text-text-2 text-[13px] font-semibold">
              Add a topic
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1">
              {TOPICS.map((topic) => {
                const isActive = selectedTopic === topic.id;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() =>
                      setSelectedTopic(topic.id === "more" ? null : topic.id)
                    }
                    className={`
                      shrink-0 rounded-full px-3.5 py-1.5 text-[13px] border
                      transition-colors
                      ${
                        isActive
                          ? "bg-primary text-white border-primary"
                          : "bg-surface text-text-1 border-border hover:border-text-3"
                      }
                      ${topic.id === "more" ? "text-text-2" : ""}
                    `}
                  >
                    {topic.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Body (Markdown) - Rich text editor */}
          <div className="border border-border rounded-sm min-h-[400px] flex flex-col overflow-hidden">
            <span className="text-text-3 text-xs font-medium px-3 pt-4 pb-2">
              Markdown
            </span>
            <MarkdownEditor
              value={body}
              onChange={(v) => setBody(v ?? "")}
              placeholder={MARKDOWN_PLACEHOLDER}
            />
          </div>
        </div>
      </div>
    </div>
  );
}