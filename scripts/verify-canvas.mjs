// Structured verification of the v1.2 canvas: scroll lock, pan, zoom, toolbar,
// per-tab fit, and card interactivity. Run with the dev/prod server on :3000.
import puppeteer from "puppeteer";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "/tmp/atlas-v12";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

/** Reads the canvas content layer's transform as {x, y, scale}. */
const readView = (page) =>
  page.$eval("[data-slot=tabs-content] .will-change-transform", (el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { x: m.e, y: m.f, scale: m.a };
  });

const viewportBox = (page) =>
  page.$eval("[data-slot=tabs-content] > div", (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

await mkdir(OUT, { recursive: true });

let browser;
try {
  browser = await puppeteer.launch({ headless: true, executablePath: CHROME });
} catch {
  browser = await puppeteer.launch({ headless: true });
}

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "networkidle0", timeout: 60_000 });
await page.waitForSelector("[data-slot-id]", { timeout: 30_000 });
await new Promise((r) => setTimeout(r, 1200));

// 1. Page must not scroll in either axis.
const scroll = await page.evaluate(() => ({
  docV: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  docH: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  bodyV: document.body.scrollHeight - document.body.clientHeight,
  bodyH: document.body.scrollWidth - document.body.clientWidth,
}));
check(
  "body/html 无滚动",
  scroll.docV <= 0 && scroll.docH <= 0 && scroll.bodyV <= 0 && scroll.bodyH <= 0,
  JSON.stringify(scroll),
);

// 2. Toolbar + tabs stay on screen even though the tree is far larger.
const chrome = await page.evaluate(() => {
  const inView = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0;
  };
  return { header: inView("header"), tabs: inView("[data-slot=tabs-list]") };
});
check("header 与 tabs 始终可见", chrome.header === true && chrome.tabs === true, JSON.stringify(chrome));

// 3. Content is bigger than the viewport, i.e. fit actually had work to do.
const box = await viewportBox(page);
const content = await page.$eval("#atlas-canvas", (el) => ({
  w: el.offsetWidth,
  h: el.offsetHeight,
}));
const fitted = await readView(page);
check(
  "初始 fit-to-content",
  fitted.scale > 0.19 && fitted.scale <= 1.001,
  `content ${content.w}x${content.h} → viewport ${Math.round(box.width)}x${Math.round(box.height)}, scale ${fitted.scale.toFixed(3)}`,
);
const scaledW = content.w * fitted.scale;
const scaledH = content.h * fitted.scale;
check(
  "fit 后内容居中且完整可见",
  scaledW <= box.width + 1 &&
    scaledH <= box.height + 1 &&
    Math.abs(fitted.x - (box.width - scaledW) / 2) < 2 &&
    Math.abs(fitted.y - (box.height - scaledH) / 2) < 2,
  `x=${fitted.x.toFixed(1)} y=${fitted.y.toFixed(1)} scaled ${Math.round(scaledW)}x${Math.round(scaledH)}`,
);

await page.screenshot({ path: `${OUT}/01-fit.png` });

// 4. Drag on empty canvas pans without changing zoom.
const emptySpot = { x: box.x + 24, y: box.y + box.height - 60 };
await page.mouse.move(emptySpot.x, emptySpot.y);
await page.mouse.down();
await page.mouse.move(emptySpot.x + 160, emptySpot.y - 90, { steps: 12 });
await page.mouse.up();
const panned = await readView(page);
check(
  "空白处拖拽平移",
  Math.abs(panned.x - fitted.x - 160) < 3 &&
    Math.abs(panned.y - fitted.y + 90) < 3 &&
    Math.abs(panned.scale - fitted.scale) < 1e-6,
  `Δx=${(panned.x - fitted.x).toFixed(1)} Δy=${(panned.y - fitted.y).toFixed(1)} scale 未变=${panned.scale === fitted.scale}`,
);

// 5. Wheel zooms, anchored at the cursor.
const pivot = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
await page.mouse.move(pivot.x, pivot.y);
const worldBefore = await page.evaluate(
  ({ px, py }) => {
    const el = document.querySelector("[data-slot=tabs-content] .will-change-transform");
    const m = new DOMMatrix(getComputedStyle(el).transform);
    const r = el.parentElement.getBoundingClientRect();
    return { wx: (px - r.left - m.e) / m.a, wy: (py - r.top - m.f) / m.a };
  },
  { px: pivot.x, py: pivot.y },
);
await page.mouse.wheel({ deltaY: -420 });
await new Promise((r) => setTimeout(r, 250));
const zoomed = await readView(page);
check("滚轮放大", zoomed.scale > panned.scale * 1.05, `${panned.scale.toFixed(3)} → ${zoomed.scale.toFixed(3)}`);

const worldAfter = await page.evaluate(
  ({ px, py }) => {
    const el = document.querySelector("[data-slot=tabs-content] .will-change-transform");
    const m = new DOMMatrix(getComputedStyle(el).transform);
    const r = el.parentElement.getBoundingClientRect();
    return { wx: (px - r.left - m.e) / m.a, wy: (py - r.top - m.f) / m.a };
  },
  { px: pivot.x, py: pivot.y },
);
check(
  "缩放以光标为锚点",
  Math.abs(worldAfter.wx - worldBefore.wx) < 2 && Math.abs(worldAfter.wy - worldBefore.wy) < 2,
  `世界坐标漂移 (${(worldAfter.wx - worldBefore.wx).toFixed(2)}, ${(worldAfter.wy - worldBefore.wy).toFixed(2)})`,
);

