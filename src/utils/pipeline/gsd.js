/**
 * STAGE 1 — GSD (Task Decomposition)
 * Extracts the core objective from raw input and returns a clean actionable task.
 */

const NOISE_PATTERNS = [
  /please\s*/gi, /can you\s*/gi, /could you\s*/gi,
  /i want to\s*/gi, /i need to\s*/gi, /help me\s*/gi,
];

function stripNoise(input) {
  let clean = input.trim();
  NOISE_PATTERNS.forEach((pattern) => {
    clean = clean.replace(pattern, '');
  });
  return clean.trim();
}

/**
 * @param {string} rawInput
 * @returns {{ task: string }}
 */
export function gsd(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    throw new Error('GSD: input must be a non-empty string');
  }

  const task = stripNoise(rawInput);

  return { task };
}
