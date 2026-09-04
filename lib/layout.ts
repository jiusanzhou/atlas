import { hierarchy, tree, type HierarchyPointNode } from "d3-hierarchy";
import type { Config, Domain, Gap, Person, Rarity } from "./schema";
import type { ThemeTokens } from "./themes/types";

export interface LayoutOptions {
  cardWidth: number;
  cardHeight: number;
  cardGap: number;
  /** Max columns in a domain node's people grid; narrow nodes use fewer. */
  columns: number;
  padding: number;
  headerHeight: number;
  /** Minimum node width so a person-less domain still reads as a banner. */
  minNodeWidth: number;
  /** Horizontal breathing room between sibling nodes on the same level. */
  nodeGapX: number;
  /** Vertical distance between the bottom of one level and the top of the next. */
  levelGapY: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  cardWidth: 240,
  cardHeight: 340,
  cardGap: 16,
  columns: 3,
  padding: 16,
  headerHeight: 44,
  minNodeWidth: 260,
  nodeGapX: 48,
  levelGapY: 96,
};

export function layoutFromTheme(theme: ThemeTokens, overrides: Partial<LayoutOptions> = {}) {
  return {
    ...DEFAULT_LAYOUT,
    cardWidth: theme.card.width,
    cardHeight: theme.card.height,
    // Small-card themes need tighter gaps and more columns than the default.
    ...theme.geometry,
    ...overrides,
  } satisfies LayoutOptions;
}

/** Cross-domain signal shown as a corner badge instead of a cross-tab arrow. */
export interface LoanBadgeInfo {
  direction: "out" | "in";
  /**
   * Loan target for `out`, the person's home domain for `in`. Resolved to the
   * domain's displayName when it has one, since config ids are rarely readable.
   */
  domain: string;
  ratio: number;
  role?: string;
}

/** Which seat a card occupies. Shared by people and gaps so the lead treatment
 *  (crown, heavier frame) is one branch rather than two. */
export type SlotRole = "lead" | "member";

export interface PersonSlot {
  kind: "person";
  role: SlotRole;
  person: Person;
  badges: LoanBadgeInfo[];
  rarity: Rarity;
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
}

