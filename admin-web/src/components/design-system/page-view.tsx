"use client";

import type { ComponentPropsWithoutRef } from "react";

const rootClassName =
  "fade-in mx-auto w-full max-w-[1240px] max-h-[calc(100vh-2rem)] overflow-y-auto";
const headerClassName = "admin-page-view__header";

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

export function PageViewHeader({ children, className, ...props }: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cx(headerClassName, "pb-6", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function PageViewContent({ children, className, ...props }: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cx(className)}
      {...props}
    >
      {children}
    </section>
  );
}
