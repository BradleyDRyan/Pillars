"use client";

import { Button as BaseUIButton } from "@base-ui/react/button";
import type { CSSProperties, ComponentPropsWithoutRef } from "react";

type AdminButtonVisualType = "default" | "primary";

type AdminButtonBaseProps = Omit<
  ComponentPropsWithoutRef<typeof BaseUIButton>,
  "className" | "type"
>;

type AdminButtonProps = AdminButtonBaseProps & {
  className?: string;
  type?: AdminButtonVisualType;
  buttonType?: "button" | "submit" | "reset";
};

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const buttonBaseClassName =
  "inline-flex items-center justify-center px-2 py-0.5 border disabled:cursor-not-allowed disabled:opacity-60 hover:bg-[var(--button-bg-hover)]";

const buttonPrimaryClassName =
  "mono cursor-pointer border border-[var(--line-strong)] bg-[var(--bg)] px-2 py-0.5 text-[var(--ink)] hover:bg-[var(--bg-elevated)]";

export function Button({
  type = "default",
  buttonType = "button",
  className,
  ...props
}: AdminButtonProps) {
  const isPrimary = type === "primary";
  const classNames = cx(
    buttonBaseClassName,
    isPrimary ? buttonPrimaryClassName : undefined,
    className
  );

  const style: CSSProperties = {
    backgroundColor: isPrimary ? "var(--primary)" : "var(--button-bg)",
    color: isPrimary ? "var(--on-primary)" : "var(--button-text)",
    borderColor: isPrimary ? "var(--primary)" : "var(--button-border-color)",
    borderWidth: isPrimary ? "1px" : "var(--button-border-width)",
    borderRadius: "var(--button-radius)",
    boxShadow: "var(--button-shadow)",
    fontSize: "13px",
    fontWeight: "500"
  };

  return <BaseUIButton type={buttonType} className={classNames} style={style} {...props} />;
}

export function PrimaryButton({
  className,
  buttonType,
  ...props
}: Omit<AdminButtonProps, "type"> & { className?: string }) {
  return (
    <Button
      type="primary"
      className={cx(buttonPrimaryClassName, className)}
      buttonType={buttonType}
      {...props}
    />
  );
}
