import { NextResponse } from "next/server";
import { ConfigError, parseConfig } from "@/lib/parser";
import { ConfigSchema } from "@/lib/schema";
import { toDrawioXML, toDrawioXMLWithAvatars } from "@/lib/drawio";
import { EXAMPLES_DIR } from "@/lib/demo";

interface DrawioRequestBody {
  /** Raw yaml/json/toml text. Mutually exclusive with `config`. */
  source?: string;
  config?: unknown;
  /** Inline avatars as base64 so the diagram opens offline. Default true. */
  inlineAvatars?: boolean;
}

export async function POST(request: Request) {
  let body: DrawioRequestBody;
  try {
    body = (await request.json()) as DrawioRequestBody;
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  try {
    const config =
      typeof body.source === "string"
        ? parseConfig(body.source).config
        : ConfigSchema.parse(body.config);

    const inline = body.inlineAvatars !== false;
    const xml = inline
      ? await toDrawioXMLWithAvatars(config, { baseDir: EXAMPLES_DIR })
      : toDrawioXML(config);

    const filename = `${config.meta?.title ?? "atlas"}.drawio`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        // RFC 5987 form keeps non-ASCII titles intact.
        "Content-Disposition": `attachment; filename="atlas.drawio"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    if (error instanceof ConfigError) {
      return NextResponse.json({ error: error.message, issues: error.issues }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "导出失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
