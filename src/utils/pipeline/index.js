/**
 * Pipeline Orchestrator
 *
 * Input → GSD → Context Mode → Code Graph → State Compiler → Execution → Output
 */

import { gsd }           from './gsd';
import { contextMode }   from './contextMode';
import { codeGraph }     from './codeGraph';
import { stateCompiler } from './stateCompiler';
import { executor }      from './executor';

/**
 * Run the full pipeline on a raw user input string.
 *
 * @param {string} rawInput
 * @returns {{ result: string, actions: string[] }}
 *
 * @example
 * const output = runPipeline('Login is not working, token not saved');
 * // output.result  → "Root cause: ..."
 * // output.actions → ["1. Validate credentials...", ...]
 */
export function runPipeline(rawInput) {
  // Stage 1 — Task Decomposition
  const gsdOutput = gsd(rawInput);

  // Stage 2 — Context Extraction
  const contextOutput = contextMode(gsdOutput);

  // Stage 3 — Dependency Mapping
  const graphOutput = codeGraph(contextOutput);

  // Stage 4 — State Compilation
  const compiled = stateCompiler(gsdOutput, contextOutput, graphOutput);

  // Stage 5 — Execution
  return executor(compiled);
}

export { gsd, contextMode, codeGraph, stateCompiler, executor };
