import { describe, expect, it } from "vitest";
import { ConfigError, detectFormat, flattenDomains, parseConfig } from "@/lib/parser";

/**
 * The same configuration expressed three ways. Every format must produce a
 * deep-equal Config, which is what lets the editor accept any of them
 * interchangeably.
 */
const YAML_SOURCE = `meta:
  title: 技术中台
  version: "1.0.0"

theme: hearthstone

domains:
  - name: infra
    displayName: 基础设施
    lead: torvalds
    members: [pcarrier]
    color: "#4a3113"
    gaps:
      - role: SRE 工程师
        count: 2
        priority: high
        note: 多活容灾
    subdomains:
      - name: compute
        displayName: 计算
        leadGap:
          role: 计算负责人
          priority: critical

people:
  - id: torvalds
    name: Linus Torvalds
    title: 首席架构师
    homeDomain: infra
    avatar: github:torvalds
    tags: [Kernel, C]
    rarity: legendary
    comment: "**强项**：内核"
    lendTo:
      - domain: compute
        ratio: 0.3
        role: 选型
  - id: pcarrier
    name: Pierre Carrier
`;

const JSON_SOURCE = JSON.stringify(
  {
    meta: { title: "技术中台", version: "1.0.0" },
    theme: "hearthstone",
    domains: [
      {
        name: "infra",
        displayName: "基础设施",
        lead: "torvalds",
        members: ["pcarrier"],
        color: "#4a3113",
        gaps: [{ role: "SRE 工程师", count: 2, priority: "high", note: "多活容灾" }],
        subdomains: [
          {
            name: "compute",
            displayName: "计算",
            leadGap: { role: "计算负责人", priority: "critical" },
          },
        ],
      },
    ],
    people: [
      {
        id: "torvalds",
        name: "Linus Torvalds",
        title: "首席架构师",
        homeDomain: "infra",
        avatar: "github:torvalds",
        tags: ["Kernel", "C"],
        rarity: "legendary",
        comment: "**强项**：内核",
        lendTo: [{ domain: "compute", ratio: 0.3, role: "选型" }],
      },
      { id: "pcarrier", name: "Pierre Carrier" },
    ],
  },
  null,
  2,
);

const TOML_SOURCE = `theme = "hearthstone"

[meta]
title = "技术中台"
version = "1.0.0"

[[domains]]
name = "infra"
displayName = "基础设施"
lead = "torvalds"
members = ["pcarrier"]
color = "#4a3113"

  [[domains.gaps]]
  role = "SRE 工程师"
  count = 2
  priority = "high"
  note = "多活容灾"

  [[domains.subdomains]]
  name = "compute"
  displayName = "计算"

    [domains.subdomains.leadGap]
    role = "计算负责人"
    priority = "critical"

[[people]]
id = "torvalds"
name = "Linus Torvalds"
title = "首席架构师"
homeDomain = "infra"
avatar = "github:torvalds"
tags = ["Kernel", "C"]
rarity = "legendary"
comment = "**强项**：内核"

  [[people.lendTo]]
  domain = "compute"
  ratio = 0.3
  role = "选型"

[[people]]
id = "pcarrier"
name = "Pierre Carrier"
`;

describe("detectFormat", () => {
  it.each([
    ["object JSON", '{"domains": []}', "json"],
    ["array JSON", "[1, 2]", "json"],
    ["yaml mapping", "domains:\n  - name: a", "yaml"],
    ["toml table header", '[meta]\ntitle = "x"', "toml"],
    ["toml key/value", 'theme = "hearthstone"', "toml"],
  ] as const)("detects %s", (_label, source, expected) => {
    expect(detectFormat(source)).toBe(expected);
  });

  it("skips leading comments and blank lines before deciding", () => {
    expect(detectFormat("# a comment\n\ntheme = \"x\"")).toBe("toml");
    expect(detectFormat("# a comment\n\ntheme: x")).toBe("yaml");
  });

  it("does not mistake a yaml value containing '=' for toml", () => {
    expect(detectFormat('meta:\n  description: "a=b"')).toBe("yaml");
  });

  it.each([
    ["[meta]", "toml"],
    ["[[domains]]", "toml"],
    ["[domains.subdomains.leadGap]", "toml"],
    ['[\n  {"a": 1}\n]', "json"],
    ['["a", "b"]', "json"],
  ] as const)("disambiguates a leading '[': %s", (source, expected) => {
    // A TOML table header and a JSON array both open with '['.
    expect(detectFormat(source)).toBe(expected);
  });

  it("throws on an empty source", () => {
    expect(() => detectFormat("   \n  ")).toThrow(ConfigError);
  });
});

