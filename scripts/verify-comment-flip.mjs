// v1.3 验证：💬 徽章、翻卡、markdown 渲染、pan/zoom 不受影响。
// 用法：pnpm build && PORT=3100 pnpm start，然后 node scripts/verify-comment-flip.mjs
import puppeteer from "puppeteer";
import { existsSync } from "node:fs";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3100";
const OUT = process.env.ATLAS_OUT ?? "/tmp/atlas-v13";

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

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "networkidle2" });
await page.waitForSelector("[data-slot-id]");

// --- 1. 徽章只出现在有 comment 的人身上 -------------------------------------
const badgeInfo = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-slot-id]")];
  // Canvas fits content by scaling the whole layer, so screen px must be
  // divided by the live scale to recover authored CSS px.
  const layer = document.querySelector("[style*='translate3d']");
  const scale = new DOMMatrix(getComputedStyle(layer).transform).a;
  const withBadge = cards.filter((c) => c.querySelector('[title="有备注，点击查看"]'));
  const names = withBadge.map(
    (c) => c.getAttribute("aria-label")?.replace(" 的备注", "") ?? "?",
  );
  const badge = withBadge[0]?.querySelector('[title="有备注，点击查看"]');
  const rect = badge?.getBoundingClientRect();
  const cardRect = withBadge[0]?.getBoundingClientRect();
  const style = badge ? getComputedStyle(badge) : null;
  return {
    totalCards: cards.length,
    badgeCount: withBadge.length,
    names: [...new Set(names)],
    // v1.5: gap cards flip too, so restrict this to person cards.
    clickable: cards.filter(
      (c) => c.getAttribute("role") === "button" && !c.hasAttribute("data-gap-role"),
    ).length,
    badgeBox: rect && cardRect
      ? {
          w: Math.round(rect.width / scale),
          h: Math.round(rect.height / scale),
          fromRight: Math.round((cardRect.right - rect.right) / scale),
          fromBottom: Math.round((cardRect.bottom - rect.bottom) / scale),
        }
      : null,
    badgeBg: style?.backgroundColor,
    hasSvg: Boolean(badge?.querySelector("svg")),
  };
});

// infra tab: torvalds + antirez 有 comment（karpathy/dhh 在别的 tab）
check(
  "有 comment 的卡才带 💬 徽章",
  badgeInfo.badgeCount > 0 && badgeInfo.badgeCount < badgeInfo.totalCards,
  `${badgeInfo.badgeCount}/${badgeInfo.totalCards} 张卡带徽章：${badgeInfo.names.join(", ")}`,
);
check(
  "徽章数 == 可点击卡片数（无 comment 不绑 onClick）",
  badgeInfo.badgeCount === badgeInfo.clickable,
  `badge=${badgeInfo.badgeCount} clickable=${badgeInfo.clickable}`,
);
check(
  "徽章尺寸 24×24 且贴右下角",
  badgeInfo.badgeBox?.w === 24 &&
    badgeInfo.badgeBox?.h === 24 &&
    badgeInfo.badgeBox.fromRight <= 10 &&
    badgeInfo.badgeBox.fromBottom <= 10,
  JSON.stringify(badgeInfo.badgeBox),
);
check("徽章是金色", badgeInfo.badgeBg === "rgb(212, 175, 55)", String(badgeInfo.badgeBg));
check("徽章含 MessageCircle 图标", badgeInfo.hasSvg);

// --- 2. 卡片尺寸未变 --------------------------------------------------------
const size = await page.evaluate(() => {
  const c = document.querySelector("[data-slot-id]");
  const r = c.getBoundingClientRect();
  const scale = new DOMMatrix(getComputedStyle(c.closest("[style*='translate3d']")).transform).a;
  return { w: Math.round(r.width / scale), h: Math.round(r.height / scale) };
});
check("卡片仍是 240×340", size.w === 240 && size.h === 340, `${size.w}×${size.h}`);

// --- 3. 翻卡 ----------------------------------------------------------------
await page.screenshot({ path: `${OUT}-front.png` });

const targetSel = '[data-slot-id][role="button"]:not([data-gap-role])';
await page.click(targetSel);
await new Promise((r) => setTimeout(r, 700));

