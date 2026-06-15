import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import CheckInModal from '@components/common/CheckInModal';
import { useAuthStore } from '@store/authStore';
import { useAttendanceStore } from '@store/attendanceStore';
import { startTracking } from '@services/locationService';
import { useLocationStore } from '@store/locationStore';
import dayjs from 'dayjs';

export default function UserDashboardScreen({ navigation }) {
  const { user, checkedInToday, setCheckedIn, isLoading } = useAuthStore();
  const checkin             = useAttendanceStore(s => s.checkin);
  const recordUserLocation  = useLocationStore(s => s.recordUserLocation);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInData, setCheckInData] = useState(null);
  const modalShown = useRef(false);

  const isCheckedInToday = () => {
    if (checkedInToday) return true;
    if (Platform.OS !== 'web') return false;
    try {
      const today = dayjs().format('YYYY-MM-DD');
      // 1. Simple key — same as what setCheckedIn writes, always reliable
      if (localStorage.getItem('last_checkin') === today) return true;
      // 2. sessionStorage — survives same-tab refresh
      if (sessionStorage.getItem('checkin_date') === today) return true;
      // 3. User-scoped key — backward compat
      const userData = JSON.parse(localStorage.getItem('user_data') || 'null');
      if (userData) {
        const userKey = String(userData?.id || userData?.username || 'staff');
        if (localStorage.getItem(`last_checkin_${userKey}`) === today) return true;
      }
    } catch {}
    return false;
  };

  useEffect(() => {
    if (isLoading) return;
    if (isCheckedInToday()) return;
    if (!modalShown.current) {
      modalShown.current = true;
      const timer = setTimeout(() => setShowCheckIn(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, checkedInToday]);

  const handleCheckIn = async (payload) => {
    setShowCheckIn(false);
    await setCheckedIn();
    setCheckInData(payload);
    setShowCheckIn(false);
    // Rest can fail silently
    checkin({ userId: user?.id, name: user?.name || user?.username, date: payload.date, time: payload.time, latitude: payload.latitude, longitude: payload.longitude, address: payload.address }).catch(() => {});
    if (payload.latitude != null) {
      recordUserLocation({ userId: user?.id, name: user?.name || user?.username, latitude: payload.latitude, longitude: payload.longitude, address: payload.address, timestamp: `${payload.date}T${payload.time}` }).catch(() => {});
    }
    startTracking(user?.id, user?.name || user?.username).catch(() => {});
  };

  const getGreeting = () => {
    const h = dayjs().hour();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <View style={styles.screen}>
      <Navbar navigation={navigation} activeTab="Home" />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Greeting */}
        <Text style={styles.greeting}>{getGreeting()}, {user?.name || 'User'}</Text>
        <Text style={styles.date}>{dayjs().format('dddd, DD MMMM YYYY')}</Text>

        {/* Check-in status card */}
        <TouchableOpacity
          style={[styles.checkinCard, checkedInToday ? styles.checkinCardDone : styles.checkinCardPending]}
          onPress={() => !checkedInToday && setShowCheckIn(true)}
        >
          <Ionicons
            name={checkedInToday ? 'checkmark-circle' : 'alert-circle-outline'}
            size={28}
            color={checkedInToday ? Colors.success : Colors.warning}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.checkinTitle}>
              {checkedInToday ? 'You\'re checked in' : 'Check-In Required'}
            </Text>
            <Text style={styles.checkinSub}>
              {checkedInToday
                ? `At ${checkInData?.time || '--:--'} · ${checkInData?.address || 'Office'}`
                : 'Tap to mark your attendance'}
            </Text>
          </View>
          {!checkedInToday && (
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          )}
        </TouchableOpacity>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Days Present', value: '0', icon: 'checkmark-circle-outline', color: '#6B7280' },
            { label: 'Days Absent',  value: '0',  icon: 'close-circle-outline',    color: '#6B7280' },
            { label: 'Leaves Left',  value: '0', icon: 'calendar-outline',         color: '#6B7280' },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Ionicons name={s.icon} size={22} color={s.color} />
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          {[
            { label: 'Attendance',   icon: 'calendar-outline',      screen: 'Attendance', color: '#C0392B' },
            { label: 'My Profile',   icon: 'person-outline',        screen: 'Profile',    color: '#C0392B' },
          ].map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.actionCard}
              onPress={() => navigation.navigate(a.screen)}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.color + '18' }]}>
                <Ionicons name={a.icon} size={22} color={a.color} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <CheckInModal
        visible={showCheckIn && !isLoading && !isCheckedInToday()}
        onCheckIn={handleCheckIn}
        onClose={() => setShowCheckIn(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:              { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },
  container:           { flex: 1, width: '100%' },
  content:             { padding: 16, paddingBottom: 90 },
  greeting:            { fontSize: 22, fontWeight: '700', color: Colors.text, marginTop: 8 },
  date:                { fontSize: 13, color: Colors.textLight, marginBottom: 20 },
  checkinCard:         { borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  checkinCardPending:  { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  checkinCardDone:     { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  checkinTitle:        { fontSize: 15, fontWeight: '700', color: Colors.text },
  checkinSub:          { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  statsRow:            { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard:            { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#E5E7EB' },
  statValue:           { fontSize: 24, fontWeight: '700' },
  statLabel:           { fontSize: 11, color: Colors.textLight, textAlign: 'center' },
  sectionTitle:        { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  actionsRow:          { flexDirection: 'row', gap: 10 },
  actionCard:          { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  actionIcon:          { width: 46, height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F8FA' },
  actionLabel:         { fontSize: 12, color: Colors.text, fontWeight: '600', textAlign: 'center' },
});
