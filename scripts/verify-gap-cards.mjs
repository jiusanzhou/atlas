// v1.5 结构验证：schema 互斥、leadGap 排序/计数、drawio 缺口样式。
// 走 /api/parse + /api/drawio，不需要浏览器。
// 用法：pnpm build && PORT=3100 pnpm start，然后 node scripts/verify-gap-cards.mjs
import { readFileSync } from "node:fs";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3100";

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const post = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const json = res.headers.get("content-type")?.includes("json") ? JSON.parse(text) : null;
  return { status: res.status, text, json };
};

const source = readFileSync(new URL("../examples/demo.yaml", import.meta.url), "utf8");
const parsed = await post("/api/parse", { source });

check("demo.yaml 解析通过", parsed.status === 200, `status=${parsed.status}`);
check("无引用告警", parsed.json?.warnings?.length === 0, (parsed.json?.warnings ?? []).join(" | "));

const config = parsed.json.config;

// --- 1. schema: lead 与 leadGap 互斥 ----------------------------------------
const both = await post("/api/parse", {
  format: "json",
  source: JSON.stringify({
    theme: "hearthstone",
    domains: [
      { name: "t", displayName: "T", lead: "a", leadGap: { role: "负责人", priority: "high" } },
    ],
    people: [{ id: "a", name: "A", homeDomain: "t" }],
  }),
});
check(
  "同时填 lead + leadGap 被拒（422 + 「lead 与 leadGap 只能填一个」）",
  both.status === 422 &&
    (both.json?.issues ?? []).some((i) => i.includes("lead 与 leadGap 只能填一个")),
  `status=${both.status} issues=${(both.json?.issues ?? []).join(" | ")}`,
);

const leadGapOnly = await post("/api/parse", {
  format: "json",
  source: JSON.stringify({
    theme: "hearthstone",
    domains: [{ name: "t", displayName: "T", leadGap: { role: "负责人", priority: "critical" } }],
    people: [],
  }),
});
check(
  "只填 leadGap 通过校验，count 默认为 1",
  leadGapOnly.status === 200 && leadGapOnly.json.config.domains[0].leadGap.count === 1,
  `status=${leadGapOnly.status} count=${leadGapOnly.json?.config?.domains?.[0]?.leadGap?.count}`,
);

const gapNoCount = await post("/api/parse", {
  format: "json",
  source: JSON.stringify({
    theme: "hearthstone",
    domains: [{ name: "t", displayName: "T", gaps: [{ role: "R", priority: "low" }] }],
    people: [],
  }),
});
check(
  "gaps[].count 省略时默认为 1",
  gapNoCount.json?.config?.domains?.[0]?.gaps?.[0]?.count === 1,
  `count=${gapNoCount.json?.config?.domains?.[0]?.gaps?.[0]?.count}`,
);

// --- 2. 计数：leadGap 计入 totalGaps ----------------------------------------
// infra 2+1+1=4, platform (leadGap 1 + iOS 2 + devex 1)=4, data 2 => 10
check("totalGaps 含 leadGap，共 10", parsed.json.stats.gaps === 10, String(parsed.json.stats.gaps));

const mobileDomain = config.domains
  .find((d) => d.name === "platform")
  .subdomains.find((d) => d.name === "mobile");
check(
  "移动端 domain 有 leadGap 且无 lead",
  Boolean(mobileDomain.leadGap) && !mobileDomain.lead,
  `leadGap.role=${mobileDomain.leadGap?.role} lead=${mobileDomain.lead ?? "(none)"}`,
);
check(
  "leadGap 带 markdown comment（招聘要求）",
  mobileDomain.leadGap.comment?.includes("岗位要求") &&
    mobileDomain.leadGap.comment.includes("加分项"),
  `commentLen=${mobileDomain.leadGap.comment?.length ?? 0}`,
);

