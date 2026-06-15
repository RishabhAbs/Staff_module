import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, FlatList, Modal, ActivityIndicator, RefreshControl, Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import api from '@services/api';
import { useAuthStore } from '@store/authStore';
import { useAttendanceStore } from '@store/attendanceStore';

// ── Status badge (matches image exactly) ──────────────────────────────────────
const STATUS_META = {
  present:     { label: 'PRESENT',     bg: '#D1FAE5', color: '#065F46' },
  late_comer:  { label: 'LATE COMER',  bg: '#FEF3C7', color: '#92400E' },
  absent:      { label: 'ABSENT',      bg: '#FEE2E2', color: '#991B1B' },
  half_day:    { label: 'HALF DAY',    bg: '#EDE9FE', color: '#5B21B6' },
  early_leave: { label: 'EARLY LEAVE', bg: '#FFEDD5', color: '#9A3412' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.absent;
  return (
    <View style={[bdg.box, { backgroundColor: m.bg }]}>
      <Text style={[bdg.txt, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}
const bdg = StyleSheet.create({
  box: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 5 },
  txt: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
});

// ── Force action modal ─────────────────────────────────────────────────────────
function ForceModal({ visible, record, onClose, onDone }) {
  const [loading, setLoading] = useState(false);
  const { forceAction } = useAttendanceStore();

  const doAction = async (type) => {
    setLoading(true);
    try {
      const date = dayjs().format('YYYY-MM-DD');
      const time = dayjs().format('HH:mm:ss');
      // Save locally first
      await forceAction({ userId: record?.staff_id, name: record?.name, date, time, type });
      // Try real API
      api.post('/attendance/force', { staff_id: record?.staff_id, type, date, time }).catch(() => {});
      onDone();
    } catch (e) {
      Alert.alert('Error', e?.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={fmod.overlay}>
        <View style={fmod.card}>
          <Text style={fmod.title}>Force Action</Text>
          <Text style={fmod.name}>{record?.name}</Text>
          <Text style={fmod.sub}>
            {record?.check_in ? `IN: ${record.check_in}` : 'Not checked in'}
            {record?.check_out ? `  ·  OUT: ${record.check_out}` : ''}
          </Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
          ) : (
            <View style={fmod.row}>
              <TouchableOpacity
                style={[fmod.btn, { backgroundColor: Colors.success }, record?.check_in && { opacity: 0.4 }]}
                onPress={() => doAction('check_in')}
                disabled={!!record?.check_in}
              >
                <Ionicons name="log-in-outline" size={16} color="#fff" />
                <Text style={fmod.btnTxt}>Force Check-In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[fmod.btn, { backgroundColor: Colors.brandRed }, record?.check_out && { opacity: 0.4 }]}
                onPress={() => doAction('check_out')}
                disabled={!!record?.check_out}
              >
                <Ionicons name="log-out-outline" size={16} color="#fff" />
                <Text style={fmod.btnTxt}>Force Check-Out</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={fmod.cancel} onPress={onClose}>
            <Text style={fmod.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const fmod = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:      { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 380, padding: 24 },
  title:     { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  name:      { fontSize: 15, fontWeight: '600', color: Colors.primary },
  sub:       { fontSize: 12, color: Colors.textLight, marginTop: 2, marginBottom: 18 },
  row:       { flexDirection: 'row', gap: 10, marginBottom: 10 },
  btn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 9 },
  btnTxt:    { color: '#fff', fontWeight: '600', fontSize: 13 },
  cancel:    { alignItems: 'center', paddingVertical: 8 },
  cancelTxt: { color: Colors.textLight, fontSize: 13 },
});

// ── Holiday form modal ─────────────────────────────────────────────────────────
function HolidayModal({ visible, onClose, onSave }) {
  const [name, setName]     = useState('');
  const [date, setDate]     = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !date.trim()) return Alert.alert('Error', 'Fill all fields');
    setSaving(true);
    try {
      await api.post('/attendance/holidays', { name, date });
      onSave(); setName(''); setDate('');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not save');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={hmod.overlay}>
        <View style={hmod.card}>
          <Text style={hmod.title}>Add Holiday</Text>
          <Text style={hmod.lbl}>Holiday Name</Text>
          <TextInput style={hmod.input} value={name} onChangeText={setName} placeholder="e.g. Diwali" placeholderTextColor={Colors.textMuted} />
          <Text style={hmod.lbl}>Date (YYYY-MM-DD)</Text>
          <TextInput style={hmod.input} value={date} onChangeText={setDate} placeholder="2026-10-20" placeholderTextColor={Colors.textMuted} />
          <View style={hmod.row}>
            <TouchableOpacity style={hmod.cancel} onPress={onClose}><Text style={hmod.cancelTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={hmod.save} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={hmod.saveTxt}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const hmod = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card:      { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  title:     { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  lbl:       { fontSize: 12, fontWeight: '600', color: Colors.textLight, marginBottom: 4 },
  input:     { borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, color: Colors.text, marginBottom: 13 },
  row:       { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancel:    { flex: 1, paddingVertical: 12, borderRadius: 9, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelTxt: { color: Colors.textLight, fontWeight: '600' },
  save:      { flex: 1, paddingVertical: 12, borderRadius: 9, backgroundColor: Colors.primary, alignItems: 'center' },
  saveTxt:   { color: '#fff', fontWeight: '700' },
});

// ── DAILY REPORT tab ──────────────────────────────────────────────────────────
function DailyReport({ navigation, selectedDate, onDateChange, search }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { user, users: localUsers, loadUsers } = useAuthStore();
  const { getReportForDate, forceAction, ready } = useAttendanceStore();
  const [records, setRecords]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [forceRecord, setForceRecord] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);

  const stats = {
    staff:   records.length,
    present: records.filter(r => r.status === 'present').length,
    absent:  records.filter(r => r.status === 'absent').length,
    half:    records.filter(r => r.status === 'half_day').length,
    late:    records.filter(r => r.status === 'late_comer').length,
    early:   records.filter(r => r.status === 'early_leave').length,
  };

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      // 1. Always fetch live attendance records first — these are the source of truth
      const apiData = await api.get(`/attendance/report?date=${selectedDate}`).catch(() => null);
      const apiRecords = Array.isArray(apiData) ? apiData : [];

      // 2. Try to get full staff list so we can show absent staff too
      let allUsers = localUsers || [];
      if (allUsers.length === 0) {
        try { allUsers = (await loadUsers()) || []; } catch { allUsers = []; }
      }

      if (allUsers.length > 0) {
        // Merge: every staff member appears — marked absent if no record
        const mergedRecords = allUsers.map(u => {
          const found = apiRecords.find(r => r.staff_id === u.id);
          if (found) return { ...found, name: found.name || u.name || u.username };
          return { staff_id: u.id, name: u.name || u.username, check_in: null, check_out: null, status: 'absent' };
        });
        setRecords(mergedRecords);
      } else {
        // Staff list unavailable — show whoever has a record (check-in/out data is still visible)
        setRecords(apiRecords);
      }
    } catch { setRecords([]); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, [selectedDate]));

  const filtered = records.filter(r => {
    const matchSearch = r.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const renderRow = ({ item }) => {
    const rowContent = (
      <View style={[dr.row, isMobile && { paddingHorizontal: 10 }]}>
        {/* Avatar + name */}
        <View style={[dr.cell, { flex: isMobile ? 2 : 2.8, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8 }]}>
          <View style={dr.avatar}>
            <Text style={dr.avatarTxt}>{(item.name || '?')[0].toUpperCase()}</Text>
          </View>
          <Text style={dr.empName} numberOfLines={1}>{item.name?.toUpperCase()}</Text>
        </View>
        {/* IN */}
        <Text style={[dr.cell, dr.timeText, { flex: 1.2 }]}>{item.check_in || '-'}</Text>
        {/* OUT */}
        <Text style={[dr.cell, dr.timeText, { flex: 1.2 }]}>{item.check_out || '-'}</Text>
        {/* STATUS */}
        <View style={[dr.cell, { flex: 1.5, alignItems: 'center' }]}>
          <StatusBadge status={item.status} />
        </View>
        {/* ACTION — visible only on desktop */}
        {!isMobile && (
          <View style={[dr.cell, { flex: 1.2, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}>
            <TouchableOpacity onPress={() => navigation.navigate('Tracking')}>
              <Ionicons name="paper-plane-outline" size={17} color={Colors.textLight} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setForceRecord(item)}>
              <Ionicons name="flash" size={17} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );

    if (!isMobile) return rowContent;

    // Mobile: wrap in horizontal ScrollView for swipe-to-reveal actions
    return (
      <View style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Scrollable row on top */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexDirection: 'row' }}
          contentContainerStyle={{ minWidth: '100%' }}
          snapToInterval={width}
          decelerationRate="fast"
          bounces={false}
        >
          <View style={{ width: width, backgroundColor: '#fff' }}>
            {rowContent}
          </View>
          {/* Action buttons sitting right next to the row content */}
          <View style={{ flexDirection: 'row', width: 140 }}>
            <TouchableOpacity
              style={[dr.swipeBtn, { backgroundColor: '#3B82F6', width: 70 }]}
              onPress={() => navigation.navigate('Tracking')}
            >
              <Ionicons name="paper-plane-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[dr.swipeBtn, { backgroundColor: Colors.danger, width: 70 }]}
              onPress={() => setForceRecord(item)}
            >
              <Ionicons name="flash" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>

      {/* Stats cards — clickable filters */}
      <View style={dr.statsRow}>
        {[
          { lbl: 'STAFF',   val: stats.staff,   color: Colors.text,    key: null },
          { lbl: 'PRESENT', val: stats.present, color: Colors.success, key: 'present' },
          { lbl: 'ABSENT',  val: stats.absent,  color: Colors.danger,  key: 'absent' },
          { lbl: 'HALF',    val: stats.half,    color: '#8B5CF6',      key: 'half_day' },
          { lbl: 'LATE',    val: stats.late,    color: Colors.warning, key: 'late_comer' },
          { lbl: 'EARLY',   val: stats.early,   color: '#F97316',      key: 'early_leave' },
        ].map((s, i, arr) => {
          const isActive = statusFilter === s.key;
          return (
            <TouchableOpacity
              key={s.lbl}
              style={[dr.statBox, i < arr.length - 1 && dr.statBoxBorder, isActive && { backgroundColor: '#F7F8FA' }]}
              onPress={() => setStatusFilter(isActive ? null : s.key)}
              activeOpacity={0.7}
            >
              <Text style={[dr.statLbl, isActive && { color: s.color }]}>{s.lbl}</Text>
              <Text style={[dr.statVal, { color: s.color }]}>{s.val}</Text>
              {isActive && <View style={[dr.statUnderline, { backgroundColor: s.color }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Table header */}
      <View style={dr.tableHeader}>
        <Text style={[dr.th, { flex: isMobile ? 2 : 2.8 }]}>EMPLOYEE</Text>
        <Text style={[dr.th, { flex: 1.2, textAlign: 'center' }]}>IN</Text>
        <Text style={[dr.th, { flex: 1.2, textAlign: 'center' }]}>OUT</Text>
        <Text style={[dr.th, { flex: 1.5, textAlign: 'center' }]}>STATUS</Text>
        {!isMobile && <Text style={[dr.th, { flex: 1.2, textAlign: 'center' }]}>ACTION</Text>}
      </View>

      {loading ? (
        <View style={dr.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <FlatList
          style={{ flex: 1, width: '100%' }}
          data={filtered}
          keyExtractor={(_, i) => String(i)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.primary]} />}
          ItemSeparatorComponent={() => <View style={dr.sep} />}
          ListEmptyComponent={
            <View style={dr.center}>
              <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
              <Text style={dr.empty}>No attendance records</Text>
            </View>
          }
          renderItem={renderRow}
        />
      )}

      <ForceModal
        visible={!!forceRecord}
        record={forceRecord}
        onClose={() => setForceRecord(null)}
        onDone={() => { setForceRecord(null); load(); }}
      />
    </View>
  );
}

const dr = StyleSheet.create({
  statsRow:    { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  statBox:      { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  statBoxBorder:{ borderRightWidth: 1, borderRightColor: Colors.border },
  statLbl:      { fontSize: 9, fontWeight: '600', color: Colors.textMuted, letterSpacing: 0.4, marginBottom: 4 },
  statVal:      { fontSize: 20, fontWeight: '700' },
  statUnderline:{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderRadius: 2 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F7F8FA', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  th:          { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, backgroundColor: '#fff' },
  cell:        { justifyContent: 'flex-start' },
  avatar:      { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  avatarTxt:   { fontSize: 11, fontWeight: '700', color: '#374151' },
  empName:     { fontSize: 12, fontWeight: '700', color: Colors.text, letterSpacing: 0.2 },
  timeText:    { fontSize: 12, color: Colors.textLight, textAlign: 'center' },
  sep:         { height: 1, backgroundColor: Colors.divider },
  center:      { paddingVertical: 60, alignItems: 'center', gap: 10 },
  empty:       { fontSize: 14, color: Colors.textMuted },
  swipeActions:{ position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'stretch' },
  swipeBtn:    { width: 70, justifyContent: 'center', alignItems: 'center', gap: 4 },
  swipeBtnTxt: { fontSize: 10, fontWeight: '700', color: '#fff' },
  swipeHint:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 5, backgroundColor: '#FFFBEB', borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  swipeHintTxt:{ fontSize: 10, color: Colors.textMuted, fontWeight: '500' },
});

// ── MONTHLY STATS tab ─────────────────────────────────────────────────────────
function MonthlyStats({ search, month, onMonthChange, navigation }) {
  const { user, users: localUsers, loadUsers } = useAuthStore();
  const { getMonthlySummary, ready } = useAttendanceStore();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const changeMonth = (d) => onMonthChange(dayjs(month + '-01').add(d, 'month').format('YYYY-MM'));

  const load = async () => {
    setLoading(true);
    try {
      let allUsers = localUsers || [];
      if (allUsers.length === 0) allUsers = await loadUsers();

      // Fetch monthly stats per user in parallel
      const results = await Promise.all(
        allUsers.map(async (u) => {
          try {
            const rows = await api.get(`/attendance/monthly?userId=${u.id}&month=${month}`);
            const data = Array.isArray(rows) ? rows : [];
            return {
              userId: u.id,
              name: u.name || u.username,
              present:     data.filter(r => r.status === 'present').length,
              absent:      data.filter(r => r.status === 'absent').length,
              half_day:    data.filter(r => r.status === 'half_day').length,
              late:        data.filter(r => r.status === 'late_comer').length,
              early_leave: data.filter(r => r.status === 'early_leave').length,
            };
          } catch {
            return { userId: u.id, name: u.name || u.username, present: 0, absent: 0, half_day: 0, late: 0, early_leave: 0 };
          }
        })
      );
      setRecords(results);
    } catch { setRecords([]); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, [month]));

  const filtered = records.filter(r => r.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={{ flex: 1 }}>

      <View style={ms.tableHeader}>
        <Text style={[ms.th, { flex: 2.5, textAlign: 'left' }]}>USER</Text>
        <Text style={ms.th}>PRESENT</Text>
        <Text style={ms.th}>ABSENT</Text>
        <Text style={ms.th}>HALF DAY</Text>
        <Text style={ms.th}>LATE</Text>
        <Text style={ms.th}>EARLY</Text>
      </View>

      {loading ? (
        <View style={ms.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <FlatList
          style={{ flex: 1, width: '100%' }}
          data={filtered}
          keyExtractor={(_, i) => String(i)}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.divider }} />}
          ListEmptyComponent={
            <View style={ms.center}>
              <Ionicons name="bar-chart-outline" size={40} color={Colors.textMuted} />
              <Text style={ms.empty}>No data for this month</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={ms.row}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('UserDetail', { userId: item.userId || item.id, name: item.name })}
            >
              <View style={[ms.cell, { flex: 2.5, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                <View style={ms.avatar}>
                  <Text style={ms.avatarTxt}>{(item.name || '?')[0].toUpperCase()}</Text>
                </View>
                <Text style={ms.nameTxt} numberOfLines={1}>{item.name}</Text>
              </View>
              <Text style={[ms.cell, { color: Colors.success }]}>{item.present ?? '—'}</Text>
              <Text style={[ms.cell, { color: Colors.danger }]}>{item.absent ?? '—'}</Text>
              <Text style={[ms.cell, { color: '#8B5CF6' }]}>{item.half_day ?? '—'}</Text>
              <Text style={[ms.cell, { color: Colors.warning }]}>{item.late ?? '—'}</Text>
              <Text style={[ms.cell, { color: '#F97316' }]}>{item.early_leave ?? '—'}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const ms = StyleSheet.create({
  nav:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#fff', gap: 20 },
  arrow:       { padding: 6 },
  navTxt:      { fontSize: 14, fontWeight: '700', color: Colors.text },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F7F8FA', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  th:          { flex: 1, fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, textAlign: 'center' },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#fff' },
  cell:        { flex: 1, fontSize: 14, fontWeight: '600', textAlign: 'center', color: Colors.text },
  avatar:      { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  avatarTxt:   { fontSize: 11, fontWeight: '700', color: '#374151' },
  nameTxt:     { fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1 },
  center:      { paddingVertical: 60, alignItems: 'center', gap: 10 },
  empty:       { fontSize: 14, color: Colors.textMuted },
});

// ── ADD HOLIDAY MODAL ─────────────────────────────────────────────────────────
function AddHolidayModal({ visible, prefilledDate, onClose, onSave }) {
  const [name, setName]   = useState('');
  const [date, setDate]   = useState('');
  const [saving, setSaving] = useState(false);
  const { addHoliday } = useAttendanceStore();

  React.useEffect(() => {
    if (prefilledDate) setDate(prefilledDate);
    else setDate('');
    setName('');
  }, [prefilledDate, visible]);

  const save = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Holiday name is required');
    if (!date.trim() || !dayjs(date).isValid()) return Alert.alert('Error', 'Enter a valid date (YYYY-MM-DD)');
    setSaving(true);
    await addHoliday({ name: name.trim(), date, type: 'custom' });
    api.post('/attendance/holidays', { name, date }).catch(() => {});
    setSaving(false);
    onSave();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={am.overlay}>
        <View style={am.card}>
          <View style={am.header}>
            <View style={am.iconBox}>
              <Ionicons name="sunny" size={20} color={Colors.warning} />
            </View>
            <Text style={am.title}>Add Holiday</Text>
            <TouchableOpacity onPress={onClose} style={am.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textLight} />
            </TouchableOpacity>
          </View>

          <Text style={am.lbl}>Holiday Name</Text>
          <TextInput
            style={am.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Diwali, Company Anniversary"
            placeholderTextColor={Colors.textMuted}
            autoFocus
          />

          <Text style={am.lbl}>Date</Text>
          <TextInput
            style={am.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textMuted}
          />
          {date.length === 10 && dayjs(date).isValid() && (
            <Text style={am.dateParsed}>
              {dayjs(date).format('dddd, DD MMMM YYYY')}
            </Text>
          )}

          <View style={am.row}>
            <TouchableOpacity style={am.cancelBtn} onPress={onClose}>
              <Text style={am.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={am.saveBtn} onPress={save} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={am.saveTxt}>Add Holiday</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const am = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:       { backgroundColor: '#fff', borderRadius: 18, padding: 20, width: '100%', maxWidth: 380 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  iconBox:    { width: 30, height: 30, borderRadius: 8, backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center' },
  title:      { fontSize: 15, fontWeight: '700', color: Colors.text, flex: 1 },
  closeBtn:   { padding: 2 },
  lbl:        { fontSize: 11, fontWeight: '600', color: Colors.textLight, marginBottom: 5 },
  input:      { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#111827', marginBottom: 12, backgroundColor: '#F7F8FA' },
  dateParsed: { fontSize: 11, color: Colors.success, marginTop: -8, marginBottom: 12, marginLeft: 2 },
  row:        { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn:  { flex: 1, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelTxt:  { color: Colors.textLight, fontWeight: '600', fontSize: 13 },
  saveBtn:    { flex: 2, paddingVertical: 10, borderRadius: 9, backgroundColor: '#C0392B', alignItems: 'center' },
  saveTxt:    { color: '#fff', fontWeight: '700', fontSize: 13 },
});

// ── MINI CALENDAR ─────────────────────────────────────────────────────────────
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function MiniCalendar({ month, holidayDates, onDatePress }) {
  const start     = dayjs(month + '-01');
  const daysCount = start.daysInMonth();
  const startDow  = start.day(); // 0=Sun
  const today     = dayjs().format('YYYY-MM-DD');

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysCount; d++) cells.push(d);

  return (
    <View style={cal.wrap}>
      {/* Day labels */}
      <View style={cal.labelRow}>
        {DAY_LABELS.map((l, i) => (
          <Text key={l} style={[cal.dayLbl, i === 0 && { color: Colors.danger }]}>{l}</Text>
        ))}
      </View>
      {/* Cells */}
      <View style={cal.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={`e-${i}`} style={cal.cell} />;
          const dateStr = start.date(d).format('YYYY-MM-DD');
          const isSun   = start.date(d).day() === 0;
          const isToday = dateStr === today;
          const isHol   = holidayDates.has(dateStr);
          return (
            <TouchableOpacity key={dateStr} style={cal.cell} onPress={() => onDatePress(dateStr)}>
              <View style={[
                cal.cellInner,
                isSun   && cal.cellInnerSun,
                isHol   && cal.cellInnerHol,
                isToday && cal.cellInnerToday,
              ]}>
                <Text style={[
                  cal.cellTxt,
                  isSun   && cal.cellTxtSun,
                  isHol   && cal.cellTxtHoliday,
                  isToday && cal.cellTxtToday,
                ]}>
                  {d}
                </Text>
                {isHol && <View style={cal.dot} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
const cal = StyleSheet.create({
  wrap:          { backgroundColor: Colors.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  labelRow:      { flexDirection: 'row', marginBottom: 4 },
  dayLbl:        { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  grid:          { flexDirection: 'row', flexWrap: 'wrap' },
  cell:          { width: `${100/7}%`, height: 44, padding: 2, justifyContent: 'center', alignItems: 'center' },
  cellSun:       { },
  cellHoliday:   { },
  cellToday:     { },
  cellInner:     { flex: 1, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  cellInnerSun:  { backgroundColor: '#FEF2F2' },
  cellInnerHol:  { backgroundColor: '#FEF3C7' },
  cellInnerToday:{ backgroundColor: Colors.primary },
  cellTxt:       { fontSize: 13, fontWeight: '500', color: Colors.text },
  cellTxtSun:    { color: Colors.danger },
  cellTxtHoliday:{ color: '#92400E', fontWeight: '700' },
  cellTxtToday:  { color: '#fff', fontWeight: '700' },
  dot:           { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.warning, position: 'absolute', bottom: 3 },
});

// ── HOLIDAYS TAB ──────────────────────────────────────────────────────────────
function HolidaysTab() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { holidays, deleteHoliday, getHolidayDates, getHolidaysForYear } = useAttendanceStore();
  const [month, setMonth]         = useState(dayjs().format('YYYY-MM'));
  const [year, setYear]           = useState(dayjs().year());
  const [showModal, setShowModal]   = useState(false);
  const [preDate, setPreDate]       = useState('');
  const [hlSearch, setHlSearch]     = useState('');

  const yearHolidays   = getHolidaysForYear(year);
  const holidayDates   = getHolidayDates(month);
  const monthHolidays  = yearHolidays.filter(h => h.date?.startsWith(month));
  const upcomingFirst  = [...yearHolidays].sort((a, b) => a.date.localeCompare(b.date));

  const changeMonth = (d) => {
    const next = dayjs(month + '-01').add(d, 'month');
    setMonth(next.format('YYYY-MM'));
    setYear(next.year());
  };

  const handleDatePress = (dateStr) => {
    const existing = holidays.find(h => h.date === dateStr);
    if (existing) {
      Alert.alert(existing.name, dayjs(dateStr).format('dddd, DD MMMM YYYY'), [
        { text: 'Delete', style: 'destructive', onPress: () => deleteHoliday(existing.id) },
        { text: 'Close' },
      ]);
    } else {
      setPreDate(dateStr);
      setShowModal(true);
    }
  };

  const del = (id, name) => Alert.alert(`Delete "${name}"?`, 'This will remove the holiday.', [
    { text: 'Cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => deleteHoliday(id) },
  ]);

  const today = dayjs().format('YYYY-MM-DD');

  const calendarSection = (
    <View style={[hl.leftCol, isMobile ? { borderRightWidth: 0, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' } : { flex: 1 }]}>
      {/* Month nav */}
      <View style={hl.nav}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={hl.navArrow}>
          <Ionicons name="chevron-back" size={16} color={Colors.text} />
        </TouchableOpacity>
        <Text style={hl.navTxt}>{dayjs(month + '-01').format('MMMM YYYY')}</Text>
        <TouchableOpacity onPress={() => changeMonth(1)} style={hl.navArrow}>
          <Ionicons name="chevron-forward" size={16} color={Colors.text} />
        </TouchableOpacity>
      </View>
      {/* Legend */}
      <View style={hl.legend}>
        {[
          { color: Colors.primary, label: 'Today' },
          { color: '#FDE68A',      label: 'Holiday' },
          { color: '#FEE2E2',      label: 'Sunday' },
        ].map(l => (
          <View key={l.label} style={hl.legendItem}>
            <View style={[hl.legendDot, { backgroundColor: l.color }]} />
            <Text style={hl.legendTxt}>{l.label}</Text>
          </View>
        ))}
      </View>
      {/* Calendar */}
      <MiniCalendar month={month} holidayDates={holidayDates} onDatePress={handleDatePress} />
    </View>
  );

  const holidayListSection = (
    <View style={[hl.rightCol, !isMobile && { flex: 1 }]}>
      {/* Header */}
      <View style={[hl.rightHeader, isMobile && { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
        <Text style={hl.rightTitle}>All Holidays — {year}</Text>
        <View style={{ flexDirection: 'row', flex: 1, gap: 10 }}>
          <View style={[hl.searchBox, { marginHorizontal: 0 }]}>
            <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
            <TextInput
              style={hl.searchInput}
              placeholder="Search holidays..."
              placeholderTextColor={Colors.textMuted}
              value={hlSearch}
              onChangeText={setHlSearch}
            />
            {hlSearch.length > 0 && (
              <TouchableOpacity onPress={() => setHlSearch('')}>
                <Ionicons name="close-circle" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={hl.addBtn} onPress={() => { setPreDate(''); setShowModal(true); }}>
            <Ionicons name="add" size={15} color="#fff" />
            <Text style={hl.addTxt}>{isMobile ? 'Add' : 'Add Holiday'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {upcomingFirst.filter(h => !hlSearch || h.name?.toLowerCase().includes(hlSearch.toLowerCase())).length === 0 ? (
        <View style={hl.empty}>
          <Ionicons name="calendar-outline" size={36} color={Colors.textMuted} />
          <Text style={hl.emptyTxt}>No holidays this year</Text>
        </View>
      ) : upcomingFirst.filter(h => !hlSearch || h.name?.toLowerCase().includes(hlSearch.toLowerCase())).map(h => {
        const isPast = h.date < today;
        return (
          <View key={h.id} style={[hl.listRow, isPast && hl.listRowPast]}>
            <View style={[hl.dateBox, isPast && hl.dateBoxPast]}>
              <Text style={[hl.dateDay, isPast && { color: Colors.textMuted }]}>{dayjs(h.date).format('DD')}</Text>
              <Text style={[hl.dateMon, isPast && { color: Colors.textMuted }]}>{dayjs(h.date).format('MMM')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[hl.listName, isPast && { color: Colors.textMuted }]}>{h.name}</Text>
              <Text style={hl.listDow}>{dayjs(h.date).format('dddd')}</Text>
            </View>
            <View style={[hl.typeBadge, { backgroundColor: h.type === 'national' ? '#FFFBEB' : '#FFF0F0' }]}>
              <Text style={[hl.typeTxt, { color: h.type === 'national' ? '#92400E' : Colors.primary }]}>
                {h.type === 'national' ? 'National' : 'Custom'}
              </Text>
            </View>
            {h.type === 'custom' && (
              <TouchableOpacity onPress={() => del(h.id, h.name)} style={hl.delBtn}>
                <Ionicons name="trash-outline" size={15} color={Colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {isMobile ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 80 }}>
          {calendarSection}
          {holidayListSection}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {calendarSection}
          {holidayListSection}
        </View>
      )}

      <AddHolidayModal
        visible={showModal}
        prefilledDate={preDate}
        onClose={() => setShowModal(false)}
        onSave={() => setShowModal(false)}
      />
    </View>
  );
}

const hl = StyleSheet.create({
  leftCol:      { borderRightWidth: 1, borderRightColor: '#E5E7EB', padding: 14, backgroundColor: '#fff' },
  rightCol:     { padding: 14, backgroundColor: '#F7F8FA' },
  rightHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  rightTitle:   { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  nav:          { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 4 },
  navArrow:     { padding: 6, borderRadius: 7, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#E5E7EB' },
  navTxt:       { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '700', color: Colors.text },
  addBtn:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#C0392B', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, gap: 4 },
  addTxt:       { color: '#fff', fontWeight: '700', fontSize: 12 },
  legend:       { flexDirection: 'row', gap: 14, marginBottom: 10, paddingHorizontal: 2 },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:    { width: 9, height: 9, borderRadius: 5 },
  legendTxt:    { fontSize: 11, color: Colors.textLight, fontWeight: '500' },
  typeBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  typeTxt:      { fontSize: 10, fontWeight: '700' },
  delBtn:       { padding: 6 },
  listRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 10, gap: 10, marginBottom: 7, borderWidth: 1, borderColor: '#E5E7EB' },
  listRowPast:  { opacity: 0.45 },
  dateBox:      { width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  dateBoxPast:  { backgroundColor: '#E2E8F0' },
  dateDay:      { fontSize: 16, fontWeight: '700', color: '#fff', lineHeight: 18 },
  dateMon:      { fontSize: 9, fontWeight: '600', color: '#fff', letterSpacing: 0.5 },
  listName:     { fontSize: 13, fontWeight: '700', color: Colors.text },
  listDow:      { fontSize: 11, color: Colors.textLight, marginTop: 1 },
  searchBox:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 10, paddingVertical: 7, marginHorizontal: 10 },
  searchInput:  { flex: 1, fontSize: 13, color: Colors.text, padding: 0, outlineStyle: 'none' },
  empty:        { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTxt:     { fontSize: 14, color: Colors.textMuted },
});

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
const TABS = ['DAILY REPORT', 'MONTHLY STATS', 'HOLIDAYS'];

export default function AdminAttendanceScreen({ navigation }) {
  const [activeTab, setActiveTab]       = useState(0);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [search, setSearch]             = useState('');
  const [month, setMonth]               = useState(dayjs().format('YYYY-MM'));

  const changeDate = (d) =>
    setSelectedDate(dayjs(selectedDate).add(d, 'day').format('YYYY-MM-DD'));

  return (
    <View style={s.screen}>
      <Navbar navigation={navigation} activeTab="Attendance" />

      {/* Top toolbar: hidden on Holidays tab */}
      {activeTab !== 2 && (
        <View style={s.toolbar}>
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={15} color={Colors.textMuted} />
            <TextInput
              style={s.searchInput}
              placeholder="Find staff..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={Colors.textMuted}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {activeTab === 0 && (
            <View style={s.datePicker}>
              <TouchableOpacity onPress={() => changeDate(-1)} style={s.dateArrow}>
                <Ionicons name="chevron-back" size={16} color={Colors.text} />
              </TouchableOpacity>
              <Text style={s.dateTxt}>{dayjs(selectedDate).format('YYYY-MM-DD')}</Text>
              <TouchableOpacity onPress={() => changeDate(1)} style={s.dateArrow}>
                <Ionicons name="chevron-forward" size={16} color={Colors.text} />
              </TouchableOpacity>
            </View>
          )}
          {activeTab === 1 && (
            <View style={s.datePicker}>
              <TouchableOpacity onPress={() => setMonth(dayjs(month + '-01').subtract(1, 'month').format('YYYY-MM'))} style={s.dateArrow}>
                <Ionicons name="chevron-back" size={16} color={Colors.text} />
              </TouchableOpacity>
              <Text style={s.dateTxt}>{dayjs(month + '-01').format('MMM YYYY')}</Text>
              <TouchableOpacity onPress={() => setMonth(dayjs(month + '-01').add(1, 'month').format('YYYY-MM'))} style={s.dateArrow}>
                <Ionicons name="chevron-forward" size={16} color={Colors.text} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={t}
            style={[s.tab, activeTab === i && s.tabActive]}
            onPress={() => setActiveTab(i)}
          >
            <Text style={[s.tabTxt, activeTab === i && s.tabTxtActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        {activeTab === 0 && (
          <DailyReport
            navigation={navigation}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            search={search}
          />
        )}
        {activeTab === 1 && <MonthlyStats search={search} month={month} onMonthChange={setMonth} navigation={navigation} />}
        {activeTab === 2 && <HolidaysTab />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },

  // toolbar
  toolbar:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', gap: 10 },
  searchBox:   { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FA', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, gap: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text, padding: 0, outlineStyle: 'none' },
  datePicker:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 4, gap: 2, backgroundColor: '#fff' },
  dateArrow:   { padding: 4 },
  dateTxt:     { fontSize: 13, fontWeight: '600', color: Colors.text, minWidth: 90, textAlign: 'center' },

  // tabs
  tabBar:      { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab:         { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:   { borderBottomColor: '#C0392B' },
  tabTxt:      { fontSize: 11, fontWeight: '600', color: Colors.textLight, letterSpacing: 0.4 },
  tabTxtActive:{ color: '#C0392B' },
});
