import React from 'react';
import ReactDOM from 'react-dom/client';
import './ui.css';
import App from './App';

// safari ignores user-scalable=no in the viewport, its own pinch gestures zoom the page unless they are cancelled
for (const gesture of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(gesture, (e) => e.preventDefault());
// nor the page on a desktop: a pinch on a trackpad is a wheel with ctrl (the scene zooms itself before it gets here), and ctrl or cmd
// with + or -
document.addEventListener('wheel', (e) => e.ctrlKey && e.preventDefault(), { passive: false });
document.addEventListener('keydown', (e) => (e.ctrlKey || e.metaKey) && ['+', '-', '=', '_'].includes(e.key) && e.preventDefault());

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
