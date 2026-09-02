import type { Config } from "./schema";
import { computeLayout, layoutFromTheme, type DomainBox, type Slot } from "./layout";
import { getTheme } from "./themes";
import { resolveAvatar, resolveAvatarSync } from "./avatar";
import type { ThemeTokens } from "./themes/types";

export interface DrawioOptions {
  /** Pre-resolved avatar data URIs keyed by person id; enables offline opening. */
  avatars?: Record<string, string>;
  diagramName?: string;
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

function createWriter(): CellWriter {
  let counter = 1;
  return {
    cells: [],
    nextId: () => `atlas-${counter++}`,
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

function personCardCells(
  writer: CellWriter,
  slot: Extract<Slot, { kind: "lead" | "member" }>,
  parent: string,
  theme: ThemeTokens,
  avatars: Record<string, string>,
): void {
  const rarity = theme.rarity[slot.rarity];
  const strokeWidth = slot.kind === "lead" ? 4 : 2;

  // Card frame is the group parent, so children use coordinates relative to it.
  const cardId = vertex(writer, {
    value: "",
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

  const badge = slot.loans[0]
    ? `→ ${slot.loans[0].domain} ${Math.round(slot.loans[0].ratio * 100)}%`
    : slot.onLoanFrom
      ? `← ${slot.onLoanFrom} ${Math.round((slot.loanRatio ?? 0) * 100)}%`
      : null;

  if (badge) {
    vertex(writer, {
      value: badge,
      style: [
        "rounded=1",
        "arcSize=30",
        `fillColor=${theme.loanBadgeBackground}`,
        "strokeColor=none",
        `fontColor=${theme.loanBadgeText}`,
        "fontSize=10",
        "fontStyle=1",
        "html=1",
        "align=center",
        "verticalAlign=middle",
      ].join(";"),
      x: slot.width - 104,
      y: 4,
      width: 100,
      height: 20,
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

function domainCells(
  writer: CellWriter,
  box: DomainBox,
  parent: string,
  theme: ThemeTokens,
  avatars: Record<string, string>,
): void {
  const stroke = box.color ?? theme.accent;

  const groupId = vertex(writer, {
    value: "",
    style: [
      "rounded=1",
      "arcSize=4",
      `fillColor=${theme.cardBackgroundFlat}`,
      "opacity=40",
      `strokeColor=${stroke}`,
      "strokeWidth=2",
      "html=1",
      "verticalAlign=top",
      "container=1",
      "collapsible=0",
    ].join(";"),
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    parent,
  });

  const label = box.domain.displayName ?? box.domain.name;
  vertex(writer, {
    value: label,
    style: [
      "rounded=0",
      `fillColor=${box.color ?? "#3a2a15"}`,
      `strokeColor=${stroke}`,
      `fontColor=${theme.textPrimary}`,
      "fontSize=16",
      "fontStyle=1",
      "html=1",
      "align=left",
      "spacingLeft=12",
      "verticalAlign=middle",
    ].join(";"),
    x: 0,
    y: 0,
    width: box.width,
    height: 40,
    parent: groupId,
  });

  if (box.gapCount > 0) {
    vertex(writer, {
      value: String(box.gapCount),
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
      x: box.width - 34,
      y: 10,
      width: 22,
      height: 22,
      parent: groupId,
    });
  }

  // Slots carry absolute coords; convert to the group's frame.
  for (const slot of box.slots) {
    const relative = { ...slot, x: slot.x - box.x, y: slot.y - box.y } as Slot;
    if (relative.kind === "gap") {
      gapCardCells(writer, relative, groupId, theme);
    } else {
      personCardCells(writer, relative, groupId, theme, avatars);
    }
  }

  for (const child of box.children) {
    const shifted: DomainBox = { ...child, x: child.x - box.x, y: child.y - box.y };
    domainCells(writer, shifted, groupId, theme, avatars);
  }
}

export function toDrawioXML(config: Config, options: DrawioOptions = {}): string {
  const theme = getTheme(config.theme);
  const layout = computeLayout(config, layoutFromTheme(theme));
  const avatars = options.avatars ?? {};
  const writer = createWriter();

  for (const box of layout.boxes) {
    domainCells(writer, box, "1", theme, avatars);
  }

  for (const loan of layout.edges) {
    const source = writer.slotCellIds.get(loan.sourceSlotId);
    const target = loan.targetSlotId ? writer.slotCellIds.get(loan.targetSlotId) : undefined;
    if (!source || !target) continue;

    edge(writer, {
      value: `${loan.role ?? "借调"} ${Math.round(loan.ratio * 100)}%`,
      style: [
        "edgeStyle=orthogonalEdgeStyle",
        "rounded=1",
        "dashed=1",
        "dashPattern=6 4",
        `strokeColor=${theme.loanArrow}`,
        "strokeWidth=2",
        "endArrow=block",
        "endFill=1",
        `fontColor=${theme.loanArrow}`,
        "fontSize=10",
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

  const name = options.diagramName ?? config.meta?.title ?? "Atlas";
  const modified = new Date().toISOString();

  return [
    `<mxfile host="atlas" modified="${modified}" agent="atlas" version="24.0.0" type="device">`,
    `  <diagram id="atlas-domain-map" name="${escapeAttr(name)}">`,
    `    <mxGraphModel dx="${layout.width}" dy="${layout.height}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${layout.width}" pageHeight="${layout.height}" background="${theme.cardBackgroundFlat}" math="0" shadow="0">`,
    `      <root>`,
    `        <mxCell id="0" />`,
    `        <mxCell id="1" parent="0" />`,
    ...writer.cells,
    `      </root>`,
    `    </mxGraphModel>`,
    `  </diagram>`,
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
