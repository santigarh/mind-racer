import { useMemo } from 'react';
import { encode } from 'uqr';
import styles from './Multiplayer.module.css';

/** Quiet zone around the code, in modules; cameras need it to find the code. */
const QUIET_ZONE = 4;

/** SVG path with one unit square per dark module. */
export function qrPath(text: string): { path: string; size: number } {
  const { data, size } = encode(text, { ecc: 'M', border: 0 });
  let path = '';
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return { path, size };
}

/** QR code of the room link, generated on the device: nothing is sent to other services (design D2). */
export function RoomQr({ url }: { url: string }) {
  const { path, size } = useMemo(() => qrPath(url), [url]);
  const box = size + QUIET_ZONE * 2;
  return (
    <svg
      className={styles.qr}
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${box} ${box}`}
      role="img"
      aria-label="Código QR del enlace de la sala"
      shapeRendering="crispEdges"
      data-testid="room-qr"
    >
      <rect x={-QUIET_ZONE} y={-QUIET_ZONE} width={box} height={box} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
