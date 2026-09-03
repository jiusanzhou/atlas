// v1.4 验证：minimal 主题卡片形态、hover 浮层、钉住、主题分段控件、localStorage 记忆。
// 用法：pnpm build && PORT=3100 pnpm start，然后 node scripts/verify-minimal-theme.mjs
import puppeteer from "puppeteer";
import { existsSync } from "node:fs";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3100";
const OUT = process.env.ATLAS_OUT ?? "/tmp/atlas-v14";

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

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "networkidle2" });
await page.waitForSelector("[data-slot-id]");

// --- 1. 主题分段控件 --------------------------------------------------------
const switcher = await page.evaluate(() => {
  const group = document.querySelector("[data-theme-switcher]");
  const options = [...(group?.querySelectorAll("[data-theme-option]") ?? [])];
  return {
    exists: Boolean(group),
    role: group?.getAttribute("role"),
    labels: options.map((b) => b.textContent?.trim()),
    names: options.map((b) => b.getAttribute("data-theme-option")),
    checked: options.filter((b) => b.getAttribute("aria-checked") === "true").map((b) =>
      b.getAttribute("data-theme-option"),
    ),
  };
});
check("头部存在主题分段控件（radiogroup）", switcher.exists && switcher.role === "radiogroup");
check(
  "4 个主题按钮：Hearthstone / Minimal / Business / Blueprint",
  switcher.labels.join(",") === "Hearthstone,Minimal,Business,Blueprint",
  switcher.labels.join(" | "),
);
check(
  "默认选中 hearthstone（demo.yaml 声明值），且只有一个选中",
  switcher.checked.length === 1 && switcher.checked[0] === "hearthstone",
  `checked=${switcher.checked.join(",")}`,
);

await page.screenshot({ path: `${OUT}-hearthstone-before.png` });

// hearthstone 基线：卡片尺寸 + 翻卡存在
const readScale = () =>
  page.evaluate(() => {
    const layer = document.querySelector("[data-canvas-layer]");
    return new DOMMatrix(getComputedStyle(layer).transform).a || 1;
  });

const hsBaseline = await page.evaluate(() => {
  const card = document.querySelector("[data-slot-id]");
  const r = card.getBoundingClientRect();
  const scale = new DOMMatrix(getComputedStyle(document.querySelector("[data-canvas-layer]")).transform).a;
  return {
    w: Math.round(r.width / scale),
    h: Math.round(r.height / scale),
    flippable: document.querySelectorAll('[data-slot-id][role="button"]').length,
    minimalCards: document.querySelectorAll("[data-minimal-card]").length,
  };
});
check("hearthstone 卡片 240×340", hsBaseline.w === 240 && hsBaseline.h === 340, `${hsBaseline.w}×${hsBaseline.h}`);
check("hearthstone 下无 minimal 卡", hsBaseline.minimalCards === 0);
check("hearthstone 下有可翻卡片", hsBaseline.flippable > 0, `${hsBaseline.flippable} 张`);

// --- 2. 切到 Minimal --------------------------------------------------------
await page.click('[data-theme-option="minimal"]');
await page.waitForSelector("[data-minimal-card]");
await sleep(700);

const minimalState = await page.evaluate(() => {
  const scale = new DOMMatrix(
    getComputedStyle(document.querySelector("[data-canvas-layer]")).transform,
  ).a;
  const card = document.querySelector("[data-minimal-card]");
  const r = card.getBoundingClientRect();
  const style = getComputedStyle(card);
  const avatar = card.querySelector("img");
  const ar = avatar?.getBoundingClientRect();
  const nameEl = [...card.children].at(-1);
  return {
    scale,
    w: Math.round(r.width / scale),
    h: Math.round(r.height / scale),
    // 透明无边框
    bg: style.backgroundColor,
    borderWidth: style.borderTopWidth,
    // The ring wrapper is the element sized to avatarSize; the inner <img>
    // is border-box inset by the 1px ring.
    avatarSize: ar ? Math.round(avatar.parentElement.getBoundingClientRect().width / scale) : null,
    avatarRadius: avatar ? getComputedStyle(avatar.parentElement).borderRadius : null,
    nameFontSize: nameEl ? getComputedStyle(nameEl).fontSize : null,
    nameColor: nameEl ? getComputedStyle(nameEl).color : null,
    // minimal 下不应有稀有度标签 / 借调徽章 / 💬 徽章 / 翻卡背面
    flippable: document.querySelectorAll('[data-slot-id][role="button"]').length,
    cardBacks: document.querySelectorAll("[data-card-back]").length,
    leadMarkers: document.querySelectorAll("[data-lead-marker]").length,
    commentDots: document.querySelectorAll("[data-comment-dot]").length,
    totalCards: document.querySelectorAll("[data-minimal-card]").length,
    rarityText: document.body.innerText.includes("传说") || document.body.innerText.includes("普通"),
  };
});

