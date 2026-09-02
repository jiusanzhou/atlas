import { z } from "zod";

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const RARITIES = ["common", "rare", "epic", "legendary"] as const;
export const THEMES = ["hearthstone", "business", "blueprint"] as const;

export type Priority = (typeof PRIORITIES)[number];
export type Rarity = (typeof RARITIES)[number];
export type ThemeName = (typeof THEMES)[number];

export const GapSchema = z.object({
  role: z.string().min(1),
  count: z.number().int().positive(),
  priority: z.enum(PRIORITIES),
  note: z.string().optional(),
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
});

export const DomainSchema: z.ZodType<DomainInput> = z.object({
  name: z.string().min(1),
  displayName: z.string().optional(),
  lead: z.string().optional(),
  members: z.array(z.string()).optional(),
  gaps: z.array(GapSchema).optional(),
  subdomains: z.lazy(() => z.array(DomainSchema)).optional(),
  color: z.string().optional(),
  description: z.string().optional(),
});

export const MetaSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
});

export const ConfigSchema = z.object({
  meta: MetaSchema.optional(),
  theme: z.enum(THEMES).default("hearthstone"),
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
  members?: string[];
  gaps?: Gap[];
  subdomains?: DomainInput[];
  color?: string;
  description?: string;
}

export type Domain = DomainInput;
