// v1.4 交付截图：minimal 首页、hover 浮层特写、hearthstone 对比。
// 用法：pnpm build && PORT=3100 pnpm start，然后 node scripts/shoot-v14.mjs
import puppeteer from "puppeteer";
import { existsSync } from "node:fs";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3100";
const OUT = process.env.ATLAS_OUT ?? "/tmp/atlas-v14-shot";
const SYSTEM_CHROME = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter((p) => p && existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer
  .launch({ headless: "shell" })
  .catch(() => puppeteer.launch({ headless: "shell", executablePath: SYSTEM_CHROME[0] }));

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950, deviceScaleFactor: 2 });
await page.evaluateOnNewDocument(() => localStorage.clear());
await page.goto(BASE, { waitUntil: "networkidle2" });
await page.waitForSelector("[data-slot-id]");
await sleep(1200);

await page.screenshot({ path: `${OUT}-1-hearthstone.png` });
console.log(`${OUT}-1-hearthstone.png`);

await page.click('[data-theme-option="minimal"]');
await page.waitForSelector("[data-minimal-card]");
await sleep(1400);
await page.screenshot({ path: `${OUT}-2-minimal-home.png` });
console.log(`${OUT}-2-minimal-home.png`);

// hover 浮层（选有 comment 的卡，内容最全）
const target = await page.evaluate(() => {
  const card = document.querySelector("[data-comment-dot]").closest("[data-minimal-card]");
  const r = card.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + 14) };
});
await page.mouse.move(target.x, target.y);
await page.waitForSelector("[data-person-panel]");
await sleep(600);
await page.screenshot({ path: `${OUT}-3-minimal-hover.png` });
console.log(`${OUT}-3-minimal-hover.png`);

const clip = await page.evaluate(() => {
  const p = document.querySelector("[data-person-panel]").getBoundingClientRect();
  const c = document.querySelector("[data-comment-dot]").closest("[data-minimal-card]").getBoundingClientRect();
  const x = Math.max(0, Math.min(p.x, c.x) - 24);
  const y = Math.max(0, Math.min(p.y, c.y) - 24);
  return {
    x,
    y,
    width: Math.min(window.innerWidth - x, p.right - x + 24),
    height: Math.min(window.innerHeight - y, Math.max(p.bottom, c.bottom) - y + 24),
  };
});
await page.screenshot({ path: `${OUT}-4-hover-closeup.png`, clip });
console.log(`${OUT}-4-hover-closeup.png`);

// 钉住态
await page.mouse.click(target.x, target.y);
await sleep(400);
await page.mouse.move(900, 880);
await sleep(500);
await page.screenshot({ path: `${OUT}-5-minimal-pinned.png`, clip });
console.log(`${OUT}-5-minimal-pinned.png`);
await page.keyboard.press("Escape");

// 借调虚线箭头：应用平台 tab
const tabs = await page.$$('[role="tab"]');
for (const t of tabs) {
  if ((await t.evaluate((el) => el.textContent ?? "")).includes("应用平台")) {
    await t.click();
    break;
  }
}
await page.waitForSelector("[data-loan-link]");
await sleep(1200);
await page.screenshot({ path: `${OUT}-6-minimal-loan-arrow.png` });
console.log(`${OUT}-6-minimal-loan-arrow.png`);

// 切回 hearthstone 对比
await page.click('[data-theme-option="hearthstone"]');
await sleep(1600);
await page.screenshot({ path: `${OUT}-7-hearthstone-after.png` });
console.log(`${OUT}-7-hearthstone-after.png`);

await browser.close();