// 6. Zoom clamps at maxZoom = 3.
for (let i = 0; i < 40; i += 1) await page.mouse.wheel({ deltaY: -600 });
await new Promise((r) => setTimeout(r, 300));
const maxed = await readView(page);
check("放大上限 3×", Math.abs(maxed.scale - 3) < 0.01, `scale=${maxed.scale.toFixed(4)}`);

for (let i = 0; i < 80; i += 1) await page.mouse.wheel({ deltaY: 600 });
await new Promise((r) => setTimeout(r, 300));
const minned = await readView(page);
check("缩小下限 0.2×", Math.abs(minned.scale - 0.2) < 0.01, `scale=${minned.scale.toFixed(4)}`);

// 7. Toolbar: percentage readout, reset, fit.
const label = await page.$eval("[data-canvas-toolbar] button.font-mono", (el) => el.textContent.trim());
check("工具条百分比与实际缩放一致", label === `${Math.round(minned.scale * 100)}%`, `显示 ${label}`);

await page.click('[data-canvas-toolbar] [aria-label^="复位"]');
await new Promise((r) => setTimeout(r, 250));
const resetView = await readView(page);
check("复位按钮回到 100%", Math.abs(resetView.scale - 1) < 1e-6, `scale=${resetView.scale}`);

await page.click('[data-canvas-toolbar] [aria-label^="适应窗口"]');
await new Promise((r) => setTimeout(r, 350));
const refit = await readView(page);
check(
  "适应窗口按钮复现初始 fit",
  Math.abs(refit.scale - fitted.scale) < 1e-3 && Math.abs(refit.x - fitted.x) < 2,
  `scale=${refit.scale.toFixed(3)}`,
);

// 150% demo screenshot.
await page.evaluate(() => {
  document.querySelector('[data-canvas-toolbar] [aria-label^="复位"]').click();
});
await new Promise((r) => setTimeout(r, 200));
await page.mouse.move(pivot.x, pivot.y);
await page.mouse.wheel({ deltaY: -225 });
await new Promise((r) => setTimeout(r, 300));
const demoZoom = await readView(page);
await page.screenshot({ path: `${OUT}/02-zoomed.png` });
console.log(`INFO  放大演示截图 scale=${demoZoom.scale.toFixed(2)}`);

await page.click('[data-canvas-toolbar] [aria-label^="适应窗口"]');
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `${OUT}/03-refit.png` });

// 8. Cards stay interactive: dragging a card must not pan the canvas.
const before = await readView(page);
const cardBox = await page.$eval("[data-slot-id]", (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.move(cardBox.x, cardBox.y);
await page.mouse.down();
await page.mouse.move(cardBox.x + 90, cardBox.y + 60, { steps: 8 });
await page.mouse.up();
const afterCardDrag = await readView(page);
check(
  "卡片上拖拽不触发平移",
  Math.abs(afterCardDrag.x - before.x) < 1 && Math.abs(afterCardDrag.y - before.y) < 1,
  `Δ=(${(afterCardDrag.x - before.x).toFixed(2)}, ${(afterCardDrag.y - before.y).toFixed(2)})`,
);

// Hover must still reach the card (framer-motion lifts it).
await page.mouse.move(cardBox.x, cardBox.y);
await new Promise((r) => setTimeout(r, 500));
const hoverLift = await page.$eval("[data-slot-id]", (el) => {
  const m = new DOMMatrix(getComputedStyle(el).transform);
  return { y: m.f, scale: m.a };
});
check("卡片 hover 效果仍生效", hoverLift.y < -1 || hoverLift.scale > 1.005, JSON.stringify(hoverLift));

// 9. Switching tabs auto-fits the new tree.
const triggers = await page.$$("[data-slot=tabs-trigger]");
check("多领域 tabs 存在", triggers.length >= 2, `${triggers.length} 个 tab`);
if (triggers.length >= 2) {
  await triggers[1].click();
  await page.waitForSelector("[data-slot-id]", { timeout: 20_000 });
  await new Promise((r) => setTimeout(r, 900));
  const tabBox = await viewportBox(page);
  const tabContent = await page.$eval("#atlas-canvas", (el) => ({ w: el.offsetWidth, h: el.offsetHeight }));
  const tabView = await readView(page);
  const sw = tabContent.w * tabView.scale;
  const sh = tabContent.h * tabView.scale;
  check(
    "切 tab 自动 fit",
    sw <= tabBox.width + 1 &&
      sh <= tabBox.height + 1 &&
      Math.abs(tabView.x - (tabBox.width - sw) / 2) < 2,
    `content ${tabContent.w}x${tabContent.h}, scale ${tabView.scale.toFixed(3)}`,
  );
  await page.screenshot({ path: `${OUT}/04-tab2.png` });

  const stillNoScroll = await page.evaluate(
    () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
  );
  check("切 tab 后仍无页面滚动", stillNoScroll <= 0, `overflow=${stillNoScroll}px`);
}

// 10. Narrow window must not introduce page scrollbars.
await page.setViewport({ width: 900, height: 620, deviceScaleFactor: 1 });
await new Promise((r) => setTimeout(r, 700));
const narrow = await page.evaluate(() => ({
  v: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  h: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
check("窄窗口下无页面滚动", narrow.v <= 0 && narrow.h <= 0, JSON.stringify(narrow));
await page.screenshot({ path: `${OUT}/05-narrow.png` });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length > 0) {
  console.log(failed.map((f) => `  FAIL ${f.name}: ${f.detail}`).join("\n"));
  process.exit(1);
}
