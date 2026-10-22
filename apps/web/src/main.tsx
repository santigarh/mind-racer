import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { sfx } from './audio/sfx';
import { createInstallStore } from './pwa/install';
import { createUpdateStore } from './pwa/updates';
// Fonts served by the game itself, so they work offline and on networks that block Google Fonts (design D6).
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles/global.css';

// Browsers only let audio start from a user gesture: the first tap, click or key turns it on.
sfx.unlockOnFirstInteraction();

// Before rendering: the browser's install offer can arrive before the first render (design D4).
const install = createInstallStore();
// Installable app that opens offline; a new version waits for the menu (spec installable-app).
const updates = createUpdateStore({ registerSW });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <a className="skip-link" href="#main">
      Saltar al contenido
    </a>
    <App updates={updates} install={install} />
  </StrictMode>,
);
