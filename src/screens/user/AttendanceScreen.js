import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import api from '@services/api';
import { useAuthStore } from '@store/authStore';
import { useAttendanceStore } from '@store/attendanceStore';

// ─── Status config ───────────────────────────────────────────────────────────
const STATUS_META = {
  present:     { label: 'Present',     bg: '#D1FAE5', color: '#065F46', icon: 'checkmark-circle' },
  late_comer:  { label: 'Late Comer',  bg: '#FEF3C7', color: '#92400E', icon: 'time' },
  absent:      { label: 'Absent',      bg: '#FEE2E2', color: '#991B1B', icon: 'close-circle' },
  half_day:    { label: 'Half Day',    bg: '#EDE9FE', color: '#5B21B6', icon: 'remove-circle' },
  early_leave: { label: 'Early Leave', bg: '#FFEDD5', color: '#9A3412', icon: 'exit' },
  holiday:     { label: 'Holiday',     bg: '#FEF9C3', color: '#78350F', icon: 'sunny' },
  sunday:      { label: 'Sunday',      bg: '#F1F5F9', color: '#64748B', icon: 'moon' },
};

function StatusChip({ status }) {
  const m = STATUS_META[status] || STATUS_META.absent;
  return (
    <View style={[chip.box, { backgroundColor: m.bg }]}>
      <Ionicons name={m.icon} size={11} color={m.color} />
      <Text style={[chip.text, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}
const chip = StyleSheet.create({
  box:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  text: { fontSize: 11, fontWeight: '600' },
});

// ─── Summary Card ────────────────────────────────────────────────────────────
function SummaryCard({ label, value, color, icon }) {
  return (
    <View style={[sc.card, { borderTopColor: color }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[sc.value, { color }]}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card:  { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderTopWidth: 3, borderWidth: 1, borderColor: '#E5E7EB', gap: 4 },
  value: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 11, color: Colors.textLight, fontWeight: '600', textAlign: 'center' },
});

// ─── Daily Tab ───────────────────────────────────────────────────────────────
function DailyTab({ month, onMonthChange }) {
  const { user } = useAuthStore();
  const { getDailyReport, ready } = useAttendanceStore();
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const workingDays = records.filter(r => r.status !== 'sunday' && r.status !== 'holiday' && r.status !== null);
  const summary = {
    total:   workingDays.length,
    present: workingDays.filter(r => r.status === 'present').length,
    absent:  workingDays.filter(r => r.status === 'absent').length,
    half:    workingDays.filter(r => r.status === 'half_day').length,
  };

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      // Try real API
      const data = await api.get(`/attendance/my-report?month=${month}`).catch(() => null);
      const apiRecords = Array.isArray(data) ? data : (data?.records || []);

      if (apiRecords.length > 0) {
        setRecords(apiRecords);
      } else {
        // Fall back to local store
        const localRecords = getDailyReport(user?.id, month);
        setRecords(localRecords);
      }
    } catch {
      const localRecords = getDailyReport(user?.id, month);
      setRecords(localRecords);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { if (ready) load(); }, [month, user?.id, ready]));

  const changeMonth = (delta) => {
    onMonthChange(dayjs(month + '-01').add(delta, 'month').format('YYYY-MM'));
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Month Navigator */}
      <View style={dt.monthRow}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={dt.arrow}>
          <Ionicons name="chevron-back" size={18} color={Colors.text} />
        </TouchableOpacity>
        <Text style={dt.monthText}>{dayjs(month + '-01').format('MMMM YYYY')}</Text>
        <TouchableOpacity onPress={() => changeMonth(1)} style={dt.arrow}>
          <Ionicons name="chevron-forward" size={18} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Summary Row */}
      <View style={dt.summaryRow}>
        <SummaryCard label="Working Days" value={summary.total}   color={Colors.text}    icon="calendar" />
        <SummaryCard label="Present"      value={summary.present} color={Colors.success} icon="checkmark-circle" />
        <SummaryCard label="Absent"       value={summary.absent}  color={Colors.danger}  icon="close-circle" />
        <SummaryCard label="Half Day"     value={summary.half}    color="#8B5CF6"        icon="remove-circle" />
      </View>

      {/* Table Header */}
      <View style={dt.header}>
        <Text style={[dt.hCell, { flex: 1, textAlign: 'left' }]}>DATE</Text>
        <Text style={dt.hCell}>IN</Text>
        <Text style={dt.hCell}>OUT</Text>
        <Text style={[dt.hCell, { flex: 1.5 }]}>STATUS</Text>
      </View>

      {loading ? (
        <View style={dt.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <FlatList
          style={{ flex: 1, width: '100%' }}
          data={records}
          keyExtractor={(_, i) => String(i)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.primary]} />}
          renderItem={({ item }) => {
            const isSunday  = item.status === 'sunday';
            const isHoliday = item.status === 'holiday';
            const isAbsent  = item.status === 'absent';
            return (
              <View style={[dt.row, (isSunday || isHoliday) && dt.rowMuted, isAbsent && dt.rowAbsent]}>
                <View style={[dt.cell, { flex: 1, alignItems: 'flex-start' }]}>
                  <Text style={[dt.dayLabel, isSunday && { color: Colors.textMuted }]}>{dayjs(item.date).format('ddd')}</Text>
                  <Text style={dt.dateNum}>{dayjs(item.date).format('DD MMM')}</Text>
                </View>
                <Text style={dt.cell}>{item.check_in  || '—'}</Text>
                <Text style={dt.cell}>{item.check_out || '—'}</Text>
                <View style={[dt.cell, { flex: 1.5, alignItems: 'center' }]}>
                  <StatusChip status={item.status} />
                </View>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.divider }} />}
          ListEmptyComponent={
            <View style={dt.center}>
              <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
              <Text style={dt.empty}>No records found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const dt = StyleSheet.create({
  monthRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 16 },
  arrow:      { padding: 6, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8 },
  monthText:  { fontSize: 15, fontWeight: '700', color: Colors.text },
  summaryRow: { flexDirection: 'row', gap: 8, marginHorizontal: 12, marginBottom: 10 },
  header:     { flexDirection: 'row', backgroundColor: '#F7F8FA', paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border },
  hCell:      { flex: 1, fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, textAlign: 'center' },
  row:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, backgroundColor: '#fff' },
  rowMuted:   { backgroundColor: '#F7F8FA' },
  rowAbsent:  { backgroundColor: '#FFF5F5' },
  cell:       { flex: 1, fontSize: 12, color: Colors.text, textAlign: 'center' },
  dayLabel:   { fontSize: 10, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  dateNum:    { fontSize: 13, fontWeight: '700', color: Colors.text, marginTop: 1 },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, gap: 10 },
  empty:      { fontSize: 14, color: Colors.textMuted },
});

// ─── Monthly Summary Tab ─────────────────────────────────────────────────────
function MonthlySummaryTab() {
  const { user } = useAuthStore();
  const { getMonthlySummary, ready } = useAttendanceStore();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear]       = useState(dayjs().year());

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/attendance/my-monthly?year=${year}`).catch(() => null);
      const apiRecords = Array.isArray(data) ? data : (data?.records || []);

      if (apiRecords.length > 0) {
        setRecords(apiRecords);
      } else {
        // Build from local store month by month
        const months = [];
        for (let m = 1; m <= 12; m++) {
          const monthStr = `${year}-${String(m).padStart(2, '0')}`;
          const s = getMonthlySummary(user?.id, monthStr);
          const daysInMonth = dayjs(monthStr + '-01').daysInMonth();
          // Count working days (exclude sundays)
          let working = 0;
          for (let d = 1; d <= daysInMonth; d++) {
            if (dayjs(`${monthStr}-${String(d).padStart(2,'0')}`).day() !== 0) working++;
          }
          months.push({ month: monthStr, working_days: working, ...s });
        }
        setRecords(months);
      }
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { if (ready) load(); }, [year, user?.id, ready]));

  return (
    <View style={{ flex: 1 }}>
      <View style={mst.yearRow}>
        <TouchableOpacity onPress={() => setYear(y => y - 1)} style={mst.arrow}>
          <Ionicons name="chevron-back" size={18} color={Colors.text} />
        </TouchableOpacity>
        <Text style={mst.yearText}>{year}</Text>
        <TouchableOpacity onPress={() => setYear(y => y + 1)} style={mst.arrow}>
          <Ionicons name="chevron-forward" size={18} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <View style={mst.header}>
        <Text style={[mst.hCell, { flex: 1.5 }]}>MONTH</Text>
        <Text style={mst.hCell}>ALL DAYS</Text>
        <Text style={mst.hCell}>PRESENT</Text>
        <Text style={mst.hCell}>ABSENT</Text>
        <Text style={mst.hCell}>HALF</Text>
      </View>

      {loading ? (
        <View style={mst.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <FlatList
          style={{ flex: 1, width: '100%' }}
          data={records}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <View style={mst.row}>
              <Text style={[mst.cell, { flex: 1.5, fontWeight: '600', color: Colors.text, textAlign: 'left' }]}>
                {dayjs(item.month + '-01').format('MMM YYYY')}
              </Text>
              <Text style={mst.cell}>{item.working_days ?? '—'}</Text>
              <Text style={[mst.cell, { color: Colors.success }]}>{item.present ?? '—'}</Text>
              <Text style={[mst.cell, { color: Colors.danger }]}>{item.absent ?? '—'}</Text>
              <Text style={[mst.cell, { color: '#8B5CF6' }]}>{item.half_day ?? '—'}</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.divider }} />}
          ListEmptyComponent={
            <View style={mst.center}>
              <Ionicons name="bar-chart-outline" size={40} color={Colors.textMuted} />
              <Text style={mst.empty}>No monthly data</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const mst = StyleSheet.create({
  yearRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 16 },
  arrow:    { padding: 6, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8 },
  yearText: { fontSize: 15, fontWeight: '700', color: Colors.text },
  header:   { flexDirection: 'row', backgroundColor: '#F7F8FA', paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border },
  hCell:    { flex: 1, fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, textAlign: 'center' },
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 12, backgroundColor: '#fff' },
  cell:     { flex: 1, fontSize: 14, fontWeight: '600', textAlign: 'center', color: Colors.textLight },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, gap: 10 },
  empty:    { fontSize: 14, color: Colors.textMuted },
});

// ─── Holidays Tab (read-only for user) ───────────────────────────────────────
function HolidaysTab() {
  const { getHolidaysForYear } = useAttendanceStore();
  const [year, setYear] = useState(dayjs().year());

  const holidays = getHolidaysForYear(year);

  const today = dayjs().format('YYYY-MM-DD');
  const upcoming = holidays.filter(h => h.date >= today);
  const past     = holidays.filter(h => h.date < today);

  const renderItem = ({ item }) => (
    <View style={hol.card}>
      <View style={hol.iconBox}>
        <Ionicons name="sunny" size={22} color={Colors.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={hol.hName}>{item.name}</Text>
        <Text style={hol.hDate}>{dayjs(item.date).format('dddd, DD MMMM YYYY')}</Text>
      </View>
      {item.date >= today && (
        <View style={hol.upcomingBadge}>
          <Text style={hol.upcomingText}>Upcoming</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={hol.yearRow}>
        <TouchableOpacity onPress={() => setYear(y => y - 1)} style={hol.arrow}>
          <Ionicons name="chevron-back" size={18} color={Colors.text} />
        </TouchableOpacity>
        <Text style={hol.yearText}>{year}</Text>
        <TouchableOpacity onPress={() => setYear(y => y + 1)} style={hol.arrow}>
          <Ionicons name="chevron-forward" size={18} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 40 }}>
        {upcoming.length > 0 && (
          <>
            <Text style={hol.section}>Upcoming Holidays</Text>
            {upcoming.map((item, i) => renderItem({ item, index: i }))}
          </>
        )}
        {past.length > 0 && (
          <>
            <Text style={[hol.section, { marginTop: 16 }]}>Past Holidays</Text>
            {past.map((item, i) => (
              <View key={i} style={hol.pastWrap}>{renderItem({ item, index: i })}</View>
            ))}
          </>
        )}
        {holidays.length === 0 && (
          <View style={hol.center}>
            <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
            <Text style={hol.empty}>No holidays this year</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const hol = StyleSheet.create({
  yearRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 16 },
  arrow:         { padding: 6, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8 },
  yearText:      { fontSize: 15, fontWeight: '700', color: Colors.text },
  section:       { fontSize: 12, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.5, marginBottom: 6 },
  card:          { backgroundColor: '#fff', borderRadius: 12, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, marginBottom: 8 },
  iconBox:       { width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center' },
  hName:         { fontSize: 14, fontWeight: '700', color: Colors.text },
  hDate:         { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  upcomingBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  upcomingText:  { fontSize: 10, fontWeight: '700', color: '#065F46' },
  pastWrap:      { opacity: 0.6 },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, gap: 10 },
  empty:         { fontSize: 14, color: Colors.textMuted },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
const TABS = ['DAILY REPORT', 'MONTHLY STATS', 'HOLIDAYS'];

export default function UserAttendanceScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState(0);
  const [month, setMonth]         = useState(dayjs().format('YYYY-MM'));

  return (
    <View style={s.screen}>
      <Navbar navigation={navigation} activeTab="Attendance" />

      <View style={s.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={t} style={[s.tab, activeTab === i && s.tabActive]} onPress={() => setActiveTab(i)}>
            <Text style={[s.tabText, activeTab === i && s.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === 0 && <DailyTab month={month} onMonthChange={setMonth} />}
        {activeTab === 1 && <MonthlySummaryTab />}
        {activeTab === 2 && <HolidaysTab />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen:        { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },
  tabBar:        { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab:           { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:     { borderBottomColor: '#C0392B' },
  tabText:       { fontSize: 11, fontWeight: '600', color: Colors.textLight, letterSpacing: 0.5 },
  tabTextActive: { color: '#C0392B' },
});
