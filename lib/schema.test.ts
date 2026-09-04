import { describe, expect, it } from "vitest";
import {
  ConfigSchema,
  DomainSchema,
  GapSchema,
  RETIRED_THEMES,
  THEMES,
  normalizeThemeName,
} from "@/lib/schema";

/** Smallest config that satisfies every required field. */
function minimalConfig() {
  return {
    domains: [{ name: "infra", lead: "torvalds" }],
    people: [{ id: "torvalds", name: "Linus Torvalds" }],
  };
}

function issuePaths(error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }> }) {
  return error.issues.map((issue) => issue.path.join("."));
}

describe("ConfigSchema", () => {
  it("accepts a minimal config and defaults the theme", () => {
    const result = ConfigSchema.parse(minimalConfig());

    expect(result.theme).toBe("hearthstone");
    expect(result.domains).toHaveLength(1);
    expect(result.people[0]?.id).toBe("torvalds");
  });

  it("accepts the full field surface, including nested subdomains", () => {
    const result = ConfigSchema.parse({
      meta: { title: "T", description: "D", version: "1.0.0" },
      theme: "minimal",
      domains: [
        {
          name: "infra",
          displayName: "基础设施",
          lead: "a",
          members: ["b"],
          color: "#4a3113",
          description: "底座",
          gaps: [{ role: "SRE", count: 2, priority: "high", note: "n", comment: "**md**" }],
          subdomains: [
            {
              name: "compute",
              subdomains: [{ name: "sched", leadGap: { role: "L", priority: "critical" } }],
            },
          ],
        },
      ],
      people: [
        {
          id: "a",
          name: "A",
          title: "架构师",
          homeDomain: "infra",
          avatar: "github:a",
          tags: ["Go"],
          rarity: "legendary",
          comment: "note",
          lendTo: [{ domain: "compute", ratio: 0.3, role: "选型" }],
        },
        { id: "b", name: "B" },
      ],
    });

    expect(result.theme).toBe("minimal");
    // Nesting survives to the third level.
    expect(result.domains[0]?.subdomains?.[0]?.subdomains?.[0]?.name).toBe("sched");
    expect(result.people[0]?.lendTo?.[0]?.ratio).toBe(0.3);
  });

  describe("theme fallback", () => {
    it.each(RETIRED_THEMES)("maps the withdrawn %s theme onto hearthstone", (retired) => {
      expect(ConfigSchema.parse({ ...minimalConfig(), theme: retired }).theme).toBe("hearthstone");
      expect(normalizeThemeName(retired)).toBe("hearthstone");
    });

    it.each(THEMES)("keeps the supported %s theme as-is", (name) => {
      expect(ConfigSchema.parse({ ...minimalConfig(), theme: name }).theme).toBe(name);
      expect(normalizeThemeName(name)).toBe(name);
    });

    it("still rejects a misspelled theme rather than silently defaulting", () => {
      const result = ConfigSchema.safeParse({ ...minimalConfig(), theme: "hearthstne" });

      expect(result.success).toBe(false);
      expect(issuePaths(result.error!)).toContain("theme");
    });

    it("returns null from normalizeThemeName for unknown and non-string input", () => {
      expect(normalizeThemeName("nope")).toBeNull();
      expect(normalizeThemeName(undefined)).toBeNull();
      expect(normalizeThemeName(null)).toBeNull();
      expect(normalizeThemeName(42)).toBeNull();
    });

    it("no longer offers the stub themes as options", () => {
      expect(THEMES).toEqual(["hearthstone", "minimal"]);
    });
  });

  describe("lead / leadGap mutual exclusion", () => {
    it("rejects a domain declaring both, pointing at leadGap", () => {
      const result = ConfigSchema.safeParse({
        domains: [{ name: "d", lead: "a", leadGap: { role: "L", priority: "high" } }],
        people: [{ id: "a", name: "A" }],
      });

      expect(result.success).toBe(false);
      const issue = result.error!.issues.find((i) => i.path.join(".") === "domains.0.leadGap");
      expect(issue?.message).toBe("lead 与 leadGap 只能填一个");
    });

    it("accepts either one alone", () => {
      expect(DomainSchema.safeParse({ name: "d", lead: "a" }).success).toBe(true);
      expect(
        DomainSchema.safeParse({ name: "d", leadGap: { role: "L", priority: "high" } }).success,
      ).toBe(true);
    });

    it("enforces the rule on nested subdomains too", () => {
      const result = ConfigSchema.safeParse({
        domains: [
          {
            name: "top",
            subdomains: [{ name: "sub", lead: "a", leadGap: { role: "L", priority: "low" } }],
          },
        ],
        people: [{ id: "a", name: "A" }],
      });

      expect(result.success).toBe(false);
      expect(issuePaths(result.error!)).toContain("domains.0.subdomains.0.leadGap");
    });
  });

  describe("required fields", () => {
    it("reports every missing required field with its path", () => {
      const result = ConfigSchema.safeParse({
        domains: [{ displayName: "无 name", gaps: [{ count: 2 }] }],
        people: [{ name: "无 id" }],
      });

      expect(result.success).toBe(false);
      const paths = issuePaths(result.error!);
      expect(paths).toContain("domains.0.name");
      expect(paths).toContain("domains.0.gaps.0.role");
      expect(paths).toContain("domains.0.gaps.0.priority");
      expect(paths).toContain("people.0.id");
    });

    it("rejects an empty domains array", () => {
      const result = ConfigSchema.safeParse({ domains: [], people: [] });

      expect(result.success).toBe(false);
      expect(issuePaths(result.error!)).toContain("domains");
    });

    it("rejects empty strings where a value is required", () => {
      expect(ConfigSchema.safeParse({ domains: [{ name: "" }], people: [] }).success).toBe(false);
      expect(
        ConfigSchema.safeParse({ ...minimalConfig(), people: [{ id: "a", name: "" }] }).success,
      ).toBe(false);
    });

    it("requires people to be present, but allows it to be empty", () => {
      expect(ConfigSchema.safeParse({ domains: [{ name: "d" }] }).success).toBe(false);
      expect(ConfigSchema.safeParse({ domains: [{ name: "d" }], people: [] }).success).toBe(true);
    });
  });

  describe("GapSchema", () => {
    it("defaults count to 1", () => {
      expect(GapSchema.parse({ role: "SRE", priority: "high" }).count).toBe(1);
    });

    it("rejects a non-positive or fractional count", () => {
      expect(GapSchema.safeParse({ role: "r", priority: "low", count: 0 }).success).toBe(false);
      expect(GapSchema.safeParse({ role: "r", priority: "low", count: -1 }).success).toBe(false);
      expect(GapSchema.safeParse({ role: "r", priority: "low", count: 1.5 }).success).toBe(false);
    });

    it("rejects an unknown priority", () => {
      expect(GapSchema.safeParse({ role: "r", priority: "urgent" }).success).toBe(false);
    });
  });

  describe("loan ratio", () => {
    it.each([0, 0.5, 1])("accepts ratio %s", (ratio) => {
      const config = { ...minimalConfig() } as Record<string, unknown>;
      config.people = [{ id: "torvalds", name: "T", lendTo: [{ domain: "d", ratio }] }];
      expect(ConfigSchema.safeParse(config).success).toBe(true);
    });

    it.each([-0.1, 1.1])("rejects out-of-range ratio %s", (ratio) => {
      const config = { ...minimalConfig() } as Record<string, unknown>;
      config.people = [{ id: "torvalds", name: "T", lendTo: [{ domain: "d", ratio }] }];
      expect(ConfigSchema.safeParse(config).success).toBe(false);
    });
  });
});
