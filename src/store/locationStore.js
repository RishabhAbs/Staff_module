import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const HISTORY_KEY = 'location_history_v2';

const getItem = async (k) =>
  Platform.OS === 'web' ? localStorage.getItem(k) : SecureStore.getItemAsync(k);
const setItem = async (k, v) =>
  Platform.OS === 'web' ? localStorage.setItem(k, v) : SecureStore.setItemAsync(k, v);

// Haversine distance in metres between two {latitude, longitude} points
function distanceMetres(a, b) {
  const R    = 6371000;
  const dLat = ((b.latitude  - a.latitude)  * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
    Math.cos((b.latitude * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
}

// Group raw pings into "stays" — consecutive pings within STAY_RADIUS metres
const STAY_RADIUS = 100; // metres — tighter grouping so 15-min pings show as separate stops if moved

export function buildTimeline(pings) {
  if (!pings || pings.length === 0) return [];
  // Only use pings with valid coordinates
  const validPings = pings.filter(p => p.latitude != null && p.longitude != null);
  if (validPings.length === 0) return [];
  const sorted = [...validPings].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const stays  = [];
  let group    = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = group[group.length - 1];
    const cur  = sorted[i];
    const dist = distanceMetres(
      { latitude: last.latitude,  longitude: last.longitude },
      { latitude: cur.latitude,   longitude: cur.longitude },
    );
    if (dist <= STAY_RADIUS) {
      group.push(cur);
    } else {
      stays.push(group);
      group = [cur];
    }
  }
  stays.push(group);

  return stays.map(g => ({
    latitude:  g[0].latitude,
    longitude: g[0].longitude,
    address:   g[0].address || null,
    from:      g[0].timestamp,
    to:        g[g.length - 1].timestamp,
    pings:     g.length,
  }));
}

export const useLocationStore = create((set, get) => ({
  currentLocation: null,
  locationHistory: [],   // own device pings
  staffLocations:  [],   // admin view: all staff last known location
  isTracking:      false,

  // { [userId]: [ { userId, name, latitude, longitude, address, timestamp } ] }
  userHistories: {},

  init: async () => {
    try {
      const raw = await getItem(HISTORY_KEY);
      if (raw) set({ userHistories: JSON.parse(raw) });
    } catch {}
  },

  setCurrentLocation: (coords) => {
    const entry = { ...coords, timestamp: new Date().toISOString() };
    set((state) => ({
      currentLocation: entry,
      locationHistory: [entry, ...state.locationHistory].slice(0, 200),
    }));
  },

  // Record a location ping for a specific user (called on checkin and background updates)
  recordUserLocation: async ({ userId, name, latitude, longitude, address, timestamp }) => {
    if (!userId) return;
    const entry = {
      userId, name,
      latitude, longitude,
      address: address || null,
      timestamp: timestamp || new Date().toISOString(),
    };
    const prev     = get().userHistories;
    const existing = prev[userId] || [];
    // Keep last 200 pings per user, deduplicate by timestamp
    const deduped  = existing.filter(e => e.timestamp !== entry.timestamp);
    const updated  = { ...prev, [userId]: [...deduped, entry].slice(-200) };
    await setItem(HISTORY_KEY, JSON.stringify(updated));
    set({ userHistories: updated });
  },

  // Get today's pings for a user, grouped into timeline stays
  getUserTimeline: (userId, date) => {
    const histories = get().userHistories;
    const all       = histories[userId] || [];
    const day       = date || new Date().toISOString().slice(0, 10);
    const todayPings = all.filter(p => p.timestamp?.startsWith(day));
    return buildTimeline(todayPings);
  },

  // Get all users who have any location pings today
  getTodayActiveUsers: () => {
    const today     = new Date().toISOString().slice(0, 10);
    const histories = get().userHistories;
    return Object.entries(histories)
      .map(([userId, pings]) => {
        const todayPings = pings.filter(p => p.timestamp?.startsWith(today));
        if (todayPings.length === 0) return null;
        const latest = todayPings[todayPings.length - 1];
        return { userId, name: latest.name, ...latest, pingCount: todayPings.length };
      })
      .filter(Boolean);
  },

  setStaffLocations:    (list) => set({ staffLocations: list }),
  updateStaffLocation:  (userId, coords) =>
    set((state) => ({
      staffLocations: state.staffLocations.map((s) =>
        s.id === userId ? { ...s, lastLocation: coords, lastSeen: new Date().toISOString() } : s
      ),
    })),
  setTracking: (val) => set({ isTracking: val }),
}));
