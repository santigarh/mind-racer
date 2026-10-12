import { useEffect, useState } from 'react';
import { ShareNetwork } from '@phosphor-icons/react';
import { Button } from '../ui/Button';
import { canShareOrCopy, shareOrCopy } from '../ui/share';
import { RoomQr } from './RoomQr';
import { roomLink } from './roomLink';
import styles from './Multiplayer.module.css';

const COPIED_MS = 2000;

type Status = 'idle' | 'copied' | 'copy-failed';

/**
 * Share menu where there is one, the clipboard otherwise. Both need HTTPS or localhost, so on the home
 * network over http neither exists: the link is always visible in a field to copy by hand (design D3).
 */
export function ShareRoom({ code }: { code: string }) {
  const url = roomLink(code);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (status !== 'copied') return;
    const timer = setTimeout(() => setStatus('idle'), COPIED_MS);
    return () => clearTimeout(timer);
  }, [status]);

  async function share() {
    const outcome = await shareOrCopy({ title: 'Mind Racer', text: `¡Ven a correr conmigo! Sala ${code}`, url }, url);
    if (outcome === 'copied') setStatus('copied');
    if (outcome === 'failed') setStatus('copy-failed');
  }

  return (
    <div className={styles.share}>
      <RoomQr url={url} />
      <div className={styles.shareLink}>
        <span className={styles.muted}>Escanea el código QR o envía el enlace</span>
        <input
          className={styles.linkInput}
          value={url}
          readOnly
          aria-label="Enlace de la sala"
          onFocus={(e) => e.currentTarget.select()}
        />
        {canShareOrCopy() && (
          <Button variant="secondary" onClick={share}>
            <ShareNetwork size={20} aria-hidden />
            Compartir
          </Button>
        )}
        <p className={styles.shareStatus} role="status">
          {status === 'copied' && 'Enlace copiado'}
          {status === 'copy-failed' && 'No se pudo copiar; selecciona el enlace y cópialo.'}
        </p>
      </div>
    </div>
  );
}
