import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import '@/i18n';
import { env } from '@/config/env';
import { initMonitoring } from '@/lib/monitoring';
import { App } from './app';

initMonitoring(env.VITE_SENTRY_DSN, import.meta.env.MODE);

const container = document.getElementById('root');
if (!container) throw new Error('The #root element is missing in index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
