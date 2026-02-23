"use client";

import { Button as BaseUIButton } from "@base-ui/react/button";
import type { CSSProperties, ComponentPropsWithoutRef } from "react";

type ButtonVisualType = "default" | "primary" | "tertiary";
type ButtonClassName = ComponentPropsWithoutRef<typeof BaseUIButton>["className"];
type NativeButtonType = NonNullable<ComponentPropsWithoutRef<typeof BaseUIButton>["type"]>;
type ButtonStyle = ComponentPropsWithoutRef<typeof BaseUIButton>["style"];
type ButtonStyleFn = Extract<NonNullable<ButtonStyle>, (...args: any[]) => any>;
type ButtonState = Parameters<ButtonStyleFn>[0];

type AdminButtonBaseProps = Omit<
  ComponentPropsWithoutRef<typeof BaseUIButton>,
  "className" | "type"
>;

type AdminButtonProps = AdminButtonBaseProps & {
  className?: ButtonClassName;
  variant?: ButtonVisualType;
  type?: NativeButtonType;
  buttonType?: NativeButtonType;
};

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function mergeButtonClassName(
  baseClassName: string,
  className: ButtonClassName
): ButtonClassName {
  if (!className) {
    return baseClassName;
  }
  if (typeof className === "string") {
    return cx(baseClassName, className);
  }

  return (state) => cx(baseClassName, className(state));
}

const buttonBaseClassName =
  "inline-flex min-h-8 cursor-pointer items-center justify-center px-[14px] py-0 border disabled:cursor-not-allowed disabled:opacity-60";

const buttonPrimaryClassName =
  "mono cursor-pointer text-sm bg-[var(--button-primary)] text-[var(--on-button-primary)] hover:bg-[var(--button-primary-hover)]";

const buttonTertiaryClassName =
  "bg-[var(--button-tertiary)] border-transparent shadow-none text-[var(--on-button-tertiary)] text-sm hover:bg-[var(--tertiary-hover)] hover:text-[var(--ink)]";

const buttonDefaultClassName =
  "mono cursor-pointer text-sm bg-[var(--button-default)] text-[var(--on-button-default)] hover:bg-[var(--button-default-hover)]";

export function Button({
  variant = "default",
  type = "button",
  buttonType,
  className,
  style: styleOverride,
  ...props
}: AdminButtonProps) {
  const resolvedNativeType = buttonType ?? type;
  const isPrimary = variant === "primary";
  const isTertiary = variant === "tertiary";
  const classNames = cx(
    buttonBaseClassName,
    isPrimary
      ? buttonPrimaryClassName
      : isTertiary
        ? buttonTertiaryClassName
        : buttonDefaultClassName
  );

  const baseStyle: CSSProperties = {
    borderColor: isPrimary
      ? "var(--button-primary)"
      : isTertiary
        ? "transparent"
        : "var(--button-border)",
    borderWidth: isTertiary ? "0px" : "var(--button-border-width)",
    borderRadius: "var(--button-radius)",
    minHeight: "32px",
    height: "32px",
    boxSizing: "border-box",
    lineHeight: "normal",
    fontFamily: "var(--font-sans), system-ui, sans-serif",
    boxShadow: isTertiary ? "none" : "var(--button-shadow)",
    fontSize: "14px",
    fontWeight: "500"
  };

  const mergedStyle =
    typeof styleOverride === "function"
      ? (state: ButtonState) => {
          const computed = styleOverride(state) || {};
          return { ...baseStyle, ...computed };
        }
      : styleOverride
        ? { ...baseStyle, ...styleOverride }
        : baseStyle;

  const mergedClassName = mergeButtonClassName(classNames, className);
  const baseProps = props as Omit<AdminButtonBaseProps, "className" | "type" | "style" | "buttonType">;

  return (
    <BaseUIButton
      type={resolvedNativeType}
      className={mergedClassName}
      style={mergedStyle}
      {...baseProps}
    />
  );
}

export function PrimaryButton({
  className,
  buttonType,
  ...props
}: Omit<AdminButtonProps, "variant"> & { className?: string }) {
  return (
    <Button
      variant="primary"
      className={cx(buttonPrimaryClassName, className)}
      buttonType={buttonType}
      {...props}
    />
  );
}

export function TertiaryButton({
  className,
  buttonType,
  ...props
}: Omit<AdminButtonProps, "variant"> & { className?: string }) {
  return (
    <Button
      variant="tertiary"
      className={cx(buttonTertiaryClassName, className)}
      buttonType={buttonType}
      {...props}
    />
  );
}
