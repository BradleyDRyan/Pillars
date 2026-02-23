"use client";

import { Input as BaseUIInput } from "@base-ui/react/input";
import type { ComponentPropsWithoutRef } from "react";

type AdminInputBaseProps = Omit<ComponentPropsWithoutRef<typeof BaseUIInput>, "className">;

type AdminInputProps = AdminInputBaseProps & { className?: string };

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const inputBaseClassName =
  "admin-input block w-full h-[30px] min-h-[30px] px-3 text-[13px] leading-[1.7] bg-[var(--bg)] text-[var(--ink)] outline-none transition-[background-color,border-color,box-shadow,color] duration-150 ease-out" +
  " placeholder:text-[var(--ink-subtle)] hover:bg-[var(--bg)] focus:bg-[var(--bg-root)] focus:ring-2 focus:ring-[var(--bg-root)] disabled:cursor-not-allowed disabled:bg-[var(--surface-grouped)] disabled:text-[var(--ink-subtle)]";

const inputStyle = {
  borderRadius: "4px",
  border: "0",
  boxShadow: "none"
};

export function Input({ className, ...props }: AdminInputProps) {
  return (
    <BaseUIInput
      className={cx(inputBaseClassName, className)}
      style={inputStyle}
      {...props}
    />
  );
}
