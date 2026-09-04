import { describe, expect, it } from "vitest";
import { toDrawioXML } from "@/lib/drawio";
import { parseConfig } from "@/lib/parser";
import type { Config } from "@/lib/schema";

const SOURCE = `theme: hearthstone

domains:
  - name: infra
    displayName: 基础设施
    lead: torvalds
    members: [pcarrier]
    gaps:
      - role: SRE 工程师
        count: 2
        priority: high
        note: 多活容灾
        comment: "需要 **Kubernetes** 经验"
    subdomains:
      - name: compute
        displayName: 计算
        lead: gvanrossum
  - name: platform
    displayName: 应用平台
    leadGap:
      role: 平台负责人
      priority: critical
    members: [dhh]
  - name: data
    displayName: 数据
    lead: wesm

people:
  - id: torvalds
    name: Linus Torvalds
    title: 首席架构师
    homeDomain: infra
    tags: [Kernel, C, 分布式]
    rarity: legendary
    comment: "**强项**：内核方向"
  - id: pcarrier
    name: Pierre Carrier
    homeDomain: infra
  - id: gvanrossum
    name: Guido van Rossum
    homeDomain: compute
  # homeDomain is what makes the loan render as "lent out" rather than "borrowed".
  - id: dhh
    name: David Heinemeier Hansson
    homeDomain: platform
    lendTo:
      - domain: data
        ratio: 0.4
        role: 指标看板
  - id: wesm
    name: Wes McKinney
    homeDomain: data
`;

function config(overrides: Partial<Config> = {}): Config {
  return { ...parseConfig(SOURCE).config, ...overrides };
}

function diagrams(xml: string): string[] {
  return xml.split("<diagram ").slice(1);
}

