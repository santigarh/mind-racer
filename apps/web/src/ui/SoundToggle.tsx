import { SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { settingsStore, useSettings, type SettingsStore } from '../settings/settings';
import { Button } from './Button';
import styles from './SoundToggle.module.css';

/** Mutes sound and vibration everywhere; the choice is remembered on this device (design D7). */
export function SoundToggle({ store = settingsStore }: { store?: SettingsStore }) {
  const { sound } = useSettings(store);
  return (
    <Button
      variant="ghost"
      size="small"
      className={styles.toggle}
      aria-label="Silenciar"
      aria-pressed={!sound}
      title={sound ? 'Silenciar' : 'Activar sonido'}
      onClick={() => store.set({ sound: !sound })}
    >
      {sound ? <SpeakerHigh size={20} aria-hidden /> : <SpeakerSlash size={20} aria-hidden />}
    </Button>
  );
}
