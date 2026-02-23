import { motion } from 'motion/react';

interface HeroSectionProps {
  points: number;
  goal: number;
  goalProgress: number;
  completedCount: number;
}

export function HeroSection({ points, goal, goalProgress, completedCount }: HeroSectionProps) {
  const progress = Math.max(0, Math.min(100, goalProgress));

  return (
    <motion.section
      className="hero"
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className="hero-points">
        {Math.round(points)}
        <span className="hero-unit">pts</span>
      </div>

      <div className="hero-goal">
        <div className="goal-track">
          <div className="goal-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="goal-meta">
          <span className="goal-label">{completedCount} completed</span>
          <span className="goal-target">
            Goal: <strong>{Math.round(goal)}</strong>
          </span>
        </div>
      </div>
    </motion.section>
  );
}
