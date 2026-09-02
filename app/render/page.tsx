import { DomainTree } from "@/components/DomainTree";
import { ConfigSchema, THEMES, type ThemeName } from "@/lib/schema";
import { parseConfig } from "@/lib/parser";
import { loadDemoConfigSource } from "@/lib/demo";
import { findTopLevelDomain } from "@/lib/layout";

export const dynamic = "force-dynamic";

interface RenderPageProps {
  searchParams: Promise<{
    config?: string;
    theme?: string;
    columns?: string;
    domain?: string;
  }>;
}

/**
 * Chrome-free render surface used by the PNG exporter: one top-level domain per
 * request. Falls back to the demo config and its first domain so the page stays
 * directly viewable during development.
 */
export default async function RenderPage({ searchParams }: RenderPageProps) {
  const params = await searchParams;

  let config;
  if (params.config) {
    const decoded = JSON.parse(params.config) as unknown;
    config = ConfigSchema.parse(decoded);
  } else {
    config = parseConfig(await loadDemoConfigSource()).config;
  }

  if (params.theme && (THEMES as readonly string[]).includes(params.theme)) {
    config = { ...config, theme: params.theme as ThemeName };
  }

  const domain = findTopLevelDomain(config, params.domain) ?? config.domains[0];
  if (!domain) throw new Error("配置中没有顶层领域");

  const columns = params.columns ? Number.parseInt(params.columns, 10) : undefined;

  return (
    <main className="inline-block">
      <DomainTree
        config={config}
        domain={domain}
        still
        columns={Number.isFinite(columns) ? columns : undefined}
      />
    </main>
  );
}
