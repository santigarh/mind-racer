import { z } from 'zod';

/** Closed catalog shared by server and client (design D1); names, icons and colors live in the web app. */
export const CAR_BODIES = ['classic', 'motorcycle', 'scooter', 'truck', 'van', 'tractor'] as const;
export const CAR_PAINTS = ['amber', 'red', 'purple', 'green', 'blue', 'cyan', 'white', 'gold'] as const;

export type CarBody = (typeof CAR_BODIES)[number];
export type CarPaint = (typeof CAR_PAINTS)[number];

export const carSchema = z.object({ body: z.enum(CAR_BODIES), paint: z.enum(CAR_PAINTS) });
export type Car = z.infer<typeof carSchema>;

export const DEFAULT_CAR: Readonly<Car> = Object.freeze({ body: 'classic', paint: 'amber' });

/** What a client sends: an invalid car is treated as missing instead of rejecting the message. */
export const sentCarSchema = carSchema.optional().catch(undefined);