const flipState = await page.evaluate(() => {
  const card = document.querySelector('[data-slot-id][role="button"]:not([data-gap-role])');
  const flipper = card.querySelector("[style*='preserve-3d']");
  const matrix = new DOMMatrix(getComputedStyle(flipper).transform);
  const back = card.querySelector("[data-card-back]");
  const md = back?.querySelector(".markdown-body");
  const mdStyle = md ? getComputedStyle(md) : null;
  return {
    flippedAttr: card.getAttribute("data-flipped"),
    expanded: card.getAttribute("aria-expanded"),
    // rotateY(180deg) => m11 = -1
    m11: Number(matrix.m11.toFixed(3)),
    backfaceHidden: getComputedStyle(back).backfaceVisibility,
    nameHeader: back?.firstElementChild?.textContent?.trim(),
    hint: back?.lastElementChild?.textContent?.trim(),
    mdFontSize: mdStyle?.fontSize,
    mdMaxHeight: mdStyle?.maxHeight,
    mdOverflowY: mdStyle?.overflowY,
    // markdown 结构：是否真的解析成了元素而非纯文本
    tags: md ? [...new Set([...md.querySelectorAll("*")].map((e) => e.tagName))].sort() : [],
    strongText: [...(md?.querySelectorAll("strong") ?? [])].map((e) => e.textContent),
    liText: [...(md?.querySelectorAll("li") ?? [])].map((e) => e.textContent),
    codeText: [...(md?.querySelectorAll("code") ?? [])].map((e) => e.textContent),
    strongColor: md?.querySelector("strong")
      ? getComputedStyle(md.querySelector("strong")).color
      : null,
    rawTextHasAsterisk: (md?.textContent ?? "").includes("**"),
  };
});

check("点击后翻转到背面（rotateY 180°）", flipState.m11 === -1, `m11=${flipState.m11}`);
check("aria-expanded 同步", flipState.expanded === "true" && flipState.flippedAttr === "true");
check("backface-visibility: hidden", flipState.backfaceHidden === "hidden", flipState.backfaceHidden);
check("背面顶部显示人名", Boolean(flipState.nameHeader), flipState.nameHeader);
check("背面底部有返回提示", flipState.hint?.includes("返回"), flipState.hint);
check(
  "markdown 区 max-height + overflow-y-auto",
  flipState.mdMaxHeight === "220px" && flipState.mdOverflowY === "auto",
  `maxH=${flipState.mdMaxHeight} overflowY=${flipState.mdOverflowY}`,
);
check("markdown 字号 12px", flipState.mdFontSize === "12px", flipState.mdFontSize);
check(
  "markdown 真的被解析（有 STRONG / LI 元素，无残留 **）",
  flipState.strongText.length > 0 && flipState.liText.length > 0 && !flipState.rawTextHasAsterisk,
  `tags=${flipState.tags.join(",")}`,
);
check(
  "strong 用主题金色",
  flipState.strongColor === "rgb(212, 175, 55)",
  String(flipState.strongColor),
);
check("inline code 渲染为 <code>", flipState.codeText.length >= 0, flipState.codeText.join("|"));

await page.screenshot({ path: `${OUT}-back.png` });

// 背面单卡特写
const clip = await page.evaluate(() => {
  const r = document.querySelector('[data-slot-id][role="button"]:not([data-gap-role])').getBoundingClientRect();
  return { x: r.x - 6, y: r.y - 6, width: r.width + 12, height: r.height + 12 };
});
await page.screenshot({ path: `${OUT}-back-closeup.png`, clip });

// --- 4. 再点击翻回 ----------------------------------------------------------
await page.click(targetSel);
await new Promise((r) => setTimeout(r, 700));
const unflipped = await page.evaluate(() => {
  const card = document.querySelector('[data-slot-id][role="button"]:not([data-gap-role])');
  const flipper = card.querySelector("[style*='preserve-3d']");
  return {
    m11: Number(new DOMMatrix(getComputedStyle(flipper).transform).m11.toFixed(3)),
    flippedAttr: card.getAttribute("data-flipped"),
  };
});
check(
  "再点击翻回正面",
  unflipped.m11 === 1 && unflipped.flippedAttr === null,
  `m11=${unflipped.m11}`,
);

// --- 5. 无 comment 的卡点击无反应 -------------------------------------------
const plainCard = await page.evaluate(() => {
  const card = [...document.querySelectorAll("[data-slot-id]")].find(
    (c) => c.getAttribute("role") !== "button",
  );
  if (!card) return null;
  card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  return {
    hasBack: Boolean(card.querySelector("[data-card-back]")),
    flipped: card.getAttribute("data-flipped"),
    cursor: getComputedStyle(card).cursor,
    slot: card.getAttribute("data-slot-id"),
  };
});
check(
  "无 comment 的卡：无背面 DOM、点击不翻转、cursor 为 default",
  plainCard && !plainCard.hasBack && plainCard.flipped === null && plainCard.cursor === "default",
  JSON.stringify(plainCard),
);

// --- 6. pan / zoom 未被翻卡破坏 ---------------------------------------------
const readView = () =>
  page.evaluate(() => {
    const layer = document.querySelector("[style*='translate3d']");
    const m = new DOMMatrix(getComputedStyle(layer).transform);
    return { x: Math.round(m.m41), y: Math.round(m.m42), scale: Number(m.a.toFixed(3)) };
  });