check(
  "minimal 卡片约 100×130",
  minimalState.w === 100 && minimalState.h === 130,
  `${minimalState.w}×${minimalState.h}`,
);
check(
  "卡片透明无边框",
  minimalState.bg === "rgba(0, 0, 0, 0)" && minimalState.borderWidth === "0px",
  `bg=${minimalState.bg} border=${minimalState.borderWidth}`,
);
check("avatar 64×64 且为圆形", minimalState.avatarSize === 64 && minimalState.avatarRadius === "3.35544e+07px", `${minimalState.avatarSize} r=${minimalState.avatarRadius}`);
check("姓名字号 13px", minimalState.nameFontSize === "13px", minimalState.nameFontSize);
check(
  "无翻卡（无 role=button，无背面 DOM）",
  minimalState.flippable === 0 && minimalState.cardBacks === 0,
  `flippable=${minimalState.flippable} backs=${minimalState.cardBacks}`,
);
check("卡面无稀有度文案", !minimalState.rarityText);
check(
  "负责人有小皇冠，且数量少于总卡数",
  minimalState.leadMarkers > 0 && minimalState.leadMarkers < minimalState.totalCards,
  `${minimalState.leadMarkers}/${minimalState.totalCards} 张带皇冠`,
);
check(
  "有 comment 的卡带小金点",
  minimalState.commentDots > 0 && minimalState.commentDots < minimalState.totalCards,
  `${minimalState.commentDots}/${minimalState.totalCards} 张带金点`,
);

const dotColor = await page.evaluate(() => {
  const dot = document.querySelector("[data-comment-dot]");
  const s = getComputedStyle(dot);
  const r = dot.getBoundingClientRect();
  const scale = new DOMMatrix(
    getComputedStyle(document.querySelector("[data-canvas-layer]")).transform,
  ).a;
  return { bg: s.backgroundColor, size: Math.round((r.width / scale) * 10) / 10 };
});
check("金点是黄色小圆点（≈7px）", dotColor.bg === "rgb(250, 204, 21)" && dotColor.size <= 8, JSON.stringify(dotColor));

// 领域容器：无背景、只有下划线
const domainStyle = await page.evaluate(() => {
  const box = document.querySelector("[data-domain-id]");
  const s = getComputedStyle(box);
  const header = box.firstElementChild;
  const hs = getComputedStyle(header);
  return {
    bg: s.backgroundColor,
    border: s.borderTopWidth,
    headerBottomBorder: hs.borderBottomWidth,
    headerBg: hs.backgroundColor,
    text: header.textContent?.trim(),
  };
});
check(
  "minimal 领域容器无背景无边框，仅 header 下划线",
  domainStyle.bg === "rgba(0, 0, 0, 0)" &&
    domainStyle.border === "0px" &&
    domainStyle.headerBottomBorder === "1px",
  JSON.stringify(domainStyle),
);
check("领域 header 显示名称 + 缺口计数", /缺 \d+/.test(domainStyle.text ?? ""), domainStyle.text);

await page.screenshot({ path: `${OUT}-minimal-home.png` });

// --- 3. hover 出浮层 --------------------------------------------------------
// 找一个有 comment 的卡（金点）来 hover，浮层内容最丰富
const target = await page.evaluate(() => {
  const dot = document.querySelector("[data-comment-dot]");
  const card = dot.closest("[data-minimal-card]");
  const r = card.getBoundingClientRect();
  return {
    slotId: card.getAttribute("data-slot-id"),
    x: Math.round(r.x + r.width / 2),
    y: Math.round(r.y + 12),
  };
});

await page.mouse.move(target.x, target.y);
await page.waitForSelector("[data-person-panel]", { timeout: 3000 });
await sleep(300);

