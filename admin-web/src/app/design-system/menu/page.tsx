import { Menu, MenuItem, MenuSection } from "@/components/design-system";

export const metadata = {
  title: "Design System - Menu",
  description: "Menu, MenuItem, and MenuSection usage examples."
};

export default function MenuPage() {
  return (
    <main className="fade-in mx-auto w-full max-w-[1240px] px-4 py-8 md:px-8 max-h-[100vh]">
      <section className="surface p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Menu</h1>
        <p className="mt-2 text-sm text-[var(--ink-subtle)]">
          Navigation primitives for sidebars and grouped menus.
        </p>

        <div className="mt-4 space-y-3">
          <div className="surface p-4">
            <p className="text-sm font-semibold">Example</p>
            <div className="mt-3 w-full max-w-sm">
              <Menu>
                <MenuSection label="Primitives" defaultOpen>
                  <MenuItem href="/design-system/button">Button</MenuItem>
                  <MenuItem href="/design-system/input">Input</MenuItem>
                  <MenuItem href="/design-system/menu">Menu</MenuItem>
                </MenuSection>
              </Menu>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
