"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { Download, ImageDown, Loader2, Palette, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigInput } from "@/components/ConfigInput";
import { DomainTree } from "@/components/DomainTree";
import { Canvas } from "@/components/Canvas";
import { ConfigError, parseConfig, type ConfigFormat } from "@/lib/parser";
import { domainGaps, domainLabel, totalGaps } from "@/lib/layout";
import { THEMES, type Config, type ThemeName } from "@/lib/schema";
import { getTheme } from "@/lib/themes";

interface AtlasEditorProps {
  initialSource: string;
}

interface ParseState {
  config: Config | null;
  format: ConfigFormat | null;
  error: string | null;
  issues: string[];
  warnings: string[];
}

function parseSource(source: string): ParseState {
  try {
    const { config, format, warnings } = parseConfig(source);
    return { config, format, error: null, issues: [], warnings };
  } catch (error) {
    if (error instanceof ConfigError) {
      return { config: null, format: null, error: error.message, issues: error.issues, warnings: [] };
    }
    return {
      config: null,
      format: null,
      error: error instanceof Error ? error.message : "解析失败",
      issues: [],
      warnings: [],
    };
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function AtlasEditor({ initialSource }: AtlasEditorProps) {
  const [source, setSource] = useState(initialSource);
  const [themeOverride, setThemeOverride] = useState<ThemeName | null>(null);
  const [busy, setBusy] = useState<"drawio" | "png" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Typing should not block on re-layout of a large tree.
  const deferredSource = useDeferredValue(source);
  const parsed = useMemo(() => parseSource(deferredSource), [deferredSource]);

  const config = useMemo(() => {
    if (!parsed.config) return null;
    return themeOverride ? { ...parsed.config, theme: themeOverride } : parsed.config;
  }, [parsed.config, themeOverride]);

  const stats = useMemo(
    () =>
      parsed.config
        ? {
            domains: parsed.config.domains.length,
            people: parsed.config.people.length,
            gaps: totalGaps(parsed.config),
          }
        : null,
    [parsed.config],
  );

  const activeTheme = getTheme(config?.theme);

  const domains = config?.domains ?? [];
  const [activeDomain, setActiveDomain] = useState<string | null>(null);

  // Derived rather than synced: editing the config can rename or drop the
  // selected domain, and this falls back to the first one without an effect.
  const currentDomain =
    domains.find((domain) => domain.name === activeDomain)?.name ?? domains[0]?.name ?? null;

  const cycleTheme = useCallback(() => {
    const current = config?.theme ?? "hearthstone";
    const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    setThemeOverride(next);
  }, [config?.theme]);

  const exportFile = useCallback(
    async (kind: "drawio" | "png") => {
      if (!config) return;
      setBusy(kind);
      setExportError(null);
      try {
        const response = await fetch(`/api/${kind === "drawio" ? "drawio" : "export"}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(kind === "png" ? { config, scale: 2 } : { config }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `导出失败（HTTP ${response.status}）`);
        }

        const title = config.meta?.title ?? "atlas";
        // PNG export is a zip: one image per top-level domain.
        triggerDownload(await response.blob(), `${title}.${kind === "drawio" ? "drawio" : "zip"}`);
      } catch (error) {
        setExportError(error instanceof Error ? error.message : "导出失败");
      } finally {
        setBusy(null);
      }
    },
    [config],
  );

  return (
    // Fixed rather than h-dvh: guarantees the page itself can never scroll,
    // without forcing overflow-hidden onto /render (puppeteer needs overflow).
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-900/60 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h1
            className="text-lg font-bold tracking-wide"
            style={{ color: activeTheme.accent, fontFamily: activeTheme.headingFont }}
          >
            Atlas
          </h1>
          <span className="text-xs text-zinc-400">
            {config?.meta?.title ?? "配置驱动的领域与人力地图"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {stats && (
            <div className="mr-2 hidden items-center gap-3 text-xs text-zinc-400 sm:flex">
              <span className="flex items-center gap-1">
                <Users size={13} />
                {stats.people}
              </span>
              <span className="text-red-400">缺口 {stats.gaps}</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={cycleTheme}
            className="h-8 border-zinc-700 bg-zinc-900 text-xs hover:bg-zinc-800"
          >
            <Palette size={14} />
            {activeTheme.label}
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!config || busy !== null}
            onClick={() => void exportFile("drawio")}
            className="h-8 border-zinc-700 bg-zinc-900 text-xs hover:bg-zinc-800"
          >
            {busy === "drawio" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            导出 drawio
          </Button>

          <Button
            size="sm"
            disabled={!config || busy !== null}
            onClick={() => void exportFile("png")}
            className="h-8 bg-amber-600 text-xs text-zinc-950 hover:bg-amber-500"
          >
            {busy === "png" ? <Loader2 size={14} className="animate-spin" /> : <ImageDown size={14} />}
            导出 PNG (zip)
          </Button>
        </div>
      </header>

      {exportError && (
        <div className="shrink-0 border-b border-red-900/60 bg-red-950/40 px-5 py-2 text-xs text-red-300">
          {exportError}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[380px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/40 p-4">
          <ConfigInput
            value={source}
            onChange={setSource}
            format={parsed.format}
            error={parsed.error}
            issues={parsed.issues}
            warnings={parsed.warnings}
            stats={stats}
          />
        </aside>

        <section className="flex min-h-0 flex-1 flex-col">
          {!config ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              修正左侧配置后即可预览
            </div>
          ) : domains.length === 0 || !currentDomain ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              配置中还没有顶层领域，添加一个 domains 条目后即可看到图
            </div>
          ) : (
            <Tabs
              value={currentDomain}
              onValueChange={setActiveDomain}
              className="flex min-h-0 flex-1 flex-col gap-0"
            >
              <TabsList
                variant="line"
                className="h-auto w-full shrink-0 flex-wrap justify-start gap-1 overflow-x-auto rounded-none border-b border-zinc-800 bg-zinc-900/60 px-4 py-2"
              >
                {domains.map((domain) => {
                  const gaps = domainGaps(domain);
                  return (
                    <TabsTrigger
                      key={domain.name}
                      value={domain.name}
                      className="h-8 flex-none px-3 text-xs text-zinc-400 data-[state=active]:text-zinc-50"
                    >
                      {domainLabel(domain)}
                      {gaps > 0 && <span className="text-red-400">缺 {gaps}</span>}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {domains.map((domain) => (
                <TabsContent
                  key={domain.name}
                  value={domain.name}
                  className="min-h-0 flex-1 overflow-hidden p-3"
                >
                  {/* Radix unmounts inactive tab content, so each switch
                      remounts the canvas and re-runs the fit. */}
                  <Canvas
                    className="h-full w-full"
                    initialFit
                    fitKey={`${domain.name}::${activeTheme.name}`}
                    background={activeTheme.canvasBackground}
                    gridBackground="dots"
                  >
                    <DomainTree config={config} domain={domain} transparent />
                  </Canvas>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </section>
      </div>
    </div>
  );
}

export default AtlasEditor;
