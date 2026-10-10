import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnswerOutcome, PublicChallenge } from '@mind-racer/engine';
import { ChallengePanel } from './ChallengePanel';
import { sanitizeAnswer } from './useAnswerEntry';

const challenge = (prompt: string, answer: string, seq = 1): PublicChallenge => ({
  seq,
  level: 4,
  prompt,
  answerLength: answer.length,
  issuedAtMs: 0,
});

function renderPanel(props: Partial<Parameters<typeof ChallengePanel>[0]> = {}) {
  const onSubmit = vi.fn();
  const utils = render(
    <ChallengePanel
      challenge={challenge('7 × 8', '56')}
      lastAnswer={null}
      disabled={false}
      showKeypad={false}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { ...utils, onSubmit, input: screen.getByLabelText('Tu respuesta') as HTMLInputElement };
}

describe('desafío y entrada de respuesta', () => {
  it('muestra el desafío en grande y enfoca el campo', () => {
    const { input } = renderPanel();
    expect(screen.getByTestId('challenge-prompt')).toHaveTextContent('7 × 8');
    expect(input).toHaveFocus();
  });

  it('envía automáticamente al escribir tantos caracteres como la respuesta', async () => {
    const { input, onSubmit } = renderPanel();
    await userEvent.type(input, '5');
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.type(input, '6');
    expect(onSubmit).toHaveBeenCalledWith('56');
    expect(input).toHaveValue('');
  });

  it('Enter envía una respuesta más corta', async () => {
    const { input, onSubmit } = renderPanel();
    await userEvent.type(input, '5{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('5');
  });

  it('cuenta el signo menos para el envío automático', async () => {
    const { input, onSubmit } = renderPanel({ challenge: challenge('3 − 15', '-12') });
    await userEvent.type(input, '-1');
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.type(input, '2');
    expect(onSubmit).toHaveBeenCalledWith('-12');
  });

  it('ignora letras y Enter vacío', async () => {
    const { input, onSubmit } = renderPanel();
    await userEvent.type(input, 'ab{Enter}');
    expect(input).toHaveValue('');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('limpia el campo con un nuevo desafío', async () => {
    const { input, rerender, onSubmit } = renderPanel();
    await userEvent.type(input, '5');
    rerender(
      <ChallengePanel
        challenge={challenge('2 + 2', '4', 2)}
        lastAnswer={null}
        disabled={false}
        showKeypad={false}
        onSubmit={onSubmit}
      />,
    );
    expect(input).toHaveValue('');
  });

  it('deshabilitado no envía', async () => {
    const { input, onSubmit } = renderPanel({ disabled: true });
    expect(input).toBeDisabled();
    fireEvent.change(input, { target: { value: '56' } });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sanitizeAnswer deja dígitos y un menos inicial', () => {
    expect(sanitizeAnswer(' 1a2 ')).toBe('12');
    expect(sanitizeAnswer('−7')).toBe('-7');
    expect(sanitizeAnswer('4-2')).toBe('42');
  });
});

describe('retroalimentación', () => {
  const outcome = (o: Partial<AnswerOutcome>): AnswerOutcome => ({
    seq: 1,
    correct: true,
    expected: '56',
    given: '56',
    nitro: false,
    atMs: 1000,
    ...o,
  });

  it('acierto', () => {
    renderPanel({ lastAnswer: outcome({}) });
    expect(screen.getByTestId('answer-feedback')).toHaveTextContent('Correcto');
  });

  it('error con la respuesta correcta', () => {
    renderPanel({ lastAnswer: outcome({ correct: false, given: '54' }) });
    const feedback = screen.getByTestId('answer-feedback');
    expect(feedback).toHaveTextContent('Era 56');
    expect(feedback).toHaveAttribute('data-result', 'error');
  });

  it('nitro', () => {
    renderPanel({ lastAnswer: outcome({ nitro: true }) });
    expect(screen.getByTestId('answer-feedback')).toHaveTextContent('Nitro');
  });
});

describe('teclado en pantalla', () => {
  it('no aparece con puntero fino', () => {
    renderPanel();
    expect(screen.queryByRole('group', { name: 'Teclado numérico' })).not.toBeInTheDocument();
  });

  it('los dígitos escriben y aplican el envío automático', async () => {
    const { input, onSubmit } = renderPanel({ showKeypad: true });
    expect(input).toHaveAttribute('inputmode', 'none');
    await userEvent.click(screen.getByRole('button', { name: '5' }));
    expect(input).toHaveValue('5');
    await userEvent.click(screen.getByRole('button', { name: '6' }));
    expect(onSubmit).toHaveBeenCalledWith('56');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('menos, borrar y enviar', async () => {
    const { input, onSubmit } = renderPanel({ showKeypad: true, challenge: challenge('3 − 15', '-12') });
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Signo menos' }));
    expect(input).toHaveValue('-1');
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    expect(input).toHaveValue('-');
    await userEvent.click(screen.getByRole('button', { name: '9' }));
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));
    expect(onSubmit).toHaveBeenCalledWith('-9');
  });
});
