// README 截图：hearthstone 主视图 / minimal 主视图 / 翻卡看 comment。
// 用法：pnpm build && PORT=3210 pnpm start，然后
//   ATLAS_BASE=http://127.0.0.1:3210 node scripts/shoot-readme.mjs
import puppeteer from "puppeteer";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.ATLAS_BASE ?? "http://127.0.0.1:3210";
const OUT = process.env.ATLAS_OUT ?? join(dirname(fileURLToPath(import.meta.url)), "../docs/screenshots");

// 本机下载 puppeteer 自带 Chrome 不稳定，回退到系统 Chrome。
const SYSTEM_CHROME = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].filter((p) => p && existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer
  .launch({ headless: "shell" })
  .catch(() => puppeteer.launch({ headless: "shell", executablePath: SYSTEM_CHROME[0] }));

const page = await browser.newPage();
// 1600x1000 @1x：README 里显示清晰，文件又不至于过大。
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
// 上一次运行记住的主题会污染截图，先清掉。
await page.evaluateOnNewDocument(() => localStorage.clear());

await page.goto(BASE, { waitUntil: "networkidle2" });
await page.waitForSelector("[data-slot-id]");
await sleep(1500);

const shot = async (name) => {
  const path = join(OUT, name);
  await page.screenshot({ path });
  console.log(path);
};

await shot("hearthstone.png");

// 翻卡：挑一张带 comment 的人物卡（缺口卡也会翻，用 data-gap-role 排除）。
const flipTarget = await page.evaluate(() => {
  const card = document.querySelector('[data-slot-id][role="button"]:not([data-gap-role])');
  if (!card) throw new Error("找不到可翻转的人物卡");
  const r = card.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
await page.mouse.click(flipTarget.x, flipTarget.y);
await sleep(1200);
await shot("flip.png");
// 翻回正面，避免影响后续截图。
await page.mouse.click(flipTarget.x, flipTarget.y);
await sleep(800);

await page.click('[data-theme-option="minimal"]');
await page.waitForSelector("[data-minimal-card]");
await sleep(1600);
await shot("minimal.png");

await browser.close();
