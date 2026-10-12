import { describe, expect, it, vi } from 'vitest';
import { canShareOrCopy, shareOrCopy } from './share';

const payload = { title: 'Mind Racer', text: 'Hola', url: 'https://juego.example/' };

describe('compartir o copiar', () => {
  it('usa el menú de compartir cuando existe', async () => {
    const share = vi.fn(async () => {});
    expect(await shareOrCopy(payload, undefined, { share })).toBe('shared');
    expect(share).toHaveBeenCalledWith(payload);
  });

  it('si la persona cierra el menú no copia nada', async () => {
    const writeText = vi.fn(async () => {});
    const share = vi.fn(async () => {
      throw new DOMException('cancelado', 'AbortError');
    });
    expect(await shareOrCopy(payload, undefined, { share, clipboard: { writeText } as unknown as Clipboard })).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('sin menú copia el texto y la dirección, o lo que se indique', async () => {
    const writeText = vi.fn(async () => {});
    const clipboard = { writeText } as unknown as Clipboard;
    expect(await shareOrCopy(payload, undefined, { clipboard })).toBe('copied');
    expect(writeText).toHaveBeenLastCalledWith('Hola\nhttps://juego.example/');
    await shareOrCopy(payload, payload.url, { clipboard });
    expect(writeText).toHaveBeenLastCalledWith('https://juego.example/');
  });

  it('si el menú falla, copia', async () => {
    const writeText = vi.fn(async () => {});
    const share = vi.fn(async () => {
      throw new Error('NotAllowedError');
    });
    expect(await shareOrCopy(payload, undefined, { share, clipboard: { writeText } as unknown as Clipboard })).toBe('copied');
  });

  it('sin ninguna de las dos APIs, o si copiar falla, lo informa', async () => {
    expect(canShareOrCopy({})).toBe(false);
    expect(await shareOrCopy(payload, undefined, {})).toBe('unavailable');
    const clipboard = {
      writeText: async () => {
        throw new Error('denied');
      },
    } as unknown as Clipboard;
    expect(canShareOrCopy({ clipboard })).toBe(true);
    expect(await shareOrCopy(payload, undefined, { clipboard })).toBe('failed');
  });
});
