import { loadEnvConfig } from "@next/env";
import { ensureSheetHeader } from "@/lib/google-sheets-blog";

loadEnvConfig(process.cwd(), false);

async function main() {
  await ensureSheetHeader();
  console.log("Sheet Posts đã sẵn sàng với đúng 23 cột.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  console.error(`Không thể khởi tạo sheet: ${message}`);
  process.exitCode = 1;
});
