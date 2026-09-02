import type { Config } from "./schema";
import {
  computeDomainTreeLayout,
  domainLabel,
  layoutFromTheme,
  type DomainNode,
  type DomainTreeLayout,
  type PersonSlot,
  type Slot,
} from "./layout";
import { getTheme } from "./themes";
import { resolveAvatar, resolveAvatarSync } from "./avatar";
import type { ThemeTokens } from "./themes/types";

export interface DrawioOptions {
  /** Pre-resolved avatar data URIs keyed by person id; enables offline opening. */
  avatars?: Record<string, string>;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/\n/g, "&#10;");
}

/** mxGraph style values are `;`/`=` delimited, so those must not survive in text. */
function escapeStyleValue(value: string): string {
  return value.replace(/[;=]/g, "");
}

interface CellWriter {
  cells: string[];
  nextId: () => string;
  /** slot id -> generated mxCell id, so loan edges can reference cards. */
  slotCellIds: Map<string, string>;
}

/** Ids are prefixed per page so a multi-diagram file has no collisions. */
function createWriter(prefix: string): CellWriter {
  let counter = 1;
  return {
    cells: [],
    nextId: () => `${prefix}-${counter++}`,
    slotCellIds: new Map(),
  };
}

function vertex(
  writer: CellWriter,
  opts: {
    value: string;
    style: string;
    x: number;
    y: number;
    width: number;
    height: number;
    parent: string;
    id?: string;
  },
): string {
  const id = opts.id ?? writer.nextId();
  writer.cells.push(
    `        <mxCell id="${escapeAttr(id)}" value="${escapeAttr(opts.value)}" style="${escapeAttr(
      opts.style,
    )}" vertex="1" parent="${escapeAttr(opts.parent)}">\n` +
      `          <mxGeometry x="${opts.x}" y="${opts.y}" width="${opts.width}" height="${opts.height}" as="geometry" />\n` +
      `        </mxCell>`,
  );
  return id;
}

function edge(
  writer: CellWriter,
  opts: { value: string; style: string; source: string; target: string; parent: string },
): string {
  const id = writer.nextId();
  writer.cells.push(
    `        <mxCell id="${escapeAttr(id)}" value="${escapeAttr(opts.value)}" style="${escapeAttr(
      opts.style,
    )}" edge="1" parent="${escapeAttr(opts.parent)}" source="${escapeAttr(
      opts.source,
    )}" target="${escapeAttr(opts.target)}">\n` +
      `          <mxGeometry relative="1" as="geometry" />\n` +
      `        </mxCell>`,
  );
  return id;
}

/**
 * The card's identity plus its markdown comment, as the frame cell's value.
 * Rendered with `noLabel=1` (the child cells already draw name/title/tags), so
 * this survives as the card's tooltip and as searchable / editable text.
 */
function cardValue(slot: PersonSlot): string {
  const comment = slot.person.comment?.trim();
  if (!comment) return "";

  const tags = (slot.person.tags ?? []).slice(0, 3);
  return [slot.person.name, slot.person.title ?? "", tags.join(" · "), "---", comment]
    .filter((line) => line !== "")
    .join("\n");
}

