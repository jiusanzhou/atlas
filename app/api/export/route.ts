import { NextResponse } from "next/server";
import type { Browser } from "puppeteer";
import { ConfigError, parseConfig } from "@/lib/parser";
import { ConfigSchema, type Config } from "@/lib/schema";

interface ExportRequestBody {
  source?: string;
  config?: unknown;
  scale?: number;
  width?: number;
}

/** Chrome installs bundled with puppeteer can fail behind a proxy; fall back to a local install. */
const SYSTEM_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

async function findSystemChrome(): Promise<string | undefined> {
  const { access } = await import("node:fs/promises");
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates = fromEnv ? [fromEnv, ...SYSTEM_CHROME_PATHS] : SYSTEM_CHROME_PATHS;

  for (const path of candidates) {
    try {
      await access(path);
      return path;
    } catch {
      continue;
    }
  }
  return undefined;
}

async function launchBrowser(): Promise<Browser> {
  const puppeteer = (await import("puppeteer")).default;
  const args = ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"];

  try {
    return await puppeteer.launch({ headless: true, args });
  } catch (error) {
    const executablePath = await findSystemChrome();
    if (!executablePath) throw error;
    return puppeteer.launch({ headless: true, args, executablePath });
  }
}

function originOf(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) return `${forwardedProto ?? url.protocol.replace(":", "")}://${forwardedHost}`;
  return url.origin;
}

async function renderPng(
  config: Config,
  origin: string,
  scale: number,
  width: number | undefined,
): Promise<Uint8Array> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const encoded = encodeURIComponent(JSON.stringify(config));

    await page.setViewport({
      width: width ?? 1280,
      height: 900,
      deviceScaleFactor: Math.min(Math.max(scale, 1), 4),
    });

    await page.goto(`${origin}/render?config=${encoded}`, {
      waitUntil: "networkidle0",
      timeout: 60_000,
    });

    const canvas = await page.waitForSelector("#atlas-canvas", { timeout: 30_000 });
    if (!canvas) throw new Error("渲染页面未产出画布");

    // Avatars are remote; give decoding a beat so cards are not blank.
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              }),
          ),
      );
      await document.fonts.ready;
    });

    return await canvas.screenshot({ type: "png" });
  } finally {
    await browser.close();
  }
}

export async function POST(request: Request) {
  let body: ExportRequestBody;
  try {
    body = (await request.json()) as ExportRequestBody;
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  try {
    const config =
      typeof body.source === "string"
        ? parseConfig(body.source).config
        : ConfigSchema.parse(body.config);

    const png = await renderPng(
      config,
      originOf(request),
      body.scale ?? 2,
      body.width,
    );

    return new NextResponse(png as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(png.byteLength),
        "Content-Disposition": `attachment; filename="atlas.png"`,
      },
    });
  } catch (error) {
    if (error instanceof ConfigError) {
      return NextResponse.json({ error: error.message, issues: error.issues }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "导出 PNG 失败";
    return NextResponse.json(
      { error: `PNG 导出失败：${message}`, hint: "确认 Chrome 可用：pnpm exec puppeteer browsers install chrome-headless-shell" },
      { status: 500 },
    );
  }
}
