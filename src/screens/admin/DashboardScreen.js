import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import CheckInModal from '@components/common/CheckInModal';
import { useAuthStore } from '@store/authStore';
import { useAttendanceStore } from '@store/attendanceStore';
import { startTracking } from '@services/locationService';
import { useLocationStore } from '@store/locationStore';
import api from '@services/api';
import dayjs from 'dayjs';

const STATUS_META = {
  present:     { label: 'Present',     color: Colors.success },
  late_comer:  { label: 'Late Comer',  color: Colors.warning },
  absent:      { label: 'Absent',      color: Colors.danger },
  half_day:    { label: 'Half Day',    color: '#8B5CF6' },
  early_leave: { label: 'Early Leave', color: '#F97316' },
};

export default function AdminDashboardScreen({ navigation }) {
  const { user, checkedInToday, setCheckedIn, isLoading, users: localUsers } = useAuthStore();
  const { checkin, getReportForDate } = useAttendanceStore();
  const { recordUserLocation } = useLocationStore();
  const [stats, setStats]             = useState({ total: 0, present: 0, onLeave: 0, pending: 0 });
  const [activity, setActivity]       = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [dismissed, setDismissed]     = useState(false);

  const isCheckedInToday = () => {
    if (checkedInToday) return true;
    if (Platform.OS !== 'web') return false;
    try {
      const today = dayjs().format('YYYY-MM-DD');
      if (localStorage.getItem('last_checkin') === today) return true;
      if (sessionStorage.getItem('checkin_date') === today) return true;
      const userData = JSON.parse(localStorage.getItem('user_data') || 'null');
      if (userData) {
        const userKey = String(userData?.id || userData?.username || 'staff');
        if (localStorage.getItem(`last_checkin_${userKey}`) === today) return true;
      }
    } catch {}
    return false;
  };

  const loadDashboard = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoadingStats(true);
    try {
      const today = dayjs().format('YYYY-MM-DD');

      // Fetch staff list, attendance report, and all leaves in parallel
      const [staffData, reportData, allLeaves] = await Promise.all([
        api.get('/staff').catch(e => { console.warn('staff error', e); return null; }),
        api.get(`/attendance/report?date=${today}`).catch(e => { console.warn('report error', e); return null; }),
        api.get('/leave').catch(e => { console.warn('leave error', e); return null; }),
      ]);

      const staffList  = Array.isArray(staffData) ? staffData : [];
      const apiRecords = Array.isArray(reportData) ? reportData : (reportData?.records || []);
      const leaveList  = Array.isArray(allLeaves) ? allLeaves : [];

      // Fill gaps with local records
      const adminUser    = user ? [{ id: user.id, name: user.name || user.username }] : [];
      const allUsers     = staffList.length > 0 ? staffList : [...adminUser, ...(localUsers || [])];
      const localRecords = await getReportForDate(today, allUsers);
      const apiIds       = new Set(apiRecords.map(r => r.staff_id || r.name));
      const merged = [
        ...apiRecords,
        ...localRecords.filter(r => !apiIds.has(r.staff_id) && !apiIds.has(r.name)),
      ];

      const totalStaff   = staffList.length > 0 ? staffList.length : Math.max(merged.length, allUsers.length);
      const presentCount = merged.filter(r => r.status === 'present' || r.status === 'late_comer').length;

      const onLeave = leaveList.filter(l => l.status === 'approved').length;
      const pending = leaveList.filter(l => l.status === 'pending').length;

      setStats({ total: totalStaff, present: presentCount, onLeave, pending });

      const recent = merged
        .filter(r => r.check_in)
        .sort((a, b) => (b.check_in || '').localeCompare(a.check_in || ''))
        .slice(0, 8)
        .map(r => ({
          id:     r.staff_id || r.name,
          name:   r.name,
          action: `Checked in at ${r.check_in}`,
          status: r.status,
          time:   r.check_in,
        }));
      setActivity(recent);

    } catch (err) {
      console.error('Dashboard load error:', err);
    }
    finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  }, [localUsers, user, getReportForDate]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  const handleCheckIn = async (payload) => {
    setDismissed(true);
    // Write to localStorage FIRST — survives any subsequent API failure or hang
    await setCheckedIn();
    // Fire all API calls in background — failures don't affect check-in state
    checkin({
      userId:    user?.id,
      name:      user?.name || user?.username,
      date:      payload.date,
      time:      payload.time,
      latitude:  payload.latitude,
      longitude: payload.longitude,
      address:   payload.address,
    }).catch(() => {});
    if (payload.latitude != null) {
      recordUserLocation({
        userId:    user?.id,
        name:      user?.name || user?.username,
        latitude:  payload.latitude,
        longitude: payload.longitude,
        address:   payload.address,
        timestamp: `${payload.date}T${payload.time}`,
      }).catch(() => {});
    }
    startTracking(user?.id, user?.name || user?.username).catch(() => {});
    loadDashboard();
  };

  const getGreeting = () => {
    const h = dayjs().hour();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const STAT_CARDS = [
    { label: 'Total Staff',    value: stats.total,   icon: 'people',            color: '#6B7280', bg: '#F7F8FA' },
    { label: 'Present Today',  value: stats.present, icon: 'checkmark-circle',  color: '#6B7280', bg: '#F7F8FA' },
    { label: 'On Leave',       value: stats.onLeave, icon: 'calendar',          color: '#6B7280', bg: '#F7F8FA' },
    { label: 'Pending Leaves', value: stats.pending, icon: 'time',              color: '#6B7280', bg: '#F7F8FA' },
  ];

  return (
    <View style={styles.screen}>
      <Navbar navigation={navigation} activeTab="Home" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboard(true)}
            colors={[Colors.primary]}
          />
        }
      >
        <Text style={styles.greeting}>{getGreeting()}, {user?.name || user?.username || 'Admin'}</Text>
        <Text style={styles.date}>{dayjs().format('dddd, DD MMMM YYYY')}</Text>

        {/* Stats Grid */}
        <View style={styles.grid}>
          {loadingStats ? (
            <View style={styles.statsLoader}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : STAT_CARDS.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <View style={styles.statIcon}>
                <Ionicons name={s.icon} size={22} color={s.color} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          {[
            { label: 'Add User',   icon: 'person-add-outline',    screen: 'Users' },
            { label: 'Attendance', icon: 'calendar-outline',      screen: 'Attendance' },
            { label: 'Live Track', icon: 'locate-outline',        screen: 'Tracking' },
          ].map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.actionCard}
              onPress={() => navigation.navigate(a.screen)}
            >
              <Ionicons name={a.icon} size={22} color={'#C0392B'} />
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Activity — live from today's checkins */}
        <Text style={styles.sectionTitle}>Today's Check-ins</Text>
        <View style={styles.activityCard}>
          {activity.length > 0 ? activity.map((item) => {
            const meta = STATUS_META[item.status] || { label: item.status, color: Colors.textLight };
            return (
              <View key={item.id} style={styles.activityRow}>
                <View style={[styles.activityIcon, { backgroundColor: '#F3F4F6' }]}>
                  <Text style={[styles.activityInitial, { color: '#374151' }]}>
                    {(item.name || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityName}>{item.name}</Text>
                  <Text style={styles.activityAction}>{item.action}</Text>
                </View>
                <View style={[styles.activityBadge, { backgroundColor: '#F3F4F6' }]}>
                  <Text style={[styles.activityBadgeTxt, { color: '#6B7280' }]}>{meta.label}</Text>
                </View>
              </View>
            );
          }) : (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Ionicons name="calendar-outline" size={28} color={Colors.textMuted} />
              <Text style={{ color: Colors.textLight, fontSize: 13, marginTop: 8 }}>
                No check-ins recorded yet today
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <CheckInModal
        visible={!isLoading && !isCheckedInToday() && !dismissed}
        onCheckIn={handleCheckIn}
        onClose={() => setDismissed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:           { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },
  container:        { flex: 1, width: '100%' },
  content:          { padding: 16, paddingBottom: 40 },
  greeting:         { fontSize: 22, fontWeight: '700', color: Colors.text, marginTop: 8 },
  date:             { fontSize: 13, color: Colors.textLight, marginBottom: 20 },
  grid:             { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statsLoader:      { width: '100%', paddingVertical: 30, alignItems: 'center' },
  statCard:         { width: '47%', borderRadius: 12, padding: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  statIcon:         { width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10, backgroundColor: '#F7F8FA' },
  statValue:        { fontSize: 28, fontWeight: '700', color: '#111827' },
  statLabel:        { fontSize: 12, color: '#6B7280', marginTop: 2 },
  sectionTitle:     { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  actionsRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  actionCard:       { backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', width: '22%', minWidth: 72, borderWidth: 1, borderColor: '#E5E7EB', gap: 6 },
  actionLabel:      { fontSize: 11, color: Colors.text, fontWeight: '500', textAlign: 'center' },
  activityCard:     { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  activityRow:      { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider, gap: 12 },
  activityIcon:     { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  activityInitial:  { fontSize: 15, fontWeight: '700' },
  activityName:     { fontSize: 14, fontWeight: '600', color: Colors.text },
  activityAction:   { fontSize: 12, color: Colors.textLight },
  activityBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activityBadgeTxt: { fontSize: 10, fontWeight: '700' },
});
