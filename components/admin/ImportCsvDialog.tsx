"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Download, FileUp, X } from "lucide-react";
import { BLOG_HEADERS } from "@/lib/blog-schema";

type CsvRow = Record<string, string>;

const CSV_TEMPLATE_DEFAULTS: CsvRow = {
  locale: "vi",
  author: "Cohamy Editorial",
  category: "chocolate",
  featured: "FALSE",
  robots_index: "TRUE",
  status: "draft",
};

export function downloadBlogCsvTemplate() {
  const templateRow = Object.fromEntries(
    BLOG_HEADERS.map((header) => [
      header,
      CSV_TEMPLATE_DEFAULTS[header] ?? "",
    ]),
  );
  const csv = Papa.unparse([templateRow], {
    columns: [...BLOG_HEADERS],
    delimiter: ";",
    newline: "\r\n",
  });
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cohamy-blog-import-excel.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ImportCsvDialog() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [preserveStatus, setPreserveStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    succeeded: number;
    failed: number;
    errors: { row: number; reason: string }[];
  } | null>(null);

  function close() {
    if (submitting) return;
    setOpen(false);
    setRows([]);
    setFileName("");
    setParseError("");
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function parse(file: File) {
    setParseError("");
    setResult(null);
    setFileName(file.name);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
      complete: (parsed) => {
        const actual = parsed.meta.fields ?? [];
        const missing = BLOG_HEADERS.filter(
          (header) => !actual.includes(header),
        );
        const extra = actual.filter(
          (header) => !BLOG_HEADERS.includes(header as (typeof BLOG_HEADERS)[number]),
        );
        if (missing.length || extra.length) {
          setRows([]);
          setParseError(
            [
              missing.length ? `Thiếu cột: ${missing.join(", ")}` : "",
              extra.length ? `Cột không hợp lệ: ${extra.join(", ")}` : "",
            ]
              .filter(Boolean)
              .join(". "),
          );
          return;
        }
        if (parsed.errors.length > 0) {
          setParseError(
            parsed.errors
              .slice(0, 5)
              .map((error) => `Dòng ${(error.row ?? 0) + 2}: ${error.message}`)
              .join(". "),
          );
        }
        setRows(parsed.data);
      },
      error: () => {
        setParseError("Không thể đọc file CSV.");
      },
    });
  }

  async function importRows() {
    if (rows.length === 0) return;
    setSubmitting(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/posts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, preserveStatus }),
      });
      const data = (await response.json()) as {
        total?: number;
        succeeded?: number;
        failed?: number;
        errors?: { row: number; reason: string }[];
        error?: string;
      };
      if (!response.ok) {
        setParseError(data.error || "Import thất bại.");
        return;
      }
      setResult({
        total: data.total ?? rows.length,
        succeeded: data.succeeded ?? 0,
        failed: data.failed ?? 0,
        errors: data.errors ?? [],
      });
      router.refresh();
    } catch {
      setParseError("Không thể kết nối máy chủ.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={downloadBlogCsvTemplate}
        className="admin-button-secondary"
      >
        <Download size={17} />
        Tải CSV mẫu
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="admin-button-secondary"
      >
        <FileUp size={17} />
        Import CSV
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="csv-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="max-h-[90dvh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 id="csv-title" className="text-lg font-semibold">
                  Import bài viết từ CSV
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  CSV phải có đúng 23 cột giống sheet Posts.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Đóng"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-950">
                    Chưa có file đúng mẫu?
                  </p>
                  <p className="mt-1 text-xs text-amber-900/75">
                    Tải file có sẵn 23 cột và một dòng mặc định, sau đó nhân
                    dòng để thêm nhiều bài viết.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadBlogCsvTemplate}
                  className="admin-button-secondary shrink-0"
                >
                  <Download size={17} />
                  Tải CSV mẫu
                </button>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) parse(file);
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center hover:border-amber-600"
              >
                <FileUp size={28} className="text-amber-700" />
                <span className="mt-3 font-medium">
                  {fileName || "Chọn file CSV"}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  Tối đa 1.000 dòng mỗi lần import
                </span>
              </button>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={preserveStatus}
                  onChange={(event) => setPreserveStatus(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-700 focus:ring-amber-600"
                />
                <span>
                  Giữ trạng thái trong CSV
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Mặc định an toàn là chuyển tất cả bài hợp lệ thành draft.
                  </span>
                </span>
              </label>

              {parseError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  {parseError}
                </p>
              ) : null}

              {rows.length > 0 ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">
                      Preview {Math.min(5, rows.length)} / {rows.length} dòng
                    </h3>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          {["locale", "slug", "title", "status", "category"].map(
                            (header) => (
                              <th key={header} className="px-3 py-2 font-semibold">
                                {header}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.slice(0, 5).map((row, index) => (
                          <tr key={`${row.slug}-${index}`}>
                            <td className="px-3 py-2">{row.locale}</td>
                            <td className="max-w-52 truncate px-3 py-2 font-mono">
                              {row.slug}
                            </td>
                            <td className="max-w-72 truncate px-3 py-2">
                              {row.title}
                            </td>
                            <td className="px-3 py-2">{row.status}</td>
                            <td className="px-3 py-2">{row.category}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {result ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold">Kết quả import</p>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <p>Tổng: {result.total}</p>
                    <p className="text-emerald-700">
                      Thành công: {result.succeeded}
                    </p>
                    <p className="text-red-700">Thất bại: {result.failed}</p>
                  </div>
                  {result.errors.length > 0 ? (
                    <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto text-xs text-red-800">
                      {result.errors.map((item) => (
                        <li key={`${item.row}-${item.reason}`}>
                          Dòng {item.row}: {item.reason}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={close}
                  className="admin-button-secondary"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={rows.length === 0 || submitting}
                  onClick={() => void importRows()}
                  className="admin-button"
                >
                  {submitting ? "Đang import..." : `Import ${rows.length} dòng`}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
