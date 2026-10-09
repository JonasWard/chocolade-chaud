import React from 'react';

// texts under the controls: a muted hint and an error

export const Hint: React.FC<{ children: React.ReactNode; inline?: boolean }> = ({ children, inline }) =>
  inline ? <span className='hint'>{children}</span> : <p className='hint'>{children}</p>;

export const ErrorText: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className='error'>{children}</span>;
