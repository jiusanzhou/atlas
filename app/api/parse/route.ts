import { NextResponse } from "next/server";
import { ConfigError, parseConfig, type ConfigFormat } from "@/lib/parser";
import { totalGaps } from "@/lib/layout";

interface ParseRequestBody {
  source?: string;
  format?: ConfigFormat;
}

export async function POST(request: Request) {
  let body: ParseRequestBody;
  try {
    body = (await request.json()) as ParseRequestBody;
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  if (typeof body.source !== "string") {
    return NextResponse.json({ error: "缺少 source 字段" }, { status: 400 });
  }

  try {
    const { config, format, warnings } = parseConfig(body.source, body.format);
    return NextResponse.json({
      config,
      format,
      warnings,
      stats: {
        domains: config.domains.length,
        people: config.people.length,
        gaps: totalGaps(config),
      },
    });
  } catch (error) {
    if (error instanceof ConfigError) {
      return NextResponse.json({ error: error.message, issues: error.issues }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "解析失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
