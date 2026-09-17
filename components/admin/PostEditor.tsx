"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RotateCcw,
  Undo2,
} from "lucide-react";

interface PostEditorProps {
  value: string;
  onChange: (html: string) => void;
}

function ToolbarButton({
  active = false,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-lg p-2 transition ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      {children}
    </button>
  );
}

export function PostEditor({ value, onChange }: PostEditorProps) {
  const [showHtml, setShowHtml] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
      }),
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      ImageExtension.configure({
        allowBase64: false,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "admin-editor-content min-h-96 px-5 py-4 outline-none",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== value && !showHtml) {
      editor?.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, showHtml, value]);

  if (!editor) {
    return (
      <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
    );
  }

  function setLink() {
    const previous = editor?.getAttributes("link").href as string | undefined;
    const href = window.prompt("Nhập URL liên kết", previous ?? "https://");
    if (href === null) return;
    if (!href.trim()) {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      ?.chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: href.trim() })
      .run();
  }

  function addImage() {
    const src = window.prompt("Nhập URL ảnh (không dùng base64)", "https://");
    if (!src?.trim() || src.startsWith("data:")) return;
    const alt = window.prompt("Nhập alt ảnh", "") ?? "";
    editor?.chain().focus().setImage({ src: src.trim(), alt }).run();
  }

  function toggleHtml() {
    if (showHtml) {
      editor?.commands.setContent(value, { emitUpdate: false });
    }
    setShowHtml((current) => !current);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-600/15">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2">
        <ToolbarButton
          label="Tiêu đề H2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 size={18} />
        </ToolbarButton>
        <ToolbarButton
          label="Tiêu đề H3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 size={18} />
        </ToolbarButton>
        <ToolbarButton
          label="In đậm"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={18} />
        </ToolbarButton>
        <ToolbarButton
          label="In nghiêng"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={18} />
        </ToolbarButton>
        <ToolbarButton
          label="Danh sách"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={18} />
        </ToolbarButton>
        <ToolbarButton
          label="Danh sách đánh số"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={18} />
        </ToolbarButton>
        <ToolbarButton
          label="Trích dẫn"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={18} />
        </ToolbarButton>
        <ToolbarButton
          label="Liên kết"
          active={editor.isActive("link")}
          onClick={setLink}
        >
          <Link2 size={18} />
        </ToolbarButton>
        <ToolbarButton label="Chèn ảnh" onClick={addImage}>
          <ImagePlus size={18} />
        </ToolbarButton>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <ToolbarButton
          label="Hoàn tác"
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={18} />
        </ToolbarButton>
        <ToolbarButton
          label="Làm lại"
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={18} />
        </ToolbarButton>
        <button
          type="button"
          onClick={toggleHtml}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400"
        >
          {showHtml ? <RotateCcw size={15} /> : null}
          {showHtml ? "Quay lại editor" : "Xem HTML"}
        </button>
      </div>

      {showHtml ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-96 w-full resize-y bg-slate-950 p-5 font-mono text-sm leading-relaxed text-slate-100 outline-none"
          aria-label="HTML nội dung"
          spellCheck={false}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}
