// v1.5 浏览器验证：hearthstone 人头缺口卡 / 负责人缺口 / 优先级角标 / 翻卡，
// 以及 minimal 剪影 + 虚线皇冠 + hover 招聘要求。同时产出交付截图。
// 用法：pnpm build && PORT=3100 pnpm start，然后 node scripts/verify-gap-visual.mjs
import puppeteer from "puppeteer";
import { existsSync } from "node:fs";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3100";
const OUT = process.env.ATLAS_OUT ?? "/tmp/atlas-v15";
const SYSTEM_CHROME = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].filter((p) => p && existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await puppeteer
  .launch({ headless: "shell" })
  .catch(() => puppeteer.launch({ headless: "shell", executablePath: SYSTEM_CHROME[0] }));

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950, deviceScaleFactor: 2 });
await page.evaluateOnNewDocument(() => localStorage.clear());
await page.goto(BASE, { waitUntil: "networkidle2" });
await page.waitForSelector("[data-slot-id]");

/** 切到指定 tab（Radix 只认真实指针事件）。 */
async function openTab(label) {
  for (const handle of await page.$$('[role="tab"]')) {
    if ((await handle.evaluate((el) => el.textContent ?? "")).includes(label)) {
      await handle.click();
      return true;
    }
  }
  return false;
}

// =========================== hearthstone ====================================
await openTab("应用平台");
await page.waitForSelector('[data-slot-id="mobile::lead-gap"]');
await sleep(1200);

const hs = await page.evaluate(() => {
  const layer = document.querySelector("[data-canvas-layer]");
  const scale = new DOMMatrix(getComputedStyle(layer).transform).a;
  const px = (v) => Math.round(v / scale);

  const read = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const dot = el.querySelector("[data-priority-dot]");
    const sil = el.querySelector("[data-gap-silhouette]");
    const silRect = sil?.getBoundingClientRect();
    return {
      w: px(r.width),
      h: px(r.height),
      borderStyle: s.borderTopStyle,
      // computed border width is already authored CSS px; unlike
      // getBoundingClientRect it is not multiplied by the canvas transform.
      borderWidth: Math.round(Number.parseFloat(s.borderTopWidth)),
      borderColor: s.borderTopColor,
      role: el.getAttribute("data-gap-role"),
      clickable: el.getAttribute("role") === "button",
      dotColor: dot ? getComputedStyle(dot).backgroundColor : null,
      hasSilhouette: Boolean(sil),
      silSize: silRect ? px(silRect.width) : null,
      silBorderStyle: sil ? getComputedStyle(sil).borderTopStyle : null,
      hasCrown: Boolean(el.querySelector("[data-lead-gap-crown]")),
      crownDash: el.querySelector("[data-lead-gap-crown] svg")?.getAttribute("stroke-dasharray"),
      countBadge: el.querySelector("[data-gap-count]")?.textContent?.trim() ?? null,
      hasCommentBadge: Boolean(el.querySelector('[title="有招聘要求，点击查看"]')),
      text: el.innerText.replace(/\n+/g, " / "),
    };
  };

  const person = document.querySelector('[data-slot-id="mobile::jeresig"]');
  const pr = person?.getBoundingClientRect();

  return {
    leadGap: read('[data-slot-id="mobile::lead-gap"]'),
    memberGap: read('[data-slot-id="mobile::gap-0"]'),
    devexGap: read('[data-slot-id="devex::gap-0"]'),
    personCard: pr ? { w: px(pr.width), h: px(pr.height) } : null,
    // grid 顺序：按 y 再按 x 排，应为 负责人缺口 -> 真人 -> 成员缺口
    mobileOrder: [...document.querySelectorAll('[data-slot-id^="mobile::"]')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { id: el.getAttribute("data-slot-id"), x: r.x, y: r.y };
      })
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((s) => s.id),
    // 卡片两两 AABB 重叠数
    overlaps: (() => {
      const boxes = [...document.querySelectorAll("[data-slot-id]")].map((el) =>
        el.getBoundingClientRect(),
      );
      let n = 0;
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) n += 1;
        }
      }
      return n;
    })(),
  };
});