// --- 3. drawio：缺口 mxCell 样式 --------------------------------------------
for (const themeName of ["hearthstone", "minimal"]) {
  const res = await post("/api/drawio", {
    config: { ...config, theme: themeName },
    inlineAvatars: false,
  });
  check(`[${themeName}] drawio 导出 200`, res.status === 200, `status=${res.status}`);
  const xml = res.text;

  const cells = [...xml.matchAll(/<mxCell [^>]*style="([^"]*)"[^>]*>/g)].map((m) => m[1]);

  const gray = themeName === "hearthstone" ? "rgba(115, 115, 115, 0.6)" : "#d4d4d4";
  const gold = themeName === "hearthstone" ? "#d4af37" : "#eab308";

  const dashedGray = cells.filter((s) => s.includes("dashed=1") && s.includes(`strokeColor=${gray}`));
  const dashedGold = cells.filter((s) => s.includes("dashed=1") && s.includes(`strokeColor=${gold}`));

  check(
    `[${themeName}] 成员缺口 cell 带 dashed=1 + 灰色 strokeColor`,
    dashedGray.length > 0,
    `${dashedGray.length} 个 (${gray})`,
  );
  check(
    `[${themeName}] 负责人缺口 cell 带 dashed=1 + 金色 strokeColor`,
    dashedGold.length > 0,
    `${dashedGold.length} 个 (${gold})`,
  );

  const values = [...xml.matchAll(/<mxCell [^>]*value="([^"]*)"/g)].map((m) => m[1]);

  const leadGapValue = values.find((v) => v.includes("负责人空缺：移动端负责人"));
  check(
    `[${themeName}] 负责人缺口 value 含 role/count/优先级/note/comment`,
    Boolean(leadGapValue) &&
      leadGapValue.includes("缺口 ×1") &&
      leadGapValue.includes("优先级：紧急") &&
      leadGapValue.includes("5+ 年 iOS 深度经验") &&
      leadGapValue.includes("岗位要求"),
    leadGapValue ? `${leadGapValue.slice(0, 60).replace(/&#10;/g, " / ")}…` : "未找到",
  );

  const memberGapValue = values.find((v) => v.includes("招募中：iOS 工程师"));
  check(
    `[${themeName}] 成员缺口 value 含 count ×2 + 高优先级 + comment`,
    Boolean(memberGapValue) &&
      memberGapValue.includes("缺口 ×2") &&
      memberGapValue.includes("优先级：高") &&
      memberGapValue.includes("Metal"),
    memberGapValue ? `${memberGapValue.slice(0, 60).replace(/&#10;/g, " / ")}…` : "未找到",
  );

  check(`[${themeName}] value 换行编码为 &#10;`, Boolean(leadGapValue?.includes("&#10;")));

  const crown = cells.filter((s) => s.includes("dashPattern=3 2"));
  check(
    `[${themeName}] 负责人缺口带虚线皇冠 cell（dashPattern=3 2）`,
    crown.length > 0,
    `${crown.length} 个`,
  );

  check(`[${themeName}] 缺口含人形剪影字形 &#128100;`, xml.includes("&amp;#128100;"));

  const pages = (xml.match(/<diagram /g) ?? []).length;
  check(`[${themeName}] 3 个 diagram page`, pages === 3, String(pages));
  // 每页两个自闭合根 cell（id=0 / id=1），其余必须成对闭合。
  const open = (xml.match(/<mxCell /g) ?? []).length;
  const close = (xml.match(/<\/mxCell>/g) ?? []).length;
  const selfClosing = (xml.match(/<mxCell [^>]*\/>/g) ?? []).length;
  check(
    `[${themeName}] mxCell 开闭标签配平`,
    open === close + selfClosing && selfClosing === pages * 2,
    `open=${open} close=${close} self=${selfClosing}`,
  );

  // 打印移动端页的缺口片段，作为交付证据
  if (themeName === "hearthstone") {
    const page = xml.split("<diagram ").find((p) => p.includes("应用平台"));
    const snippet = page
      .split("\n")
      .filter((line) => /dashed=1|负责人空缺|招募中/.test(line))
      .slice(0, 6)
      .join("\n");
    console.log(`\n--- hearthstone 应用平台页缺口 mxCell 片段 ---\n${snippet}\n`);
  }
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length > 0) process.exit(1);
