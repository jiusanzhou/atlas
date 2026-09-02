import { load as parseYaml } from "js-yaml";
import TOML from "@iarna/toml";
import { ConfigSchema, type Config, type Domain } from "./schema";

export type ConfigFormat = "json" | "yaml" | "toml";

export class ConfigError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = "ConfigError";
    this.issues = issues;
  }
}

/**
 * TOML needs `key = value` at top level; YAML uses `key: value`. An `=` before
 * any `:` on the first meaningful line is the only cheap signal that separates them.
 */
export function detectFormat(source: string): ConfigFormat {
  const text = source.trim();
  if (!text) throw new ConfigError("配置为空");
  if (text.startsWith("{") || text.startsWith("[")) return "json";

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[") && line.endsWith("]")) return "toml";
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
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`${resolved.toUpperCase()} 语法错误`, [message]);
  }

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.join(".") || "(root)";
      return `${path}: ${issue.message}`;
    });
    throw new ConfigError("配置不符合 schema", issues);
  }

  return { config: result.data, format: resolved, warnings: checkReferences(result.data) };
}
