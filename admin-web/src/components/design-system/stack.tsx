import type { ComponentPropsWithoutRef, ReactNode } from "react";

type StackGap = 1 | 2 | 3 | 4 | 6;
type StackProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  children: ReactNode;
  gap?: StackGap;
};

function gapClass(value: StackGap) {
  return `gap-${value}`;
}

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Stack({ children, gap = 4, className, ...props }: StackProps) {
  return (
    <div
      className={cx("grid", gapClass(gap), className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function InlineStack({ children, gap = 2, className, ...props }: StackProps) {
  return (
    <div
      className={cx("inline-flex flex-wrap items-center", gapClass(gap), className)}
      {...props}
    >
      {children}
    </div>
  );
}

