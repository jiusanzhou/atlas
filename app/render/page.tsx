import { DomainTree } from "@/components/DomainTree";
import { ConfigSchema, THEMES, type ThemeName } from "@/lib/schema";
import { parseConfig } from "@/lib/parser";
import { loadDemoConfigSource } from "@/lib/demo";

export const dynamic = "force-dynamic";

interface RenderPageProps {
  searchParams: Promise<{ config?: string; theme?: string; columns?: string }>;
}

/**
 * Chrome-free render surface used by the PNG exporter. Falls back to the demo
 * config so the page is also directly viewable during development.
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

  const columns = params.columns ? Number.parseInt(params.columns, 10) : undefined;

  return (
    <main className="inline-block">
      <DomainTree
        config={config}
        still
        columns={Number.isFinite(columns) ? columns : undefined}
      />
    </main>
  );
}
