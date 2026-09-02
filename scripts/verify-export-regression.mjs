// The v1.2 layout change tightened html/body sizing; confirm the puppeteer
// render surface still yields full-size PNGs, and grab a 150% demo shot.
import puppeteer from "puppeteer";
import JSZip from "jszip";
import { readFile, writeFile } from "node:fs/promises";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "/tmp/atlas-v12";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

let browser;
try {
  browser = await puppeteer.launch({ headless: true, executablePath: CHROME });
} catch {
  browser = await puppeteer.launch({ headless: true });
}

// --- 150% demo screenshot, driven through the toolbar for an exact value.
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "networkidle0", timeout: 60_000 });
await page.waitForSelector("[data-slot-id]", { timeout: 30_000 });
await new Promise((r) => setTimeout(r, 1200));

const readScale = () =>
  page.$eval("[data-slot=tabs-content] .will-change-transform", (el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return m.a;
  });

await page.screenshot({ path: `${OUT}/10-fit.png` });
console.log(`fit scale = ${(await readScale()).toFixed(3)}`);

// Reset to 100%, then wheel in until we cross 150%.
await page.click('[data-canvas-toolbar] [aria-label^="复位"]');
await new Promise((r) => setTimeout(r, 200));
const box = await page.$eval("[data-slot=tabs-content] > div", (el) => {
  const r = el.getBoundingClientRect();
  return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
});
await page.mouse.move(box.cx, box.cy);
for (let i = 0; i < 120 && (await readScale()) < 1.495; i += 1) {
  await page.mouse.wheel({ deltaY: -8 });
  await new Promise((r) => setTimeout(r, 25));
}
const zoomScale = await readScale();
const shown = await page.$eval("[data-canvas-toolbar] button.font-mono", (el) => el.textContent.trim());
await page.screenshot({ path: `${OUT}/11-zoom150.png` });
console.log(`zoom demo scale = ${zoomScale.toFixed(3)} (工具条显示 ${shown})`);

await page.click('[data-canvas-toolbar] [aria-label^="适应窗口"]');
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `${OUT}/12-after-refit.png` });
console.log(`after refit scale = ${(await readScale()).toFixed(3)}`);

// --- /render surface must still measure full content height, not clip to vh.
const render = await browser.newPage();
await render.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
await render.goto(`${BASE}/render`, { waitUntil: "networkidle0", timeout: 60_000 });
const canvas = await render.waitForSelector("#atlas-canvas", { timeout: 30_000 });
const geom = await render.$eval("#atlas-canvas", (el) => {
  const r = el.getBoundingClientRect();
  return { offsetW: el.offsetWidth, offsetH: el.offsetHeight, rectH: Math.round(r.height) };
});
const shot = await canvas.screenshot({ type: "png" });
// PNG IHDR: width/height are big-endian uint32 at bytes 16..24.
const view = new DataView(shot.buffer, shot.byteOffset, shot.byteLength);
const png = { w: view.getUint32(16), h: view.getUint32(20) };
console.log(`/render 画布 ${geom.offsetW}x${geom.offsetH} (rect ${geom.rectH}) → PNG ${png.w}x${png.h}`);
const renderOk = png.w === geom.offsetW && png.h === geom.offsetH && geom.offsetH > 900;
console.log(`${renderOk ? "PASS" : "FAIL"}  /render 未被视口高度裁切`);
await writeFile(`${OUT}/13-render-element.png`, shot);

await browser.close();

// --- Full PNG export endpoint (zip of one image per top-level domain).
const source = await readFile(new URL("../examples/demo.yaml", import.meta.url), "utf8");
const parsed = await fetch(`${BASE}/api/parse`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ source }),
});
const parseJson = await parsed.json();
const config = parseJson.config;

const zipRes = await fetch(`${BASE}/api/export`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ config, scale: 1 }),
});
if (!zipRes.ok) {
  console.log(`FAIL  PNG 导出 HTTP ${zipRes.status}: ${await zipRes.text()}`);
  process.exit(1);
}
const zip = await JSZip.loadAsync(await zipRes.arrayBuffer());
const entries = Object.keys(zip.files);
console.log(`PNG zip 条目: ${entries.join(", ")}`);
for (const name of entries) {
  const data = await zip.file(name).async("uint8array");
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  console.log(`  ${name}: ${dv.getUint32(16)}x${dv.getUint32(20)}, ${(data.byteLength / 1024).toFixed(0)}KB`);
}
console.log(`${entries.length === config.domains.length ? "PASS" : "FAIL"}  每个顶层领域一张 PNG (${entries.length}/${config.domains.length})`);

// --- drawio export still parses as multi-page XML.
const drawioRes = await fetch(`${BASE}/api/drawio`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ config }),
});
const xml = await drawioRes.text();
const pages = xml.match(/<diagram\b/g)?.length ?? 0;
console.log(`${pages === config.domains.length ? "PASS" : "FAIL"}  drawio ${pages} 个 page (${config.domains.length} 领域)`);
