"use client";

import type { ComponentPropsWithoutRef } from "react";

type AdminSelectBaseProps = Omit<ComponentPropsWithoutRef<"select">, "className">;

type AdminSelectProps = AdminSelectBaseProps & { className?: string };

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const selectBaseClassName =
  "admin-select admin-select__field block w-full h-[30px] min-h-[30px] px-3 text-[13px] leading-[1.7] bg-[var(--input-background)] border border-[var(--input-border)] text-[var(--ink)] outline-none transition-[background-color,border-color,box-shadow,color] duration-150 ease-out" +
  " placeholder:text-[var(--ink-tertiary)] hover:bg-[var(--input-background)] focus:bg-[var(--bg-root)] focus:ring-2 focus:ring-[var(--bg-root)] disabled:cursor-not-allowed disabled:bg-[var(--surface-grouped)] disabled:text-[var(--ink-subtle)]";

const selectStyle = {
  borderRadius: "4px",
  borderWidth: "var(--input-border-width)",
  borderColor: "var(--input-border)",
  boxShadow: "none"
};

export function Select({ className, ...props }: AdminSelectProps) {
  return (
    <select
      className={cx(selectBaseClassName, className)}
      style={selectStyle}
      {...props}
    />
  );
}
