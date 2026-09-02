import { md5 } from "./md5";
import type { Person } from "./schema";

export interface ResolveAvatarOptions {
  /** Directory that `file://` avatars resolve against. Server-side only. */
  baseDir?: string;
  size?: number;
  /** Fetch remote avatars and inline them as data URIs (used by drawio export). */
  inline?: boolean;
}

const PALETTE = [
  "#7c3aed",
  "#b45309",
  "#0f766e",
  "#be123c",
  "#1d4ed8",
  "#4d7c0f",
  "#a21caf",
  "#c2410c",
] as const;

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function colorForName(name: string): string {
  return PALETTE[hashString(name) % PALETTE.length];
}

/** First letter of the first two whitespace-separated words; CJK keeps one char. */
export function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (/^[㐀-鿿豈-﫿]/.test(trimmed)) {
    return trimmed.slice(0, 1);
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function initialsSvg(name: string, size = 200): string {
  const initials = initialsOf(name);
  const bg = colorForName(name);
  const fontSize = initials.length > 1 ? size * 0.38 : size * 0.48;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${bg}"/>`,
    `<text x="50%" y="50%" dy="0.35em" text-anchor="middle" fill="#ffffff"`,
    ` font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700">`,
    escapeXml(initials),
    `</text></svg>`,
  ].join("");
}

export function initialsDataUri(name: string, size = 200): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(initialsSvg(name, size))}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Resolves the avatar spec to a URL without touching the network or filesystem.
 * `file://` and `inline` need async I/O, so those fall through to resolveAvatar.
 */
export function resolveAvatarSync(person: Person, opts: ResolveAvatarOptions = {}): string {
  const size = opts.size ?? 200;
  const spec = person.avatar?.trim();

  if (!spec || spec === "initials") return initialsDataUri(person.name, size);
  if (spec.startsWith("https://") || spec.startsWith("http://")) return spec;
  if (spec.startsWith("data:")) return spec;

  if (spec.startsWith("gravatar:")) {
    const email = spec.slice("gravatar:".length).trim().toLowerCase();
    return `https://www.gravatar.com/avatar/${md5(email)}?d=identicon&s=${size}`;
  }
  if (spec.startsWith("github:")) {
    const user = encodeURIComponent(spec.slice("github:".length).trim());
    return `https://github.com/${user}.png`;
  }
  if (spec.startsWith("dicebear:")) {
    const style = encodeURIComponent(spec.slice("dicebear:".length).trim() || "identicon");
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(person.id)}`;
  }

  return initialsDataUri(person.name, size);
}

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

async function readLocalAvatar(spec: string, baseDir: string | undefined): Promise<string | null> {
  const relative = spec.slice("file://".length);
  if (!baseDir) return null;

  try {
    const { readFile } = await import("node:fs/promises");
    const { resolve, extname, relative: relativeTo } = await import("node:path");

    const target = resolve(baseDir, relative);
    // Keep `file://` from escaping the config directory via `../`.
    const rel = relativeTo(resolve(baseDir), target);
    if (rel.startsWith("..")) return null;

    const buffer = await readFile(target);
    const mime = MIME_BY_EXT[extname(target).toLowerCase()] ?? "application/octet-stream";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

async function inlineRemote(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) return null;
    const mime = response.headers.get("content-type")?.split(";")[0] ?? "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Full fallback chain. Never rejects: anything unresolvable degrades to an
 * initials SVG so a card always renders.
 */
export async function resolveAvatar(
  person: Person,
  opts: ResolveAvatarOptions = {},
): Promise<string> {
  const size = opts.size ?? 200;
  const spec = person.avatar?.trim();
  const fallback = initialsDataUri(person.name, size);

  if (spec?.startsWith("file://")) {
    return (await readLocalAvatar(spec, opts.baseDir)) ?? fallback;
  }

  const resolved = resolveAvatarSync(person, opts);

  if (opts.inline && /^https?:\/\//.test(resolved)) {
    return (await inlineRemote(resolved)) ?? fallback;
  }
  return resolved;
}