const panel = await page.evaluate(() => {
  const p = document.querySelector("[data-person-panel]");
  const card = document.querySelector(`[data-slot-id="${p.getAttribute("data-person-panel")}"]`);
  const pr = p.getBoundingClientRect();
  const cr = card.getBoundingClientRect();
  const scale = new DOMMatrix(
    getComputedStyle(document.querySelector("[data-canvas-layer]")).transform,
  ).a;
  const md = p.querySelector(".markdown-body");
  return {
    slot: p.getAttribute("data-person-panel"),
    side: p.getAttribute("data-panel-side"),
    role: p.getAttribute("role"),
    width: Math.round(pr.width / scale),
    // 右侧浮层：左边缘应在卡片右边缘之外
    gapFromCardRight: Math.round((pr.left - cr.right) / scale),
    pinnedAttr: p.getAttribute("data-panel-pinned"),
    pointerEvents: getComputedStyle(p).pointerEvents,
    inViewport: pr.right <= window.innerWidth + 1 && pr.left >= -1,
    // 内容断言
    avatarSize: p.querySelector("img")
      ? Math.round(p.querySelector("img").parentElement.getBoundingClientRect().width / scale)
      : null,
    text: p.innerText,
    tagCount: [...p.querySelectorAll("span")].filter((s) =>
      /^[A-Za-z一-龥]/.test(s.textContent ?? ""),
    ).length,
    hasMarkdown: Boolean(md),
    mdStrong: [...(md?.querySelectorAll("strong") ?? [])].map((e) => e.textContent),
    mdList: (md?.querySelectorAll("li") ?? []).length,
    mdRawAsterisk: (md?.textContent ?? "").includes("**"),
  };
});

check("hover 卡片弹出浮层", Boolean(panel.slot), panel.slot);
check("浮层宽度 240px（220-260 区间）", panel.width >= 220 && panel.width <= 260, `${panel.width}px`);
check("浮层在卡片右侧且留有间距", panel.side === "right" && panel.gapFromCardRight >= 8, `side=${panel.side} gap=${panel.gapFromCardRight}`);
check("浮层未超出视口", panel.inViewport);
check("浮层 pointer-events: auto（鼠标可移入）", panel.pointerEvents === "auto");
check("浮层是 role=dialog", panel.role === "dialog");
check("浮层含 80px 大 avatar", panel.avatarSize === 80, String(panel.avatarSize));
check("浮层含职级信息", panel.text.includes("首席架构师") || panel.text.length > 40, panel.text.slice(0, 60).replace(/\n/g, " / "));
check(
  "浮层 markdown 被真正解析（有 strong，无残留 **）",
  panel.hasMarkdown && panel.mdStrong.length > 0 && !panel.mdRawAsterisk,
  `strong=${panel.mdStrong.join(",")} li=${panel.mdList}`,
);

await page.screenshot({ path: `${OUT}-minimal-hover.png` });
const clip = await page.evaluate(() => {
  const p = document.querySelector("[data-person-panel]").getBoundingClientRect();
  const c = document
    .querySelector("[data-minimal-card][data-slot-id]")
    .getBoundingClientRect();
  const x = Math.max(0, Math.min(p.x, c.x) - 20);
  const y = Math.max(0, Math.min(p.y, c.y) - 20);
  return { x, y, width: Math.min(window.innerWidth - x, p.right - x + 20), height: Math.min(window.innerHeight - y, p.bottom - y + 20) };
});
await page.screenshot({ path: `${OUT}-minimal-hover-closeup.png`, clip });

// --- 4. 鼠标移开浮层消失 ----------------------------------------------------
await page.mouse.move(20, 900);
await sleep(700);
const afterLeave = await page.evaluate(() => document.querySelectorAll("[data-person-panel]").length);
check("鼠标移开后浮层消失（未钉住）", afterLeave === 0, `panels=${afterLeave}`);

// --- 5. 点击钉住 / 再点取消 -------------------------------------------------
await page.mouse.move(target.x, target.y);
await page.waitForSelector("[data-person-panel]");
await page.mouse.click(target.x, target.y);
await sleep(300);
const pinned = await page.evaluate(() => {
  const p = document.querySelector("[data-person-panel]");
  return { exists: Boolean(p), pinned: p?.getAttribute("data-panel-pinned"), text: p?.innerText.includes("已钉住") };
});
check("点击卡片钉住浮层", pinned.exists && pinned.pinned === "true", JSON.stringify(pinned));

// 钉住后移开鼠标不消失
await page.mouse.move(20, 900);
await sleep(700);
const stillPinned = await page.evaluate(() => document.querySelectorAll("[data-person-panel]").length);
check("钉住后鼠标移开浮层保留", stillPinned === 1, `panels=${stillPinned}`);

await page.screenshot({ path: `${OUT}-minimal-pinned.png` });

