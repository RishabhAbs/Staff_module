import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import dayjs from 'dayjs';

const setItem = async (k, v) =>
  Platform.OS === 'web' ? localStorage.setItem(k, v) : SecureStore.setItemAsync(k, v);

const getItem = async (k) =>
  Platform.OS === 'web' ? localStorage.getItem(k) : SecureStore.getItemAsync(k);

const removeItem = async (k) =>
  Platform.OS === 'web' ? localStorage.removeItem(k) : SecureStore.deleteItemAsync(k);

// Use id first (always numeric, always set by backend), fall back to username
const getUserKey = (u) => String(u?.id || u?.username || 'staff');

export const useAuthStore = create((set, get) => ({
  user:           null,
  token:          null,
  role:           null,
  users:          [],
  isLoggedIn:     false,
  isLoading:      true,
  checkedInToday: false,

  login: async (token, user) => {
    await setItem('access_token', token);
    await setItem('user_role', user.role);
    await setItem('user_data', JSON.stringify(user));
    const today = dayjs().format('YYYY-MM-DD');
    // Check backend first (works across devices/browsers), fall back to local cache
    let checkedInToday = false;
    try {
      const api = require('@services/api').default;
      const records = await api.get(`/attendance/my-report?month=${today.slice(0, 7)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      checkedInToday = Array.isArray(records) && records.some(r => dayjs(r.date).format('YYYY-MM-DD') === today);
    } catch {
      const lastCheckin = await getItem(`last_checkin_${getUserKey(user)}`);
      checkedInToday = lastCheckin === today;
    }
    if (checkedInToday) await setItem(`last_checkin_${getUserKey(user)}`, today);
    set({ token, user, role: user.role, isLoggedIn: true, checkedInToday });
    // Pre-load users list for admin so screens have data immediately
    if (user.role === 'admin') {
      get().loadUsers().catch(() => {});
    }
  },

  logout: async () => {
    await removeItem('access_token');
    await removeItem('user_role');
    await removeItem('user_data');
    if (Platform.OS === 'web') {
      try {
        sessionStorage.removeItem('checkin_date');
        localStorage.removeItem('last_checkin');
      } catch {}
    }
    set({ token: null, user: null, role: null, isLoggedIn: false, isLoading: false, checkedInToday: false });
  },

  setCheckedIn: async () => {
    const today = dayjs().format('YYYY-MM-DD');
    // Primary: simple key — no user-object dependency, always works
    await setItem('last_checkin', today);
    if (Platform.OS === 'web') {
      try { sessionStorage.setItem('checkin_date', today); } catch {}
    }
    // Secondary: user-scoped key for multi-user devices
    let user = get().user;
    if (!user && Platform.OS === 'web') {
      try { user = JSON.parse(localStorage.getItem('user_data') || 'null'); } catch {}
    }
    if (user) await setItem(`last_checkin_${getUserKey(user)}`, today);
    set({ checkedInToday: true });
  },

  // Users are loaded from backend API by screens directly
  // These are kept for backward compat with screens that read get().users
  loadUsers: async () => {
    try {
      const api = require('@services/api').default;
      const { ENDPOINTS } = require('@constants/api');
      const data = await api.get(ENDPOINTS.STAFF_LIST);
      const users = Array.isArray(data) ? data : [];
      set({ users });
      return users;
    } catch { return []; }
  },

  addUser: async (newUser) => {
    const api = require('@services/api').default;
    const { ENDPOINTS } = require('@constants/api');
    const created = await api.post(ENDPOINTS.CREATE_USER, newUser);
    set(s => ({ users: [...s.users, created] }));
    return created;
  },

  updateUser: async (updatedUser) => {
    const api = require('@services/api').default;
    const { ENDPOINTS } = require('@constants/api');
    await api.put(ENDPOINTS.UPDATE_USER(updatedUser.id), updatedUser);
    set(s => ({ users: s.users.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u) }));
  },

  deleteUser: async (userId) => {
    const api = require('@services/api').default;
    const { ENDPOINTS } = require('@constants/api');
    await api.delete(ENDPOINTS.UPDATE_USER(userId));
    set(s => ({ users: s.users.filter(u => u.id !== userId) }));
  },

  markTwoFaSetup: async (userId) => {
    const api = require('@services/api').default;
    await api.put(`/staff/${userId}/2fa`, { setup: true });
    set(s => ({ users: s.users.map(u => u.id === userId ? { ...u, twoFaSetup: true } : u) }));
  },

  initAuth: async () => {
    try {
      // Force re-login if app version changed (clears stale tokens)
      const APP_VERSION = '2';
      const storedVersion = Platform.OS === 'web' ? localStorage.getItem('app_version') : null;
      if (storedVersion !== APP_VERSION) {
        if (Platform.OS === 'web') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('user_role');
          localStorage.removeItem('user_data');
          localStorage.setItem('app_version', APP_VERSION);
        }
        set({ token: null, role: null, user: null, isLoggedIn: false, isLoading: false, checkedInToday: false });
        return;
      }

      const token    = await getItem('access_token');
      const role     = await getItem('user_role');
      const userData = await getItem('user_data');
      let user = null;
      let checkedInToday = false;

      if (!token) {
        set({ token: null, role: null, user: null, isLoggedIn: false, isLoading: false, checkedInToday: false });
        return;
      }

      if (userData) {
        try { user = JSON.parse(userData); } catch {}
      }

      // Fast local check — three independent sources, any one is enough
      const today = dayjs().format('YYYY-MM-DD');
      // 1. Simple key — no user-object dependency, most reliable
      const simpleLast = await getItem('last_checkin');
      if (simpleLast === today) checkedInToday = true;
      // 2. sessionStorage — survives same-tab refresh even if localStorage is cleared
      if (!checkedInToday && Platform.OS === 'web') {
        try { if (sessionStorage.getItem('checkin_date') === today) checkedInToday = true; } catch {}
      }
      // 3. User-scoped key — backward compat with any previously stored data
      if (!checkedInToday && user) {
        const lastCheckin = await getItem(`last_checkin_${getUserKey(user)}`);
        if (lastCheckin === today) checkedInToday = true;
      }

      // Validate token against backend — if 401, clear session and force re-login
      const api = require('@services/api').default;
      try {
        const records = await api.get(`/attendance/my-report?month=${today.slice(0, 7)}`);
        const apiCheckedIn = Array.isArray(records) && records.some(r => dayjs(r.date).format('YYYY-MM-DD') === today);
        // Only trust API result if it says true, or if localStorage also says false
        // Never let a false API result override a confirmed localStorage hit
        if (apiCheckedIn) {
          checkedInToday = true;
          if (user) await setItem(`last_checkin_${getUserKey(user)}`, today);
        } else if (!checkedInToday) {
          checkedInToday = false; // both localStorage and API say no — genuinely not checked in
        }
        // if checkedInToday is already true from localStorage but API says false — keep true
        // (API may be stale/wrong; localStorage was set at check-in time)
      } catch (err) {
        const status = err?._status || err?.status || err?.response?.status;
        if (status === 401) {
          await removeItem('access_token');
          await removeItem('user_role');
          await removeItem('user_data');
          set({ token: null, role: null, user: null, isLoggedIn: false, isLoading: false, checkedInToday: false });
          return;
        }
        // Network/other error — keep the local checkedInToday value already set above
      }

      const resolvedRole = role || user?.role || null;
      const isLoggedIn   = !!(token && resolvedRole);

      // Load users list for admin
      let users = [];
      if (isLoggedIn && resolvedRole === 'admin') {
        try {
          const { ENDPOINTS } = require('@constants/api');
          const data = await api.get(ENDPOINTS.STAFF_LIST);
          users = Array.isArray(data) ? data : [];
        } catch {}
      }

      set({ token, role: resolvedRole, user, checkedInToday, isLoggedIn, isLoading: false, users });
    } catch {
      set({ token: null, role: null, user: null, isLoggedIn: false, isLoading: false, checkedInToday: false });
    }
  },
}));