export interface GapSlot {
  kind: "gap";
  /** `lead` means the domain has no lead yet: an empty lead seat. */
  role: SlotRole;
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

export interface DomainNode {
  domain: Domain;
  depth: number;
  /** Absolute canvas coordinates of the node box. */
  x: number;
  y: number;
  width: number;
  height: number;
  headerHeight: number;
  /** Slots carry absolute coordinates too, matching v1's contract. */
  slots: Slot[];
  children: DomainNode[];
  gapCount: number;
  color?: string;
  id: string;
}

/** Parent-bottom to child-top connector, in absolute canvas coordinates. */
export interface TreeLink {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

/**
 * A loan whose lender and borrower both render inside this one tree, so it can
 * be drawn as an arrow. Cross-tree loans have no second endpoint here and stay
 * badge-only.
 */
export interface LoanLink {
  id: string;
  /** Home-domain copy of the person. */
  fromSlotId: string;
  /** Borrowing-domain copy of the same person. */
  toSlotId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  personName: string;
  ratio: number;
  role?: string;
  /** Borrowing domain's display label. */
  toDomain: string;
}

export interface DomainTreeLayout {
  /** The top-level domain this diagram belongs to. */
  root: DomainNode;
  /** Flattened breadth-order node list for renderers that avoid DOM nesting. */
  nodes: DomainNode[];
  links: TreeLink[];
  /** Same-tree loans, drawable as dashed arrows. Empty when none qualify. */
  loanLinks: LoanLink[];
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
  const lead = domain.leadGap?.count ?? 0;
  const nested = (domain.subdomains ?? []).reduce((sum, sub) => sum + countGapsDeep(sub), 0);
  return own + lead + nested;
}

interface Measured {
  domain: Domain;
  slots: UnplacedSlot[];
  children: Measured[];
  width: number;
  height: number;
  gridHeight: number;
  columns: number;
}

/** Collects the cards attached to one domain node: lead, members, loans in, gaps. */
function collectSlots(
  config: Config,
  domain: Domain,
  peopleById: Map<string, Person>,
  labelOf: (name: string) => string,
  options: LayoutOptions,
): UnplacedSlot[] {
  const slots: UnplacedSlot[] = [];
  const seen = new Set<string>();

  const badgesFor = (person: Person): LoanBadgeInfo[] => {
    const isHome = person.homeDomain === domain.name;
    if (isHome) {
      return (person.lendTo ?? []).map((loan) => ({
        direction: "out" as const,
        domain: labelOf(loan.domain),
        ratio: loan.ratio,
        role: loan.role,
      }));
    }

    // Listed here but living elsewhere: a borrow, with the ratio if declared.
    if (!person.homeDomain) return [];
    const loan = (person.lendTo ?? []).find((entry) => entry.domain === domain.name);
    return [
      {
        direction: "in",
        domain: labelOf(person.homeDomain),
        ratio: loan?.ratio ?? 1,
        role: loan?.role,
      },
    ];
  };

  const pushPerson = (person: Person, role: SlotRole) => {
    if (seen.has(person.id)) return;
    seen.add(person.id);
    slots.push({
      kind: "person",
      role,
      person,
      badges: badgesFor(person),
      rarity: inferRarity(person, role === "lead"),
      width: options.cardWidth,
      height: options.cardHeight,
      id: slotId(domain.name, person.id),
    });
  };

  // Lead seat first, whether it is filled by a person or standing empty.
  if (domain.lead) {
    const lead = peopleById.get(domain.lead);
    if (lead) pushPerson(lead, "lead");
  } else if (domain.leadGap) {
    slots.push({
      kind: "gap",
      role: "lead",
      gap: domain.leadGap,
      width: options.cardWidth,
      height: options.cardHeight,
      id: slotId(domain.name, "lead-gap"),
    });
  }
  for (const memberId of domain.members ?? []) {
    const person = peopleById.get(memberId);
    if (person) pushPerson(person, "member");
  }

  // People lent into this domain render here as well, badged as borrowed in.
  for (const person of config.people) {
    for (const loan of person.lendTo ?? []) {
      if (loan.domain !== domain.name || seen.has(person.id)) continue;
      seen.add(person.id);
      slots.push({
        kind: "person",
        role: "member",
        person,
        badges: [
          {
            direction: "in",
            domain: person.homeDomain ? labelOf(person.homeDomain) : "外部",
            ratio: loan.ratio,
            role: loan.role,
          },
        ],
        rarity: inferRarity(person, false),
        width: options.cardWidth,
        height: options.cardHeight,
        id: slotId(domain.name, person.id),
      });
    }
  }

  // Member gaps land last, so the grid reads lead -> real members -> vacancies.
  for (const [index, gap] of (domain.gaps ?? []).entries()) {
    slots.push({
      kind: "gap",
      role: "member",
      gap,
      width: options.cardWidth,
      height: options.cardHeight,
      id: slotId(domain.name, `gap-${index}`),
    });
  }

  return slots;
}

function measure(
  config: Config,
  domain: Domain,
  peopleById: Map<string, Person>,
  labelOf: (name: string) => string,
  options: LayoutOptions,
): Measured {
  const slots = collectSlots(config, domain, peopleById, labelOf, options);

  // A single-person domain should not be as wide as a full three-up grid.
  const columns = Math.max(1, Math.min(options.columns, slots.length || 1));
  const rows = Math.ceil(slots.length / columns);
  const gridWidth = columns * options.cardWidth + (columns - 1) * options.cardGap;
  const gridHeight =
    rows === 0 ? 0 : rows * options.cardHeight + (rows - 1) * options.cardGap;

  const width = Math.max(
    options.minNodeWidth,
    (slots.length > 0 ? gridWidth : 0) + options.padding * 2,
  );
  const height =
    options.headerHeight + (gridHeight > 0 ? options.padding + gridHeight + options.padding : 0);

  const children = (domain.subdomains ?? []).map((sub) =>
    measure(config, sub, peopleById, labelOf, options),
  );

  return { domain, slots, children, width, height, gridHeight, columns };
}

/** Config-wide name -> displayName lookup, so badges read like the tab titles. */
function buildLabelLookup(config: Config): (name: string) => string {
  const labels = new Map<string, string>();
  const walk = (domains: Domain[]) => {
    for (const domain of domains) {
      labels.set(domain.name, domainLabel(domain));
      if (domain.subdomains?.length) walk(domain.subdomains);
    }
  };
  walk(config.domains);
  return (name) => labels.get(name) ?? name;
}

/**
 * Tidy tree for one top-level domain. Node widths vary, so d3's `nodeSize` x is
 * kept at 1 unit = 1px and the real spacing is expressed through `separation`.
 * Level y is computed manually because node heights also vary per depth.
 */
export function computeDomainTreeLayout(
  config: Config,
  domain: Domain,
  options: LayoutOptions = DEFAULT_LAYOUT,
): DomainTreeLayout {
  const peopleById = new Map(config.people.map((person) => [person.id, person]));
  const measured = measure(config, domain, peopleById, buildLabelLookup(config), options);

  // `tree()` returns the same node objects with x/y assigned; the point-typed
  // result is what makes those coordinates non-optional.
  const root = tree<Measured>()
    .nodeSize([1, 1])
    .separation((a, b) => {
      const half = (a.data.width + b.data.width) / 2;
      // Cousins get extra room so subtree groupings stay legible.
      return half + (a.parent === b.parent ? options.nodeGapX : options.nodeGapX * 1.6);
    })(hierarchy(measured, (node) => (node.children.length ? node.children : null)));

  const descendants = root.descendants();

  const levelHeight = new Map<number, number>();
  for (const node of descendants) {
    levelHeight.set(node.depth, Math.max(levelHeight.get(node.depth) ?? 0, node.data.height));
  }

  const levelY = new Map<number, number>();
  let cursorY = options.padding;
  for (let depth = 0; depth <= root.height; depth += 1) {
    levelY.set(depth, cursorY);
    cursorY += (levelHeight.get(depth) ?? 0) + options.levelGapY;
  }
  const contentHeight = cursorY - options.levelGapY + options.padding;

  const minX = Math.min(...descendants.map((node) => node.x - node.data.width / 2));
  const maxX = Math.max(...descendants.map((node) => node.x + node.data.width / 2));
  const offsetX = options.padding - minX;

  const boxOf = new Map<HierarchyPointNode<Measured>, DomainNode>();

  // Build boxes first so children can be attached without a second traversal.
  for (const node of descendants) {
    const width = node.data.width;
    const x = node.x - width / 2 + offsetX;
    const y = levelY.get(node.depth) ?? options.padding;

    const columns = node.data.columns;
    const gridWidth =
      columns * options.cardWidth + (columns - 1) * options.cardGap;
    // Centre the grid inside the node, which may be wider due to minNodeWidth.
    const gridX = x + (width - gridWidth) / 2;
    const gridY = y + options.headerHeight + options.padding;

    const slots: Slot[] = node.data.slots.map((slot, index) => ({
      ...slot,
      x: gridX + (index % columns) * (options.cardWidth + options.cardGap),
      y: gridY + Math.floor(index / columns) * (options.cardHeight + options.cardGap),
    })) as Slot[];

    boxOf.set(node, {
      domain: node.data.domain,
      depth: node.depth,
      x,
      y,
      width,
      height: node.data.height,
      headerHeight: options.headerHeight,
      slots,
      children: [],
      gapCount: countGapsDeep(node.data.domain),
      color: node.data.domain.color,
      id: node.data.domain.name,
    });
  }

  const links: TreeLink[] = [];
  for (const node of descendants) {
    const box = boxOf.get(node);
    if (!box) continue;
    for (const child of node.children ?? []) {
      const childBox = boxOf.get(child);
      if (!childBox) continue;
      box.children.push(childBox);
      links.push({
        id: `${box.id}->${childBox.id}`,
        fromX: box.x + box.width / 2,
        fromY: box.y + box.height,
        toX: childBox.x + childBox.width / 2,
        toY: childBox.y,
      });
    }
  }

  const rootBox = boxOf.get(root);
  if (!rootBox) throw new Error(`领域 "${domain.name}" 布局失败`);

  const nodes = descendants
    .map((node) => boxOf.get(node))
    .filter((box): box is DomainNode => !!box);

  return {
    root: rootBox,
    nodes,
    links,
    loanLinks: collectLoanLinks(config, nodes, buildLabelLookup(config)),
    width: maxX - minX + options.padding * 2,
    height: contentHeight,
    options,
  };
}

/** Midpoints of the two facing edges, so the arrow never crosses a card. */
function anchorBetween(
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
): { fromX: number; fromY: number; toX: number; toY: number } {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);

