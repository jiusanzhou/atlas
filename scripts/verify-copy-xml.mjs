// v1.7 验证：header 三个导出按钮、复制 XML 写入剪贴板、toast 提示、剪贴板被拒时的手动兜底。
// 用法：pnpm dev（或 pnpm start），然后 node scripts/verify-copy-xml.mjs
import puppeteer from "puppeteer";
import { existsSync } from "node:fs";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const OUT = process.env.ATLAS_OUT ?? "/tmp/atlas-v17";

const SYSTEM_CHROME = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].filter((p) => p && existsSync(p));

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function launch() {
  try {
    return await puppeteer.launch({ headless: "shell" });
  } catch {
    if (SYSTEM_CHROME.length === 0) throw new Error("no chrome available");
    return puppeteer.launch({ headless: "shell", executablePath: SYSTEM_CHROME[0] });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Removing toast nodes by hand desyncs sonner's internal list, so let them
// expire instead. Default duration is 4s.
async function waitForToastsCleared(p) {
  await p.waitForFunction(() => document.querySelectorAll("[data-sonner-toast]").length === 0, {
    timeout: 15000,
  });
}

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950, deviceScaleFactor: 2 });

// Headless has no real clipboard, so record what writeText receives.
await page.evaluateOnNewDocument(() => {
  window.__copied = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text) => {
        if (window.__denyClipboard) return Promise.reject(new Error("denied"));
        window.__copied.push(text);
        return Promise.resolve();
      },
    },
  });
  document.execCommand = () => !window.__denyExecCommand;
});

await page.goto(BASE, { waitUntil: "networkidle2" });
await page.waitForSelector("[data-slot-id]");

// --- 1. header 三个按钮 -----------------------------------------------------
const buttons = await page.evaluate(() =>
  [...document.querySelectorAll("header [data-slot='button']")]
    .map((b) => b.textContent?.trim())
    .filter((t) => t?.includes("导出") || t?.includes("复制")),
);
check(
  "header 有 3 个导出按钮且顺序为 导出 drawio / 复制 XML / 导出 PNG",
  buttons.length === 3 &&
    buttons[0] === "导出 drawio" &&
    buttons[1] === "复制 XML" &&
    buttons[2] === "导出 PNG (zip)",
  JSON.stringify(buttons),
);

const copySelector = "header [data-slot='button']::-p-text(复制 XML)";
const copyButton = await page.waitForSelector(copySelector);

const icon = await copyButton.evaluate((b) => Boolean(b.querySelector("svg")));
check("复制 XML 按钮带图标", icon);

await page.screenshot({ path: `${OUT}-header.png`, clip: await headerBox(page) });

// --- 2. 主路径：写入剪贴板 + toast -------------------------------------------
await copyButton.click();
await page.waitForSelector("[data-sonner-toast]");
await sleep(150);

const success = await page.evaluate(() => {
  const toast = document.querySelector("[data-sonner-toast]");
  return {
    type: toast?.getAttribute("data-type"),
    text: toast?.textContent?.trim(),
    copies: window.__copied.length,
    xml: window.__copied[0] ?? "",
  };
});

check("剪贴板收到一次写入", success.copies === 1);
check(
  "写入内容是完整 mxfile",
  success.xml.startsWith("<mxfile") && success.xml.trimEnd().endsWith("</mxfile>"),
  `${(success.xml.length / 1024).toFixed(1)} KB`,
);

const diagramCount = (success.xml.match(/<diagram /g) ?? []).length;
const expectedKB = (success.xml.length / 1024).toFixed(1);
check("toast 是 success 类型", success.type === "success", success.type ?? "无");
check(
  `toast 文案含 diagram 数与大小（期望 ${diagramCount} 个 / ${expectedKB} KB）`,
  success.text === `已复制 · ${diagramCount} 个 diagram · ${expectedKB} KB`,
  success.text ?? "无",
);
check("diagram 数等于顶层领域数", diagramCount === 3, `${diagramCount} 个`);

await page.screenshot({ path: `${OUT}-toast.png` });

// --- 3. 回退一：clipboard 被拒 → execCommand ---------------------------------
await waitForToastsCleared(page);
await page.evaluate(() => {
  window.__denyClipboard = true;
  window.__copied = [];
});
await (await page.waitForSelector(copySelector)).click();
await page.waitForSelector("[data-sonner-toast]");
await sleep(150);

const viaExec = await page.evaluate(() => ({
  type: document.querySelector("[data-sonner-toast]")?.getAttribute("data-type"),
  dialog: Boolean(document.querySelector("[role='dialog']")),
}));
check("clipboard 被拒时回退成功（仍报 success，无手动弹层）", viaExec.type === "success" && !viaExec.dialog);

// --- 4. 回退二：两条路都失败 → 手动弹层 -------------------------------------
await waitForToastsCleared(page);
await page.evaluate(() => {
  window.__denyExecCommand = true;
});
await (await page.waitForSelector(copySelector)).click();
await page.waitForSelector("[role='dialog']");
await sleep(150);

const manual = await page.evaluate(() => {
  const dialog = document.querySelector("[role='dialog']");
  const textarea = dialog?.querySelector("textarea");
  return {
    type: document.querySelector("[data-sonner-toast]")?.getAttribute("data-type"),
    xml: textarea?.value ?? "",
    readOnly: textarea?.readOnly,
    // Guard against the auto-growing textarea blowing past the viewport.
    height: textarea ? Math.round(textarea.getBoundingClientRect().height) : 0,
  };
});
check("全部失败时弹出手动复制层", manual.xml.startsWith("<mxfile"), `${(manual.xml.length / 1024).toFixed(1)} KB`);
check("手动层 textarea 只读且高度受控", manual.readOnly === true && manual.height > 0 && manual.height < 900, `${manual.height}px`);
check("同时给出失败 toast", manual.type === "error", manual.type ?? "无");

await page.screenshot({ path: `${OUT}-manual.png` });

const closed = await page.evaluate(() => {
  document.querySelector("[role='dialog'] button[aria-label='关闭']")?.click();
  return true;
});
await sleep(200);
check(
  "手动层可关闭",
  closed && (await page.evaluate(() => !document.querySelector("[role='dialog']"))),
);

// --- 5. XML 能被 draw.io 解析（用浏览器 DOMParser 当校验器）-----------------
const parsed = await page.evaluate((xml) => {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return {
    error: doc.querySelector("parsererror")?.textContent ?? null,
    root: doc.documentElement.nodeName,
    pages: [...doc.querySelectorAll("diagram")].map((d) => d.getAttribute("name")),
    cells: doc.querySelectorAll("mxCell").length,
  };
}, success.xml);
check("XML 格式合法（DOMParser 无 parsererror）", parsed.error === null, parsed.error ?? "");
check("根节点是 mxfile", parsed.root === "mxfile");
check("page 名是领域显示名", parsed.pages.length === 3, JSON.stringify(parsed.pages));
check("cell 数量非空", parsed.cells > 20, `${parsed.cells} cells`);

async function headerBox(p) {
  return p.evaluate(() => {
    const r = document.querySelector("header").getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log(`screenshots: ${OUT}-header.png ${OUT}-toast.png ${OUT}-manual.png`);
if (failed.length > 0) process.exit(1);
