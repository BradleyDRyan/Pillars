import { createElement } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { Baby, Brain, CircleHelp, Dumbbell, DollarSign, Heart, House, Leaf, Briefcase } from "lucide-react";
import { resolveColorHexForToken } from "./pillar-render-registry";

export enum TemplateIconToken {
  Heart = "heart",
  Figure = "figure",
  Briefcase = "briefcase",
  DollarSign = "dollarsign",
  House = "house",
  Brain = "brain",
  Leaf = "leaf",
  Figure2 = "figure2"
}

export enum TemplateColorToken {
  Coral = "coral",
  Rose = "rose",
  Violet = "violet",
  Indigo = "indigo",
  Blue = "blue",
  Sky = "sky",
  Mint = "mint",
  Green = "green",
  Lime = "lime",
  Amber = "amber",
  Orange = "orange",
  Slate = "slate"
}

export const templateColorTokens = Object.freeze(Object.values(TemplateColorToken)) as readonly TemplateColorToken[];

const templateIconLookup: Record<TemplateIconToken, LucideIcon> = {
  [TemplateIconToken.Heart]: Heart,
  [TemplateIconToken.Figure]: Dumbbell,
  [TemplateIconToken.Briefcase]: Briefcase,
  [TemplateIconToken.DollarSign]: DollarSign,
  [TemplateIconToken.House]: House,
  [TemplateIconToken.Brain]: Brain,
  [TemplateIconToken.Leaf]: Leaf,
  [TemplateIconToken.Figure2]: Baby
};

function normalizeTemplateIconToken(value: string | null | undefined): TemplateIconToken | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return Object.values(TemplateIconToken).includes(normalized as TemplateIconToken)
    ? (normalized as TemplateIconToken)
    : null;
}

function normalizeTemplateColorToken(value: string | null | undefined): TemplateColorToken | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return Object.values(TemplateColorToken).includes(normalized as TemplateColorToken)
    ? (normalized as TemplateColorToken)
    : null;
}

export function getTemplateColorToken(value: string | null | undefined): TemplateColorToken | null {
  return normalizeTemplateColorToken(value);
}

export function getTemplateColor(value: string | null | undefined): string {
  const normalized = getTemplateColorToken(value);
  return resolveColorHexForToken(normalized ?? null);
}

export function getTemplateIcon(token: string | null | undefined, props: Omit<LucideProps, "ref"> = {}): JSX.Element {
  const normalized = normalizeTemplateIconToken(token);
  const Icon = normalized ? templateIconLookup[normalized] : CircleHelp;
  return createElement(Icon, props);
}
