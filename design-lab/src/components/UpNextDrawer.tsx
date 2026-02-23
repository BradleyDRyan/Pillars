import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ActionItem } from '../types/lifeBars';
import type { LifeBarsTheme } from '../types/theme';
import { ActionCard } from './ActionCard';

interface UpNextDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ActionItem[];
  onComplete: (id: string) => void;
  totalPoints: number;
  theme: LifeBarsTheme;
  animationDuration: number;
}

export function UpNextDrawer({
  open,
  onOpenChange,
  items,
  onComplete,
  totalPoints,
  theme,
  animationDuration,
}: UpNextDrawerProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <>
      <div className="upnext-trigger-wrap">
        <button type="button" className="upnext-trigger" onClick={() => onOpenChange(true)}>
          <span className="upnext-trigger-title">Up Next</span>
          <span className="upnext-trigger-points">{totalPoints} pts available</span>
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              className="sheet-overlay"
              aria-label="Close up next drawer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: animationDuration * 0.8 }}
              onClick={() => onOpenChange(false)}
            />
            <motion.section
              className="bottom-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="up-next-title"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: animationDuration, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="sheet-handle-area">
                <div className="sheet-handle" />
              </div>

              <header className="sheet-header">
                <div>
                  <h2 id="up-next-title" className="sheet-title">
                    Up Next
                  </h2>
                  <div className="sheet-count">
                    <strong>{totalPoints}</strong> pts available
                  </div>
                </div>
                <button
                  type="button"
                  className="sheet-close"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </header>

              <div className="sheet-body">
                {items.length === 0 ? (
                  <div className="sheet-empty">Everything is complete. Nice work.</div>
                ) : (
                  items.map((item) => (
                    <ActionCard
                      key={item.id}
                      item={item}
                      done={false}
                      theme={theme}
                      onComplete={onComplete}
                    />
                  ))
                )}
              </div>
            </motion.section>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
