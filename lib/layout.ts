import { hierarchy, type HierarchyNode } from "d3-hierarchy";
import type { Config, Domain, Gap, Person, Rarity } from "./schema";
import type { ThemeTokens } from "./themes/types";

export interface LayoutOptions {
  cardWidth: number;
  cardHeight: number;
  cardGap: number;
  columns: number;
  padding: number;
  bannerHeight: number;
  sectionGap: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  cardWidth: 240,
  cardHeight: 340,
  cardGap: 20,
  columns: 3,
  padding: 24,
  bannerHeight: 52,
  sectionGap: 28,
};

export function layoutFromTheme(theme: ThemeTokens, overrides: Partial<LayoutOptions> = {}) {
  return {
    ...DEFAULT_LAYOUT,
    cardWidth: theme.card.width,
    cardHeight: theme.card.height,
    ...overrides,
  } satisfies LayoutOptions;
}

export type SlotKind = "lead" | "member" | "gap";

export interface PersonSlot {
  kind: "lead" | "member";
  person: Person;
  /** Loans out of this domain, shown as a corner badge. */
  loans: { domain: string; ratio: number; role?: string }[];
  /** Set when the person's home domain differs from where the card is drawn. */
  onLoanFrom?: string;
  loanRatio?: number;
  rarity: Rarity;
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
}

export interface GapSlot {
  kind: "gap";
  gap: Gap;
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
}

export type Slot = PersonSlot | GapSlot;

/** Omit over a union collapses to shared keys, so distribute it explicitly. */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

export type UnplacedSlot = DistributiveOmit<Slot, "x" | "y">;

export interface DomainBox {
  domain: Domain;
  depth: number;
  /** Absolute canvas coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
  slots: Slot[];
  children: DomainBox[];
  gapCount: number;
  color?: string;
  id: string;
}

export interface LoanEdge {
  personId: string;
  personName: string;
  fromDomain: string;
  toDomain: string;
  ratio: number;
  role?: string;
  /** Card ids so the web overlay can anchor the arrow to real DOM nodes. */
  sourceSlotId: string;
  targetSlotId?: string;
}

export interface LayoutResult {
  boxes: DomainBox[];
  edges: LoanEdge[];
  width: number;
  height: number;
  options: LayoutOptions;
}

function inferRarity(person: Person, isLead: boolean): Rarity {
  if (person.rarity) return person.rarity;
  if (isLead) return "legendary";
  if (person.lendTo?.length) return "epic";
  if ((person.tags?.length ?? 0) >= 3) return "rare";
  return "common";
}

function slotId(domainName: string, key: string): string {
  return `${domainName}::${key}`;
}

/** Total gaps for a domain including everything nested beneath it. */
function countGapsDeep(domain: Domain): number {
  const own = (domain.gaps ?? []).reduce((sum, gap) => sum + gap.count, 0);
  const nested = (domain.subdomains ?? []).reduce((sum, sub) => sum + countGapsDeep(sub), 0);
  return own + nested;
}

/**
 * Two-pass layout: measure each domain bottom-up (so a parent knows how tall
 * its children are), then assign absolute positions top-down.
 */
