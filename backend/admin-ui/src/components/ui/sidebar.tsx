import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type SidebarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function SidebarProvider({
  defaultOpen = true,
  children
}: {
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  const toggleSidebar = React.useCallback(() => {
    setOpen(prev => !prev);
  }, []);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleSidebar]);

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      toggleSidebar
    }),
    [open, toggleSidebar]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export const useSidebar = () => {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
};

export type SidebarProps = React.HTMLAttributes<HTMLElement> & {
  collapsible?: "none" | "icon";
};

export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  ({ className, collapsible = "icon", children, ...props }, ref) => {
    const { open } = useSidebar();
    const isIconMode = collapsible === "icon" && !open;

    return (
      <aside
        ref={ref}
        className={cn(
          "hidden h-screen shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out md:flex",
          open ? "w-64" : "w-16",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "flex h-full w-full flex-col gap-4 p-3",
            isIconMode ? "items-center px-2" : "px-3"
          )}
        >
          {children}
        </div>
      </aside>
    );
  }
);
Sidebar.displayName = "Sidebar";

export const SidebarRail = ({ className }: { className?: string }) => {
  const { open, toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
      onClick={toggleSidebar}
      className={cn(
        "absolute -right-3 top-4 hidden h-7 w-7 rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow transition hover:bg-sidebar-accent md:flex items-center justify-center",
        className
      )}
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  );
};

export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center gap-2 rounded-md border border-transparent bg-transparent px-2 py-1",
      className
    )}
    {...props}
  />
));
SidebarHeader.displayName = "SidebarHeader";

export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-y-auto px-1", className)}
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";

export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mt-auto px-2 pb-1 pt-2 text-xs text-muted-foreground", className)}
    {...props}
  />
));
SidebarFooter.displayName = "SidebarFooter";

export const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("space-y-2 px-1", className)}
    {...props}
  />
));
SidebarGroup.displayName = "SidebarGroup";

export const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground",
      className
    )}
    {...props}
  />
));
SidebarGroupLabel.displayName = "SidebarGroupLabel";

export const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("space-y-1", className)}
    {...props}
  />
));
SidebarGroupContent.displayName = "SidebarGroupContent";

export const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md border border-sidebar-border text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
      className
    )}
    {...props}
  />
));
SidebarGroupAction.displayName = "SidebarGroupAction";

export const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("space-y-1", className)}
    {...props}
  />
));
SidebarMenu.displayName = "SidebarMenu";

export const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.LiHTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("list-none", className)} {...props} />
));
SidebarMenuItem.displayName = "SidebarMenuItem";

type SidebarMenuButtonProps = React.ComponentPropsWithoutRef<typeof Slot> & {
  asChild?: boolean;
  isActive?: boolean;
};

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(({ className, asChild = false, isActive = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref as any}
      className={cn(
        "group inline-flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring",
        isActive && "bg-sidebar-accent/80 text-sidebar-foreground",
        className
      )}
      {...props}
    />
  );
});
SidebarMenuButton.displayName = "SidebarMenuButton";

export const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex h-8 w-8 items-center justify-center rounded-md text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-foreground",
      className
    )}
    {...props}
  />
));
SidebarMenuAction.displayName = "SidebarMenuAction";

export const SidebarMenuBadge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "ml-auto inline-flex items-center rounded-full bg-sidebar-accent px-2 py-0.5 text-xs font-medium text-sidebar-accent-foreground",
      className
    )}
    {...props}
  />
));
SidebarMenuBadge.displayName = "SidebarMenuBadge";

export const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      ref={ref}
      type="button"
      onClick={toggleSidebar}
      aria-label="Toggle sidebar"
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-sm font-medium shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";

export const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-1 flex-col", className)}
    {...props}
  />
));
SidebarInset.displayName = "SidebarInset";

export const SidebarMenuSkeleton = ({
  showIcon = false,
  className
}: {
  showIcon?: boolean;
  className?: string;
}) => (
  <div
    className={cn(
      "flex items-center gap-2 rounded-md bg-sidebar-accent/60 px-2 py-2 text-sm text-sidebar-foreground/60",
      className
    )}
  >
    {showIcon && <div className="h-4 w-4 rounded-sm bg-sidebar-border" />}
    <div className="h-3 flex-1 rounded-sm bg-sidebar-border" />
  </div>
);