// 再点击取消钉住
await page.mouse.move(target.x, target.y);
await sleep(200);
await page.mouse.click(target.x, target.y);
await sleep(500);
const unpinned = await page.evaluate(() => document.querySelectorAll("[data-person-panel]").length);
check("再点击取消钉住", unpinned === 0, `panels=${unpinned}`);

// --- 6. 点空白关闭 + Esc 关闭 ----------------------------------------------
// 鼠标已在卡片上时不会再触发 pointerenter，先移开再回来。
await page.mouse.move(20, 900);
await sleep(400);
await page.mouse.move(target.x, target.y);
await page.waitForSelector("[data-person-panel]");
await page.mouse.click(target.x, target.y);
await sleep(250);
const blankPoint = await page.evaluate(() => {
  const vp = document.querySelector("#atlas-canvas").closest(".absolute.inset-0");
  const r = vp.getBoundingClientRect();
  return { x: Math.round(r.x + 12), y: Math.round(r.y + r.height - 90) };
});
await page.mouse.click(blankPoint.x, blankPoint.y);
await sleep(400);
check(
  "点击空白关闭钉住的浮层",
  (await page.evaluate(() => document.querySelectorAll("[data-person-panel]").length)) === 0,
);

await page.mouse.move(20, 900);
await sleep(400);
await page.mouse.move(target.x, target.y);
await page.waitForSelector("[data-person-panel]");
await page.mouse.click(target.x, target.y);
await sleep(250);
await page.keyboard.press("Escape");
await sleep(400);
check(
  "Esc 关闭钉住的浮层",
  (await page.evaluate(() => document.querySelectorAll("[data-person-panel]").length)) === 0,
);

// --- 7. 缺口卡浮层 ----------------------------------------------------------
// 切到有缺口的领域（infra 默认就有）
const gapTarget = await page.evaluate(() => {
  const card = [...document.querySelectorAll("[data-minimal-card]")].find((c) =>
    c.getAttribute("data-slot-id")?.includes("gap-"),
  );
  if (!card) return null;
  const r = card.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + 12), slot: card.getAttribute("data-slot-id"), label: card.textContent };
});
if (gapTarget) {
  check("缺口卡显示「招募中 · {role}」", /招募中/.test(gapTarget.label ?? ""), gapTarget.label);
  await page.mouse.move(20, 900);
  await sleep(300);
  await page.mouse.move(gapTarget.x, gapTarget.y);
  await page.waitForSelector("[data-person-panel]");
  await sleep(250);
  const gapPanel = await page.evaluate(() => document.querySelector("[data-person-panel]").innerText);
  check(
    "缺口浮层含 role / 人数 / 优先级",
    /招募中/.test(gapPanel) && /缺 \d+ 人/.test(gapPanel) && /优先级/.test(gapPanel),
    gapPanel.replace(/\n/g, " / "),
  );
  await page.mouse.move(20, 900);
  await sleep(500);
} else {
  check("缺口卡存在", false, "当前 tab 无缺口卡");
}

// --- 8. 借调连线（同图内）--------------------------------------------------
const loans = await page.evaluate(() => {
  const paths = [...document.querySelectorAll("[data-loan-link]")];
  return {
    count: paths.length,
    dashed: paths[0] ? getComputedStyle(paths[0]).strokeDasharray : null,
    hasMarker: paths[0]?.getAttribute("marker-end"),
    ids: paths.map((p) => p.getAttribute("data-loan-link")),
  };
});
// infra 领域内：matz 借调到 compute（matz 家在 devex，不同图）→ 可能为 0；
// 检查存在性但不强制 >0，转而在「数据」tab 或 platform tab 里验证
check(
  "借调连线为虚线且带箭头（若本图存在同图借调）",
  loans.count === 0 || (loans.dashed !== "none" && loans.hasMarker?.includes("atlas-loan-arrow")),
  `count=${loans.count} dash=${loans.dashed} ids=${loans.ids.join(",")}`,
);

