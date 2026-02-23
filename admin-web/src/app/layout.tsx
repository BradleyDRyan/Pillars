import type { Metadata } from "next";
import { Menu, MenuItem, MenuSection } from "@/components/design-system";
import {
  Database,
  LayoutGrid,
  Shapes,
  Pointer,
  Pencil,
  List,
  FileText,
  Palette,
  AppWindow
} from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pillars Admin",
  description: "Schema control plane for Pillars"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="admin-shell admin-shell__root">
          <aside
            className="admin-shell__sidebar"
            data-ui="admin-shell"
            data-ui-region="sidebar"
          >
            <nav className="admin-shell__nav" data-ui="admin-shell-nav">
              <p
                className="admin-shell__title mb-2 px-2 text-sm font-semibold tracking-wide text-[var(--ink-subtle)]"
                data-ui="admin-shell-title"
              >
                Admin
              </p>
              <Menu>
                <MenuItem
                  icon={<Database size={14} strokeWidth={2} />}
                  className="admin-nav__item admin-nav__item--schemas"
                  href="/schemas"
                  data-ui="admin-nav-schemas"
                >
                  Schemas
                </MenuItem>
                <MenuSection className="admin-nav__section" label={<span data-ui="admin-nav-label-design-system">Design System</span>} defaultOpen>
                  <MenuItem
                    icon={<Shapes size={14} strokeWidth={2} />}
                    className="admin-nav__item admin-nav__item--components"
                    href="/design-system/components"
                    data-ui="admin-nav-design-components"
                  >
                    Components
                  </MenuItem>
                  <MenuItem
                    icon={<Pointer size={14} strokeWidth={2} />}
                    className="admin-nav__item admin-nav__item--button"
                    href="/design-system/button"
                    data-ui="admin-nav-design-button"
                  >
                    Button
                  </MenuItem>
                  <MenuItem
                    icon={<Pencil size={14} strokeWidth={2} />}
                    className="admin-nav__item admin-nav__item--input"
                    href="/design-system/input"
                    data-ui="admin-nav-design-input"
                  >
                    Input
                  </MenuItem>
                  <MenuItem
                    icon={<LayoutGrid size={14} strokeWidth={2} />}
                    className="admin-nav__item admin-nav__item--section"
                    href="/design-system/section"
                    data-ui="admin-nav-design-section"
                  >
                    Section
                  </MenuItem>
                  <MenuItem
                    icon={<List size={14} strokeWidth={2} />}
                    className="admin-nav__item admin-nav__item--menu"
                    href="/design-system/menu"
                    data-ui="admin-nav-design-menu"
                  >
                    Menu
                  </MenuItem>
                  <MenuItem
                    icon={<List size={14} strokeWidth={2} />}
                    className="admin-nav__item admin-nav__item--list"
                    href="/design-system/list"
                    data-ui="admin-nav-design-list"
                  >
                    List
                  </MenuItem>
                </MenuSection>
                <MenuSection className="admin-nav__section" label={<span data-ui="admin-nav-label-pillars">Pillars</span>} defaultOpen>
                  <MenuItem
                    icon={<FileText size={14} strokeWidth={2} />}
                    className="admin-nav__item admin-nav__item--templates"
                    href="/pillars/templates"
                    data-ui="admin-nav-pillars-templates"
                  >
                    Templates
                  </MenuItem>
                  <MenuItem
                    icon={<AppWindow size={14} strokeWidth={2} />}
                    className="admin-nav__item admin-nav__item--icons"
                    href="/pillars/icons"
                    data-ui="admin-nav-pillars-icons"
                  >
                    Icons
                  </MenuItem>
                  <MenuItem
                    icon={<Palette size={14} strokeWidth={2} />}
                    className="admin-nav__item admin-nav__item--colors"
                    href="/pillars/colors"
                    data-ui="admin-nav-pillars-colors"
                  >
                    Colors
                  </MenuItem>
                </MenuSection>
              </Menu>
            </nav>
          </aside>
          <div
            className="admin-shell__content"
            data-ui="admin-shell-content"
          >
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
