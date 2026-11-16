import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { App } from './app';

const container = document.getElementById('root');
if (!container) throw new Error('The #root element is missing in index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