check(
  "缺口卡与人物卡同尺寸 240×340（人头卡而非小占位符）",
  hs.leadGap.w === 240 && hs.leadGap.h === 340 && hs.personCard.w === 240,
  `gap=${hs.leadGap.w}×${hs.leadGap.h} person=${hs.personCard.w}×${hs.personCard.h}`,
);
check(
  "成员缺口：灰虚线边框 2px",
  hs.memberGap.borderStyle === "dashed" &&
    hs.memberGap.borderWidth === 2 &&
    hs.memberGap.borderColor === "rgba(115, 115, 115, 0.6)",
  `${hs.memberGap.borderStyle} ${hs.memberGap.borderWidth}px ${hs.memberGap.borderColor}`,
);
check(
  "负责人缺口：金虚线边框 2px",
  hs.leadGap.borderStyle === "dashed" &&
    hs.leadGap.borderWidth === 2 &&
    hs.leadGap.borderColor === "rgb(212, 175, 55)",
  `${hs.leadGap.borderStyle} ${hs.leadGap.borderWidth}px ${hs.leadGap.borderColor}`,
);
check("负责人缺口 data-gap-role=lead", hs.leadGap.role === "lead", hs.leadGap.role);
check("成员缺口 data-gap-role=member", hs.memberGap.role === "member", hs.memberGap.role);
check(
  "缺口有人形剪影圆环，直径 == avatarSize 120，虚线",
  hs.leadGap.hasSilhouette &&
    hs.leadGap.silSize === 120 &&
    hs.leadGap.silBorderStyle === "dashed",
  `size=${hs.leadGap.silSize} style=${hs.leadGap.silBorderStyle}`,
);
check(
  "负责人缺口有虚线皇冠（stroke-dasharray）",
  hs.leadGap.hasCrown && hs.leadGap.crownDash === "3 2",
  `crown=${hs.leadGap.hasCrown} dash=${hs.leadGap.crownDash}`,
);
check("成员缺口无皇冠", !hs.memberGap.hasCrown);
check(
  "负责人缺口文案含「负责人 · {role}」",
  hs.leadGap.text.includes("负责人 · 移动端负责人") && hs.leadGap.text.includes("招募中"),
  hs.leadGap.text,
);
check(
  "优先级角标：critical=红 #ef4444",
  hs.leadGap.dotColor === "rgb(239, 68, 68)",
  hs.leadGap.dotColor,
);
check(
  "优先级角标：high=橙 #f97316",
  hs.memberGap.dotColor === "rgb(249, 115, 22)",
  hs.memberGap.dotColor,
);
check(
  "优先级角标：medium=黄 #eab308",
  hs.devexGap.dotColor === "rgb(234, 179, 8)",
  hs.devexGap.dotColor,
);
check(
  "count > 1 显示 ×N 徽章；count == 1 不显示",
  hs.memberGap.countBadge === "×2" && hs.leadGap.countBadge === null,
  `member=${hs.memberGap.countBadge} lead=${hs.leadGap.countBadge}`,
);
check(
  "有 comment 的缺口卡带 💬 徽章且可点击",
  hs.leadGap.hasCommentBadge && hs.leadGap.clickable && hs.memberGap.hasCommentBadge,
  `lead badge=${hs.leadGap.hasCommentBadge} clickable=${hs.leadGap.clickable}`,
);
check(
  "无 comment 的缺口不可点击、无徽章",
  !hs.devexGap.hasCommentBadge && !hs.devexGap.clickable,
  `devex badge=${hs.devexGap.hasCommentBadge} clickable=${hs.devexGap.clickable}`,
);
check(
  "渲染顺序：负责人缺口 -> 成员真人 -> 成员缺口",
  hs.mobileOrder.join(",") === "mobile::lead-gap,mobile::jeresig,mobile::gap-0",
  hs.mobileOrder.join(","),
);
check("无卡片重叠", hs.overlaps === 0, `${hs.overlaps} 对重叠`);