function personCardCells(
  writer: CellWriter,
  slot: PersonSlot,
  parent: string,
  theme: ThemeTokens,
  avatars: Record<string, string>,
): void {
  const rarity = theme.rarity[slot.rarity];
  const strokeWidth = slot.kind === "lead" ? 4 : 2;
  const value = cardValue(slot);

  // Card frame is the group parent, so children use coordinates relative to it.
  const cardId = vertex(writer, {
    value,
    style: [
      "rounded=1",
      `arcSize=${Math.round((theme.card.borderRadius / theme.card.width) * 100)}`,
      `fillColor=${theme.cardBackgroundFlat}`,
      `strokeColor=${rarity.border}`,
      `strokeWidth=${strokeWidth}`,
      slot.kind === "lead" ? "shadow=1" : "shadow=0",
      "html=1",
      "whiteSpace=wrap",
      "verticalAlign=top",
      // Child cells already draw the visible text; keep the frame label hidden
      // so the comment does not paint over the avatar.
      ...(value ? ["noLabel=1"] : []),
    ].join(";"),
    x: slot.x,
    y: slot.y,
    width: slot.width,
    height: slot.height,
    parent,
  });

  const avatarSize = theme.card.avatarSize;
  const avatarX = (slot.width - avatarSize) / 2;
  const image = avatars[slot.person.id] ?? resolveAvatarSync(slot.person, { size: avatarSize });

  vertex(writer, {
    value: "",
    style: [
      "shape=image",
      "imageAspect=0",
      "aspect=fixed",
      "verticalLabelPosition=bottom",
      "verticalAlign=top",
      "imageBorder=none",
      `image=${image}`,
      "clipPath=ellipse",
    ].join(";"),
    x: avatarX,
    y: 18,
    width: avatarSize,
    height: avatarSize,
    parent: cardId,
  });

  // Gold ring around the avatar.
  vertex(writer, {
    value: "",
    style: [
      "ellipse",
      "fillColor=none",
      `strokeColor=${theme.accent}`,
      "strokeWidth=3",
      "html=1",
    ].join(";"),
    x: avatarX,
    y: 18,
    width: avatarSize,
    height: avatarSize,
    parent: cardId,
  });

  vertex(writer, {
    value: slot.person.name,
    style: [
      "text",
      "html=1",
      "align=center",
      "verticalAlign=middle",
      `fontColor=${theme.textPrimary}`,
      "fontSize=18",
      "fontStyle=1",
      `fontFamily=${escapeStyleValue(theme.headingFont.split(",")[0])}`,
      "strokeColor=none",
      "fillColor=none",
    ].join(";"),
    x: 8,
    y: avatarSize + 26,
    width: slot.width - 16,
    height: 26,
    parent: cardId,
  });

  if (slot.person.title) {
    vertex(writer, {
      value: slot.person.title,
      style: [
        "text",
        "html=1",
        "align=center",
        "verticalAlign=middle",
        `fontColor=${theme.textSecondary}`,
        "fontSize=12",
        "fontStyle=2",
        "strokeColor=none",
        "fillColor=none",
      ].join(";"),
      x: 8,
      y: avatarSize + 52,
      width: slot.width - 16,
      height: 20,
      parent: cardId,
    });
  }

  if (slot.kind === "lead") {
    vertex(writer, {
      value: "负责人",
      style: [
        "rounded=1",
        "arcSize=40",
        `fillColor=${theme.accent}`,
        "strokeColor=none",
        "fontColor=#1a1410",
        "fontSize=11",
        "fontStyle=1",
        "html=1",
        "align=center",
        "verticalAlign=middle",
      ].join(";"),
      x: slot.width / 2 - 30,
      y: 2,
      width: 60,
      height: 20,
      parent: cardId,
    });
  }

  const tags = (slot.person.tags ?? []).slice(0, 3);
  if (tags.length > 0) {
    const tagWidth = (slot.width - 16 - (tags.length - 1) * 6) / tags.length;
    for (const [index, tag] of tags.entries()) {
      vertex(writer, {
        value: tag,
        style: [
          "rounded=1",
          "arcSize=30",
          "fillColor=#000000",
          "opacity=60",
          `strokeColor=${theme.accentSoft.startsWith("rgba") ? theme.accent : theme.accentSoft}`,
          `fontColor=${theme.tagText}`,
          "fontSize=10",
          "html=1",
          "align=center",
          "verticalAlign=middle",
        ].join(";"),
        x: 8 + index * (tagWidth + 6),
        y: slot.height - 36,
        width: tagWidth,
        height: 22,
        parent: cardId,
      });
    }
  }

  // Loans cross pages, so they are annotated on the card instead of drawn as edges.
  for (const [index, badge] of slot.badges.slice(0, 3).entries()) {
    const out = badge.direction === "out";
    vertex(writer, {
      value: `${out ? "→" : "←"} ${badge.domain} ${Math.round(badge.ratio * 100)}%`,
      style: [
        "rounded=1",
        "arcSize=30",
        `fillColor=${out ? theme.loanOutBackground : theme.loanInBackground}`,
        "strokeColor=none",
        `fontColor=${theme.loanBadgeText}`,
        "fontSize=9",
        "fontStyle=1",
        "html=1",
        "align=center",
        "verticalAlign=middle",
      ].join(";"),
      x: slot.width - 108,
      y: 4 + index * 20,
      width: 104,
      height: 18,
      parent: cardId,
    });
  }

  writer.slotCellIds.set(slot.id, cardId);
}

