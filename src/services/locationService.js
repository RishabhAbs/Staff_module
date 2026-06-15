import { Platform } from 'react-native';
import * as Location from 'expo-location';

export const LOCATION_TASK    = 'background-location-task';
const TRACKING_INTERVAL_MS    = 15 * 60 * 1000; // 15 minutes

// ── Native: background task ───────────────────────────────────────────────────
if (Platform.OS !== 'web') {
  const TaskManager = require('expo-task-manager');
  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const latest = data.locations[0];
    try {
      const { useLocationStore } = require('@store/locationStore');
      const state = useLocationStore.getState();
      const { useAuthStore } = require('@store/authStore');
      const { user } = useAuthStore.getState();
      if (user?.id) {
        const { latitude, longitude, accuracy } = latest.coords;
        await state.recordUserLocation({
          userId: user.id, name: user.name || user.username,
          latitude, longitude,
          timestamp: new Date(latest.timestamp).toISOString(),
        });
        // Save to backend API
        try {
          const api = require('@services/api').default;
          await api.post('/location/update', { latitude, longitude, accuracy: accuracy || null });
        } catch (_) {}
      }
    } catch (_) {}
  });
}

// ── Web: interval-based tracker ───────────────────────────────────────────────
let _webInterval = null;

async function _webPing(userId, name) {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });

    const { latitude, longitude, accuracy } = pos.coords;
    let address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
      const geo = await r.json();
      const a = geo?.address;
      const parts = [a?.road, a?.suburb, a?.city || a?.town || a?.village, a?.state].filter(Boolean);
      if (parts.length) address = parts.join(', ');
    } catch {}

    // Save to local store
    const { useLocationStore } = require('@store/locationStore');
    await useLocationStore.getState().recordUserLocation({
      userId, name, latitude, longitude, address,
      timestamp: new Date().toISOString(),
    });
    
    // Save to backend API so admin can see location history
    try {
      const api = require('@services/api').default;
      await api.post('/location/update', { latitude, longitude, accuracy: accuracy || null });
    } catch (_) {}

  } catch (error) {
    // Ignore error
  }
}

export async function startTracking(userId, name) {
  if (Platform.OS === 'web') {
    if (_webInterval) clearInterval(_webInterval);
    // Fire immediately, then every 15 min
    _webPing(userId, name);
    _webInterval = setInterval(() => _webPing(userId, name), TRACKING_INTERVAL_MS);
    return;
  }
  // Native
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') return;
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isRunning) return;
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy:         Location.Accuracy.Balanced,
      timeInterval:     TRACKING_INTERVAL_MS,
      distanceInterval: 50,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'ABS Staff Tracking',
        notificationBody:  'Location is being recorded.',
        notificationColor: '#C0392B',
      },
    });
  } catch (_) {}
}

export function stopTracking() {
  if (Platform.OS === 'web') {
    if (_webInterval) { clearInterval(_webInterval); _webInterval = null; }
    return;
  }
  Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
    .then(running => { if (running) Location.stopLocationUpdatesAsync(LOCATION_TASK); })
    .catch(() => {});
}

export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
}

export function isWithinRadius(userCoords, officeCoords, radiusMeters) {
  const R    = 6371000;
  const dLat = ((officeCoords.latitude  - userCoords.latitude)  * Math.PI) / 180;
  const dLon = ((officeCoords.longitude - userCoords.longitude) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((userCoords.latitude  * Math.PI) / 180) *
    Math.cos((officeCoords.latitude * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radiusMeters;
}
