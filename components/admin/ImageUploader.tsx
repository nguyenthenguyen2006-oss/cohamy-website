"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, UploadCloud } from "lucide-react";

export function ImageUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setUploading(true);
    setError("");
    const body = new FormData();
    body.set("file", file);

    try {
      const response = await fetch("/api/admin/uploads", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url) {
        setError(
          result.error === "UPLOAD_TOO_LARGE"
            ? "Ảnh vượt quá giới hạn 8 MB."
            : result.error === "UNSUPPORTED_IMAGE_TYPE"
              ? "Chỉ chấp nhận JPG, PNG hoặc WebP."
              : "Upload ảnh thất bại.",
        );
        return;
      }
      onChange(result.url);
    } catch {
      setError("Không thể kết nối máy chủ upload.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {value ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          <Image
            src={value}
            alt="Ảnh đại diện hiện tại"
            width={640}
            height={360}
            className="aspect-[16/9] w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
          <ImagePlus size={32} strokeWidth={1.5} />
        </div>
      )}
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="admin-button-secondary w-full"
      >
        <UploadCloud size={17} />
        {uploading ? "Đang xử lý ảnh..." : "Chọn ảnh để upload"}
      </button>
      <p className="text-xs leading-relaxed text-slate-500">
        JPG, PNG hoặc WebP, tối đa 8 MB. Ảnh được auto-rotate, thu về tối đa
        1920 px và chuyển sang WebP.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