function gapCardCells(
  writer: CellWriter,
  slot: Extract<Slot, { kind: "gap" }>,
  parent: string,
  theme: ThemeTokens,
): void {
  const cardId = vertex(writer, {
    value: "",
    style: [
      "rounded=1",
      "arcSize=8",
      `fillColor=${theme.cardBackgroundFlat}`,
      `strokeColor=${theme.gapBorder}`,
      "strokeWidth=2",
      "dashed=1",
      "dashPattern=8 6",
      "html=1",
      "verticalAlign=top",
    ].join(";"),
    x: slot.x,
    y: slot.y,
    width: slot.width,
    height: slot.height,
    parent,
  });

  vertex(writer, {
    value: "招募中",
    style: [
      "text",
      "html=1",
      "align=center",
      "verticalAlign=middle",
      `fontColor=${theme.gapText}`,
      "fontSize=16",
      "fontStyle=1",
      "strokeColor=none",
      "fillColor=none",
    ].join(";"),
    x: 8,
    y: slot.height / 2 - 46,
    width: slot.width - 16,
    height: 24,
    parent: cardId,
  });

  vertex(writer, {
    value: `${slot.gap.role} ×${slot.gap.count}`,
    style: [
      "text",
      "html=1",
      "align=center",
      "verticalAlign=middle",
      `fontColor=${theme.textPrimary}`,
      "fontSize=14",
      "fontStyle=1",
      "strokeColor=none",
      "fillColor=none",
    ].join(";"),
    x: 8,
    y: slot.height / 2 - 12,
    width: slot.width - 16,
    height: 24,
    parent: cardId,
  });

  vertex(writer, {
    value: "",
    style: [
      "ellipse",
      `fillColor=${theme.priority[slot.gap.priority]}`,
      "strokeColor=none",
      "html=1",
    ].join(";"),
    x: slot.width - 26,
    y: 12,
    width: 14,
    height: 14,
    parent: cardId,
  });

  if (slot.gap.note) {
    vertex(writer, {
      value: slot.gap.note,
      style: [
        "text",
        "html=1",
        "align=center",
        "verticalAlign=top",
        `fontColor=${theme.gapText}`,
        "fontSize=10",
        "strokeColor=none",
        "fillColor=none",
        "whiteSpace=wrap",
      ].join(";"),
      x: 10,
      y: slot.height / 2 + 18,
      width: slot.width - 20,
      height: 40,
      parent: cardId,
    });
  }

  vertex(writer, {
    value: slot.gap.priority.toUpperCase(),
    style: [
      "text",
      "html=1",
      "align=center",
      "verticalAlign=middle",
      `fontColor=${theme.priority[slot.gap.priority]}`,
      "fontSize=10",
      "fontStyle=1",
      "strokeColor=none",
      "fillColor=none",
    ].join(";"),
    x: 8,
    y: slot.height - 32,
    width: slot.width - 16,
    height: 18,
    parent: cardId,
  });

  writer.slotCellIds.set(slot.id, cardId);
}

/**
 * One tree node. Nodes are laid out side by side rather than spatially nested,
 * so every node is a container at the page root and only its own cards are
 * re-based onto its frame. Returns the container id so links can target it.
 */
