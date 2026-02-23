import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DialRoot } from 'dialkit';
import App from './App';
import 'dialkit/styles.css';
import './styles/global.css';
import './styles/life-bars.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="base-ui-portal-root">
      <App />
      <DialRoot position="top-right" />
    </div>
  </StrictMode>,
);
