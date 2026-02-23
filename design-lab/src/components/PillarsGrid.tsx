import type { CSSProperties } from 'react';
import { motion } from 'motion/react';
import type { PillarGauge } from '../types/lifeBars';
import type { LifeBarsTheme } from '../types/theme';

interface PillarsGridProps {
  pillars: PillarGauge[];
  theme: LifeBarsTheme;
}

const RADIUS = 17;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function PillarsGrid({ pillars, theme }: PillarsGridProps) {
  return (
    <section className="pillars-section">
      <div className="pillars-grid">
        {pillars.map((pillar, index) => {
          const palette = theme.pillars[pillar.color];
          const offset = CIRCUMFERENCE - (pillar.score / 100) * CIRCUMFERENCE;
          const cardStyle = {
            '--pillar-accent': palette.solid,
            '--pillar-glow': palette.glow,
          } as CSSProperties;

          return (
            <motion.article
              key={pillar.id}
              className="pillar-card"
              style={cardStyle}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.045 }}
            >
              <div className="gauge-ring" aria-label={`${pillar.name} ${pillar.score}%`}>
                <svg viewBox="0 0 42 42">
                  <circle className="track" cx="21" cy="21" r={RADIUS} />
                  <circle
                    className="fill"
                    cx="21"
                    cy="21"
                    r={RADIUS}
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={offset}
                  />
                </svg>
                <div className="gauge-icon">{pillar.icon}</div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
