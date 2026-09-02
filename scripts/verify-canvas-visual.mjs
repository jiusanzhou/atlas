// Screenshots cannot be eyeballed in this environment, so the "canvas look"
// (grid, rounded bordered container, bottom-right toolbar, cursors) is asserted
// against computed styles and geometry instead.
import puppeteer from "puppeteer";

const BASE = process.env.BASE ?? "http://localhost:3000";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

let browser;
try {
  browser = await puppeteer.launch({ headless: true, executablePath: CHROME });
} catch {
  browser = await puppeteer.launch({ headless: true });
}
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(BASE, { waitUntil: "networkidle0", timeout: 60_000 });
await page.waitForSelector("[data-slot-id]", { timeout: 30_000 });
await new Promise((r) => setTimeout(r, 1200));

const shell = await page.$eval("[data-slot=tabs-content] > div", (el) => {
  const s = getComputedStyle(el);
  return {
    radius: s.borderTopLeftRadius,
    borderWidth: s.borderTopWidth,
    borderColor: s.borderTopColor,
    shadow: s.boxShadow,
    overflow: s.overflow,
    background: s.backgroundImage.slice(0, 60),
  };
});
check(
  "画布容器：圆角 + 边框 + 阴影 + 裁切",
  parseFloat(shell.radius) >= 8 &&
    parseFloat(shell.borderWidth) >= 1 &&
    shell.shadow !== "none" &&
    shell.overflow === "hidden",
  `radius=${shell.radius} border=${shell.borderWidth} ${shell.borderColor} overflow=${shell.overflow}`,
);
check("画布底色使用主题渐变", shell.background.includes("gradient"), shell.background);

const grid = await page.$eval("[data-slot=tabs-content] .touch-none", (el) => {
  const s = getComputedStyle(el);
  return { image: s.backgroundImage, size: s.backgroundSize, position: s.backgroundPosition };
});
check(
  "点阵网格已绘制且随缩放变化",
  grid.image.includes("radial-gradient") && parseFloat(grid.size) > 0,
  `size=${grid.size} position=${grid.position}`,
);

// Grid step must track zoom so it reads as canvas paper, not a fixed overlay.
const gridBefore = parseFloat(grid.size);
await page.click('[data-canvas-toolbar] [aria-label^="复位"]');
await new Promise((r) => setTimeout(r, 250));
const gridAfter = await page.$eval("[data-slot=tabs-content] .touch-none", (el) =>
  parseFloat(getComputedStyle(el).backgroundSize),
);
check("网格间距随缩放联动", Math.abs(gridAfter - gridBefore) > 1, `${gridBefore}px → ${gridAfter}px @100%`);

const toolbar = await page.evaluate(() => {
  const bar = document.querySelector("[data-canvas-toolbar]");
  const host = document.querySelector("[data-slot=tabs-content] > div");
  const b = bar.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  return {
    fromRight: Math.round(h.right - b.right),
    fromBottom: Math.round(h.bottom - b.bottom),
    inside: b.right <= h.right && b.bottom <= h.bottom,
    buttons: Array.from(bar.querySelectorAll("button")).map(
      (el) => el.getAttribute("aria-label") ?? el.textContent.trim(),
    ),
  };
});
check(
  "工具条浮于画布右下角",
  toolbar.inside && toolbar.fromRight <= 20 && toolbar.fromBottom <= 20,
  `right=${toolbar.fromRight}px bottom=${toolbar.fromBottom}px`,
);
check(
  "工具条含 − % + 复位 fit 五个控件",
  toolbar.buttons.length === 5,
  toolbar.buttons.join(" | "),
);

const cursors = await page.evaluate(() => {
  const viewport = document.querySelector("[data-slot=tabs-content] .touch-none");
  const card = document.querySelector("[data-slot-id]");
  return {
    canvas: getComputedStyle(viewport).cursor,
    card: getComputedStyle(card.parentElement).cursor,
  };
});
check("空白处 cursor=grab", cursors.canvas === "grab", `canvas=${cursors.canvas} card=${cursors.card}`);

// grabbing only applies mid-drag, so hold the button down to observe it.
// Fit first, then pick a corner that is provably outside every card.
await page.click('[data-canvas-toolbar] [aria-label^="适应窗口"]');
await new Promise((r) => setTimeout(r, 500));
const spot = await page.evaluate(() => {
  const host = document.querySelector("[data-slot=tabs-content] > div");
  const r = host.getBoundingClientRect();
  const p = { x: r.x + 12, y: r.y + r.height - 12 };
  const hit = document.elementFromPoint(p.x, p.y);
  return { ...p, onCard: hit?.closest("[data-canvas-no-pan]") !== null };
});
check("选取的拖拽起点位于空白区", spot.onCard === false, JSON.stringify(spot));

await page.mouse.move(spot.x, spot.y);
await page.mouse.down();
await page.mouse.move(spot.x + 40, spot.y - 20, { steps: 5 });
// Let React commit the panning state before reading the computed cursor.
await new Promise((r) => setTimeout(r, 200));
const dragCursor = await page.$eval(
  "[data-slot=tabs-content] .touch-none",
  (el) => getComputedStyle(el).cursor,
);
await page.mouse.up();
check("拖拽中 cursor=grabbing", dragCursor === "grabbing", dragCursor);

await new Promise((r) => setTimeout(r, 200));
const afterCursor = await page.$eval(
  "[data-slot=tabs-content] .touch-none",
  (el) => getComputedStyle(el).cursor,
);
check("松手后 cursor 回到 grab", afterCursor === "grab", afterCursor);

// The tree itself must not paint its own opaque backdrop over the grid.
const treeBg = await page.$eval("#atlas-canvas", (el) => getComputedStyle(el).backgroundImage);
check("树自身背景透明（不遮挡网格）", treeBg === "none", treeBg);

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length > 0) process.exit(1);
