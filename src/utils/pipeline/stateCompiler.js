/**
 * STAGE 4 — State Compiler
 * Merges GSD, Context Mode, and Code Graph outputs into a single structured state.
 */

/**
 * @param {{ task: string }} gsdOutput
 * @param {{ context: { error: string, affected_modules: string[] } }} contextOutput
 * @param {{ critical_path: string[] }} graphOutput
 * @returns {object} compiled state
 */
export function stateCompiler(gsdOutput, contextOutput, graphOutput) {
  return {
    task: gsdOutput.task,
    context: {
      error:           contextOutput.context.error,
      affected_modules: contextOutput.context.affected_modules,
      critical_path:   graphOutput.critical_path,
    },
    constraints: [
      'minimal changes',
      'do not redesign system',
    ],
    expected_output: 'root cause + step-by-step fix',
  };
}
