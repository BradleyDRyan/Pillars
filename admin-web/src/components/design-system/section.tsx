import type { ComponentPropsWithoutRef, ReactNode } from "react";

type SectionProps = {
  title?: ReactNode | null;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
} & Omit<ComponentPropsWithoutRef<"section">, "children" | "title">;

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const sectionClassName = "bg-[var(--bg-surface)] p-2 -m-2";
const defaultTitleClassName = "text-base font-semibold";

export function Section({
  title,
  children,
  className,
  titleClassName,
  contentClassName,
  ...props
}: SectionProps) {
  const showTitle = title !== null && title !== undefined && title !== "";

  return (
    <section {...props} className={cx(sectionClassName, className)}>
      {showTitle ? (
        <header className="mb-3 flex items-center justify-between">
          <h2 className={cx(defaultTitleClassName, titleClassName)}>{title}</h2>
        </header>
      ) : null}
      <div className={cx(contentClassName)}>{children}</div>
    </section>
  );
}
