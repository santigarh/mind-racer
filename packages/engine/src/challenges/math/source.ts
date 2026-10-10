import type { Rng } from '../../rng';
import type { Challenge, ChallengeKey, ChallengeSource } from '../../types';
import { generateProblem, getLevelDefinition } from './levels';

const MAX_ATTEMPTS = 20;
const INTEGER_INPUT = /^[-−]?\d+$/;

/** Parses a player's answer into an integer, or null if it is not one. */
export function parseIntegerAnswer(input: string): number | null {
  const compact = input.replace(/\s+/g, '');
  if (!INTEGER_INPUT.test(compact)) return null;
  const value = Number(compact.replace('−', '-'));
  return Number.isSafeInteger(value) ? value : null;
}

export const mathChallengeSource: ChallengeSource = {
  next(level: number, rng: Rng, recent: readonly ChallengeKey[]): Challenge {
    const def = getLevelDefinition(level);
    let problem = generateProblem(def.level, rng);
    for (let attempt = 1; attempt < MAX_ATTEMPTS && recent.includes(problem.prompt); attempt++) {
      problem = generateProblem(def.level, rng);
    }
    return {
      key: problem.prompt,
      level: def.level,
      prompt: problem.prompt,
      answer: String(problem.answer),
      targetTimeMs: def.targetTimeMs,
    };
  },

  check(challenge: Challenge, input: string): boolean {
    const value = parseIntegerAnswer(input);
    return value !== null && value === Number(challenge.answer);
  },
};
