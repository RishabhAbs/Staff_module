/**
 * STAGE 2 — Context Mode
 * Extracts relevant information: core error/problem and affected modules.
 */

const MODULE_KEYWORDS = {
  UI:         ['screen', 'component', 'view', 'button', 'input', 'form', 'render', 'style', 'layout', 'ui'],
  navigation: ['navigate', 'route', 'stack', 'tab', 'drawer', 'navigator', 'screen'],
  API:        ['api', 'request', 'response', 'endpoint', 'fetch', 'axios', 'http', 'rest'],
  auth:       ['login', 'logout', 'token', 'auth', 'session', 'password', 'secure'],
  store:      ['state', 'store', 'zustand', 'redux', 'context', 'global'],
  database:   ['db', 'database', 'storage', 'async-storage', 'query', 'table'],
  attendance: ['attendance', 'present', 'absent', 'mark', 'checkin', 'checkout'],
  leave:      ['leave', 'holiday', 'apply', 'approve', 'reject', 'pending'],
  staff:      ['staff', 'employee', 'user', 'profile', 'role', 'department'],
};

function detectModules(text) {
  const lower = text.toLowerCase();
  return Object.entries(MODULE_KEYWORDS)
    .filter(([, keywords]) => keywords.some((kw) => lower.includes(kw)))
    .map(([module]) => module);
}

function extractError(text) {
  const errorPatterns = [
    /error[:\s]+(.+)/i,
    /exception[:\s]+(.+)/i,
    /failed[:\s]+(.+)/i,
    /issue[:\s]+(.+)/i,
    /bug[:\s]+(.+)/i,
    /not working[:\s]*(.*)/i,
  ];

  for (const pattern of errorPatterns) {
    const match = text.match(pattern);
    if (match) return match[1]?.trim() || match[0]?.trim();
  }
  return null;
}

/**
 * @param {{ task: string }} gsdOutput
 * @returns {{ context: { error: string|null, affected_modules: string[] } }}
 */
export function contextMode({ task }) {
  const error = extractError(task);
  const affected_modules = detectModules(task);

  return {
    context: {
      error:            error || 'No explicit error detected',
      affected_modules: affected_modules.length ? affected_modules : ['unknown'],
    },
  };
}
