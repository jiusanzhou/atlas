// v1.4 验证：minimal 主题的 drawio 导出结构（简约卡、借调虚线边、comment 保留）。
// 用法：pnpm build && PORT=3100 pnpm start，然后 node scripts/verify-minimal-drawio.mjs
import { readFile, writeFile } from "node:fs/promises";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3100";
const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const source = await readFile(new URL("../examples/demo.yaml", import.meta.url), "utf8");

async function exportXml(theme) {
  const res = await fetch(`${BASE}/api/drawio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // 关掉头像内联：避免依赖网络，也让 XML 小到可读
    body: JSON.stringify({ source: source.replace(/^theme:.*$/m, `theme: ${theme}`), inlineAvatars: false }),
  });
  if (!res.ok) throw new Error(`${theme} 导出失败 HTTP ${res.status}: ${await res.text()}`);
  return res.text();
}

const xml = await exportXml("minimal");
await writeFile("/tmp/atlas-v14-minimal.drawio", xml);
const hs = await exportXml("hearthstone");

// --- 结构合法性 ------------------------------------------------------------
check("导出为 mxfile 且以 </mxfile> 收尾", xml.startsWith("<mxfile") && xml.trimEnd().endsWith("</mxfile>"));

const pages = [...xml.matchAll(/<diagram id="([^"]+)" name="([^"]+)">/g)].map((m) => m[2]);
check(
  "一个顶层领域一个 page（基础设施 / 应用平台 / 数据）",
  pages.length === 3 && pages.join(",") === "基础设施,应用平台,数据",
  pages.join(" | "),
);

// 真正解析一遍，而不是数标签：自闭合的 <mxCell id="0" /> 会让计数天然不配平。
// linkedom 未安装，这里用 JSDOM 之外最轻的方式：浏览器端的 DOMParser 不可用，
// 于是做一次严格的手写扫描——每个 <mxCell 要么自闭合，要么有对应 </mxCell>。
const cellTokens = [...xml.matchAll(/<mxCell\b[^>]*?(\/)?>|<\/mxCell>/g)];
let depth = 0;
let wellFormed = true;
for (const [token, selfClosing] of cellTokens) {
  if (token === "</mxCell>") depth -= 1;
  else if (!selfClosing) depth += 1;
  if (depth < 0) wellFormed = false;
}
check("mxCell 嵌套良构（自闭合已计入）", wellFormed && depth === 0, `残余深度 ${depth}`);

const selfClosed = cellTokens.filter(([, s]) => s).length;
check(
  "每 page 两个自闭合根 cell（id=0 / id=1）",
  selfClosed === pages.length * 2,
  `${selfClosed} 个自闭合 / ${pages.length} pages`,
);

// --- minimal 卡片样式 ------------------------------------------------------
check(
  "minimal 人物卡无填充无描边（frame 为 fillColor=none;strokeColor=none）",
  xml.includes("rounded=1;arcSize=10;fillColor=none;strokeColor=none"),
);
check(
  "头像仍为圆形裁剪（clipPath=ellipse）",
  xml.includes("clipPath=ellipse"),
  `出现 ${(xml.match(/clipPath=ellipse/g) ?? []).length} 次`,
);
check(
  "minimal 卡不带稀有度边框色（hearthstone 的 legendary 金边缺席）",
  !xml.includes("strokeColor=#d4af37;strokeWidth=4") && hs.includes("strokeColor=#d4af37"),
);
check("minimal 卡不画标签 chip（无 fillColor=#000000;opacity=60）", !xml.includes("fillColor=#000000;opacity=60"));
check("负责人用皇冠符号而非「负责人」横幅", xml.includes("♛") && !xml.includes('value="负责人"'));
check(
  "hearthstone 仍用「负责人」横幅（未被 minimal 改动）",
  hs.includes('value="负责人"') && !hs.includes("♛"),
);

// --- 领域容器 --------------------------------------------------------------
check(
  "minimal 领域容器无填充（container=1 但 fillColor=none）",
  xml.includes("fillColor=none;strokeColor=none;html=1;verticalAlign=top;container=1"),
);
check("minimal 领域用下划线（shape=line）区隔", xml.includes("line;html=1;strokeColor="));
check("领域 header 带缺口计数文案", /缺 \d+/.test(xml), (xml.match(/缺 \d+/g) ?? []).slice(0, 3).join(" "));

// --- 借调 ------------------------------------------------------------------
const loanEdges = [...xml.matchAll(/dashed=1;dashPattern=5 4/g)];
check("同图借调导出为虚线箭头边", loanEdges.length > 0, `${loanEdges.length} 条`);
check(
  "借调边带箭头且标注比例",
  xml.includes("endArrow=blockThin") && /value="[^"]*\d+%"/.test(xml),
);
// 跨 page 借调（antirez: storage -> streaming）退化为文本标注
check(
  "跨 page 借调退化为「→ 借出到 XX」文本标注",
  xml.includes("→ 借出到") || xml.includes("← 来自"),
  (xml.match(/(→ 借出到|← 来自)[^"<]*/g) ?? []).slice(0, 3).join(" | "),
);

// --- comment 保留 ----------------------------------------------------------
check(
  "comment 附加到 mxCell value（noLabel=1 隐藏但可搜索）",
  xml.includes("noLabel=1") && xml.includes("定海神针"),
);
check(
  "带 comment 的卡有金点 marker",
  xml.includes("fillColor=#facc15;strokeColor=none"),
);

// --- 缺口卡 ----------------------------------------------------------------
check(
  "minimal 缺口卡为虚线圆 + 「招募中 · role」",
  xml.includes("dashPattern=3 3") && /招募中 · [^"]+×\d+/.test(xml),
  (xml.match(/招募中 · [^"]+×\d+/g) ?? []).slice(0, 2).join(" | "),
);

// --- 尺寸：minimal page 应显著小于 hearthstone --------------------------------
const dims = (text) => {
  const m = text.match(/pageWidth="(\d+)" pageHeight="(\d+)"/);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
};
const md = dims(xml);
const hd = dims(hs);
check(
  "minimal page 尺寸显著小于 hearthstone",
  md && hd && md.w < hd.w && md.h < hd.h,
  `minimal ${md?.w}×${md?.h} vs hearthstone ${hd?.w}×${hd?.h}`,
);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
console.log("XML：/tmp/atlas-v14-minimal.drawio");
if (failed.length > 0) process.exit(1);