await page.screenshot({ path: `${OUT}-1-hearthstone-gaps.png` });

// 移动端节点特写（含负责人缺口 + 真人 + 成员缺口）
const mobileClip = await page.evaluate(() => {
  const box = document.querySelector('[data-domain-id="mobile"]').getBoundingClientRect();
  const x = Math.max(0, box.x - 20);
  const y = Math.max(0, box.y - 20);
  return {
    x,
    y,
    width: Math.min(window.innerWidth - x, box.width + 40),
    height: Math.min(window.innerHeight - y, box.height + 40),
  };
});
await page.screenshot({ path: `${OUT}-2-lead-gap-closeup.png`, clip: mobileClip });

// --- 翻卡看招聘要求 ---------------------------------------------------------
await page.click('[data-slot-id="mobile::lead-gap"]');
await sleep(800);

const flip = await page.evaluate(() => {
  const card = document.querySelector('[data-slot-id="mobile::lead-gap"]');
  const flipper = card.querySelector("[style*='preserve-3d']");
  const back = card.querySelector("[data-card-back]");
  const md = back?.querySelector(".markdown-body");
  return {
    m11: Number(new DOMMatrix(getComputedStyle(flipper).transform).m11.toFixed(3)),
    flipped: card.getAttribute("data-flipped"),
    expanded: card.getAttribute("aria-expanded"),
    header: back?.firstElementChild?.textContent?.trim(),
    strongs: [...(md?.querySelectorAll("strong") ?? [])].map((e) => e.textContent),
    lis: (md?.querySelectorAll("li") ?? []).length,
    hasBlockquote: Boolean(md?.querySelector("blockquote")),
    rawAsterisk: (md?.textContent ?? "").includes("**"),
    maxHeight: md ? getComputedStyle(md).maxHeight : null,
    overflowY: md ? getComputedStyle(md).overflowY : null,
  };
});

check("点击负责人缺口翻到背面（rotateY 180°）", flip.m11 === -1, `m11=${flip.m11}`);
check("aria-expanded / data-flipped 同步", flip.expanded === "true" && flip.flipped === "true");
check("背面标题为「负责人 · {role}」", flip.header === "负责人 · 移动端负责人", flip.header);
check(
  "招聘要求 markdown 真的被解析（strong + li + blockquote，无残留 **）",
  flip.strongs.includes("岗位要求") && flip.lis >= 5 && flip.hasBlockquote && !flip.rawAsterisk,
  `strongs=${flip.strongs.join("/")} li=${flip.lis} bq=${flip.hasBlockquote}`,
);
check(
  "markdown 区有 max-height + 滚动",
  flip.maxHeight === "240px" && flip.overflowY === "auto",
  `maxH=${flip.maxHeight} overflowY=${flip.overflowY}`,
);

await page.screenshot({ path: `${OUT}-3-lead-gap-flipped.png`, clip: mobileClip });

// 成员缺口翻卡（表格 markdown 在 infra 页，这里先看 iOS 的列表）
await page.click('[data-slot-id="mobile::gap-0"]');
await sleep(800);
const memberFlip = await page.evaluate(() => {
  const card = document.querySelector('[data-slot-id="mobile::gap-0"]');
  const md = card.querySelector("[data-card-back] .markdown-body");
  return {
    m11: Number(
      new DOMMatrix(getComputedStyle(card.querySelector("[style*='preserve-3d']")).transform).m11.toFixed(3),
    ),
    hasCode: Boolean(md?.querySelector("code")),
    lis: (md?.querySelectorAll("li") ?? []).length,
  };
});
check(
  "成员缺口也能翻卡看招聘要求（含 inline code）",
  memberFlip.m11 === -1 && memberFlip.hasCode && memberFlip.lis === 3,
  `m11=${memberFlip.m11} code=${memberFlip.hasCode} li=${memberFlip.lis}`,
);
await page.screenshot({ path: `${OUT}-4-member-gap-flipped.png`, clip: mobileClip });