function domainCells(
  writer: CellWriter,
  node: DomainNode,
  theme: ThemeTokens,
  avatars: Record<string, string>,
): string {
  const stroke = node.color ?? theme.accent;
  const isRoot = node.depth === 0;

  const groupId = vertex(writer, {
    value: "",
    style: [
      "rounded=1",
      "arcSize=4",
      `fillColor=${theme.cardBackgroundFlat}`,
      "opacity=40",
      `strokeColor=${stroke}`,
      `strokeWidth=${isRoot ? 3 : 2}`,
      "html=1",
      "verticalAlign=top",
      "container=1",
      "collapsible=0",
    ].join(";"),
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    parent: "1",
  });

  vertex(writer, {
    value: domainLabel(node.domain),
    style: [
      "rounded=0",
      `fillColor=${node.color ?? "#3a2a15"}`,
      `strokeColor=${stroke}`,
      `fontColor=${theme.textPrimary}`,
      `fontSize=${isRoot ? 16 : 13}`,
      "fontStyle=1",
      "html=1",
      "align=left",
      "spacingLeft=12",
      "verticalAlign=middle",
    ].join(";"),
    x: 0,
    y: 0,
    width: node.width,
    height: node.headerHeight,
    parent: groupId,
  });

  if (node.gapCount > 0) {
    vertex(writer, {
      value: String(node.gapCount),
      style: [
        "ellipse",
        `fillColor=${theme.priority.critical}`,
        "strokeColor=none",
        "fontColor=#ffffff",
        "fontSize=11",
        "fontStyle=1",
        "html=1",
        "align=center",
        "verticalAlign=middle",
      ].join(";"),
      x: node.width - 32,
      y: (node.headerHeight - 22) / 2,
      width: 22,
      height: 22,
      parent: groupId,
    });
  }

  // Slots carry absolute coords; convert to the container's frame.
  for (const slot of node.slots) {
    const relative = { ...slot, x: slot.x - node.x, y: slot.y - node.y } as Slot;
    if (relative.kind === "gap") {
      gapCardCells(writer, relative, groupId, theme);
    } else {
      personCardCells(writer, relative, groupId, theme, avatars);
    }
  }

  return groupId;
}

/** Renders one top-level domain's tree into a `<diagram>` page body. */
function pageCells(
  layout: DomainTreeLayout,
  theme: ThemeTokens,
  avatars: Record<string, string>,
  prefix: string,
): string[] {
  const writer = createWriter(prefix);
  const nodeCellIds = new Map<string, string>();

  for (const node of layout.nodes) {
    nodeCellIds.set(node.id, domainCells(writer, node, theme, avatars));
  }

  // Solid parent-to-child connectors; dashed styling stays reserved for loans.
  for (const link of layout.links) {
    const [fromId, toId] = link.id.split("->");
    const source = nodeCellIds.get(fromId);
    const target = nodeCellIds.get(toId);
    if (!source || !target) continue;

    edge(writer, {
      value: "",
      style: [
        "edgeStyle=orthogonalEdgeStyle",
        "rounded=1",
        "dashed=0",
        `strokeColor=${theme.accent}`,
        "strokeWidth=2",
        "endArrow=none",
        "html=1",
        "exitX=0.5",
        "exitY=1",
        "entryX=0.5",
        "entryY=0",
      ].join(";"),
      source,
      target,
      parent: "1",
    });
  }

  return writer.cells;
}

/** One `<diagram>` page per top-level domain, all inside a single `<mxfile>`. */
export function toDrawioXML(config: Config, options: DrawioOptions = {}): string {
  const theme = getTheme(config.theme);
  const avatars = options.avatars ?? {};
  const layoutOptions = layoutFromTheme(theme);

  const diagrams = config.domains.map((domain, index) => {
    const layout = computeDomainTreeLayout(config, domain, layoutOptions);
    const cells = pageCells(layout, theme, avatars, `p${index + 1}`);
    const width = Math.ceil(layout.width);
    const height = Math.ceil(layout.height);

    return [
      `  <diagram id="atlas-page-${index + 1}" name="${escapeAttr(domainLabel(domain))}">`,
      `    <mxGraphModel dx="${width}" dy="${height}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${width}" pageHeight="${height}" background="${theme.cardBackgroundFlat}" math="0" shadow="0">`,
      `      <root>`,
      `        <mxCell id="0" />`,
      `        <mxCell id="1" parent="0" />`,
      ...cells,
      `      </root>`,
      `    </mxGraphModel>`,
      `  </diagram>`,
    ].join("\n");
  });

  const modified = new Date().toISOString();

  return [
    `<mxfile host="atlas" modified="${modified}" agent="atlas" version="24.0.0" type="device">`,
    ...diagrams,
    `</mxfile>`,
    ``,
  ].join("\n");
}

/** Resolves every avatar to a data URI first so the diagram opens offline. */
export async function toDrawioXMLWithAvatars(
  config: Config,
  opts: { baseDir?: string } = {},
): Promise<string> {
  const theme = getTheme(config.theme);
  const entries = await Promise.all(
    config.people.map(async (person) => {
      const uri = await resolveAvatar(person, {
        size: theme.card.avatarSize,
        inline: true,
        baseDir: opts.baseDir,
      });
      return [person.id, uri] as const;
    }),
  );

  return toDrawioXML(config, { avatars: Object.fromEntries(entries) });
}
