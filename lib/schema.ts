import { z } from "zod";

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const RARITIES = ["common", "rare", "epic", "legendary"] as const;
/** Themes that are fully implemented and therefore selectable. */
export const THEMES = ["hearthstone", "minimal"] as const;

export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "紧急",
};
export type Rarity = (typeof RARITIES)[number];
export type ThemeName = (typeof THEMES)[number];

export const GapSchema = z.object({
  role: z.string().min(1),
  count: z.number().int().positive().default(1),
  priority: z.enum(PRIORITIES),
  note: z.string().optional(),
  /** Markdown source: hiring requirements, shown on the flipped card / panel. */
  comment: z.string().optional(),
});

export const LoanSchema = z.object({
  domain: z.string().min(1),
  ratio: z.number().min(0).max(1),
  role: z.string().optional(),
});

export const PersonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  title: z.string().optional(),
  homeDomain: z.string().optional(),
  avatar: z.string().optional(),
  tags: z.array(z.string()).optional(),
  lendTo: z.array(LoanSchema).optional(),
  rarity: z.enum(RARITIES).optional(),
  /** Markdown source, shown on the card's flipped back face. */
  comment: z.string().optional(),
});

export const DomainSchema: z.ZodType<DomainInput> = z
  .object({
    name: z.string().min(1),
    displayName: z.string().optional(),
    lead: z.string().optional(),
    /** An unfilled lead seat. Mutually exclusive with `lead`. */
    leadGap: GapSchema.optional(),
    members: z.array(z.string()).optional(),
    gaps: z.array(GapSchema).optional(),
    subdomains: z.lazy(() => z.array(DomainSchema)).optional(),
    color: z.string().optional(),
    description: z.string().optional(),
  })
  .refine((domain) => !(domain.lead && domain.leadGap), {
    error: "lead 与 leadGap 只能填一个",
    path: ["leadGap"],
  });

/**
 * Themes that existed as stubs before v1.6 and were withdrawn. Configs and
 * localStorage entries still naming them resolve to the default rather than
 * failing validation; a genuine typo still errors.
 */
export const RETIRED_THEMES = ["business", "blueprint"] as const;

const retired: ReadonlySet<string> = new Set(RETIRED_THEMES);

export function normalizeThemeName(value: unknown): ThemeName | null {
  if (typeof value !== "string") return null;
  if (retired.has(value)) return "hearthstone";
  return (THEMES as readonly string[]).includes(value) ? (value as ThemeName) : null;
}

export const ThemeSchema = z
  .preprocess((value) => (retired.has(value as string) ? "hearthstone" : value), z.enum(THEMES))
  .default("hearthstone");

export const MetaSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
});

export const ConfigSchema = z.object({
  meta: MetaSchema.optional(),
  theme: ThemeSchema,
  domains: z.array(DomainSchema).min(1),
  people: z.array(PersonSchema),
});

export type Gap = z.infer<typeof GapSchema>;
export type Loan = z.infer<typeof LoanSchema>;
export type Person = z.infer<typeof PersonSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export interface DomainInput {
  name: string;
  displayName?: string;
  lead?: string;
  leadGap?: Gap;
  members?: string[];
  gaps?: Gap[];
  subdomains?: DomainInput[];
  color?: string;
  description?: string;
}

export type Domain = DomainInput;