describe("toDrawioXML", () => {
  const xml = toDrawioXML(config());

  it("emits one diagram page per top-level domain", () => {
    // Three top-level domains: infra, platform, data.
    expect(diagrams(xml)).toHaveLength(3);
    expect(xml.match(/<\/diagram>/g)).toHaveLength(3);
  });

  it("names each page after the domain's display name", () => {
    expect(xml).toContain('name="基础设施"');
    expect(xml).toContain('name="应用平台"');
    expect(xml).toContain('name="数据"');
  });

  it("wraps everything in a single mxfile with an mxGraphModel per page", () => {
    expect(xml.startsWith("<mxfile ")).toBe(true);
    expect(xml.trimEnd().endsWith("</mxfile>")).toBe(true);
    expect(xml.match(/<mxGraphModel /g)).toHaveLength(3);
  });

  it("gives every page the two mandatory root cells and unique ids", () => {
    for (const page of diagrams(xml)) {
      expect(page).toContain('<mxCell id="0" />');
      expect(page).toContain('<mxCell id="1" parent="0" />');
    }

    const ids = [...xml.matchAll(/<mxCell id="([^"]+)"/g)].map((m) => m[1]);
    // Ids 0 and 1 repeat once per page by design; the generated ones must not.
    const generated = ids.filter((id) => id !== "0" && id !== "1");
    expect(new Set(generated).size).toBe(generated.length);
    // Ids are prefixed per page (p1-, p2-, p3-) to keep pages collision-free.
    expect(generated.some((id) => id.startsWith("p1-"))).toBe(true);
    expect(generated.some((id) => id.startsWith("p3-"))).toBe(true);
  });

  it("balances its tags", () => {
    const open = (xml.match(/<mxCell /g) ?? []).length;
    const close = (xml.match(/<\/mxCell>/g) ?? []).length;
    const selfClosing = (xml.match(/<mxCell[^>]*\/>/g) ?? []).length;
    // Each page contributes two self-closing root cells (id=0 and id=1).
    expect(open).toBe(close + selfClosing);
    expect(selfClosing).toBe(6);
  });

  describe("gap cards", () => {
    it("draws member gaps with a dashed frame", () => {
      const infra = diagrams(xml)[0];
      expect(infra).toContain("dashed=1");
      expect(infra).toContain("dashPattern=8 6");
    });

    it("labels a member gap as 招募中 with its role and priority", () => {
      const infra = diagrams(xml)[0];
      expect(infra).toContain('value="招募中"');
      expect(infra).toContain('value="SRE 工程师"');
      expect(infra).toContain('value="高优先级"');
      // count > 1 gets an explicit multiplier chip.
      expect(infra).toContain('value="×2"');
    });

    it("marks a lead gap with the 负责人 prefix and a crown", () => {
      const platform = diagrams(xml)[1];
      expect(platform).toContain('value="负责人 · 平台负责人"');
      expect(platform).toContain('value="♛"');
    });

    it("uses a silhouette glyph rather than a shape", () => {
      // escapeAttr re-escapes the '&', so U+1F464 lands as &amp;#128100; in XML.
      expect(xml).toContain("&amp;#128100;");
    });

    it("carries the gap's note and comment into the cell value", () => {
      const infra = diagrams(xml)[0];
      expect(infra).toContain("多活容灾");
      expect(infra).toContain("需要 **Kubernetes** 经验");
    });
  });

  describe("comments", () => {
    it("puts a person's comment in the frame cell's value", () => {
      expect(xml).toContain("**强项**：内核方向");
    });

    it("prefixes the comment with the person's identity, newline-escaped", () => {
      const match = /value="(Linus Torvalds[^"]*)"/.exec(xml);
      expect(match).not.toBeNull();
      const value = match![1];
      expect(value).toContain("首席架构师");
      expect(value).toContain("Kernel · C · 分布式");
      expect(value).toContain("---");
      // Raw newlines would break the attribute; they become &#10;.
      expect(value).toContain("&#10;");
      expect(value).not.toContain("\n");
    });

    it("hides the frame label so the comment does not paint over the card", () => {
      expect(xml).toContain("noLabel=1");
    });

    it("omits the value entirely for a person without a comment", () => {
      const solo = toDrawioXML(
        config({
          domains: [{ name: "d", lead: "x" }],
          people: [{ id: "x", name: "NoComment" }],
        }),
      );
      expect(solo).not.toContain("noLabel=1");
    });
  });

  describe("structure", () => {
    it("connects parent to child with a solid edge", () => {
      const infra = diagrams(xml)[0];
      expect(infra).toContain('edge="1"');
      // Dashed styling stays reserved for loans.
      expect(infra).toContain("dashed=0");
    });

    it("renders the domain header with its label", () => {
      expect(xml).toContain('value="基础设施"');
      expect(xml).toContain('value="计算"');
    });

    it("annotates a cross-page loan on the card instead of drawing an edge", () => {
      // dhh sits in platform and is lent to data, a different page.
      expect(xml).toContain("→ 数据 40%");
    });

    it("sets the page size from the computed layout", () => {
      const sizes = [...xml.matchAll(/pageWidth="(\d+)" pageHeight="(\d+)"/g)];
      expect(sizes).toHaveLength(3);
      for (const [, width, height] of sizes) {
        expect(Number(width)).toBeGreaterThan(0);
        expect(Number(height)).toBeGreaterThan(0);
      }
    });
  });

  describe("escaping", () => {
    it("escapes the five XML-significant characters in user text", () => {
      const escaped = toDrawioXML(
        config({
          domains: [{ name: "d", lead: "x" }],
          people: [{ id: "x", name: "A&B", comment: '<tag> "q" \'s\'' }],
        }),
      );

      expect(escaped).toContain("A&amp;B");
      expect(escaped).toContain("&lt;tag&gt;");
      expect(escaped).toContain("&quot;q&quot;");
      expect(escaped).toContain("&apos;s&apos;");
      // No unescaped angle bracket may survive inside an attribute value.
      expect(/value="[^"]*<[^"]*"/.test(escaped)).toBe(false);
    });

    it("strips ; and = from text interpolated into a style", () => {
      const themed = toDrawioXML(config());
      // headingFont is injected as fontFamily=...; a stray ';' would split the style.
      const fontFamilies = [...themed.matchAll(/fontFamily=([^;"]*)/g)].map((m) => m[1]);
      expect(fontFamilies.length).toBeGreaterThan(0);
      for (const family of fontFamilies) {
        expect(family).not.toContain("=");
      }
    });
  });

  describe("themes", () => {
    it("switches to the minimal cell writers", () => {
      const minimal = toDrawioXML(config({ theme: "minimal" }));

      expect(diagrams(minimal)).toHaveLength(3);
      // Minimal draws a name line and a rule instead of framed cards with tags.
      expect(minimal).toContain('value="Linus Torvalds"');
      expect(minimal).toContain('style="line;html=1');
      expect(minimal).toContain("招募中 · SRE 工程师 ×2");
      expect(minimal).toContain("负责人空缺 · 平台负责人");
    });

    it("draws a same-page loan as a dashed edge in the minimal theme", () => {
      // Both ends of this loan land in the platform tree, which is the only
      // case that qualifies for an arrow; cross-tree loans stay badge-only.
      const sameTree = toDrawioXML(
        parseConfig(`theme: minimal
domains:
  - name: platform
    displayName: 应用平台
    subdomains:
      - name: web
        lead: a
      - name: devex
        lead: b
people:
  - id: a
    name: A
    homeDomain: web
    lendTo:
      - domain: devex
        ratio: 0.2
        role: 构建
  - id: b
    name: B
    homeDomain: devex
`).config,
      );

      expect(sameTree).toContain('edge="1"');
      expect(sameTree).toContain("dashPattern=5 4");
      expect(sameTree).toContain('value="构建 20%"');
    });

    it("falls back to hearthstone for a withdrawn theme name", () => {
      const withdrawn = toDrawioXML({ ...config(), theme: "business" } as unknown as Config);
      expect(withdrawn).toContain('value="负责人"');
      expect(diagrams(withdrawn)).toHaveLength(3);
    });
  });

  describe("avatars", () => {
    it("inlines a provided data URI instead of resolving the spec", () => {
      const uri = "data:image/png;base64,AAAA";
      const withAvatar = toDrawioXML(config(), { avatars: { torvalds: uri } });
      expect(withAvatar).toContain(`image=${uri}`);
    });

    it("falls back to a generated initials avatar when none is given", () => {
      expect(xml).toContain("image=data:image/svg+xml;utf8,");
    });
  });
});
