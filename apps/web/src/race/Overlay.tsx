import styles from './Overlay.module.css';

interface OverlayProps {
  /** Big text: "3", "¡Ya!", "Pausa". */
  title: string;
  subtitle?: string;
  tone?: 'count' | 'go' | 'pause';
}

/** Countdown, start signal and pause overlay over the race area. */
export function Overlay({ title, subtitle, tone = 'count' }: OverlayProps) {
  return (
    <div className={styles.overlay} data-tone={tone} role="status" aria-live="assertive">
      <span key={title} className={styles.title}>
        {title}
      </span>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
    </div>
  );
}
