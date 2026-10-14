import type { CSSProperties } from 'react';
import type { Car } from '@mind-racer/protocol';
import { bodyInfo, paintInfo } from './catalog';

interface CarIconProps {
  car: Car;
  size?: number;
  className?: string;
  /** Paint the icon; off when a parent sets the color (e.g. the track's lane color). */
  painted?: boolean;
}

/** A garage car: its vehicle icon, facing right (towards the finish), in its paint. */
export function CarIcon({ car, size = 24, className, painted = true }: CarIconProps) {
  const { icon: Icon, mirrored } = bodyInfo(car.body);
  const style: CSSProperties = {
    ...(painted ? { color: paintInfo(car.paint).color } : {}),
    ...(mirrored ? { transform: 'scaleX(-1)' } : {}),
  };
  return (
    <Icon size={size} weight="fill" className={className} style={style} data-body={car.body} data-paint={car.paint} aria-hidden />
  );
}