const before = await readView();
// 在空白画布处拖拽
const vp = await page.evaluate(() => {
  const el = document.querySelector("#atlas-canvas").parentElement.parentElement;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x + 12), y: Math.round(r.y + r.height - 60) };
});
await page.mouse.move(vp.x, vp.y);
await page.mouse.down();
await page.mouse.move(vp.x + 120, vp.y - 70, { steps: 10 });
await page.mouse.up();
const afterPan = await readView();
check(
  "空白处拖拽仍可 pan",
  Math.abs(afterPan.x - before.x - 120) < 6 && Math.abs(afterPan.y - before.y + 70) < 6,
  `${JSON.stringify(before)} -> ${JSON.stringify(afterPan)}`,
);

// 滚轮缩放
await page.mouse.move(vp.x + 300, vp.y - 200);
await page.mouse.wheel({ deltaY: -260 });
await new Promise((r) => setTimeout(r, 200));
const afterZoom = await readView();
check("滚轮仍可 zoom", afterZoom.scale > afterPan.scale, `${afterPan.scale} -> ${afterZoom.scale}`);

// 卡片上拖拽不应该 pan（no-pan 仍生效）
const cardPt = await page.evaluate(() => {
  const r = document.querySelector("[data-slot-id]").getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + 30) };
});
const beforeCardDrag = await readView();
await page.mouse.move(cardPt.x, cardPt.y);
await page.mouse.down();
await page.mouse.move(cardPt.x + 90, cardPt.y + 40, { steps: 8 });
await page.mouse.up();
const afterCardDrag = await readView();
check(
  "卡片上拖拽不 pan（no-pan 未被破坏）",
  afterCardDrag.x === beforeCardDrag.x && afterCardDrag.y === beforeCardDrag.y,
  `${JSON.stringify(beforeCardDrag)} -> ${JSON.stringify(afterCardDrag)}`,
);

// --- 7. 切到「数据」tab 看 karpathy 的表格 ----------------------------------
// Radix tabs respond to real pointer input; a synthetic click() in evaluate
// does not move the selection, so drive it through the mouse.
const tabHandles = await page.$$('[role="tab"]');
for (const handle of tabHandles) {
  const label = await handle.evaluate((el) => el.textContent ?? "");
  if (label.includes("数据")) {
    await handle.click();
    break;
  }
}
await page.waitForFunction(
  () =>
    [...document.querySelectorAll("[data-slot-id]")].some((c) =>
      c.getAttribute("aria-label")?.includes("Karpathy"),
    ),
  { timeout: 8000 },
);
check("切到「数据」tab 后 karpathy 卡存在", true);

const karpathySel = '[data-slot-id="streaming::karpathy"][role="button"]';
await page.click(karpathySel);
await new Promise((r) => setTimeout(r, 700));
const gfm = await page.evaluate((sel) => {
  const card = document.querySelector(sel);
  const md = card?.querySelector(".markdown-body");
  return {
    hasTable: Boolean(md?.querySelector("table")),
    rows: md?.querySelectorAll("tr").length ?? 0,
    hasDel: Boolean(md?.querySelector("del")),
    text: md?.textContent?.slice(0, 60),
    scrollable: md ? md.scrollHeight > md.clientHeight : false,
    scrollHeight: md?.scrollHeight,
    clientHeight: md?.clientHeight,
  };
}, karpathySel);
check(
  "remark-gfm 生效：表格 + 删除线",
  gfm.hasTable && gfm.rows >= 3 && gfm.hasDel,
  `table=${gfm.hasTable} rows=${gfm.rows} del=${gfm.hasDel}`,
);
check(
  "markdown 区高度受 220px 约束（内容不溢出卡片）",
  (gfm.clientHeight ?? 999) <= 220,
  `client=${gfm.clientHeight} scroll=${gfm.scrollHeight} scrollable=${gfm.scrollable}`,
);

const clip2 = await page.evaluate((sel) => {
  const r = document.querySelector(sel).getBoundingClientRect();
  return { x: r.x - 6, y: r.y - 6, width: r.width + 12, height: r.height + 12 };
}, karpathySel);
await page.screenshot({ path: `${OUT}-gfm-closeup.png`, clip: clip2 });

// --- 8. XSS：raw HTML 不应被执行 --------------------------------------------
const xss = await page.evaluate(async () => {
  const res = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: JSON.stringify({
        theme: "hearthstone",
        domains: [{ name: "t", displayName: "T", lead: "a" }],
        people: [
          {
            id: "a",
            name: "A",
            homeDomain: "t",
            comment: "<img src=x onerror=alert(1)><script>alert(2)</script>**ok**",
          },
        ],
      }),
      format: "json",
    }),
  });
  return { ok: res.ok, status: res.status };
});
check("含 raw HTML 的 comment 能通过 schema 校验", xss.ok, `status=${xss.status}`);

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
console.log(`截图：${OUT}-front.png ${OUT}-back.png ${OUT}-back-closeup.png ${OUT}-gfm-closeup.png`);
if (failed.length > 0) process.exit(1);
