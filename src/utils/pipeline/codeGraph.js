/**
 * STAGE 3 — Code Graph (Dependency Mapping)
 * Maps the logical execution flow and key functional steps.
 */

const MODULE_FLOW = {
  auth: [
    'Validate credentials (email + password)',
    'POST /auth/login via axios',
    'Store token in SecureStore',
    'Update authStore (zustand)',
    'Navigate to MainNavigator',
  ],
  API: [
    'Build axios request with auth token from SecureStore',
    'Send HTTP request to API_BASE_URL',
    'Parse response / handle error via interceptor',
    'Return data to caller (react-query or service)',
  ],
  UI: [
    'Render screen component',
    'Bind form fields via react-hook-form + Controller',
    'Validate with zod schema on submit',
    'Dispatch action / API call on success',
    'Show loading state / error feedback',
  ],
  store: [
    'Read global state from zustand store',
    'Trigger action (setter function)',
    'Persist sensitive data to SecureStore if needed',
    'Subscribers re-render via useAuthStore selector',
  ],
  navigation: [
    'Check isLoggedIn in RootNavigator',
    'Render AuthNavigator or MainNavigator conditionally',
    'Navigate via navigation.navigate(screenName)',
  ],
  attendance: [
    'Fetch attendance list via GET /attendance',
    'Display records in FlatList',
    'Mark attendance via POST /attendance/mark',
    'Refresh list via react-query invalidateQueries',
  ],
  leave: [
    'Fetch leave list via GET /leave',
    'Apply leave via POST /leave/apply with form data',
    'Admin approves/rejects via PATCH /leave/:id',
    'Update local state via react-query cache',
  ],
  staff: [
    'Fetch staff list via GET /staff',
    'View staff detail via GET /staff/:id',
    'Filter/search staff locally',
  ],
};

const DEFAULT_FLOW = [
  'Identify input type and target module',
  'Load relevant screen/component',
  'Execute API call or state update',
  'Handle response and update UI',
];

/**
 * @param {{ context: { affected_modules: string[] } }} contextOutput
 * @returns {{ critical_path: string[] }}
 */
export function codeGraph({ context }) {
  const { affected_modules } = context;

  const critical_path = affected_modules.flatMap(
    (mod) => MODULE_FLOW[mod] || DEFAULT_FLOW
  );

  const unique = [...new Set(critical_path)];

  return { critical_path: unique };
}
