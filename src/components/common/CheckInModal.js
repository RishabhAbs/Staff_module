import React, { useEffect, useState, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, Animated, Easing, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors } from '@constants/colors';
import { useAuthStore } from '@store/authStore';
import dayjs from 'dayjs';

// Phases: fetching → ready | denied → submitting → blocked
export default function CheckInModal({ visible, onCheckIn, onClose }) {
  const [phase, setPhase]       = useState('fetching');
  const [coords, setCoords]     = useState(null);
  const [address, setAddress]   = useState('');
  const [accuracy, setAccuracy] = useState(null);
  const [blockedMsg, setBlockedMsg]   = useState('');
  const [blockedCode, setBlockedCode] = useState('');
  const spinAnim = useRef(new Animated.Value(0)).current;
  const { logout } = useAuthStore();

  /* ── spinner ── */
  useEffect(() => {
    if (phase === 'fetching' || phase === 'submitting') {
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
      ).start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  }, [phase]);

  /* ── auto-fetch on open ── */
  useEffect(() => {
    if (visible) {
      setCoords(null);
      setAddress('');
      setAccuracy(null);
      setBlockedMsg('');
      setBlockedCode('');
      setPhase('fetching');
      fetchLocation();
    }
  }, [visible]);

  const fetchLocation = async () => {
    try {
      if (Platform.OS === 'web') {
        if (!navigator?.geolocation) { setPhase('ready'); return; }

        const pos = await new Promise((resolve, reject) => {
          let best = null;
          let bestAccuracy = Infinity;
          let done = false;

          const finish = (p) => {
            if (done) return;
            done = true;
            navigator.geolocation.clearWatch(wid);
            clearTimeout(timer);
            resolve(p);
          };

          // 5-second cap — accept best available after that
          const timer = setTimeout(() => {
            if (best) finish(best);
            else { done = true; reject(new Error('timeout')); }
          }, 5000);

          const wid = navigator.geolocation.watchPosition(
            (p) => {
              const acc = p.coords.accuracy;
              if (acc < bestAccuracy) { bestAccuracy = acc; best = p; setAccuracy(Math.round(acc)); }
              if (acc <= 50) finish(p); // good enough — stop waiting
            },
            (err) => { done = true; clearTimeout(timer); navigator.geolocation.clearWatch(wid); reject(err); },
            { enableHighAccuracy: false, maximumAge: 30000, timeout: 5000 }
          );
        });

        const { latitude, longitude, accuracy: acc } = pos.coords;
        setAccuracy(Math.round(acc));
        await resolveAddress(latitude, longitude);

      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setPhase('denied'); return; }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          maximumAge: 0,
        });
        const { latitude, longitude, accuracy: acc } = loc.coords;
        setAccuracy(Math.round(acc));
        await resolveAddress(latitude, longitude);
      }
    } catch (e) {
      if (e?.code === 1) {
        setPhase('denied');
      } else {
        // timeout or network — still allow check-in without coords
        setPhase('ready');
      }
    }
  };

  const resolveAddress = async (latitude, longitude) => {
    setCoords({ latitude, longitude });
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      );
      const geo = await r.json();
      const a = geo?.address;
      const parts = [a?.road, a?.suburb, a?.city || a?.town || a?.village, a?.state].filter(Boolean);
      setAddress(parts.join(', ') || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    } catch {
      setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    }
    setPhase('ready');
  };

  const handleCheckIn = async () => {
    const payload = {
      latitude:  coords?.latitude  ?? null,
      longitude: coords?.longitude ?? null,
      address:   address || '',
      date: dayjs().format('YYYY-MM-DD'),
      time: dayjs().format('HH:mm:ss'),
      type: 'check_in',
    };
    // Close modal first, then let the parent handle the API call
    onClose();
    onCheckIn(payload);
  };

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={s.overlay}>
        <View style={s.card}>

          {/* ── FETCHING ── */}
          {phase === 'fetching' && (
            <>
              <View style={s.iconWrap}>
                <View style={[s.iconCircle, { backgroundColor: '#F7F8FA' }]}>
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="locate-outline" size={36} color={Colors.primary} />
                  </Animated.View>
                </View>
              </View>
              <Text style={s.title}>Detecting Location…</Text>
              <Text style={s.subtitle}>Please allow location access when prompted.</Text>
              <View style={s.accuracyBar}>
                <Ionicons name="radio-outline" size={14} color={accuracy && accuracy <= 50 ? Colors.success : '#F59E0B'} />
                <Text style={[s.accuracyTxt, accuracy && accuracy <= 50 && { color: Colors.success }]}>
                  {accuracy
                    ? `GPS accuracy: ±${accuracy}m${accuracy <= 50 ? '  ✓ Locked' : '  Improving…'}`
                    : 'Searching for GPS signal…'}
                </Text>
              </View>
              <TouchableOpacity style={s.secondaryBtn} onPress={handleCheckIn}>
                <Text style={s.secondaryTxt}>Skip — check in without location</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── SUBMITTING ── */}
          {phase === 'submitting' && (
            <>
              <View style={s.iconWrap}>
                <View style={[s.iconCircle, { backgroundColor: '#F7F8FA' }]}>
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="sync-outline" size={36} color={Colors.primary} />
                  </Animated.View>
                </View>
              </View>
              <Text style={s.title}>Checking In…</Text>
              <Text style={s.subtitle}>Recording your attendance, please wait.</Text>
              <View style={{ height: 32 }} />
            </>
          )}

          {/* ── READY ── */}
          {phase === 'ready' && (
            <>
              <View style={s.iconWrap}>
                <View style={[s.iconCircle, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="location" size={36} color={Colors.success} />
                </View>
              </View>
              <Text style={s.title}>Mark Your Attendance</Text>

              {/* Location box */}
              <View style={s.locBox}>
                <Ionicons name="location-outline" size={14} color={Colors.primary} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.locTxt} numberOfLines={2}>
                    {address || (coords
                      ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
                      : 'Location unavailable')}
                  </Text>
                  {coords && (
                    <Text style={s.coordsTxt}>
                      {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
                      {accuracy ? `  ±${accuracy}m` : ''}
                    </Text>
                  )}
                </View>
              </View>

              {/* Date / time */}
              <View style={s.meta}>
                <View style={s.metaItem}>
                  <Ionicons name="calendar-outline" size={13} color={Colors.textLight} />
                  <Text style={s.metaTxt}>{dayjs().format('DD MMM YYYY')}</Text>
                </View>
                <View style={s.metaDot} />
                <View style={s.metaItem}>
                  <Ionicons name="time-outline" size={13} color={Colors.textLight} />
                  <Text style={s.metaTxt}>{dayjs().format('hh:mm A')}</Text>
                </View>
              </View>

              <TouchableOpacity style={s.checkInBtn} onPress={handleCheckIn}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={s.checkInTxt}>Check In Now</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.retryRow} onPress={() => { setPhase('fetching'); fetchLocation(); }}>
                <Ionicons name="refresh-outline" size={13} color="#6B7280" />
                <Text style={s.retryTxt}>Refresh location</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── DENIED ── */}
          {phase === 'denied' && (
            <>
              <View style={s.iconWrap}>
                <View style={[s.iconCircle, { backgroundColor: '#FEF9C3' }]}>
                  <Ionicons name="warning-outline" size={36} color="#CA8A04" />
                </View>
              </View>
              <Text style={s.title}>Location Access Needed</Text>
              <Text style={s.subtitle}>
                Allow location in your browser, then tap Try Again. You can also continue without GPS.
              </Text>
              <View style={s.stepsBox}>
                <View style={s.stepRow}>
                  <Ionicons name="lock-open-outline" size={15} color={Colors.textLight} />
                  <Text style={s.stepTxt}>Click the lock icon in your address bar</Text>
                </View>
                <View style={s.stepRow}>
                  <Ionicons name="location-outline" size={15} color={Colors.textLight} />
                  <Text style={s.stepTxt}>Set Location → <Text style={{ fontWeight: '700', color: Colors.text }}>Allow</Text></Text>
                </View>
              </View>
              <TouchableOpacity style={s.checkInBtn} onPress={() => { setPhase('fetching'); fetchLocation(); }}>
                <Ionicons name="refresh-outline" size={18} color="#fff" />
                <Text style={s.checkInTxt}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.secondaryBtn} onPress={handleCheckIn}>
                <Text style={s.secondaryTxt}>Continue without location</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── BLOCKED (policy / shift violation) ── */}
          {phase === 'blocked' && (
            <>
              <View style={s.iconWrap}>
                <View style={[s.iconCircle, { backgroundColor: '#FEF2F2' }]}>
                  <Ionicons name="ban-outline" size={36} color={Colors.danger} />
                </View>
              </View>
              <Text style={s.title}>
                {blockedCode === 'SHIFT_VIOLATION' ? 'Outside Shift Hours' : 'Check-In Disabled'}
              </Text>
              <View style={s.alertBox}>
                <Text style={s.alertTxt}>{blockedMsg}</Text>
              </View>
              <TouchableOpacity style={[s.checkInBtn, { backgroundColor: '#6B7280' }]} onPress={logout}>
                <Ionicons name="log-out-outline" size={18} color="#fff" />
                <Text style={s.checkInTxt}>Logout</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:        { backgroundColor: '#fff', borderRadius: 24, width: '100%', maxWidth: 400, paddingHorizontal: 24, paddingBottom: 28, overflow: 'hidden' },
  iconWrap:    { alignItems: 'center', marginTop: 28, marginBottom: 16 },
  iconCircle:  { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  title:       { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle:    { fontSize: 13, color: Colors.textLight, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  locBox:      { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, marginBottom: 14, width: '100%' },
  locTxt:      { fontSize: 13, color: Colors.text, flex: 1, lineHeight: 18 },
  coordsTxt:   { fontSize: 10, color: Colors.textMuted, marginTop: 3, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  meta:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaTxt:     { fontSize: 13, color: Colors.textLight },
  metaDot:     { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  checkInBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#C0392B', borderRadius: 14, paddingVertical: 15, marginBottom: 8, width: '100%' },
  checkInTxt:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn:{ alignItems: 'center', paddingVertical: 10 },
  secondaryTxt:{ fontSize: 13, color: Colors.textMuted },
  retryRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  retryTxt:    { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  accuracyBar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F7F8FA', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#E5E7EB', marginTop: 4 },
  accuracyTxt: { fontSize: 12, color: '#F59E0B', fontWeight: '600' },
  stepsBox:    { backgroundColor: '#F7F8FA', borderRadius: 12, padding: 14, gap: 10, marginBottom: 16, width: '100%', borderWidth: 1, borderColor: '#E5E7EB' },
  stepRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepTxt:     { fontSize: 12, color: Colors.textLight, flex: 1, lineHeight: 18 },
  alertBox:    { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginBottom: 16, width: '100%', borderWidth: 1, borderColor: '#FCA5A5' },
  alertTxt:    { fontSize: 13, color: '#991B1B', lineHeight: 20, textAlign: 'center' },
});
