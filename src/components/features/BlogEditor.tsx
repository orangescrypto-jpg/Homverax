"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlignLeft, CheckCircle2, Code2, Eye,
  Globe, Hash, Loader2, Save, Star, X,
  Bold, Italic, Link as LinkIcon, List,
  ListOrdered, Quote, Heading2, Heading3,
  Image as ImageIcon, Minus, Type,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createBlogPost, updateBlogPost, generateSlug } from "@/services/blog";
import { BLOG_CATEGORIES } from "@/lib/blogConstants";
import { useAuth } from "@/hooks/useAuth";
import { isAdminOrModerator, ROLE_CONFIG } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { BlogPost, BlogStatus, BlogCategory } from "@/types/blog";

interface BlogEditorProps {
  existingPost?: BlogPost;
  mode: "create" | "edit";
}

// ─── Editor mode ──────────────────────────────────────────────────────────────
type EditorMode = "rich" | "markdown" | "html";

// ─── Rich text toolbar actions ────────────────────────────────────────────────
interface ToolbarAction {
  icon: React.ElementType;
  title: string;
  action: (selected: string) => string;
  wrapLine?: boolean; // prefix the current line
}

const RICH_TOOLBAR: ToolbarAction[] = [
  { icon: Bold,         title: "Bold",            action: (s) => `<strong>${s || "bold text"}</strong>` },
  { icon: Italic,       title: "Italic",          action: (s) => `<em>${s || "italic text"}</em>` },
  { icon: Heading2,     title: "Heading 2",       action: (s) => `<h2>${s || "Section heading"}</h2>`, wrapLine: true },
  { icon: Heading3,     title: "Heading 3",       action: (s) => `<h3>${s || "Sub-heading"}</h3>`, wrapLine: true },
  { icon: List,         title: "Bullet list",     action: () => `<ul>\n  <li>First item</li>\n  <li>Second item</li>\n  <li>Third item</li>\n</ul>`, wrapLine: true },
  { icon: ListOrdered,  title: "Numbered list",   action: () => `<ol>\n  <li>First</li>\n  <li>Second</li>\n  <li>Third</li>\n</ol>`, wrapLine: true },
  { icon: Quote,        title: "Blockquote",      action: (s) => `<blockquote>${s || "Quote text here"}</blockquote>`, wrapLine: true },
  { icon: LinkIcon,     title: "Link",            action: (s) => `<a href="URL">${s || "link text"}</a>` },
  { icon: ImageIcon,    title: "Image",           action: () => `<img src="https://example.com/image.jpg" alt="Description" />`, wrapLine: true },
  { icon: Minus,        title: "Divider",         action: () => `<hr />`, wrapLine: true },
];

const MARKDOWN_TOOLBAR: ToolbarAction[] = [
  { icon: Bold,         title: "Bold",            action: (s) => `**${s || "bold text"}**` },
  { icon: Italic,       title: "Italic",          action: (s) => `*${s || "italic text"}*` },
  { icon: Heading2,     title: "Heading 2",       action: (s) => `## ${s || "Section heading"}`, wrapLine: true },
  { icon: Heading3,     title: "Heading 3",       action: (s) => `### ${s || "Sub-heading"}`, wrapLine: true },
  { icon: List,         title: "Bullet list",     action: () => `- First item\n- Second item\n- Third item`, wrapLine: true },
  { icon: ListOrdered,  title: "Numbered list",   action: () => `1. First\n2. Second\n3. Third`, wrapLine: true },
  { icon: Quote,        title: "Blockquote",      action: (s) => `> ${s || "Quote text here"}`, wrapLine: true },
  { icon: LinkIcon,     title: "Link",            action: (s) => `[${s || "link text"}](URL)` },
  { icon: ImageIcon,    title: "Image",           action: () => `![Description](https://example.com/image.jpg)`, wrapLine: true },
  { icon: Minus,        title: "Divider",         action: () => `---`, wrapLine: true },
];

// ─── Render content for preview ───────────────────────────────────────────────
function renderContent(content: string, mode: EditorMode): string {
  if (mode === "html" || mode === "rich") {
    return content; // already HTML
  }
  // Markdown → basic HTML conversion for preview
  return content
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/^---$/gm, "<hr />")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[h|b|u|o|l|p|h|b|i|a|d|q|h])(.+)$/gm, "<p>$1</p>");
}

