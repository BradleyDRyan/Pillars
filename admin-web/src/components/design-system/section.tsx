import type { ComponentPropsWithoutRef, ReactNode } from "react";

type SectionProps = {
  title?: ReactNode | null;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
} & Omit<ComponentPropsWithoutRef<"section">, "children">;

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const sectionClassName = "admin-section bg-[var(--bg-surface)] p-3";
export function Section({
  title,
  children,
  className,
  contentClassName,
  ...props
}: SectionProps) {
  const containerClassName = cx(sectionClassName, className);
  const titleNode = title ? (
    <h3 className="text-sm font-normal text-[var(--ink)]">{title}</h3>
  ) : null;

  return (
    <div className="grid gap-2">
      {titleNode}
      <section
        {...props}
        className={containerClassName}
        style={{ borderRadius: "10px", border: "1px solid var(--border-light)" }}
      >
        <div className={cx("admin-section__content", contentClassName)}>{children}</div>
      </section>
    </div>
  );
}