// 切到「应用平台」tab：yyx990803(web) 借到 devex，两者同在 platform 树内
const tabs = await page.$$('[role="tab"]');
for (const t of tabs) {
  const label = await t.evaluate((el) => el.textContent ?? "");
  if (label.includes("应用平台")) {
    await t.click();
    break;
  }
}
await page.waitForSelector("[data-minimal-card]");
await sleep(800);
const platformLoans = await page.evaluate(() => {
  const paths = [...document.querySelectorAll("[data-loan-link]")];
  return {
    count: paths.length,
    ids: paths.map((p) => p.getAttribute("data-loan-link")),
    dash: paths[0] ? getComputedStyle(paths[0]).strokeDasharray : null,
    stroke: paths[0] ? getComputedStyle(paths[0]).stroke : null,
  };
});
check(
  "同图内借调画出虚线箭头（platform: yyx990803 web→devex）",
  platformLoans.count > 0 && platformLoans.dash !== "none",
  `count=${platformLoans.count} ids=${platformLoans.ids.join(",")} dash=${platformLoans.dash}`,
);
await page.screenshot({ path: `${OUT}-minimal-loan-arrow.png` });

// --- 9. pan / zoom 仍工作 ---------------------------------------------------
const readView = () =>
  page.evaluate(() => {
    const m = new DOMMatrix(
      getComputedStyle(document.querySelector("[data-canvas-layer]")).transform,
    );
    return { x: Math.round(m.m41), y: Math.round(m.m42), scale: Number(m.a.toFixed(3)) };
  });
const beforePan = await readView();
await page.mouse.move(blankPoint.x, blankPoint.y);
await page.mouse.down();
await page.mouse.move(blankPoint.x + 110, blankPoint.y - 60, { steps: 10 });
await page.mouse.up();
const afterPan = await readView();
check(
  "minimal 下空白处仍可 pan",
  Math.abs(afterPan.x - beforePan.x - 110) < 8,
  `${JSON.stringify(beforePan)} -> ${JSON.stringify(afterPan)}`,
);

// --- 10. 切回 Hearthstone ---------------------------------------------------
await page.click('[data-theme-option="hearthstone"]');
await page.waitForFunction(() => document.querySelectorAll("[data-minimal-card]").length === 0);
await sleep(900);
const backToHs = await page.evaluate(() => {
  const card = document.querySelector("[data-slot-id]");
  const r = card.getBoundingClientRect();
  const scale = new DOMMatrix(
    getComputedStyle(document.querySelector("[data-canvas-layer]")).transform,
  ).a;
  return {
    w: Math.round(r.width / scale),
    h: Math.round(r.height / scale),
    flippable: document.querySelectorAll('[data-slot-id][role="button"]').length,
    panels: document.querySelectorAll("[data-person-panel]").length,
    checked: document
      .querySelector('[data-theme-option][aria-checked="true"]')
      ?.getAttribute("data-theme-option"),
  };
});
check(
  "切回 hearthstone 恢复 240×340 + 可翻卡 + 无浮层",
  backToHs.w === 240 && backToHs.h === 340 && backToHs.flippable > 0 && backToHs.panels === 0,
  JSON.stringify(backToHs),
);

// 翻卡仍工作
await page.click('[data-slot-id][role="button"]');
await sleep(700);
const flip = await page.evaluate(() => {
  const card = document.querySelector('[data-slot-id][role="button"]');
  const flipper = card.querySelector("[style*='preserve-3d']");
  return {
    m11: Number(new DOMMatrix(getComputedStyle(flipper).transform).m11.toFixed(2)),
    hasMd: Boolean(card.querySelector("[data-card-back] .markdown-body")),
  };
});
check("hearthstone 翻卡功能正常", flip.m11 === -1 && flip.hasMd, `m11=${flip.m11} md=${flip.hasMd}`);
await page.click('[data-slot-id][role="button"]');
await sleep(500);
await page.screenshot({ path: `${OUT}-hearthstone-after.png` });

// --- 11. localStorage 记忆 --------------------------------------------------
await page.click('[data-theme-option="minimal"]');
await page.waitForSelector("[data-minimal-card]");
const stored = await page.evaluate(() => localStorage.getItem("atlas:theme"));
check("选择写入 localStorage", stored === "minimal", String(stored));

await page.reload({ waitUntil: "networkidle2" });
await page.waitForSelector("[data-slot-id]");
await sleep(600);
const afterReload = await page.evaluate(() => ({
  checked: document
    .querySelector('[data-theme-option][aria-checked="true"]')
    ?.getAttribute("data-theme-option"),
  minimalCards: document.querySelectorAll("[data-minimal-card]").length,
}));
check(
  "刷新后仍是 minimal（主题被记住）",
  afterReload.checked === "minimal" && afterReload.minimalCards > 0,
  JSON.stringify(afterReload),
);

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
console.log(`截图前缀：${OUT}-*`);
if (failed.length > 0) process.exit(1);