// ─── Placeholder per editor mode ──────────────────────────────────────────────
const PLACEHOLDERS: Record<EditorMode, string> = {
  rich: `<h2>Introduction</h2>
<p>Write your article here. Use the toolbar above to format text, add headings, lists, and links.</p>

<h2>Main Section</h2>
<p>Explain your topic clearly with paragraphs and bullet points.</p>

<ul>
  <li>Key point one</li>
  <li>Key point two</li>
</ul>

<h2>Conclusion</h2>
<p>Wrap up with a clear takeaway for the reader.</p>`,
  markdown: `## Introduction

Write your article here. Use **bold**, *italic*, and [links](URL).

## Main Section

Explain your topic with clear paragraphs.

- Key point one
- Key point two
- Key point three

## Conclusion

Wrap up with a clear takeaway for the reader.`,
  html: `<h2>Introduction</h2>
<p>Write your article here. Full HTML is supported.</p>

<h2>Main Section</h2>
<p>Use any HTML tags you need.</p>

<ul>
  <li>Key point one</li>
  <li>Key point two</li>
</ul>

<h2>Conclusion</h2>
<p>Wrap up your article here.</p>`,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function BlogEditor({ existingPost, mode }: BlogEditorProps) {
  const router = useRouter();
  const { user } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const richEditorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && !isAdminOrModerator(user.role)) router.replace("/dashboard");
  }, [user, router]);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [title, setTitle] = useState(existingPost?.title ?? "");
  const [excerpt, setExcerpt] = useState(existingPost?.excerpt ?? "");
  const [content, setContent] = useState(existingPost?.content ?? "");
  const [category, setCategory] = useState<BlogCategory>(existingPost?.category ?? "market-news");
  const [tags, setTags] = useState<string[]>(existingPost?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [status, setStatus] = useState<BlogStatus>(existingPost?.status ?? "draft");
  const [featured, setFeatured] = useState(existingPost?.featured ?? false);

  // ── Cover image (external URL only) ────────────────────────────────────────
  const [coverUrl, setCoverUrl] = useState(existingPost?.coverImage ?? "");
  const [coverUrlInput, setCoverUrlInput] = useState(existingPost?.coverImage ?? "");
  const [coverError, setCoverError] = useState(false);

  const applyCoverUrl = () => {
    const val = coverUrlInput.trim();
    if (val && !val.startsWith("http")) {
      toast.error("Please enter a full URL starting with http:// or https://");
      return;
    }
    setCoverUrl(val);
    setCoverError(false);
    if (val) toast.success("Cover image updated");
  };

  // ── Editor mode ─────────────────────────────────────────────────────────────
  const [editorMode, setEditorMode] = useState<EditorMode>("rich");
  const [activeView, setActiveView] = useState<"write" | "preview">("write");
  const [isSaving, setIsSaving] = useState(false);

  // ── Reading time ────────────────────────────────────────────────────────────
  const wordCount = content.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));
  const slug = existingPost?.slug ?? generateSlug(title);

  // ── Toolbar insert (for markdown + html modes) ───────────────────────────────
  const handleToolbarInsert = useCallback((action: ToolbarAction) => {
    if (editorMode === "rich") return; // handled by contentEditable
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const inserted = action.action(selected);
    const before = content.substring(0, start);
    const after = content.substring(end);
    const newContent = action.wrapLine
      ? `${before}\n${inserted}\n${after}`
      : `${before}${inserted}${after}`;
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + inserted.length + (action.wrapLine ? 2 : 0);
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }, [content, editorMode]);

  // ── Rich editor (contentEditable) exec commands ───────────────────────────
  const execRich = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    richEditorRef.current?.focus();
    // Sync content from contentEditable div
    if (richEditorRef.current) {
      setContent(richEditorRef.current.innerHTML);
    }
  };

  const handleRichEditorInput = () => {
    if (richEditorRef.current) {
      setContent(richEditorRef.current.innerHTML);
    }
  };

  // When switching TO rich mode, set innerHTML
  useEffect(() => {
    if (editorMode === "rich" && richEditorRef.current) {
      richEditorRef.current.innerHTML = content;
    }
  }, [editorMode]);

  // ── Rich toolbar actions (contentEditable) ────────────────────────────────
  const RICH_EXEC_TOOLBAR: { icon: React.ElementType; title: string; exec: () => void }[] = [
    { icon: Bold,        title: "Bold",          exec: () => execRich("bold") },
    { icon: Italic,      title: "Italic",        exec: () => execRich("italic") },
    { icon: Heading2,    title: "Heading 2",     exec: () => execRich("formatBlock", "h2") },
    { icon: Heading3,    title: "Heading 3",     exec: () => execRich("formatBlock", "h3") },
    { icon: List,        title: "Bullet list",   exec: () => execRich("insertUnorderedList") },
    { icon: ListOrdered, title: "Ordered list",  exec: () => execRich("insertOrderedList") },
    { icon: Quote,       title: "Blockquote",    exec: () => execRich("formatBlock", "blockquote") },
    { icon: LinkIcon,    title: "Insert link",   exec: () => {
      const url = prompt("Enter URL:");
      if (url) execRich("createLink", url);
    }},
    { icon: Minus,       title: "Divider",       exec: () => execRich("insertHorizontalRule") },
    { icon: Type,        title: "Paragraph",     exec: () => execRich("formatBlock", "p") },
  ];

  // ── Tags ─────────────────────────────────────────────────────────────────
  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const cleaned = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
      if (!tags.includes(cleaned) && tags.length < 10) {
        setTags((prev) => [...prev, cleaned]);
      }
      setTagInput("");
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (saveStatus: BlogStatus) => {
    if (!user) return;
    if (!title.trim()) { toast.error("Add a title"); return; }
    if (!excerpt.trim()) { toast.error("Add an excerpt/summary"); return; }

    // Sync content from rich editor if active
    let finalContent = content;
    if (editorMode === "rich" && richEditorRef.current) {
      finalContent = richEditorRef.current.innerHTML;
    }
    if (!finalContent.trim()) { toast.error("Write some content"); return; }

    setIsSaving(true);
    const authorRole = ROLE_CONFIG[user.role]?.shortLabel ?? "Staff";

    try {
      if (mode === "create") {
        await createBlogPost({
          title: title.trim(),
          excerpt: excerpt.trim(),
          content: finalContent,
          coverImage: coverUrl || undefined,
          category,
          tags,
          status: saveStatus,
          featured,
          authorId: user.id,
          authorName: user.name,
          authorAvatar: user.avatarUrl,
          authorRole,
          publishedAt: saveStatus === "published" ? new Date().toISOString() : undefined,
        });
        toast.success(saveStatus === "published" ? "Post published!" : "Draft saved!");
      } else if (existingPost) {
        await updateBlogPost(existingPost.id, {
          title: title.trim(),
          excerpt: excerpt.trim(),
          content: finalContent,
          coverImage: coverUrl || undefined,
          category,
          tags,
          status: saveStatus,
          featured,
        });
        toast.success("Post updated!");
      }
      router.push("/admin/blog");
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Please try again.";
      toast.error(`Failed to save: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Editor mode configs ───────────────────────────────────────────────────
  const editorModeConfig: { value: EditorMode; label: string; icon: React.ElementType; description: string }[] = [
    { value: "rich",     label: "Rich Text", icon: AlignLeft, description: "WYSIWYG — see formatting as you type" },
    { value: "markdown", label: "Markdown",  icon: Type,      description: "Lightweight syntax for writers" },
    { value: "html",     label: "HTML",      icon: Code2,     description: "Full HTML control for developers" },
  ];

  const toolbar = editorMode === "rich" ? null : editorMode === "markdown" ? MARKDOWN_TOOLBAR : MARKDOWN_TOOLBAR;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">
              {mode === "create" ? "New Blog Post" : "Edit Post"}
            </h1>
            {title && (
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                /blog/{slug}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" disabled={isSaving} onClick={() => handleSave("draft")}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </Button>
            <Button className="gap-2 bg-green-600 hover:bg-green-700" disabled={isSaving} onClick={() => handleSave("published")}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              Publish
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Main column ────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Title */}
            <div>
              <Label>Post Title *</Label>
              <Input
                className="mt-1.5 text-lg font-serif h-12"
                placeholder="Write a clear, compelling title…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Excerpt */}
            <div>
              <Label>Excerpt / Summary *</Label>
              <Textarea
                className="mt-1.5"
                placeholder="A 1–2 sentence summary shown on the blog listing page and in search results…"
                rows={2}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                maxLength={300}
              />
              <p className="text-xs text-muted-foreground mt-1">{excerpt.length}/300 characters</p>
            </div>

            {/* Cover image — external URL */}
            <div>
              <Label className="flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                Cover Image URL
              </Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  placeholder="https://images.unsplash.com/photo-… or any image URL"
                  value={coverUrlInput}
                  onChange={(e) => { setCoverUrlInput(e.target.value); setCoverError(false); }}
                  onKeyDown={(e) => e.key === "Enter" && applyCoverUrl()}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" className="shrink-0" onClick={applyCoverUrl}>
                  Apply
                </Button>
                {coverUrl && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => { setCoverUrl(""); setCoverUrlInput(""); }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Paste any public image URL — Unsplash, Pexels, or your own CDN. Recommended: 1200×630px.
              </p>

              {/* Preview */}
              {coverUrl && (
                <div className="mt-3 relative w-full h-44 rounded-xl overflow-hidden border border-border">
                  <Image
                    src={coverUrl}
                    alt="Cover preview"
                    fill
                    className="object-cover"
                    sizes="640px"
                    onError={() => { setCoverError(true); }}
                  />
                  {coverError && (
                    <div className="absolute inset-0 bg-secondary flex items-center justify-center text-muted-foreground text-sm">
                      ⚠ Could not load image — check the URL
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Editor Mode Switcher ──────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Content *</Label>
                <div className="flex gap-1 bg-secondary/60 p-0.5 rounded-xl">
                  {editorModeConfig.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => { setEditorMode(value); setActiveView("write"); }}
                      title={editorModeConfig.find((m) => m.value === value)?.description}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                        editorMode === value
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode description */}
              <p className="text-xs text-muted-foreground mb-3">
                {editorModeConfig.find((m) => m.value === editorMode)?.description}
                {editorMode !== "rich" && (
                  <button
                    onClick={() => setActiveView(activeView === "write" ? "preview" : "write")}
                    className="ml-3 flex-inline items-center gap-1 text-primary hover:underline"
                  >
                    <Eye className="w-3 h-3 inline mr-0.5" />
                    {activeView === "write" ? "Preview" : "Edit"}
                  </button>
                )}
              </p>

              {/* ── RICH TEXT EDITOR ─────────────────────────────────────── */}
              {editorMode === "rich" && (
                <div className="border border-border rounded-2xl overflow-hidden">
                  {/* Toolbar */}
                  <div className="flex items-center flex-wrap gap-0.5 p-2 bg-secondary/50 border-b border-border">
                    {RICH_EXEC_TOOLBAR.map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <button
                          key={tool.title}
                          type="button"
                          title={tool.title}
                          onMouseDown={(e) => {
                            e.preventDefault(); // keep focus in editor
                            tool.exec();
                          }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      );
                    })}
                    <div className="ml-auto text-xs text-muted-foreground px-2">
                      ~{wordCount} words · {readingTime} min read
                    </div>
                  </div>

                  {/* ContentEditable area */}
                  <div
                    ref={richEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleRichEditorInput}
                    className={cn(
                      "min-h-[420px] p-5 outline-none text-foreground text-sm leading-relaxed",
                      "prose prose-sm max-w-none",
                      "[&_h2]:text-xl [&_h2]:font-serif [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-4 [&_h2]:mb-2",
                      "[&_h3]:text-lg [&_h3]:font-serif [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-2",
                      "[&_p]:text-muted-foreground [&_p]:mb-3 [&_p]:leading-relaxed",
                      "[&_ul]:list-disc [&_ul]:ml-5 [&_ul]:text-muted-foreground [&_ul]:mb-3",
                      "[&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:text-muted-foreground [&_ol]:mb-3",
                      "[&_li]:mb-1",
                      "[&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:mb-3",
                      "[&_a]:text-primary [&_a]:underline",
                      "[&_hr]:border-border [&_hr]:my-4",
                      "[&_img]:rounded-xl [&_img]:max-w-full",
                      "[&_strong]:text-foreground [&_strong]:font-semibold",
                    )}
                    data-placeholder={!content ? "Start writing your article… Use the toolbar above to format." : ""}
                    style={{
                      "--placeholder-color": "var(--muted-foreground)",
                    } as React.CSSProperties}
                  />
                  <style>{`
                    [contenteditable]:empty:before {
                      content: attr(data-placeholder);
                      color: var(--muted-foreground);
                      pointer-events: none;
                    }
                  `}</style>
                </div>
              )}

              {/* ── MARKDOWN / HTML EDITOR ───────────────────────────────── */}
              {editorMode !== "rich" && (
                <>
                  {/* Toolbar for markdown / html */}
                  {activeView === "write" && (
                    <div className="flex items-center flex-wrap gap-0.5 p-2 bg-secondary/50 border border-border rounded-t-2xl border-b-0">
                      {(editorMode === "markdown" ? MARKDOWN_TOOLBAR : [
                        { icon: Heading2,    title: "h2 tag",      action: (s: string) => `<h2>${s || "Heading"}</h2>`, wrapLine: true },
                        { icon: Heading3,    title: "h3 tag",      action: (s: string) => `<h3>${s || "Heading"}</h3>`, wrapLine: true },
                        { icon: Bold,        title: "strong tag",  action: (s: string) => `<strong>${s || "bold"}</strong>` },
                        { icon: Italic,      title: "em tag",      action: (s: string) => `<em>${s || "italic"}</em>` },
                        { icon: List,        title: "ul list",     action: () => `<ul>\n  <li>Item</li>\n  <li>Item</li>\n</ul>`, wrapLine: true },
                        { icon: ListOrdered, title: "ol list",     action: () => `<ol>\n  <li>Item</li>\n  <li>Item</li>\n</ol>`, wrapLine: true },
                        { icon: Quote,       title: "blockquote",  action: (s: string) => `<blockquote>${s || "Quote"}</blockquote>`, wrapLine: true },
                        { icon: LinkIcon,    title: "a tag",       action: (s: string) => `<a href="URL">${s || "link"}</a>` },
                        { icon: ImageIcon,   title: "img tag",     action: () => `<img src="URL" alt="description" />`, wrapLine: true },
                        { icon: Minus,       title: "hr tag",      action: () => `<hr />`, wrapLine: true },
                      ] as ToolbarAction[]).map((tool) => {
                        const Icon = tool.icon;
                        return (
                          <button
                            key={tool.title}
                            type="button"
                            title={tool.title}
                            onClick={() => handleToolbarInsert(tool as ToolbarAction)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          >
                            <Icon className="w-4 h-4" />
                          </button>
                        );
                      })}
                      <div className="ml-auto text-xs text-muted-foreground px-2">
                        ~{wordCount} words · {readingTime} min read
                      </div>
                    </div>
                  )}

                  {activeView === "write" ? (
                    <Textarea
                      ref={textareaRef}
                      className={cn(
                        "min-h-[420px] resize-y text-sm",
                        activeView === "write" ? "rounded-t-none rounded-b-2xl" : "rounded-2xl",
                        editorMode === "html" && "font-mono"
                      )}
                      placeholder={PLACEHOLDERS[editorMode]}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                  ) : (
                    /* Preview panel */
                    <div
                      className="border border-border rounded-b-2xl p-6 min-h-[420px] bg-card prose prose-sm max-w-none
                        [&_h2]:text-xl [&_h2]:font-serif [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-6 [&_h2]:mb-3
                        [&_h3]:text-lg [&_h3]:font-serif [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-4 [&_h3]:mb-2
                        [&_p]:text-muted-foreground [&_p]:mb-4 [&_p]:leading-relaxed
                        [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:text-muted-foreground [&_ul]:mb-4
                        [&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:text-muted-foreground [&_ol]:mb-4
                        [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground
                        [&_a]:text-primary [&_a]:underline
                        [&_hr]:border-border [&_hr]:my-6
                        [&_strong]:font-semibold [&_strong]:text-foreground
                        [&_img]:rounded-xl [&_img]:max-w-full [&_img]:my-4"
                      dangerouslySetInnerHTML={{ __html: renderContent(content, editorMode) }}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Sidebar ──────────────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Status */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-3 text-sm">Status & Visibility</h3>
              <Select value={status} onValueChange={(v) => setStatus(v as BlogStatus)}>
                <SelectTrigger className="h-9 mb-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">📝 Draft — not visible to public</SelectItem>
                  <SelectItem value="published">🌐 Published — live on the blog</SelectItem>
                  <SelectItem value="archived">📦 Archived — hidden but kept</SelectItem>
                </SelectContent>
              </Select>

              {/* Featured */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div>
                  <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Star className={cn("w-4 h-4", featured ? "fill-accent text-accent" : "text-muted-foreground")} />
                    Featured post
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Shown in the featured section</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={featured}
                  onClick={() => setFeatured(!featured)}
                  className={cn(
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50",
                    featured ? "bg-accent" : "bg-border"
                  )}
                >
                  <span className={cn(
                    "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
                    featured ? "translate-x-4" : "translate-x-1"
                  )} />
                </button>
              </div>
            </div>

            {/* Category */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-3 text-sm">Category *</h3>
              <Select value={category} onValueChange={(v) => setCategory(v as BlogCategory)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BLOG_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                {BLOG_CATEGORIES.find((c) => c.value === category)?.description}
              </p>
            </div>

            {/* Tags */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-3 text-sm flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-muted-foreground" /> Tags
                <span className="text-xs font-normal text-muted-foreground ml-auto">{tags.length}/10</span>
              </h3>
              <Input
                placeholder="Type a tag, press Enter…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={addTag}
                className="h-9 text-sm mb-2"
                disabled={tags.length >= 10}
              />
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 text-xs bg-secondary text-muted-foreground px-2 py-1 rounded-lg">
                      #{tag}
                      <button onClick={() => setTags((p) => p.filter((t) => t !== tag))}>
                        <X className="w-3 h-3 hover:text-foreground" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No tags yet — press Enter to add</p>
              )}
            </div>

            {/* Author */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-3 text-sm">Author</h3>
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">
                {ROLE_CONFIG[user?.role ?? "admin"]?.label ?? "Staff"}
              </p>
            </div>

            {/* SEO Checklist */}
            <div className="bg-secondary/50 rounded-2xl p-4">
              <h3 className="text-xs font-semibold text-foreground mb-3">SEO Checklist</h3>
              <ul className="space-y-2">
                {[
                  { done: title.length >= 30 && title.length <= 70, label: "Title 30–70 characters" },
                  { done: excerpt.length >= 100 && excerpt.length <= 160, label: "Excerpt 100–160 chars" },
                  { done: wordCount >= 300, label: "Content 300+ words" },
                  { done: tags.length >= 2, label: "At least 2 tags" },
                  { done: !!coverUrl && !coverError, label: "Cover image set" },
                  { done: category !== undefined, label: "Category selected" },
                ].map((check) => (
                  <li key={check.label} className={cn(
                    "flex items-center gap-2 text-xs",
                    check.done ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                  )}>
                    <CheckCircle2 className={cn("w-3.5 h-3.5 shrink-0", check.done ? "text-green-500" : "text-border")} />
                    {check.label}
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick save shortcuts reminder */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="text-xs font-semibold text-foreground mb-2">Keyboard shortcuts</h3>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {editorMode === "rich" ? (
                  <>
                    <p><kbd className="bg-secondary px-1.5 py-0.5 rounded text-[10px]">Ctrl+B</kbd> Bold</p>
                    <p><kbd className="bg-secondary px-1.5 py-0.5 rounded text-[10px]">Ctrl+I</kbd> Italic</p>
                    <p><kbd className="bg-secondary px-1.5 py-0.5 rounded text-[10px]">Ctrl+K</kbd> Link</p>
                    <p><kbd className="bg-secondary px-1.5 py-0.5 rounded text-[10px]">Ctrl+Z</kbd> Undo</p>
                  </>
                ) : (
                  <>
                    <p>Click toolbar buttons to insert formatting at cursor</p>
                    <p>Select text first, then click a button to wrap it</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
