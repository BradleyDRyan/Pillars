import { Circle, Bell, Heart } from "lucide-react";
import { ListGroup, ListItem } from "@/components/design-system";

export const metadata = {
  title: "Design System - List",
  description: "List and list-item composition examples."
};

export default function ListPage() {
  return (
    <main className="fade-in mx-auto w-full max-w-[1240px] px-4 py-8 md:px-8 max-h-[100vh]">
      <section className="surface p-6">
        <h1 className="text-2xl font-semibold tracking-tight">List</h1>
        <p className="mt-2 text-sm text-[var(--ink-subtle)]">
          Use ListGroup and ListItem for compact row-based selectors and navigation.
        </p>

        <div className="mt-4 space-y-4">
          <section className="surface p-4">
            <p className="text-sm font-semibold">List Group</p>
            <p className="mt-1 text-xs text-[var(--ink-subtle)]">Groups rows with shared surface and spacing.</p>
            <div className="mt-3 w-full max-w-sm">
              <ListGroup>
                <ListItem href="/pillars/templates" icon={<Heart size={14} />}>
                  Templates
                </ListItem>
                <ListItem href="/pillars/icons" icon={<Bell size={14} />}>
                  Icons
                </ListItem>
                <ListItem href="/pillars/colors" icon={<Circle size={14} />}>
                  Colors
                </ListItem>
              </ListGroup>
            </div>
          </section>

          <section className="surface p-4">
            <p className="text-sm font-semibold">List Item variants</p>
            <p className="mt-1 text-xs text-[var(--ink-subtle)]">
              Use link and button variants for navigation versus inline actions.
            </p>
            <div className="mt-3 w-full max-w-sm">
              <ListGroup>
                <ListItem href="/pillars/templates/marriage" active>
                  Active link row
                </ListItem>
                <ListItem onClick={() => {}}>
                  Button action row
                </ListItem>
              </ListGroup>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
