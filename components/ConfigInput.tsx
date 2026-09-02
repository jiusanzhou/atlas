"use client";

import { AlertTriangle, CheckCircle2, FileCode2, Upload } from "lucide-react";
import { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { ConfigFormat } from "@/lib/parser";

interface ConfigInputProps {
  value: string;
  onChange: (value: string) => void;
  format: ConfigFormat | null;
  error: string | null;
  issues: string[];
  warnings: string[];
  stats: { domains: number; people: number; gaps: number } | null;
}

const FORMAT_LABEL: Record<ConfigFormat, string> = {
  yaml: "YAML",
  json: "JSON",
  toml: "TOML",
};

export function ConfigInput({
  value,
  onChange,
  format,
  error,
  issues,
  warnings,
  stats,
}: ConfigInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    onChange(await file.text());
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <FileCode2 size={15} />
          配置
          {format && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
              {FORMAT_LABEL[format]}
            </span>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".yaml,.yml,.json,.toml,text/plain"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          className="h-7 border-zinc-700 bg-zinc-900 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          <Upload size={13} />
          上传文件
        </Button>
      </div>

      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        aria-label="配置内容"
        className="min-h-0 flex-1 resize-none border-zinc-800 bg-zinc-950/80 font-mono text-[11px] leading-relaxed text-zinc-200 focus-visible:border-amber-600/60"
      />

      <div className="shrink-0 space-y-2 text-xs">
        {error ? (
          <div className="rounded-md border border-red-900/60 bg-red-950/40 p-2.5 text-red-300">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle size={13} />
              {error}
            </div>
            {issues.length > 0 && (
              <ul className="mt-1.5 max-h-28 space-y-0.5 overflow-auto pl-5">
                {issues.slice(0, 12).map((issue, index) => (
                  <li key={index} className="list-disc text-[11px] text-red-300/90">
                    {issue}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          stats && (
            <div className="flex items-center gap-3 rounded-md border border-emerald-900/50 bg-emerald-950/30 p-2.5 text-emerald-300">
              <CheckCircle2 size={14} />
              <span className="font-semibold">配置有效</span>
              <span className="text-emerald-400/80">
                {stats.domains} 领域 · {stats.people} 人 · 缺口 {stats.gaps}
              </span>
            </div>
          )
        )}

        {warnings.length > 0 && (
          <div className="rounded-md border border-amber-900/50 bg-amber-950/30 p-2.5 text-amber-300">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle size={13} />
              引用告警 ({warnings.length})
            </div>
            <ul className="mt-1.5 max-h-24 space-y-0.5 overflow-auto pl-5">
              {warnings.slice(0, 8).map((warning, index) => (
                <li key={index} className="list-disc text-[11px] text-amber-300/90">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConfigInput;