// 再点翻回，避免影响后续截图
await page.click('[data-slot-id="mobile::gap-0"]');
await page.click('[data-slot-id="mobile::lead-gap"]');
await sleep(600);

// infra 页的表格 markdown（critical 缺口）
await openTab("基础设施");
await page.waitForSelector('[data-slot-id="objectstore::gap-0"]');
await sleep(1000);
await page.click('[data-slot-id="objectstore::gap-0"]');
await sleep(800);
const tableFlip = await page.evaluate(() => {
  const md = document.querySelector(
    '[data-slot-id="objectstore::gap-0"] [data-card-back] .markdown-body',
  );
  return {
    hasTable: Boolean(md?.querySelector("table")),
    rows: md?.querySelectorAll("tr").length ?? 0,
    hasDel: Boolean(md?.querySelector("del")),
    clientHeight: md?.clientHeight,
  };
});
check(
  "缺口 comment 支持 GFM 表格 + 删除线",
  tableFlip.hasTable && tableFlip.rows >= 4 && tableFlip.hasDel,
  `table=${tableFlip.hasTable} rows=${tableFlip.rows} del=${tableFlip.hasDel}`,
);
check(
  "长 markdown 不撑破卡片（clientHeight <= 240）",
  (tableFlip.clientHeight ?? 999) <= 240,
  `clientHeight=${tableFlip.clientHeight}`,
);
const tableClip = await page.evaluate(() => {
  const r = document.querySelector('[data-slot-id="objectstore::gap-0"]').getBoundingClientRect();
  return { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 };
});
await page.screenshot({ path: `${OUT}-5-gap-gfm-table.png`, clip: tableClip });

// =========================== minimal =======================================
await page.click('[data-theme-option="minimal"]');
await page.waitForSelector("[data-minimal-card]");
await openTab("应用平台");
await page.waitForSelector('[data-slot-id="mobile::lead-gap"]');
await sleep(1400);

const mi = await page.evaluate(() => {
  const read = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const sil = el.querySelector("[data-gap-silhouette]");
    const dot = el.querySelector("[data-priority-dot]");
    return {
      role: el.getAttribute("data-gap-role"),
      hasSilhouette: Boolean(sil),
      silBorderStyle: sil ? getComputedStyle(sil).borderTopStyle : null,
      silBorderColor: sil ? getComputedStyle(sil).borderTopColor : null,
      hasSvgUser: Boolean(sil?.querySelector("svg")),
      hasCrown: Boolean(el.querySelector("[data-lead-gap-crown]")),
      crownDash: el.querySelector("[data-lead-gap-crown] svg")?.getAttribute("stroke-dasharray"),
      dotColor: dot ? getComputedStyle(dot).backgroundColor : null,
      hasCommentDot: Boolean(el.querySelector("[data-comment-dot]")),
      text: el.innerText.replace(/\n+/g, " / "),
    };
  };
  return {
    leadGap: read('[data-slot-id="mobile::lead-gap"]'),
    memberGap: read('[data-slot-id="mobile::gap-0"]'),
    devexGap: read('[data-slot-id="devex::gap-0"]'),
  };
});

