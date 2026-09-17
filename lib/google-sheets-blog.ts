import "server-only";

import { google, type sheets_v4 } from "googleapis";
import { assertLegacyBlogWrites } from "@/lib/blog-source";
import {
  BLOG_HEADERS,
  blogRowSchema,
  isPublicBlogRow,
  parseSheetBoolean,
  splitCommaList,
  type BlogLocale,
  type BlogRow,
} from "@/lib/blog-schema";

const LAST_COLUMN = "W";
let headerVerified = false;

interface IndexedBlogRow {
  row: BlogRow;
  sheetRow: number;
}

function getConfiguration(): {
  spreadsheetId: string;
  sheetName: string;
  email: string;
  privateKey: string;
} {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const sheetName =
    process.env.GOOGLE_SHEETS_POSTS_SHEET?.trim() || "Posts";
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/gu, "\n").trim();

  if (!spreadsheetId || !email || !privateKey) {
    throw new Error("BLOG_SHEETS_NOT_CONFIGURED");
  }

  return { spreadsheetId, sheetName, email, privateKey };
}

function getClient(): {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string;
} {
  const { spreadsheetId, sheetName, email, privateKey } = getConfiguration();
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return {
    sheets: google.sheets({ version: "v4", auth }),
    spreadsheetId,
    sheetName,
  };
}

function quoteSheetName(sheetName: string): string {
  return `'${sheetName.replace(/'/gu, "''")}'`;
}

function sheetError(error: unknown): never {
  const candidate = error as {
    code?: number | string;
    response?: {
      status?: number;
      data?: { error?: { code?: number; message?: string } };
    };
    message?: string;
  };
  const status = Number(
    candidate.response?.status ??
      candidate.response?.data?.error?.code ??
      candidate.code,
  );

  if (status === 403) throw new Error("BLOG_SHEET_PERMISSION_DENIED");
  if (status === 404) throw new Error("BLOG_SPREADSHEET_NOT_FOUND");

  const sourceMessage =
    candidate.response?.data?.error?.message ?? candidate.message ?? "";
  if (/requested entity was not found|unable to parse range/iu.test(sourceMessage)) {
    throw new Error("BLOG_SPREADSHEET_NOT_FOUND");
  }

  throw new Error("BLOG_SHEETS_API_FAILED");
}

function cell(value: unknown): string {
  return String(value ?? "").trim();
}

function rowFromCells(values: unknown[], rowNumber: number): BlogRow {
  const record = Object.fromEntries(
    BLOG_HEADERS.map((header, index) => [header, values[index] ?? ""]),
  );

  const parsed = blogRowSchema.safeParse({
    id: cell(record.id),
    group_id: cell(record.group_id),
    locale: cell(record.locale),
    slug: cell(record.slug),
    title: cell(record.title),
    excerpt: cell(record.excerpt),
    content_html: String(record.content_html ?? ""),
    cover_image: cell(record.cover_image),
    cover_image_alt: cell(record.cover_image_alt),
    author: cell(record.author),
    category: cell(record.category),
    tags: splitCommaList(record.tags),
    featured: parseSheetBoolean(record.featured),
    related_product_ids: splitCommaList(record.related_product_ids),
    seo_title: cell(record.seo_title),
    seo_description: cell(record.seo_description),
    canonical_url: cell(record.canonical_url),
    robots_index: parseSheetBoolean(record.robots_index, true),
    status: cell(record.status),
    scheduled_at: cell(record.scheduled_at),
    published_at: cell(record.published_at),
    created_at: cell(record.created_at),
    updated_at: cell(record.updated_at),
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`BLOG_SHEET_ROW_INVALID:${rowNumber}:${details}`);
  }

  return parsed.data;
}

function cellsFromRow(row: BlogRow): (string | boolean)[] {
  return [
    row.id,
    row.group_id,
    row.locale,
    row.slug,
    row.title,
    row.excerpt,
    row.content_html,
    row.cover_image,
    row.cover_image_alt,
    row.author,
    row.category,
    row.tags.join(","),
    row.featured,
    row.related_product_ids.join(","),
    row.seo_title,
    row.seo_description,
    row.canonical_url,
    row.robots_index,
    row.status,
    row.scheduled_at,
    row.published_at,
    row.created_at,
    row.updated_at,
  ];
}

