import { create } from 'zustand';
import dayjs from 'dayjs';
import api from '@services/api';
import { ENDPOINTS } from '@constants/api';

export const OFFICE_CONFIG = {
  checkinStart:  10 * 60 + 0,
  halfDayOut:    16 * 60 + 30,
  earlyLeaveOut: 18 * 60 + 30,
};

function toMin(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export const useAttendanceStore = create((set, get) => ({
  records:  [],
  holidays: [],
  ready:    false,

  setRecords: (records) => set({ records }),

  init: async () => {
    try {
      const [holidays] = await Promise.all([
        api.get(`${ENDPOINTS.HOLIDAYS}?year=${dayjs().year()}`).catch(() => []),
      ]);
      set({ holidays: Array.isArray(holidays) ? holidays : [], ready: true });
    } catch {
      set({ holidays: [], ready: true });
    }
  },

  // ── Holidays ────────────────────────────────────────────────────────────────
  addHoliday: async ({ name, date }) => {
    const h = await api.post(ENDPOINTS.HOLIDAYS, { name, date });
    set(s => ({ holidays: [...s.holidays, h].sort((a, b) => a.date.localeCompare(b.date)) }));
  },

  deleteHoliday: async (id) => {
    await api.delete(ENDPOINTS.HOLIDAY_BY_ID(id));
    set(s => ({ holidays: s.holidays.filter(h => h.id !== id) }));
  },

  getHolidaysForYear: (year) =>
    get().holidays.filter(h => h.date?.startsWith(String(year))),

  getHolidayDates: (month) => {
    const s = new Set();
    get().holidays.filter(h => h.date?.startsWith(month)).forEach(h => s.add(h.date));
    return s;
  },

  // ── Checkin / Checkout ──────────────────────────────────────────────────────
  checkin: async ({ userId, name, date, time, latitude, longitude, address }) => {
    await api.post(ENDPOINTS.CHECKIN, { latitude, longitude, address });
    // Save to location_history table so admin can see it
    if (latitude != null) {
      try {
        await api.post('/location/update', { latitude, longitude, accuracy: null });
      } catch {}
      try {
        const { useLocationStore } = require('@store/locationStore');
        await useLocationStore.getState().recordUserLocation({ userId, name, latitude, longitude, address, timestamp: `${date}T${time}` });
      } catch {}
    }
  },

  checkout: async ({ userId, date, time }) => {
    await api.post(ENDPOINTS.CHECKOUT, {});
  },

  forceAction: async ({ userId, name, date, time, type }) => {
    await api.post(ENDPOINTS.ATTENDANCE_FORCE, {
      staffId: userId, date,
      check_in:  type === 'check_in'  ? time : undefined,
      check_out: type === 'check_out' ? time : undefined,
      status: 'present',
    });
  },

  // ── Read helpers (used by screens that fall back to local when API fails) ───
  getReportForDate: async (date, allUsers) => {
    try {
      const data = await api.get(`${ENDPOINTS.ATTENDANCE_REPORT}?date=${date}`);
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  },

  getMonthlySummary: (userId, month) => {
    // Returns zeros — screens fetch live from API directly
    return { present: 0, absent: 0, half_day: 0, late: 0, early_leave: 0 };
  },

  getDailyReport: (userId, month) => {
    // Returns empty — screens fetch live from API directly
    return [];
  },
}));