check(
  "minimal 缺口：灰底圆 + 人形剪影 SVG，虚线圈",
  mi.memberGap.hasSilhouette &&
    mi.memberGap.hasSvgUser &&
    mi.memberGap.silBorderStyle === "dashed" &&
    mi.memberGap.silBorderColor === "rgb(212, 212, 212)",
  `${mi.memberGap.silBorderStyle} ${mi.memberGap.silBorderColor}`,
);
check(
  "minimal 负责人缺口圆环为金虚线",
  mi.leadGap.silBorderStyle === "dashed" && mi.leadGap.silBorderColor === "rgb(234, 179, 8)",
  `${mi.leadGap.silBorderStyle} ${mi.leadGap.silBorderColor}`,
);
check(
  "minimal 负责人缺口 avatar 底部叠虚线皇冠",
  mi.leadGap.hasCrown && mi.leadGap.crownDash === "3 2",
  `crown=${mi.leadGap.hasCrown} dash=${mi.leadGap.crownDash}`,
);
check("minimal 成员缺口无皇冠", !mi.memberGap.hasCrown);
check(
  "minimal 名字为「招募中 · {role}」",
  mi.leadGap.text.includes("招募中 · 移动端负责人"),
  mi.leadGap.text,
);
check(
  "minimal 优先级色点：critical 红 / high 橙 / medium 黄",
  mi.leadGap.dotColor === "rgb(220, 38, 38)" &&
    mi.memberGap.dotColor === "rgb(234, 88, 12)" &&
    mi.devexGap.dotColor === "rgb(217, 119, 6)",
  `${mi.leadGap.dotColor} / ${mi.memberGap.dotColor} / ${mi.devexGap.dotColor}`,
);
check(
  "minimal 有 comment 的缺口带 comment 点，无 comment 的没有",
  mi.leadGap.hasCommentDot && mi.memberGap.hasCommentDot && !mi.devexGap.hasCommentDot,
  `lead=${mi.leadGap.hasCommentDot} member=${mi.memberGap.hasCommentDot} devex=${mi.devexGap.hasCommentDot}`,
);

await page.screenshot({ path: `${OUT}-6-minimal-gaps.png` });

// --- hover 浮层显示招聘要求 -------------------------------------------------
const gapPoint = await page.evaluate(() => {
  const r = document.querySelector('[data-slot-id="mobile::lead-gap"]').getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + 16) };
});
// 鼠标已停在卡上时不会再触发 pointerenter，先移开。
await page.mouse.move(20, 900);
await sleep(200);
await page.mouse.move(gapPoint.x, gapPoint.y);
await page.waitForSelector("[data-person-panel]");
await sleep(600);

const panel = await page.evaluate(() => {
  const p = document.querySelector("[data-person-panel]");
  const md = p.querySelector(".markdown-body");
  return {
    gapRole: p.getAttribute("data-gap-role"),
    hasCrown: Boolean(p.querySelector("[data-lead-gap-crown]")),
    text: p.innerText.replace(/\n+/g, " / "),
    strongs: [...(md?.querySelectorAll("strong") ?? [])].map((e) => e.textContent),
    lis: (md?.querySelectorAll("li") ?? []).length,
    hasBlockquote: Boolean(md?.querySelector("blockquote")),
    rawAsterisk: (md?.textContent ?? "").includes("**"),
  };
});

check("minimal 浮层标记为负责人缺口", panel.gapRole === "lead" && panel.hasCrown);
check(
  "minimal 浮层含「负责人空缺 · 招募中」+ 人数 + 优先级",
  panel.text.includes("负责人空缺 · 招募中") &&
    /缺 1 人/.test(panel.text) &&
    /紧急优先级/.test(panel.text),
  panel.text.slice(0, 90),
);
check(
  "minimal 浮层渲染招聘要求 markdown",
  panel.strongs.includes("岗位要求") && panel.lis >= 5 && panel.hasBlockquote && !panel.rawAsterisk,
  `strongs=${panel.strongs.join("/")} li=${panel.lis}`,
);

const panelClip = await page.evaluate(() => {
  const p = document.querySelector("[data-person-panel]").getBoundingClientRect();
  const c = document.querySelector('[data-slot-id="mobile::lead-gap"]').getBoundingClientRect();
  const x = Math.max(0, Math.min(p.x, c.x) - 24);
  const y = Math.max(0, Math.min(p.y, c.y) - 24);
  return {
    x,
    y,
    width: Math.min(window.innerWidth - x, Math.max(p.right, c.right) - x + 24),
    height: Math.min(window.innerHeight - y, Math.max(p.bottom, c.bottom) - y + 24),
  };
});
await page.screenshot({ path: `${OUT}-7-minimal-hover-comment.png`, clip: panelClip });
await page.screenshot({ path: `${OUT}-8-minimal-hover-full.png` });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
console.log(`截图：${OUT}-1..8*.png`);
if (failed.length > 0) process.exit(1);