export function computeLayout(config: Config, options: LayoutOptions = DEFAULT_LAYOUT): LayoutResult {
  const peopleById = new Map(config.people.map((person) => [person.id, person]));

  interface Measured {
    domain: Domain;
    depth: number;
    slots: UnplacedSlot[];
    children: Measured[];
    width: number;
    height: number;
    gridHeight: number;
  }

  const measure = (domain: Domain, depth: number): Measured => {
    const slots: UnplacedSlot[] = [];
    const seen = new Set<string>();

    const pushPerson = (person: Person, kind: "lead" | "member") => {
      if (seen.has(person.id)) return;
      seen.add(person.id);

      const loans = (person.lendTo ?? []).map((loan) => ({
        domain: loan.domain,
        ratio: loan.ratio,
        role: loan.role,
      }));

      slots.push({
        kind,
        person,
        loans,
        rarity: inferRarity(person, kind === "lead"),
        width: options.cardWidth,
        height: options.cardHeight,
        id: slotId(domain.name, person.id),
      });
    };

    if (domain.lead) {
      const lead = peopleById.get(domain.lead);
      if (lead) pushPerson(lead, "lead");
    }
    for (const memberId of domain.members ?? []) {
      const person = peopleById.get(memberId);
      if (person) pushPerson(person, "member");
    }

    // People lent into this domain from elsewhere render here too.
    for (const person of config.people) {
      for (const loan of person.lendTo ?? []) {
        if (loan.domain !== domain.name || seen.has(person.id)) continue;
        seen.add(person.id);
        slots.push({
          kind: "member",
          person,
          loans: [],
          onLoanFrom: person.homeDomain ?? "外部",
          loanRatio: loan.ratio,
          rarity: inferRarity(person, false),
          width: options.cardWidth,
          height: options.cardHeight,
          id: slotId(domain.name, person.id),
        });
      }
    }

    for (const [index, gap] of (domain.gaps ?? []).entries()) {
      slots.push({
        kind: "gap",
        gap,
        width: options.cardWidth,
        height: options.cardHeight,
        id: slotId(domain.name, `gap-${index}`),
      });
    }

    const columns = Math.max(1, options.columns);
    const rows = Math.ceil(slots.length / columns) || 0;
    const gridWidth =
      columns * options.cardWidth + (columns - 1) * options.cardGap;
    const gridHeight =
      rows === 0 ? 0 : rows * options.cardHeight + (rows - 1) * options.cardGap;

    const children = (domain.subdomains ?? []).map((sub) => measure(sub, depth + 1));
    const childrenHeight = children.reduce(
      (sum, child, index) => sum + child.height + (index > 0 ? options.sectionGap : 0),
      0,
    );
    const childrenWidth = children.reduce((max, child) => Math.max(max, child.width), 0);

    const innerWidth = Math.max(gridWidth, childrenWidth);
    const width = innerWidth + options.padding * 2;

    let height = options.bannerHeight + options.padding;
    if (gridHeight > 0) height += gridHeight;
    if (children.length > 0) {
      if (gridHeight > 0) height += options.sectionGap;
      height += childrenHeight;
    }
    height += options.padding;

    return { domain, depth, slots, children, width, height, gridHeight };
  };

  const place = (node: Measured, x: number, y: number): DomainBox => {
    const columns = Math.max(1, options.columns);
    const innerX = x + options.padding;
    let cursorY = y + options.bannerHeight + options.padding;

    const slots: Slot[] = node.slots.map((slot, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      return {
        ...slot,
        x: innerX + column * (options.cardWidth + options.cardGap),
        y: cursorY + row * (options.cardHeight + options.cardGap),
      } as Slot;
    });

    if (node.gridHeight > 0) cursorY += node.gridHeight;
    if (node.children.length > 0 && node.gridHeight > 0) cursorY += options.sectionGap;

    const children: DomainBox[] = [];
    for (const [index, child] of node.children.entries()) {
      if (index > 0) cursorY += options.sectionGap;
      const box = place(child, innerX, cursorY);
      children.push(box);
      cursorY += child.height;
    }

    return {
      domain: node.domain,
      depth: node.depth,
      x,
      y,
      width: node.width,
      height: node.height,
      slots,
      children,
      gapCount: countGapsDeep(node.domain),
      color: node.domain.color,
      id: node.domain.name,
    };
  };

  const measured = config.domains.map((domain) => measure(domain, 0));

  const boxes: DomainBox[] = [];
  let cursorY = options.padding;
  let maxWidth = 0;
  for (const node of measured) {
    boxes.push(place(node, options.padding, cursorY));
    cursorY += node.height + options.sectionGap;
    maxWidth = Math.max(maxWidth, node.width);
  }

  const slotIndex = new Map<string, Slot>();
  const collect = (box: DomainBox) => {
    for (const slot of box.slots) slotIndex.set(slot.id, slot);
    box.children.forEach(collect);
  };
  boxes.forEach(collect);

  const edges: LoanEdge[] = [];
  for (const person of config.people) {
    for (const loan of person.lendTo ?? []) {
      const from = person.homeDomain;
      if (!from) continue;
      const sourceSlotId = slotId(from, person.id);
      const targetSlotId = slotId(loan.domain, person.id);
      if (!slotIndex.has(sourceSlotId)) continue;

      edges.push({
        personId: person.id,
        personName: person.name,
        fromDomain: from,
        toDomain: loan.domain,
        ratio: loan.ratio,
        role: loan.role,
        sourceSlotId,
        targetSlotId: slotIndex.has(targetSlotId) ? targetSlotId : undefined,
      });
    }
  }

  return {
    boxes,
    edges,
    width: maxWidth + options.padding * 2,
    height: cursorY - options.sectionGap + options.padding,
    options,
  };
}

/**
 * d3-hierarchy view of the domain tree, for callers that need depth/ancestor
 * queries rather than pixel geometry.
 */
export function domainHierarchy(domains: Domain[]): HierarchyNode<Domain> {
  const root: Domain = { name: "__root__", subdomains: domains };
  return hierarchy<Domain>(root, (d) => d.subdomains);
}

export function totalGaps(config: Config): number {
  return config.domains.reduce((sum, domain) => sum + countGapsDeep(domain), 0);
}

export function countPeople(config: Config): number {
  return config.people.length;
}
