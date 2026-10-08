import React from 'react';
import { useMode } from '../shared/Mode';

/** the faint ⚙ at the top left of the scene, highlighted while expert mode is on: simple mode is what most people need */
export const ExpertToggle: React.FC = () => {
  const { expert, setExpert } = useMode();
  return (
    <button
      className={expert ? 'expert-toggle on' : 'expert-toggle'}
      aria-pressed={expert}
      aria-label='expert mode'
      title={expert ? 'Expert mode: every setting (tap for simple)' : 'Expert mode: every setting'}
      onClick={() => setExpert(!expert)}
    >
      ⚙
    </button>
  );
};
