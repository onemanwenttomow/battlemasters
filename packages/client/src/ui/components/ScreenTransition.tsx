import { useState, useEffect, useRef, type ReactNode } from 'react';
import styles from './ScreenTransition.module.css';

interface ScreenTransitionProps {
  screenKey: string;
  children: ReactNode;
}

export function ScreenTransition({ screenKey, children }: ScreenTransitionProps) {
  const [displayedKey, setDisplayedKey] = useState(screenKey);
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const [phase, setPhase] = useState<'entering' | 'visible' | 'exiting'>('entering');
  const prevKey = useRef(screenKey);

  useEffect(() => {
    if (screenKey !== prevKey.current) {
      // Screen changed — start exit animation
      setPhase('exiting');
      const timer = setTimeout(() => {
        // Swap content and start enter animation
        prevKey.current = screenKey;
        setDisplayedKey(screenKey);
        setDisplayedChildren(children);
        setPhase('entering');
        // Clear entering state after animation
        const enterTimer = setTimeout(() => setPhase('visible'), 350);
        return () => clearTimeout(enterTimer);
      }, 250);
      return () => clearTimeout(timer);
    } else {
      // Same screen — just update children in place
      setDisplayedChildren(children);
    }
  }, [screenKey, children]);

  const className = [
    styles.wrapper,
    phase === 'entering' ? styles.entering : '',
    phase === 'exiting' ? styles.exiting : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} key={displayedKey}>
      {displayedChildren}
    </div>
  );
}
