import { ArrowClockwise, DownloadSimple } from '@phosphor-icons/react';
import { Button } from '../ui/Button';
import { useInstall, type InstallStore } from './install';
import { useUpdate, type UpdateStore } from './updates';
import styles from './Pwa.module.css';

/** "Hay una versión nueva": shown only in the menu, so a race or a class is never reloaded (design D3). */
export function UpdateBanner({ store }: { store: UpdateStore }) {
  const { needRefresh } = useUpdate(store);
  if (!needRefresh) return null;
  return (
    <div className={styles.update} role="status">
      <span>Hay una versión nueva</span>
      <Button size="small" onClick={() => store.applyUpdate()}>
        <ArrowClockwise size={18} aria-hidden />
        Actualizar
      </Button>
    </div>
  );
}

/** "Instalar app", only while the browser offers it (design D4). */
export function InstallButton({ store }: { store: InstallStore }) {
  const { canInstall } = useInstall(store);
  if (!canInstall) return null;
  return (
    <Button variant="secondary" size="small" onClick={() => void store.install()} aria-label="Instalar app">
      <DownloadSimple size={18} aria-hidden />
      <span className={styles.installLabel}>Instalar app</span>
    </Button>
  );
}
