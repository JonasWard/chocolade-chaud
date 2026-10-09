import React from 'react';
import { ErrorText } from '../shared/Hint';

/** whether the meshes are being generated, and why they couldn't be */
export const SceneStatus: React.FC<{ pending: boolean; error?: string }> = ({ pending, error }) => (
  <div className='status'>
    {pending && <span className='spinner' aria-label='generating' />}
    {error && <ErrorText>{error}</ErrorText>}
  </div>
);
