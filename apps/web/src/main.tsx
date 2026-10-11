import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { sfx } from './audio/sfx';
import './styles/global.css';

// Browsers only let audio start from a user gesture: the first tap, click or key turns it on.
sfx.unlockOnFirstInteraction();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <a className="skip-link" href="#main">
      Saltar al contenido
    </a>
    <App />
  </StrictMode>,
);
