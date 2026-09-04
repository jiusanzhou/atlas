import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseConfig } from "@/lib/parser";

/**
 * Fenced yaml blocks that are meant to be complete, runnable configs. The docs
 * also contain a structural skeleton (`domains:   # 必填…`) and standalone
 * fragments; requiring a real `- name:` entry under both keys excludes those.
 */
function yamlConfigBlocks(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/```yaml\n([\s\S]*?)```/g)]
    .map((m) => m[1])
    .filter(
      (block) =>
        /^domains:\s*$/m.test(block) && /^people:\s*$/m.test(block) && /^\s+- name:/m.test(block),
    );
}

describe.each(["README.md", "docs/CONFIG.md"])("%s yaml examples", (file) => {
  const blocks = yamlConfigBlocks(file);

  it("has at least one full config example", () => {
    expect(blocks.length).toBeGreaterThan(0);
  });

  it.each(blocks.map((b, i) => [i, b] as const))("block %i parses", (_i, block) => {
    const { config, warnings } = parseConfig(block);
    expect(config.domains.length).toBeGreaterThan(0);
    expect(warnings).toEqual([]);
  });
});
