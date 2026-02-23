"use client";

import { Checkbox as BaseUICheckbox } from "@base-ui/react/checkbox";
import type { ComponentPropsWithoutRef, CSSProperties } from "react";

type CheckboxRootProps = Omit<ComponentPropsWithoutRef<typeof BaseUICheckbox.Root>, "className">;
type CheckboxIndicatorProps = Omit<ComponentPropsWithoutRef<typeof BaseUICheckbox.Indicator>, "className">;

const checkboxRootClassName =
  "admin-checkbox admin-checkbox__root inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--line-strong)] bg-[var(--bg-surface)]";

const checkboxIndicatorClassName =
  "admin-checkbox__indicator text-xs font-semibold text-[var(--accent)]";

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function CheckboxRoot({ className, style, children, ...props }: CheckboxRootProps) {
  const rootStyle: CSSProperties = {
    borderRadius: "8px",
    borderColor: "var(--line-strong)",
    backgroundColor: "var(--bg-surface)",
    ...style
  };

  return (
    <BaseUICheckbox.Root
      className={cx(checkboxRootClassName, className)}
      style={rootStyle}
      {...props}
    >
      {children}
    </BaseUICheckbox.Root>
  );
}

function CheckboxIndicator({ className, children, ...props }: CheckboxIndicatorProps) {
  return (
    <BaseUICheckbox.Indicator
      className={cx(checkboxIndicatorClassName, className)}
      {...props}
    >
      {children ?? "✓"}
    </BaseUICheckbox.Indicator>
  );
}

export const Checkbox = {
  Root: CheckboxRoot,
  Indicator: CheckboxIndicator
};
