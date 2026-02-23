import { createElement } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { Baby, Brain, CircleHelp, Dumbbell, DollarSign, Heart, House, Leaf, Briefcase } from "lucide-react";

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

export function getTemplateIcon(token: string | null | undefined, props: Omit<LucideProps, "ref"> = {}): JSX.Element {
  const normalized = normalizeTemplateIconToken(token);
  const Icon = normalized ? templateIconLookup[normalized] : CircleHelp;
  return createElement(Icon, props);
}
