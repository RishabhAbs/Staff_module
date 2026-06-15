import { create } from 'zustand';
import api from '@services/api';
import { ENDPOINTS } from '@constants/api';

const ANNUAL_BALANCE = { CL: 12, SL: 12, EL: 15, LOP: 999 };

function _workingDays(from, to) {
  let count = 0;
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    if (cur.getDay() !== 0) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(count, 1);
}

export const useLeaveStore = create((set, get) => ({
  requests: [],
  ready: false,

  init: async () => {
    try {
      const data = await api.get(ENDPOINTS.LEAVE_LIST);
      set({ requests: Array.isArray(data) ? data : [], ready: true });
    } catch {
      set({ requests: [], ready: true });
    }
  },

  applyLeave: async ({ userId, userName, type, fromDate, toDate, reason }) => {
    const days = _workingDays(fromDate, toDate);
    const req = await api.post(ENDPOINTS.LEAVE_APPLY, { type, from_date: fromDate, to_date: toDate, reason });
    const newReq = { ...req, userId, userName, type, fromDate, toDate, days, reason, status: 'pending', appliedAt: new Date().toISOString() };
    set(s => ({ requests: [newReq, ...s.requests] }));
    return newReq;
  },

  updateStatus: async (id, status, adminNote = '') => {
    await api.put(ENDPOINTS.LEAVE_BY_ID(id), { status, adminNote });
    set(s => ({
      requests: s.requests.map(r => r.id === id ? { ...r, status, adminNote, updatedAt: new Date().toISOString() } : r),
    }));
  },

  getAllRequests: (month, year) => {
    const reqs = get().requests;
    if (!month && !year) return reqs;
    return reqs.filter(r => {
      const d = new Date(r.fromDate || r.from_date);
      const mMatch = month ? d.getMonth() + 1 === Number(month) : true;
      const yMatch = year  ? d.getFullYear()  === Number(year)  : true;
      return mMatch && yMatch;
    });
  },

  getUserRequests: (userId) =>
    get().requests.filter(r => r.userId === userId || r.staff_id === userId),

  getUsedLeaves: (userId, year) => {
    const y = year || new Date().getFullYear();
    const approved = get().requests.filter(r =>
      (r.userId === userId || r.staff_id === userId) &&
      r.status === 'approved' &&
      new Date(r.fromDate || r.from_date).getFullYear() === y
    );
    const used = { CL: 0, SL: 0, EL: 0, LOP: 0 };
    approved.forEach(r => { if (used[r.type] != null) used[r.type] += (r.days || 1); });
    return used;
  },

  getBalance: (userId) => {
    const used = get().getUsedLeaves(userId, new Date().getFullYear());
    return {
      CL:  { total: ANNUAL_BALANCE.CL,  used: used.CL,  remaining: Math.max(0, ANNUAL_BALANCE.CL  - used.CL) },
      SL:  { total: ANNUAL_BALANCE.SL,  used: used.SL,  remaining: Math.max(0, ANNUAL_BALANCE.SL  - used.SL) },
      EL:  { total: ANNUAL_BALANCE.EL,  used: used.EL,  remaining: Math.max(0, ANNUAL_BALANCE.EL  - used.EL) },
      LOP: { total: '∞', used: used.LOP, remaining: '∞' },
    };
  },

  getStats: () => {
    const reqs = get().requests;
    const map = {};
    reqs.forEach(r => {
      const uid = r.userId || r.staff_id;
      if (!map[uid]) map[uid] = { userId: uid, userName: r.userName || r.staff_name, CL: 0, SL: 0, EL: 0, LOP: 0, total: 0, pending: 0 };
      if (r.status === 'approved') { map[uid][r.type] = (map[uid][r.type] || 0) + (r.days || 1); map[uid].total += (r.days || 1); }
      if (r.status === 'pending') map[uid].pending += 1;
    });
    return Object.values(map);
  },
}));