  if (Math.abs(dy) > Math.abs(dx)) {
    const down = dy > 0;
    return {
      fromX: from.x + from.width / 2,
      fromY: down ? from.y + from.height : from.y,
      toX: to.x + to.width / 2,
      toY: down ? to.y : to.y + to.height,
    };
  }

  const right = dx > 0;
  return {
    fromX: right ? from.x + from.width : from.x,
    fromY: from.y + from.height / 2,
    toX: right ? to.x : to.x + to.width,
    toY: to.y + to.height / 2,
  };
}

/**
 * Loans where the person's home card and their borrowed-in card both landed in
 * this tree. Anything pointing outside it is left to the corner badges.
 */
function collectLoanLinks(
  config: Config,
  nodes: DomainNode[],
  labelOf: (name: string) => string,
): LoanLink[] {
  const placed = new Map<string, PersonSlot>();
  for (const node of nodes) {
    for (const slot of node.slots) {
      if (slot.kind === "person") placed.set(slot.id, slot);
    }
  }

  const loanLinks: LoanLink[] = [];
  for (const person of config.people) {
    if (!person.homeDomain) continue;
    const from = placed.get(slotId(person.homeDomain, person.id));
    if (!from) continue;

    for (const loan of person.lendTo ?? []) {
      const to = placed.get(slotId(loan.domain, person.id));
      if (!to) continue;
      loanLinks.push({
        id: `loan:${person.id}:${person.homeDomain}->${loan.domain}`,
        fromSlotId: from.id,
        toSlotId: to.id,
        ...anchorBetween(from, to),
        personName: person.name,
        ratio: loan.ratio,
        role: loan.role,
        toDomain: labelOf(loan.domain),
      });
    }
  }

  return loanLinks;
}

/** Top-level domains, one per tab / drawio page / exported PNG. */
export function topLevelDomains(config: Config): Domain[] {
  return config.domains;
}

export function domainLabel(domain: Domain): string {
  return domain.displayName ?? domain.name;
}

/** Safe for filenames and URL query values across the export paths. */
export function domainSlug(domain: Domain): string {
  return domain.name.replace(/[^\w一-龥-]+/g, "-");
}

export function findTopLevelDomain(config: Config, name: string | undefined): Domain | undefined {
  if (!name) return undefined;
  return config.domains.find(
    (domain) => domain.name === name || domain.displayName === name || domainSlug(domain) === name,
  );
}

export function totalGaps(config: Config): number {
  return config.domains.reduce((sum, domain) => sum + countGapsDeep(domain), 0);
}

export function domainGaps(domain: Domain): number {
  return countGapsDeep(domain);
}

export function countPeople(config: Config): number {
  return config.people.length;
}
