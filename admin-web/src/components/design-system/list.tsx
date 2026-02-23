import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type ListSize = "sm" | "md" | "lg";

export type ListGroupProps = {
  children: ReactNode;
  className?: string;
  divider?: boolean;
} & Omit<ComponentPropsWithoutRef<"div">, "children">;

type BaseListItemProps = {
  children: ReactNode;
  active?: boolean;
  isActive?: boolean;
  className?: string;
  icon?: ReactNode;
  size?: ListSize;
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
export type ListCardProps = Omit<ComponentPropsWithoutRef<"article">, "children"> & {
  children: ReactNode;
};

function isListItemLink(props: ListItemProps): props is ListItemLinkProps {
  return "href" in props && Boolean(props.href);
}

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const listGroupClassName = "admin-list grid gap-[1px]";
const listGroupDividedClassName = "admin-list--divided gap-0 divide-y divide-[var(--line)]";

const baseListRowClassName =
  "admin-list-row inline-flex w-full items-center justify-between border border-transparent px-1.5 text-left font-medium text-[var(--ink)] transition-colors";

function listSizeClass(size: ListSize) {
  if (size === "sm") {
    return "h-7 min-h-7 text-xs px-[6px]";
  }
  if (size === "lg") {
    return "h-9 min-h-9 text-[14px] px-2";
  }
  return "h-8 min-h-8 text-[13px]";
}

export function ListGroup({ children, className, ...props }: ListGroupProps) {
  const { divider, ...groupProps } = props;

  return (
    <div
      {...groupProps}
      className={cx(
        listGroupClassName,
        divider ? listGroupDividedClassName : null,
        className
      )}
    >
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
  size = "md",
  ...props
}: ListItemProps) {
  const selected = active ?? isActive;
  const rowClassName = cx(
    baseListRowClassName,
    listSizeClass(size),
    selected
      ? "admin-list-row--active border-[var(--line-strong)]"
      : "admin-list-row--default hover:bg-[var(--on-hover)]",
    className
  );
  const rowStyle = { borderRadius: "8px" };

  if (isListItemLink(props)) {
    return (
      <a
        className={rowClassName}
        style={rowStyle}
        {...props}
      >
        <span className="admin-list-row__content inline-flex w-full items-center gap-2">
        {icon ? (
            <span className="admin-list-row__icon inline-flex h-4 w-4 shrink-0 items-center justify-center text-[var(--on-surface-secondary)]">
              {icon}
            </span>
          ) : null}
          <span className="admin-list-row__label inline-flex min-w-0 flex-1 items-center">{children}</span>
        </span>
    </a>
  );
  }

  const buttonProps = props as ListItemButtonProps;
  return (
      <button
        type={buttonProps.buttonType ?? "button"}
        className={rowClassName}
        style={rowStyle}
        {...buttonProps}
      >
      <span className="admin-list-row__content inline-flex w-full items-center gap-2">
        {icon ? (
          <span className="admin-list-row__icon inline-flex h-4 w-4 shrink-0 items-center justify-center text-[var(--on-surface-secondary)]">
            {icon}
          </span>
        ) : null}
        <span className="admin-list-row__label inline-flex min-w-0 flex-1 items-center">{children}</span>
      </span>
    </button>
  );
}

export function ListRow(props: ListRowProps) {
  return <ListItem {...props} />;
}

export function ListCard({ children, className, ...props }: ListCardProps) {
  return (
    <article
      className={cx(
        "rounded-md border border-[var(--line)] bg-[var(--bg)] p-3",
        className
      )}
      {...props}
    >
      {children}
    </article>
  );
}
