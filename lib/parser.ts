import { load as parseYaml } from "js-yaml";
import TOML from "@iarna/toml";
import { ConfigSchema, type Config, type Domain } from "./schema";

export type ConfigFormat = "json" | "yaml" | "toml";

export class ConfigError extends Error {
  /** Human-readable lines, already prefixed with a location when known. */
  readonly issues: string[];
  /** 1-based line of a syntax error, when the underlying parser reports one. */
  readonly line?: number;

  constructor(message: string, issues: string[] = [], line?: number) {
    super(message);
    this.name = "ConfigError";
    this.issues = issues;
    this.line = line;
  }
}

interface SyntaxLocation {
  /** 1-based. */
  line?: number;
  message: string;
}

/**
 * Each parser reports position differently, and none of them expose a common
 * shape: js-yaml carries a `mark` object, @iarna/toml a 0-based `line`, and
 * `JSON.parse` only embeds "(line N column M)" in its message text. This pulls a
 * line number out of whichever one threw so the UI can point at the offending row.
 */
function locateSyntaxError(error: unknown, format: ConfigFormat): SyntaxLocation {
  const raw = error instanceof Error ? error.message : String(error);

  if (format === "yaml") {
    const mark = (error as { mark?: { line?: number } }).mark;
    const reason = (error as { reason?: string }).reason;
    // js-yaml's `mark.line` is 0-based, and its own message already appends a
    // "(line:col)" plus a source snippet that would be noise in a list.
    return {
      line: typeof mark?.line === "number" ? mark.line + 1 : undefined,
      message: reason ?? raw.split("\n")[0] ?? raw,
    };
  }

  if (format === "toml") {
    const line = (error as { line?: number }).line;
    // @iarna/toml is 0-based too, and appends a multi-line source excerpt.
    return {
      line: typeof line === "number" ? line + 1 : undefined,
      message: raw.split("\n")[0]?.replace(/\s*at row \d+, col \d+, pos \d+:?$/, "") ?? raw,
    };
  }

  // V8 formats recoverable JSON errors as "... in JSON at position 13 (line 3
  // column 3)". Some messages (e.g. "Unexpected token ','") carry no position,
  // so the tail is stripped only when it is actually there.
  const match = /\s*in JSON at position \d+ \(line (\d+) column (\d+)\)/.exec(raw);
  if (!match) return { message: raw };

  return {
    line: Number.parseInt(match[1], 10),
    message: `${raw.slice(0, match.index)}（第 ${match[1]} 行 第 ${match[2]} 列）`,
  };
}

/**
 * zod paths are arrays of keys and indices; rendering indices as `[1]` rather
 * than `.1` makes a deep path like `domains[1].gaps[0].priority` readable.
 */
function formatIssuePath(path: ReadonlyArray<PropertyKey>): string {
  if (path.length === 0) return "(根)";

  let out = "";
  for (const segment of path) {
    if (typeof segment === "number") out += `[${segment}]`;
    else out += out === "" ? String(segment) : `.${String(segment)}`;
  }
  return out;
}

/**
 * A TOML table header (`[meta]`, `[[domains]]`, `[a.b]`) also starts with `[`,
 * which would otherwise be read as the opening bracket of a JSON array. Only a
 * bare dotted key matches, so a real JSON array's first line never does.
 */
const TOML_TABLE_HEADER = /^\[\[?\s*[A-Za-z_][\w-]*(\s*\.\s*[A-Za-z_][\w-]*)*\s*\]\]?$/;

/**
 * TOML needs `key = value` at top level; YAML uses `key: value`. An `=` before
 * any `:` on the first meaningful line is the only cheap signal that separates them.
 */
export function detectFormat(source: string): ConfigFormat {
  const text = source.trim();
  if (!text) throw new ConfigError("配置为空");
  if (text.startsWith("{")) return "json";

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (TOML_TABLE_HEADER.test(line)) return "toml";
    if (line.startsWith("[")) return "json";
    const eq = line.indexOf("=");
    const colon = line.indexOf(":");
    if (eq !== -1 && (colon === -1 || eq < colon)) return "toml";
    break;
  }
  return "yaml";
}

function parseRaw(source: string, format: ConfigFormat): unknown {
  switch (format) {
    case "json":
      return JSON.parse(source) as unknown;
    case "yaml":
      return parseYaml(source);
    case "toml":
      return TOML.parse(source) as unknown;
  }
}

export function walkDomains(
  domains: Domain[],
  visit: (domain: Domain, depth: number, parent?: Domain) => void,
  depth = 0,
  parent?: Domain,
): void {
  for (const domain of domains) {
    visit(domain, depth, parent);
    if (domain.subdomains?.length) {
      walkDomains(domain.subdomains, visit, depth + 1, domain);
    }
  }
}

export function flattenDomains(domains: Domain[]): Domain[] {
  const out: Domain[] = [];
  walkDomains(domains, (d) => out.push(d));
  return out;
}

/**
 * Cross-reference checks zod can't express: ids must be unique and every
 * lead/member/lendTo target must resolve to something that actually exists.
 */
function checkReferences(config: Config): string[] {
  const issues: string[] = [];
  const peopleIds = new Set<string>();

  for (const person of config.people) {
    if (peopleIds.has(person.id)) issues.push(`people: 重复的 id "${person.id}"`);
    peopleIds.add(person.id);
  }

  const domainNames = new Set<string>();
  walkDomains(config.domains, (domain) => {
    if (domainNames.has(domain.name)) {
      issues.push(`domains: 重复的 name "${domain.name}"`);
    }
    domainNames.add(domain.name);
  });

  walkDomains(config.domains, (domain) => {
    if (domain.lead && !peopleIds.has(domain.lead)) {
      issues.push(`domain "${domain.name}": lead "${domain.lead}" 不存在于 people`);
    }
    for (const member of domain.members ?? []) {
      if (!peopleIds.has(member)) {
        issues.push(`domain "${domain.name}": member "${member}" 不存在于 people`);
      }
    }
  });

  for (const person of config.people) {
    if (person.homeDomain && !domainNames.has(person.homeDomain)) {
      issues.push(`person "${person.id}": homeDomain "${person.homeDomain}" 不存在`);
    }
    for (const loan of person.lendTo ?? []) {
      if (!domainNames.has(loan.domain)) {
        issues.push(`person "${person.id}": lendTo.domain "${loan.domain}" 不存在`);
      }
    }
  }

  return issues;
}

export interface ParseResult {
  config: Config;
  format: ConfigFormat;
  warnings: string[];
}

export function parseConfig(source: string, format?: ConfigFormat): ParseResult {
  const resolved = format ?? detectFormat(source);

  let raw: unknown;
  try {
    raw = parseRaw(source, resolved);
  } catch (error) {
    const { line, message } = locateSyntaxError(error, resolved);
    const label = resolved.toUpperCase();
    throw new ConfigError(
      line ? `${label} 语法错误（第 ${line} 行）` : `${label} 语法错误`,
      [line ? `第 ${line} 行: ${message}` : message],
      line,
    );
  }

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${formatIssuePath(issue.path)}: ${issue.message}`,
    );
    const count = issues.length;
    throw new ConfigError(
      count === 1 ? "配置校验失败（1 处）" : `配置校验失败（${count} 处）`,
      issues,
    );
  }

  return { config: result.data, format: resolved, warnings: checkReferences(result.data) };
}
