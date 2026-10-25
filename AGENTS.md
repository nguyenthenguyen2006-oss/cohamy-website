<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cohamy MCP coverage contract

The user requires ChatGPT web to read CRM business data and operate all current Admin workflows through the Cohamy remote MCP. For every feature or data update, explicitly answer in Vietnamese: "MCP có dùng được không? MCP có đọc được dữ liệu này không?" Verify the affected tools against the actual runtime, fix missing coverage, and state any remaining gap. Regenerate and check the MCP operation catalog whenever an API or input contract changes (`npm run crm:mcp:catalog`, `npm run test:crm:mcp:catalog`). Keep server-side permissions, stock/finance invariants, immutable confirmed snapshots, pagination, audit and retry protection intact. Never expose passwords, tokens, encrypted keys, arbitrary SQL, shell or filesystem execution as tools. WordPress and CRM credentials remain separate.
