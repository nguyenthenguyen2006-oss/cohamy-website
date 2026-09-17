import { readFileSync, appendFileSync, mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const local = JSON.parse(readFileSync(".local/secrets.json", "utf8"));
const php = process.env.PHP_BINARY || "php";
const ini = path.join(root, ".local/php.ini");
const wpRoot = path.join(root, ".local/wordpress");
mkdirSync(".local/logs", { recursive: true });
function launch(name, command, args, env = process.env) {
  const child = spawn(command, args, { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => appendFileSync(`.local/logs/${name}.log`, chunk));
  child.on("error", (error) => console.error(`${name} failed: ${error.code}`));
  return child;
}
const env = { ...process.env, BLOG_SOURCE: "wordpress", WORDPRESS_URL: `http://127.0.0.1:${local.cms_port}`, WORDPRESS_ALLOW_LOCAL_HTTP: "true", WORDPRESS_WEBHOOK_SECRET: local.webhook_secret, WORDPRESS_REPLAY_DIR: path.join(root, ".local/webhook-replay"), NEXT_PUBLIC_SITE_URL: "https://cohamy.vn" };
const cms = launch("wordpress", php, ["-c", ini, "-S", `127.0.0.1:${local.cms_port}`, "-t", wpRoot, "scripts/wordpress/router.php"]);
const production = process.argv.includes("--production");
env.COHAMY_ISOLATED_LOCAL_BUILD = "true";
const frontend = launch("next", process.execPath, ["node_modules/next/dist/bin/next", production ? "start" : "dev", "-p", String(local.frontend_port)], env);
writeFileSync(".local/runtime.json", JSON.stringify({ harness: process.pid, cms: cms.pid, frontend: frontend.pid, mode: production ? "production" : "development", distDir: ".local/next-headless", startedAt: new Date().toISOString() }, null, 2));
let running = false;
let cronChild;
const cron = setInterval(() => {
  if (running || existsSync('.local/cron-pause')) return; running = true;
  const child = launch("cron", php, ["-c", ini, "scripts/wordpress/cron.php", wpRoot]); cronChild=child;
  child.on("exit", () => { running = false; });
}, 2000);
function stop() { clearInterval(cron); cronChild?.kill(); cms.kill(); frontend.kill(); try { unlinkSync(".local/runtime.json"); } catch {} process.exit(0); }
process.on("SIGINT", stop); process.on("SIGTERM", stop);
console.log(`WordPress thật: http://127.0.0.1:${local.cms_port}/wp-admin/ | Next.js: http://127.0.0.1:${local.frontend_port} | DB SQLite riêng, cron mỗi 2 giây.`);
