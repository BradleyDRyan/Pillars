import { AnimatePresence } from 'motion/react';
import type { ActionItem } from '../types/lifeBars';
import type { LifeBarsTheme } from '../types/theme';
import { ActionCard } from './ActionCard';

interface CompletedSectionProps {
  items: ActionItem[];
  theme: LifeBarsTheme;
}

export function CompletedSection({ items, theme }: CompletedSectionProps) {
  return (
    <section className="completed-section">
      <div className="completed-feed">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <ActionCard key={item.id} item={item} done theme={theme} />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
