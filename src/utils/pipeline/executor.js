/**
 * STAGE 5 — Execution
 * Takes compiled state and produces a structured result with actionable fixes.
 */

/**
 * @param {object} compiledState
 * @returns {{ result: string, actions: string[] }}
 */
export function executor(compiledState) {
  const { task, context } = compiledState;
  const { error, affected_modules, critical_path } = context;

  const result = error !== 'No explicit error detected'
    ? `Root cause: "${error}" detected in [${affected_modules.join(', ')}] module(s).`
    : `Task identified: "${task}" — targeting [${affected_modules.join(', ')}] module(s).`;

  const actions = critical_path.map((step, i) => `${i + 1}. ${step}`);

  return { result, actions };
}
