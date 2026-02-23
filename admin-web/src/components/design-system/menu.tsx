"use client";

import { Toolbar } from "@base-ui/react/toolbar";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type ReactNode, type ComponentPropsWithoutRef } from "react";
import { usePathname } from "next/navigation";

type MenuPropsBase = Omit<ComponentPropsWithoutRef<typeof Toolbar.Root>, "className">;
type MenuItemPropsBase = Omit<ComponentPropsWithoutRef<typeof Toolbar.Link>, "children" | "className"> & {
  children: ReactNode;
  icon?: ReactNode;
};
type MenuItemProps = MenuItemPropsBase & { className?: string };
type MenuProps = MenuPropsBase & { className?: string };

type MenuSectionProps = {
  label: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
  className?: string;
  panelClassName?: string;
};

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const menuItemBaseClassName =
  "admin-nav__item block w-full text-left hover:bg-[var(--bg)]";

export function Menu({ className, ...props }: MenuProps) {
  return <Toolbar.Root className={cx("grid gap-4", className)} {...props} />;
}

export function MenuItem({ className, icon, children, ...props }: MenuItemProps) {
  const pathname = usePathname();
  const href = typeof props.href === "string" ? props.href : "";
  const isActive =
    href.length > 0 && (pathname === href || (pathname.startsWith(`${href}/`) && href !== "/"));

  return (
    <Toolbar.Link
      className={cx(
        menuItemBaseClassName,
        isActive ? "admin-nav__item--active" : undefined,
        className
      )}
      {...props}
    >
      {icon ? <span className="admin-nav__item-icon" aria-hidden>{icon}</span> : null}
      <span>{children}</span>
    </Toolbar.Link>
  );
}

export function MenuSection({
  label,
  children,
  defaultOpen = false,
  icon,
  className,
  panelClassName
}: MenuSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        data-panel-open={isOpen ? "true" : "false"}
        aria-disabled="false"
        aria-controls={panelId}
        aria-expanded={isOpen}
        className={cx(
          "admin-nav__section",
          className
        )}
        data-state={isOpen ? "open" : "closed"}
      >
        <span>{label}</span>
        <span aria-hidden className="admin-nav__section-icon text-[var(--ink-subtle)]">
          {icon || <ChevronDown size={12} strokeWidth={2} />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            id={panelId}
            key={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeInOut" }}
            className={cx("grid", "admin-nav__section-panel", panelClassName)}
            style={{ overflow: "hidden" }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
