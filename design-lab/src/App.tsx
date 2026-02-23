import { useState, type CSSProperties } from 'react';
import { useDialKit } from 'dialkit';
import { ActionCard } from './components/ActionCard';
import { DeviceFrame } from './components/DeviceFrame';
import { HeroSection } from './components/HeroSection';
import { PillarsGrid } from './components/PillarsGrid';
import { CompletedSection } from './components/CompletedSection';
import { StatusBar } from './components/StatusBar';
import { initialLifeBarsModel } from './data/lifeBars.mock';
import { lifeBarsTheme } from './theme/lifeBarsTheme';

function App() {
  const dial = useDialKit('Life Bars', {
    points: [142, 0, 400, 1],
    goal: [200, 50, 400, 1],
    goalProgress: [71, 0, 100, 1],
    bgPrimary: '#f7f7f7',
    cardRadius: [16, 10, 30, 1],
    glowIntensity: [0.12, 0, 0.5, 0.01],
    animationDuration: [0.35, 0.18, 0.9, 0.01],
  });

  const [completedItems, setCompletedItems] = useState(() => [...initialLifeBarsModel.completed]);
  const [upcomingItems, setUpcomingItems] = useState(() => [...initialLifeBarsModel.upcoming]);

  const appStyle = {
    '--bg-primary': dial.bgPrimary,
    '--accent': '#111111',
    '--accent-glow': `rgba(0, 0, 0, ${dial.glowIntensity})`,
    '--card-radius': `${dial.cardRadius}px`,
    '--anim-duration': `${dial.animationDuration}s`,
  } as CSSProperties;

  const completeUpcomingItem = (id: string) => {
    setUpcomingItems((currentUpcoming) => {
      const matched = currentUpcoming.find((item) => item.id === id);
      if (!matched) {
        return currentUpcoming;
      }

      setCompletedItems((currentCompleted) => [matched, ...currentCompleted]);
      return currentUpcoming.filter((item) => item.id !== id);
    });
  };

  return (
    <div className="life-bars-view" style={appStyle}>
      <DeviceFrame>
        <StatusBar />

        <main className="main-content">
          <HeroSection
            points={dial.points}
            goal={dial.goal}
            goalProgress={dial.goalProgress}
            completedCount={completedItems.length}
          />
          <PillarsGrid pillars={initialLifeBarsModel.pillars} theme={lifeBarsTheme} />
          <CompletedSection items={completedItems} theme={lifeBarsTheme} />

          <section className="completed-section">
            <div className="completed-feed">
              {upcomingItems.length === 0 ? (
                <div className="sheet-empty">Everything is complete. Nice work.</div>
              ) : (
                upcomingItems.map((item) => (
                  <ActionCard
                    key={item.id}
                    item={item}
                    done={false}
                    theme={lifeBarsTheme}
                    onComplete={completeUpcomingItem}
                  />
                ))
              )}
            </div>
          </section>
        </main>
      </DeviceFrame>
    </div>
  );
}

export default App;
