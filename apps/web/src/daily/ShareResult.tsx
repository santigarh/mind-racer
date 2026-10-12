import { useEffect, useState } from 'react';
import { ShareNetwork } from '@phosphor-icons/react';
import { Button } from '../ui/Button';
import { canShareOrCopy, shareOrCopy } from '../ui/share';
import styles from './Daily.module.css';

const COPIED_MS = 2000;

/** "Compartir resultado": share menu, clipboard, or the text in a field to copy by hand (design D6). */
export function ShareResult({ text, size = 'normal' }: { text: string; size?: 'normal' | 'large' }) {
  const url = `${window.location.origin}/`;
  const full = `${text}\n${url}`;
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>(() => (canShareOrCopy() ? 'idle' : 'manual'));

  useEffect(() => {
    if (status !== 'copied') return;
    const timer = setTimeout(() => setStatus('idle'), COPIED_MS);
    return () => clearTimeout(timer);
  }, [status]);

  async function share() {
    const outcome = await shareOrCopy({ title: 'Mind Racer', text, url }, full);
    if (outcome === 'copied') setStatus('copied');
    if (outcome === 'failed' || outcome === 'unavailable') setStatus('manual');
  }

  return (
    <div className={styles.share}>
      {status !== 'manual' && (
        <Button size={size} onClick={share}>
          <ShareNetwork size={20} weight="bold" aria-hidden />
          Compartir resultado
        </Button>
      )}
      {status === 'manual' && (
        <textarea
          className={styles.shareText}
          value={full}
          readOnly
          rows={4}
          aria-label="Resultado para copiar"
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
      <p className={styles.shareStatus} role="status">
        {status === 'copied' && 'Resultado copiado'}
      </p>
    </div>
  );
}
