import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type ListGroupProps = {
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"div">, "children">;

type BaseListItemProps = {
  children: ReactNode;
  active?: boolean;
  isActive?: boolean;
  className?: string;
  icon?: ReactNode;
};

type ListItemLinkProps = BaseListItemProps &
  Omit<ComponentPropsWithoutRef<"a">, "children" | "className" | "role"> & {
    href: string;
  };

type ListItemButtonProps = BaseListItemProps &
  Omit<ComponentPropsWithoutRef<"button">, "children" | "type" | "className"> & {
    href?: never;
    buttonType?: "button" | "submit" | "reset";
  };

export type ListItemProps = ListItemLinkProps | ListItemButtonProps;
export type ListRowProps = ListItemProps;

function isListItemLink(props: ListItemProps): props is ListItemLinkProps {
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

export function ListItem({
  children,
  active,
  isActive,
  className,
  icon,
  ...props
}: ListItemProps) {
  const selected = active ?? isActive;
  const rowClassName = cx(
    baseListRowClassName,
    selected
      ? "border-[var(--line-strong)] bg-[var(--on-grouped-background-tertiary)]"
      : "hover:bg-[var(--on-grouped-background-tertiary)]",
    className
  );

  if (isListItemLink(props)) {
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

  const buttonProps = props as ListItemButtonProps;
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

export function ListRow(props: ListRowProps) {
  return <ListItem {...props} />;
}
