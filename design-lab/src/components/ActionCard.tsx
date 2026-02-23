import type { CSSProperties, KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import type { ActionItem } from '../types/lifeBars';
import type { LifeBarsTheme } from '../types/theme';

interface ActionCardProps {
  item: ActionItem;
  done: boolean;
  theme: LifeBarsTheme;
  onComplete?: (id: string) => void;
}

export function ActionCard({ item, done, theme, onComplete }: ActionCardProps) {
  const interactive = !done && Boolean(onComplete);
  const tag = theme.pillarTags[item.pillar] ?? theme.pillarTags.default;
  const tagStyle = {
    '--tag-bg': tag.bg,
    '--tag-text': tag.text,
  } as CSSProperties;

  const handleComplete = () => {
    if (!interactive || !onComplete) {
      return;
    }
    onComplete(item.id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!interactive) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleComplete();
    }
  };

  const bountyValue = done
    ? `+${item.bounty}`
    : `${item.bounty}${item.bonus ? ` +${item.bonus}` : ''}`;

  return (
    <motion.article
      layout
      className={`action-card${done ? ' completed' : ''}${interactive ? ' interactive' : ''}`}
      onClick={interactive ? handleComplete : undefined}
      onKeyDown={onKeyDown}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : -1}
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.28 }}
    >
      <button
        type="button"
        className={`action-check${done ? ' is-checked' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          handleComplete();
        }}
        disabled={!interactive}
        aria-label={done ? `${item.text} completed` : `Complete ${item.text}`}
      >
        <span className="action-check-mark" aria-hidden>
          ✓
        </span>
      </button>

      <div className="action-content">
        <div className="action-text">{item.text}</div>
        {!done ? (
          <div className="action-meta">
            <span className="action-pillar" style={tagStyle}>
              {item.pillarLabel}
            </span>
            <span className="action-time">{item.time}</span>
            <span className={`action-type${item.type === 'habit' ? ' habit' : ''}`}>{item.type}</span>
          </div>
        ) : null}
      </div>

      <div className="action-right">
        <div className={`action-bounty${done ? ' earned' : ''}`}>{bountyValue}</div>
        <div className="action-bounty-label">{done ? 'earned' : 'pts'}</div>
      </div>
    </motion.article>
  );
}
