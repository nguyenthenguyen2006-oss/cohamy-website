import "server-only";

import { mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

function getUploadConfig(): { directory: string; baseUrl: string } {
  const directory = process.env.UPLOAD_DIR?.trim();
  const baseUrl = process.env.NEXT_PUBLIC_UPLOAD_BASE_URL?.trim();
  if (!directory || !baseUrl) throw new Error("UPLOAD_NOT_CONFIGURED");
  return {
    directory: path.resolve(directory),
    baseUrl: baseUrl.replace(/\/+$/u, ""),
  };
}

export async function isUploadDirectoryWritable(): Promise<boolean> {
  try {
    const { directory } = getUploadConfig();
    await mkdir(directory, { recursive: true });
    await access(directory, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function processBlogUpload(file: File): Promise<{
  url: string;
  width: number;
  height: number;
  bytes: number;
}> {
  if (file.size === 0) throw new Error("EMPTY_UPLOAD");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("UPLOAD_TOO_LARGE");

  const input = Buffer.from(await file.arrayBuffer());
  const image = sharp(input, {
    failOn: "error",
    limitInputPixels: 40_000_000,
  });

  try {
    const metadata = await image.metadata();

    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
      throw new Error("UNSUPPORTED_IMAGE_TYPE");
    }

    const { directory, baseUrl } = getUploadConfig();
    await mkdir(directory, { recursive: true });

    const fileName = `${randomUUID()}.webp`;
    const target = path.resolve(directory, fileName);
    const relative = path.relative(directory, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("INVALID_UPLOAD_PATH");
    }

    const result = await image
      .rotate()
      .resize({
        width: 1920,
        withoutEnlargement: true,
        fit: "inside",
      })
      .webp({ quality: 83, effort: 4 })
      .toFile(target);

    return {
      url: `${baseUrl}/${fileName}`,
      width: result.width,
      height: result.height,
      bytes: result.size,
    };
  } finally {
    image.destroy();
  }
}
