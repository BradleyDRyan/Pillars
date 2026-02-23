import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type ListGroupProps = {
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"div">, "children">;

type BaseListRowProps = {
  children: ReactNode;
  active?: boolean;
  isActive?: boolean;
  className?: string;
  icon?: ReactNode;
};

type ListRowLinkProps = BaseListRowProps &
  Omit<ComponentPropsWithoutRef<"a">, "children" | "className" | "role"> & {
    href: string;
  };

type ListRowButtonProps = BaseListRowProps &
  Omit<ComponentPropsWithoutRef<"button">, "children" | "type" | "className"> & {
    href?: never;
    buttonType?: "button" | "submit" | "reset";
  };

export type ListRowProps = ListRowLinkProps | ListRowButtonProps;

function isListRowLink(props: ListRowProps): props is ListRowLinkProps {
  return "href" in props && Boolean(props.href);
}

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const listGroupClassName = "grid gap-1";

const baseListRowClassName =
  "inline-flex w-full items-center justify-between rounded-[5px] border border-transparent px-3 text-left text-sm font-medium text-[var(--ink)] h-8 min-h-8 transition-colors";

export function ListGroup({ children, className, ...props }: ListGroupProps) {
  return (
    <div {...props} className={cx(listGroupClassName, className)}>
      {children}
    </div>
  );
}

export function ListRow({
  children,
  active,
  isActive,
  className,
  icon,
  ...props
}: ListRowProps) {
  const selected = active ?? isActive;
  const rowClassName = cx(
    baseListRowClassName,
    selected
      ? "border-[var(--line-strong)] bg-[var(--on-grouped-background-tertiary)]"
      : "hover:bg-[var(--on-grouped-background-tertiary)]",
    className
  );

  if (isListRowLink(props)) {
    return (
      <a
        className={rowClassName}
        {...props}
      >
        <span className="inline-flex w-full items-center gap-2">
          {icon ? (
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[var(--ink-subtle)]">
              {icon}
            </span>
          ) : null}
          <span className="inline-flex min-w-0 flex-1 items-center">{children}</span>
        </span>
      </a>
    );
  }

  const buttonProps = props as ListRowButtonProps;
  return (
    <button
      type={buttonProps.buttonType ?? "button"}
      className={rowClassName}
      {...buttonProps}
    >
      <span className="inline-flex w-full items-center gap-2">
        {icon ? (
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[var(--ink-subtle)]">
            {icon}
          </span>
        ) : null}
        <span className="inline-flex min-w-0 flex-1 items-center">{children}</span>
      </span>
    </button>
  );
}
