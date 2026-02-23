import { Plus } from "lucide-react";
import { Button, PrimaryButton, TertiaryButton, PageView, PageViewContent, PageViewHeader } from "@/components/design-system";

export const metadata = {
  title: "Design System - Button",
  description: "Button component usage and states."
};

export default function ButtonPage() {
  return (
    <PageView>
      <PageViewHeader>
        <h1 className="text-2xl font-semibold tracking-tight">Button</h1>
      </PageViewHeader>
      <PageViewContent>
        <section className="space-y-4">
          <p className="text-sm text-[var(--ink-subtle)]">
            Use this component for all admin actions that require an interactive button.
          </p>

          <section className="surface p-4">
            <p className="text-sm font-semibold">Default button</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button>Default</Button>
              <Button disabled>Default disabled</Button>
              <Button type="submit">Submit</Button>
            </div>
          </section>

          <section className="surface p-4">
            <p className="text-sm font-semibold">Primary button</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton>Primary</PrimaryButton>
              <PrimaryButton disabled>Primary disabled</PrimaryButton>
            </div>
          </section>

          <section className="surface p-4">
            <p className="text-sm font-semibold">Tertiary button</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <TertiaryButton>Back</TertiaryButton>
              <TertiaryButton disabled>Tertiary disabled</TertiaryButton>
              <TertiaryButton className="inline-flex items-center gap-1.5">
                <Plus size={12} />
                <span>Tertiary with icon</span>
              </TertiaryButton>
            </div>
          </section>

          <section className="surface p-4">
            <p className="text-sm font-semibold">With icon</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton className="inline-flex items-center gap-1.5">
                <Plus size={12} />
                <span>Template</span>
              </PrimaryButton>
              <Button className="inline-flex items-center gap-1.5">
                <Plus size={12} />
                <span>Default with icon</span>
              </Button>
            </div>
          </section>
        </section>
      </PageViewContent>
    </PageView>
  );
}