async function verifyHeaderOnce(): Promise<void> {
  if (headerVerified) return;
  await ensureSheetHeader();
  headerVerified = true;
}

async function getIndexedRows(): Promise<IndexedBlogRow[]> {
  await verifyHeaderOnce();
  const { sheets, spreadsheetId, sheetName } = getClient();
  const range = `${quoteSheetName(sheetName)}!A2:${LAST_COLUMN}`;

  try {
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [range],
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const values = response.data.valueRanges?.[0]?.values ?? [];
    return values
      .map((row, index) => ({ values: row, sheetRow: index + 2 }))
      .filter(({ values }) => values.some((value) => cell(value) !== ""))
      .map(({ values, sheetRow }) => ({
        row: rowFromCells(values, sheetRow),
        sheetRow,
      }));
  } catch (error) {
    sheetError(error);
  }
}

function assertUnique(rows: BlogRow[]): void {
  const slugs = new Map<string, string>();
  const groups = new Map<string, string>();

  for (const row of rows) {
    const slugKey = `${row.locale}:${row.slug}`;
    const groupKey = `${row.group_id}:${row.locale}`;
    const slugOwner = slugs.get(slugKey);
    const groupOwner = groups.get(groupKey);

    if (slugOwner && slugOwner !== row.id) {
      throw new Error("DUPLICATE_LOCALE_SLUG");
    }
    if (groupOwner && groupOwner !== row.id) {
      throw new Error("DUPLICATE_GROUP_LOCALE");
    }

    slugs.set(slugKey, row.id);
    groups.set(groupKey, row.id);
  }
}

export function isBlogSheetsConfigured(): boolean {
  try {
    getConfiguration();
    return true;
  } catch {
    return false;
  }
}

export async function ensureSheetHeader(): Promise<void> {
  const { sheets, spreadsheetId, sheetName } = getClient();

  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    const existingSheet = spreadsheet.data.sheets?.find(
      (sheet) => sheet.properties?.title === sheetName,
    );

    if (!existingSheet) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
      });
    }

    const headerRange = `${quoteSheetName(sheetName)}!A1:${LAST_COLUMN}1`;
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: headerRange,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const current = (headerResponse.data.values?.[0] ?? []).map(cell);

    if (current.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: headerRange,
        valueInputOption: "RAW",
        requestBody: { values: [[...BLOG_HEADERS]] },
      });
      headerVerified = true;
      return;
    }

    const mismatches = BLOG_HEADERS.flatMap((expected, index) => {
      const actual = current[index] ?? "(thiếu)";
      return actual === expected
        ? []
        : [`cột ${index + 1}: cần "${expected}", hiện là "${actual}"`];
    });
    if (current.length > BLOG_HEADERS.length) {
      mismatches.push(
        `dư ${current.length - BLOG_HEADERS.length} cột sau ${LAST_COLUMN}`,
      );
    }

    if (mismatches.length > 0) {
      throw new Error(`BLOG_SHEET_HEADER_INVALID:${mismatches.join("; ")}`);
    }

    headerVerified = true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("BLOG_SHEET_HEADER_INVALID")
    ) {
      throw error;
    }
    sheetError(error);
  }
}

export async function getAllRows(): Promise<BlogRow[]> {
  return (await getIndexedRows()).map(({ row }) => row);
}