describe("parseConfig across formats", () => {
  const yaml = parseConfig(YAML_SOURCE);
  const json = parseConfig(JSON_SOURCE);
  const toml = parseConfig(TOML_SOURCE);

  it("auto-detects each format", () => {
    expect(yaml.format).toBe("yaml");
    expect(json.format).toBe("json");
    expect(toml.format).toBe("toml");
  });

  it("produces identical configs from yaml, json and toml", () => {
    expect(json.config).toEqual(yaml.config);
    // TOML's parser returns objects with a null prototype, so compare a
    // round-tripped copy rather than the raw parse result.
    expect(JSON.parse(JSON.stringify(toml.config))).toEqual(
      JSON.parse(JSON.stringify(yaml.config)),
    );
  });

  it("reports no reference warnings for a self-consistent config", () => {
    expect(yaml.warnings).toEqual([]);
    expect(json.warnings).toEqual([]);
    expect(toml.warnings).toEqual([]);
  });

  it("preserves nested structure and defaults", () => {
    const { config } = yaml;

    expect(config.meta?.title).toBe("技术中台");
    expect(config.domains[0]?.subdomains?.[0]?.name).toBe("compute");
    // leadGap.count is optional in the source and defaults to 1.
    expect(config.domains[0]?.subdomains?.[0]?.leadGap?.count).toBe(1);
    expect(config.people[0]?.lendTo?.[0]?.domain).toBe("compute");
  });

  it("honours an explicit format that overrides detection", () => {
    expect(parseConfig(JSON_SOURCE, "json").format).toBe("json");
    // JSON is a subset of YAML, so parsing it as YAML must also work.
    expect(parseConfig(JSON_SOURCE, "yaml").config).toEqual(json.config);
  });
});

describe("flattenDomains", () => {
  it("walks the whole tree depth-first", () => {
    const { config } = parseConfig(YAML_SOURCE);
    expect(flattenDomains(config.domains).map((d) => d.name)).toEqual(["infra", "compute"]);
  });
});

describe("syntax error reporting", () => {
  it("reports the line for a YAML error", () => {
    try {
      parseConfig("meta:\n  title: a\n  bad: [1, 2\npeople: []\n");
      expect.unreachable("should have thrown");
    } catch (error) {
      const configError = error as ConfigError;
      expect(configError).toBeInstanceOf(ConfigError);
      expect(configError.line).toBe(4);
      expect(configError.message).toContain("第 4 行");
      expect(configError.issues[0]).toContain("第 4 行");
      // The raw js-yaml message appends a multi-line snippet; it must not leak.
      expect(configError.issues[0]).not.toContain("\n");
    }
  });

  it("reports the line for a JSON error", () => {
    try {
      parseConfig('{\n  "domains": [],\n  "people": []\n  "x": 1\n}');
      expect.unreachable("should have thrown");
    } catch (error) {
      const configError = error as ConfigError;
      expect(configError.line).toBe(4);
      expect(configError.message).toContain("JSON 语法错误");
      expect(configError.issues[0]).toContain("第 4 行");
    }
  });

  it("reports the line for a TOML error", () => {
    try {
      parseConfig("a = 1\nb = = 2\n");
      expect.unreachable("should have thrown");
    } catch (error) {
      const configError = error as ConfigError;
      expect(configError.line).toBe(2);
      expect(configError.message).toContain("TOML 语法错误");
      // The trailing "at row N, col M, pos P" is stripped as redundant.
      expect(configError.issues[0]).not.toContain("pos ");
    }
  });

  it("still produces an issue when the parser gives no position", () => {
    try {
      parseConfig("{");
      expect.unreachable("should have thrown");
    } catch (error) {
      const configError = error as ConfigError;
      expect(configError.issues).toHaveLength(1);
      expect(configError.issues[0]).toBeTruthy();
    }
  });
});

describe("schema error reporting", () => {
  it("renders array indices in brackets and counts the issues", () => {
    try {
      parseConfig("domains:\n  - displayName: 无 name\n    gaps:\n      - count: 2\npeople: []\n");
      expect.unreachable("should have thrown");
    } catch (error) {
      const configError = error as ConfigError;
      expect(configError.message).toMatch(/配置校验失败（\d+ 处）/);
      expect(configError.issues).toContain(
        "domains[0].gaps[0].priority: Invalid option: expected one of \"low\"|\"medium\"|\"high\"|\"critical\"",
      );
      expect(configError.issues.some((i) => i.startsWith("domains[0].name:"))).toBe(true);
      // Syntax was fine, so there is no line to report.
      expect(configError.line).toBeUndefined();
    }
  });

  it("surfaces the lead/leadGap conflict with its domain path", () => {
    try {
      parseConfig(
        "domains:\n  - name: d\n    lead: a\n    leadGap:\n      role: r\n      priority: high\npeople:\n  - id: a\n    name: A\n",
      );
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as ConfigError).issues).toContain(
        "domains[0].leadGap: lead 与 leadGap 只能填一个",
      );
    }
  });
});

describe("reference warnings", () => {
  it("flags dangling lead, member, homeDomain and lendTo targets", () => {
    const { warnings } = parseConfig(
      `domains:
  - name: infra
    lead: ghost
    members: [alsoGhost]
people:
  - id: real
    name: Real
    homeDomain: nowhere
    lendTo:
      - domain: nowhere
        ratio: 0.5
`,
    );

    expect(warnings.some((w) => w.includes('lead "ghost"'))).toBe(true);
    expect(warnings.some((w) => w.includes('member "alsoGhost"'))).toBe(true);
    expect(warnings.some((w) => w.includes('homeDomain "nowhere"'))).toBe(true);
    expect(warnings.some((w) => w.includes('lendTo.domain "nowhere"'))).toBe(true);
  });

  it("flags duplicate person ids and domain names", () => {
    const { warnings } = parseConfig(
      `domains:
  - name: dup
  - name: dup
people:
  - id: same
    name: A
  - id: same
    name: B
`,
    );

    expect(warnings.some((w) => w.includes('重复的 id "same"'))).toBe(true);
    expect(warnings.some((w) => w.includes('重复的 name "dup"'))).toBe(true);
  });

  it("treats warnings as non-fatal", () => {
    expect(parseConfig("domains:\n  - name: d\n    lead: ghost\npeople: []\n").config).toBeTruthy();
  });
});
