import type { ComponentPropsWithoutRef, ReactNode } from "react";

type CommonProps = {
  children: ReactNode;
  className?: string;
};

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function PageHeading({ children, className, ...props }: CommonProps & Omit<ComponentPropsWithoutRef<"h1">, "children" | "className">) {
  return (
    <h1
      className={cx("text-3xl font-semibold tracking-tight md:text-4xl", className)}
      {...props}
    >
      {children}
    </h1>
  );
}

export function SectionHeading({
  children,
  className,
  ...props
}: CommonProps & Omit<ComponentPropsWithoutRef<"h3">, "children" | "className">) {
  return (
    <h3
      className={cx("mb-2 text-sm font-normal text-[var(--ink-subtle)]", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function SubtleText({
  children,
  className,
  ...props
}: CommonProps & Omit<ComponentPropsWithoutRef<"p">, "children" | "className">) {
  return (
    <p
      className={cx("text-sm text-[var(--ink-subtle)]", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function NoticeText({
  children,
  className,
  ...props
}: CommonProps & Omit<ComponentPropsWithoutRef<"p">, "children" | "className">) {
  return (
    <p
      className={cx("mono rounded bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--ink)]", className)}
      {...props}
    >
      {children}
    </p>
  );
}