/** Read-only migration export: never creates a tab or repairs/writes headers. */
export async function getBlogRowsForMigration(): Promise<BlogRow[]> {
  const { sheets, spreadsheetId, sheetName } = getClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${quoteSheetName(sheetName)}!A1:${LAST_COLUMN}`, valueRenderOption: "UNFORMATTED_VALUE" });
  const values = response.data.values ?? [];
  if (values[0]?.length !== BLOG_HEADERS.length || BLOG_HEADERS.some((header, index) => cell(values[0]?.[index]) !== header)) throw new Error("BLOG_SHEET_HEADER_INVALID");
  return values.slice(1).flatMap((cells, index) => cells.some((value) => cell(value)) ? [rowFromCells(cells, index + 2)] : []);
}

export async function getPublishedRows(): Promise<BlogRow[]> {
  const now = new Date();
  return (await getAllRows()).filter((row) => isPublicBlogRow(row, now));
}

export async function getRowById(id: string): Promise<BlogRow | undefined> {
  return (await getAllRows()).find((row) => row.id === id);
}

export async function getPostBySlug(
  locale: BlogLocale,
  slug: string,
): Promise<BlogRow | undefined> {
  return (await getPublishedRows()).find(
    (row) => row.locale === locale && row.slug === slug,
  );
}

export async function checkDuplicateSlug(
  locale: BlogLocale,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  return (await getAllRows()).some(
    (row) =>
      row.locale === locale &&
      row.slug === slug &&
      (!excludeId || row.id !== excludeId),
  );
}

export async function createRow(data: BlogRow): Promise<BlogRow> {
  assertLegacyBlogWrites();
  const parsed = blogRowSchema.parse(data);
  const current = await getAllRows();
  assertUnique([...current, parsed]);

  const { sheets, spreadsheetId, sheetName } = getClient();
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${quoteSheetName(sheetName)}!A:${LAST_COLUMN}`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [cellsFromRow(parsed)] },
    });
    return parsed;
  } catch (error) {
    sheetError(error);
  }
}

export async function updateRow(
  id: string,
  data: BlogRow,
): Promise<BlogRow> {
  assertLegacyBlogWrites();
  const parsed = blogRowSchema.parse({ ...data, id });
  const indexed = await getIndexedRows();
  const target = indexed.find(({ row }) => row.id === id);
  if (!target) throw new Error("BLOG_ROW_NOT_FOUND");

  const merged = indexed.map(({ row }) => (row.id === id ? parsed : row));
  assertUnique(merged);

  const { sheets, spreadsheetId, sheetName } = getClient();
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheetName(sheetName)}!A${target.sheetRow}:${LAST_COLUMN}${target.sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [cellsFromRow(parsed)] },
    });
    return parsed;
  } catch (error) {
    sheetError(error);
  }
}

export async function archiveRow(id: string): Promise<BlogRow> {
  assertLegacyBlogWrites();
  const current = await getRowById(id);
  if (!current) throw new Error("BLOG_ROW_NOT_FOUND");
  return updateRow(id, {
    ...current,
    status: "archived",
    updated_at: new Date().toISOString(),
  });
}

export async function upsertRows(rows: BlogRow[]): Promise<{
  created: number;
  updated: number;
}> {
  assertLegacyBlogWrites();
  const parsedRows = rows.map((row) => blogRowSchema.parse(row));
  assertUnique(parsedRows);

  const indexed = await getIndexedRows();
  const byGroupLocale = new Map(
    indexed.map((item) => [
      `${item.row.group_id}:${item.row.locale}`,
      item,
    ]),
  );
  const finalRows = [...indexed.map(({ row }) => row)];
  const writes: { range: string; values: (string | boolean)[][] }[] = [];
  const { sheets, spreadsheetId, sheetName } = getClient();
  let nextRow = indexed.reduce(
    (maximum, item) => Math.max(maximum, item.sheetRow),
    1,
  ) + 1;
  let created = 0;
  let updated = 0;

  for (const row of parsedRows) {
    const key = `${row.group_id}:${row.locale}`;
    const existing = byGroupLocale.get(key);
    if (existing) {
      const targetIndex = finalRows.findIndex(
        (candidate) => candidate.id === existing.row.id,
      );
      const replacement = {
        ...row,
        id: existing.row.id,
        created_at: existing.row.created_at,
      };
      finalRows[targetIndex] = replacement;
      writes.push({
        range: `${quoteSheetName(sheetName)}!A${existing.sheetRow}:${LAST_COLUMN}${existing.sheetRow}`,
        values: [cellsFromRow(replacement)],
      });
      updated += 1;
    } else {
      finalRows.push(row);
      writes.push({
        range: `${quoteSheetName(sheetName)}!A${nextRow}:${LAST_COLUMN}${nextRow}`,
        values: [cellsFromRow(row)],
      });
      byGroupLocale.set(key, { row, sheetRow: nextRow });
      nextRow += 1;
      created += 1;
    }
  }

  assertUnique(finalRows);
  if (writes.length === 0) return { created, updated };

  try {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: writes,
      },
    });
    return { created, updated };
  } catch (error) {
    sheetError(error);
  }
}
