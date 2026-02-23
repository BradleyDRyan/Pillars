"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

const rootClassName = "admin-page-view fade-in";
const titleClassName = "admin-page-view__title";
const contentClassName = "admin-page-view__content";
const toolbarClassName = "admin-page-view__toolbar";

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function PageView({ children, className, ...props }: ComponentPropsWithoutRef<"main">) {
  return (
    <main
      className={cx(rootClassName, className)}
      {...props}
    >
      {children}
    </main>
  );
}

export function PageViewTitle({ children, className, ...props }: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cx(titleClassName, className)}
      {...props}
    >
      {children}
    </section>
  );
}

type PageViewToolbarProps = {
  back?: ReactNode;
  actions?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"section">, "children">;

export function PageViewToolbar({
  back,
  actions,
  className,
  ...props
}: PageViewToolbarProps) {
  return (
    <section
      className={cx(toolbarClassName, className)}
      {...props}
    >
      {back ? <div className="admin-page-view__back">{back}</div> : null}
      {actions ? <div className="admin-page-view__toolbar-actions">{actions}</div> : null}
    </section>
  );
}

export function PageViewContent({ children, className, ...props }: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cx(contentClassName, className)}
      {...props}
    >
      {children}
    </section>
  );
}
