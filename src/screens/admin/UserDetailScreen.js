import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { Colors } from '@constants/colors';
import { useAttendanceStore } from '@store/attendanceStore';
import { useAuthStore } from '@store/authStore';
import api from '@services/api';

const STATUS_META = {
  present:     { label: 'Present',     bg: '#D1FAE5', color: '#065F46', icon: 'checkmark-circle' },
  late_comer:  { label: 'Late',        bg: '#FEF3C7', color: '#92400E', icon: 'time' },
  absent:      { label: 'Absent',      bg: '#FEE2E2', color: '#991B1B', icon: 'close-circle' },
  half_day:    { label: 'Half Day',    bg: '#EDE9FE', color: '#5B21B6', icon: 'remove-circle' },
  early_leave: { label: 'Early Leave', bg: '#FFEDD5', color: '#9A3412', icon: 'exit' },
  sunday:      { label: 'Sunday',      bg: '#F3F4F6', color: '#6B7280', icon: 'sunny' },
};

const FILTER_TABS = [
  { key: null,       label: 'All' },
  { key: 'present',  label: 'Present' },
  { key: 'absent',   label: 'Absent' },
  { key: 'half_day', label: 'Half Day' },
];

export default function UserDetailScreen({ route, navigation }) {
  const { userId, name } = route.params;
  const { ready } = useAttendanceStore();
  const { users } = useAuthStore();

  const [month, setMonth]           = useState(dayjs().format('YYYY-MM'));
  const [days, setDays]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeFilter, setActiveFilter] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/attendance/monthly?userId=${userId}&month=${month}`);
      const apiRecords = Array.isArray(data) ? data : [];
      setDays([...apiRecords].reverse());
    } catch {
      setDays([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [month, userId]));

  const changeMonth = (d) =>
    setMonth(dayjs(month + '-01').add(d, 'month').format('YYYY-MM'));

  const filtered = activeFilter
    ? days.filter(d => d.status === activeFilter)
    : days;

  const initial = (name || 'U')[0].toUpperCase();

  // Compute live statistics from the loaded days
  const summary = {
    present: days.filter(d => d.status === 'present').length,
    absent: days.filter(d => d.status === 'absent').length,
    half_day: days.filter(d => d.status === 'half_day').length,
    late_comer: days.filter(d => d.status === 'late_comer').length,
    early_leave: days.filter(d => d.status === 'early_leave').length,
    sunday: days.filter(d => d.status === 'sunday').length,
    holiday: days.filter(d => d.status === 'holiday').length,
  };

  const summaryStats = [
    { key: null,       label: 'All',      val: days.length,      color: Colors.text,    icon: 'calendar' },
    { key: 'present',  label: 'Present',  val: summary.present + summary.late_comer + summary.early_leave,  color: '#22C55E',      icon: 'checkmark-circle' },
    { key: 'absent',   label: 'Absent',   val: summary.absent,   color: '#EF4444',      icon: 'close-circle' },
    { key: 'half_day', label: 'Half Day', val: summary.half_day, color: '#8B5CF6',      icon: 'remove-circle' },
  ];

  const PAY_HEAD_DEFAULTS = {
    'Basic Salary': {
      pay_head_type: 'Earnings for Employees',
      calculation_type: 'On Attendance',
      basis_of_calculation: 'As per Calendar Period',
      statutory_pay_type: ''
    },
    'HRA': {
      pay_head_type: 'Earnings for Employees',
      calculation_type: 'On Attendance',
      basis_of_calculation: 'As per Calendar Period',
      statutory_pay_type: ''
    },
    'PF': {
      pay_head_type: "Employees' Statutory Deductions",
      calculation_type: 'As Computed Value',
      basis_of_calculation: 'User Defined',
      statutory_pay_type: 'PF Account (A/c No. 1)'
    },
    'ESI': {
      pay_head_type: "Employees' Statutory Deductions",
      calculation_type: 'As Computed Value',
      basis_of_calculation: 'User Defined',
      statutory_pay_type: 'Employee State Insurance'
    },
    'Income Tax': {
      pay_head_type: "Employees' Statutory Deductions",
      calculation_type: 'As Computed Value',
      basis_of_calculation: 'User Defined',
      statutory_pay_type: 'Income Tax'
    },
    'Professional Tax': {
      pay_head_type: "Employees' Statutory Deductions",
      calculation_type: 'As Computed Value',
      basis_of_calculation: 'User Defined',
      statutory_pay_type: 'Professional Tax'
    },
    'Custom': {
      pay_head_type: 'Earnings for Employees',
      calculation_type: 'Flat Rate',
      basis_of_calculation: 'User Defined',
      statutory_pay_type: ''
    }
  };

  // Retrieve user's salary structures
  const staffMember = users.find(u => u.id === userId) || {};
  const salaryDetails = staffMember.salary_details || [];

  // Grouped Versioning - find the active Period Version group for this month
  const activeMonthStart = dayjs(month + '-01');
  const activeMonthEnd   = activeMonthStart.endOf('month');

  let activeGroup = null;
  if (Array.isArray(salaryDetails)) {
    // If the record was saved in the legacy flat format, normalize it dynamically!
    let groupedList = [];
    if (salaryDetails.length > 0 && salaryDetails[0].items === undefined) {
      const groups = {};
      salaryDetails.forEach(item => {
        const date = item.effective_from || staffMember.date_of_joining || new Date().toISOString().split('T')[0];
        if (!groups[date]) groups[date] = [];
        groups[date].push(item);
      });
      groupedList = Object.keys(groups).map(date => ({
        effective_from: date,
        items: groups[date]
      }));
    } else {
      groupedList = salaryDetails;
    }

    // Sort chronologically
    const sortedGroups = [...groupedList].sort((a, b) => dayjs(a.effective_from).diff(dayjs(b.effective_from)));
    
    // Find the latest group active on or before this month's end
    sortedGroups.forEach(g => {
      if (g.effective_from && dayjs(g.effective_from).isBefore(activeMonthEnd)) {
        activeGroup = g;
      }
    });

    // Fallback: earliest group
    if (!activeGroup && sortedGroups.length > 0) {
      activeGroup = sortedGroups[0];
    }
  }

  const activeItems = activeGroup ? (activeGroup.items || []) : [];

  // Calculate salary components based on days present in month
  const daysInMonth = dayjs(month + '-01').daysInMonth();
  const presentCount = summary.present + summary.late_comer + summary.early_leave;
  const halfDayCount = summary.half_day;
  const sundayCount  = summary.sunday;
  const holidayCount = summary.holiday;
  
  // Paid Days: Present + 0.5 * HalfDay + Sundays + Holidays
  const paidDays = presentCount + (halfDayCount * 0.5) + sundayCount + holidayCount;

  let totalEarnings = 0;
  let totalDeductions = 0;

  const calculatedSalaryDetails = activeItems.map(item => {
    const defaults = PAY_HEAD_DEFAULTS[item.pay_head] || PAY_HEAD_DEFAULTS['Custom'];
    const merged = { ...defaults, ...item };

    const rate = parseFloat(merged.rate) || 0;
    let earned = 0;
    if (merged.calculation_type === 'On Attendance' && merged.basis_of_calculation === 'As per Calendar Period') {
      earned = (rate / daysInMonth) * paidDays;
    } else {
      earned = rate; // flat rate or computed value
    }

    if (merged.pay_head_type === 'Earnings for Employees') {
      totalEarnings += earned;
    } else {
      totalDeductions += earned;
    }

    return {
      ...merged,
      rate,
      earned: Math.round(earned * 100) / 100
    };
  });

  const netSalary = totalEarnings - totalDeductions;

  const renderSalarySummary = () => {
    if (salaryDetails.length === 0 || activeItems.length === 0) {
      return (
        <View style={s.salCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Ionicons name="wallet-outline" size={16} color={Colors.textMuted} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>No Salary Structure Setup</Text>
          </View>
          <Text style={{ fontSize: 11, color: Colors.textMuted }}>
            Go to the employee editor tab to setup pay heads for this user.
          </Text>
        </View>
      );
    }

    return (
      <View style={s.salCard}>
        {/* Card Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 10, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="wallet-outline" size={18} color={Colors.brandRed} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text }}>ESTIMATED PAYROLL SUMMARY</Text>
          </View>
          <View style={{ backgroundColor: '#FFF0EF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.brandRed }}>TALLY RULES</Text>
          </View>
        </View>

        {/* Calculation Info */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginBottom: 12 }}>
          <View>
            <Text style={{ fontSize: 10, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase' }}>Month Days</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 2 }}>{daysInMonth} Days</Text>
          </View>
          <View>
            <Text style={{ fontSize: 10, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase' }}>Paid Days</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#16A34A', marginTop: 2 }}>{paidDays} Days</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase' }}>Formula basis</Text>
            <Text style={{ fontSize: 11, fontWeight: '500', color: Colors.textLight, marginTop: 2 }}>Calendar Period</Text>
          </View>
        </View>

        {/* Pay heads list */}
        <View style={{ gap: 8, marginBottom: 14 }}>
          {calculatedSalaryDetails.map((sal, idx) => (
            <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sal.pay_head_type === 'Earnings for Employees' ? '#16A34A' : '#EF4444' }} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.text }}>
                  {sal.pay_head === 'Custom' ? (sal.custom_pay_head || 'Custom Head') : sal.pay_head}
                  {sal.pay_head_type === 'Employees\' Statutory Deductions' && sal.statutory_pay_type ? ` (${sal.statutory_pay_type})` : ''}
                </Text>
                <Text style={{ fontSize: 10, color: '#9CA3AF' }}>
                  ({sal.calculation_type === 'On Attendance' ? 'Attendance' : 'Flat'})
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.text }}>
                  ₹{sal.earned.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={{ fontSize: 9, color: '#9CA3AF' }}>
                  Rate: ₹{sal.rate.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: '#F3F4F6', marginBottom: 12 }} />

        {/* Net Salary banner */}
        <View style={{ backgroundColor: '#FFF0EF', borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.brandRed }}>NET EARNED SALARY</Text>
            <Text style={{ fontSize: 10, color: '#991B1B', marginTop: 2 }}>Earnings minus deductions</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.brandRed }}>
            ₹{Math.max(0, netSalary).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={s.screen}>

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <Text style={s.headerLabel}>MONTHLY ATTENDANCE</Text>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={14} color="#fff" />
            <Text style={s.backTxt}>Back</Text>
          </TouchableOpacity>
        </View>
        <View style={s.headerBottom}>
          <View style={s.headerLeft}>
            <View style={s.avatar}>
              <Text style={s.avatarTxt}>{initial}</Text>
            </View>
            <View>
              <Text style={s.headerName}>{(name || '').toUpperCase()}</Text>
              <Text style={s.headerMonth}>{dayjs(month + '-01').format('MMMM YYYY')}</Text>
            </View>
          </View>
          <View style={s.monthNav}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={s.navBtn}>
              <Ionicons name="chevron-back" size={16} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => changeMonth(1)} style={s.navBtn}>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={s.statsRow}>
        {summaryStats.map((t) => {
          const isActive = activeFilter === t.key;
          return (
            <TouchableOpacity
              key={t.label}
              style={[s.statCard, isActive && { borderColor: t.color, borderWidth: 2 }]}
              onPress={() => setActiveFilter(isActive ? null : t.key)}
              activeOpacity={0.75}
            >
              <Ionicons name={t.icon} size={18} color={t.color} style={{ marginBottom: 6 }} />
              <Text style={[s.statVal, { color: t.color }]}>{t.val ?? 0}</Text>
              <Text style={s.statLbl}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {renderSalarySummary()}

      {/* Filter Pills */}
      <View style={s.filterRow}>
        {FILTER_TABS.map((t) => {
          const isActive = activeFilter === t.key;
          return (
            <TouchableOpacity
              key={t.label}
              style={[s.pill, isActive && s.pillActive]}
              onPress={() => setActiveFilter(isActive ? null : t.key)}
              activeOpacity={0.75}
            >
              <Text style={[s.pillTxt, isActive && s.pillTxtActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, width: '100%' }}
          data={filtered}
          keyExtractor={(item) => item.date}
          contentContainerStyle={{ padding: 14, gap: 10 }}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
              <Text style={s.emptyTxt}>No records found</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSun = item.status === 'sunday';
            const meta  = STATUS_META[item.status];
            const dow   = dayjs(item.date).format('ddd').toUpperCase();
            const dd    = dayjs(item.date).format('DD');
            const fullDate = dayjs(item.date).format('D MMM');

            let hours = null;
            if (item.check_in && item.check_out) {
              const inMin  = item.check_in.split(':').slice(0,2).reduce((a,v,i) => a + (i===0 ? +v*60 : +v), 0);
              const outMin = item.check_out.split(':').slice(0,2).reduce((a,v,i) => a + (i===0 ? +v*60 : +v), 0);
              const diff   = outMin - inMin;
              if (diff > 0) hours = `${Math.floor(diff/60)}h ${diff%60}m`;
            }

            return (
              <View style={[s.card, isSun && s.cardSun]}>
                {/* Left: date block */}
                <View style={[s.dateBlock, isSun && s.dateBlockSun]}>
                  <Text style={[s.dateNum, isSun && { color: '#EF4444' }]}>{dd}</Text>
                  <Text style={[s.dateDow, isSun && { color: '#EF4444' }]}>{dow}</Text>
                </View>

                {/* Middle: check-in / check-out */}
                <View style={s.cardBody}>
                  {isSun ? (
                    <Text style={s.sundayLabel}>Weekend</Text>
                  ) : (
                    <>
                      <View style={s.timeRow}>
                        <View style={s.timeChip}>
                          <Ionicons name="log-in-outline" size={12} color="#22C55E" />
                          <Text style={s.timeIn}>{item.check_in || '—'}</Text>
                        </View>
                        <View style={s.timeSep} />
                        <View style={s.timeChip}>
                          <Ionicons name="log-out-outline" size={12} color="#EF4444" />
                          <Text style={s.timeOut}>{item.check_out || '—'}</Text>
                        </View>
                      </View>
                      {hours && (
                        <Text style={s.hoursText}>
                          <Ionicons name="time-outline" size={11} color={Colors.textMuted} /> {hours}
                        </Text>
                      )}
                      {item.address ? (
                        <Text style={s.addrTxt} numberOfLines={1}>
                          <Ionicons name="location-outline" size={11} color={Colors.textMuted} /> {item.address}
                        </Text>
                      ) : null}
                    </>
                  )}
                </View>

                {/* Right: status badge */}
                {meta && (
                  <View style={[s.badge, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={13} color={meta.color} />
                    <Text style={[s.badgeTxt, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F0F2F5' },

  // Header
  header:       { backgroundColor: '#1C2333', paddingTop: 18, paddingBottom: 22, paddingHorizontal: 20 },
  headerTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerLabel:  { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 1.4 },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  backTxt:      { fontSize: 12, fontWeight: '600', color: '#fff' },
  headerBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar:       { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarTxt:    { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerName:   { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  headerMonth:  { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  monthNav:     { flexDirection: 'row', gap: 6 },
  navBtn:       { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },

  // Stats
  statsRow:     { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 4 },
  statCard:     { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  statVal:      { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  statLbl:      { fontSize: 10, fontWeight: '600', color: Colors.textMuted, letterSpacing: 0.3 },

  // Filter pills
  filterRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  pill:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border },
  pillActive:   { backgroundColor: '#1C2333', borderColor: '#1C2333' },
  pillTxt:      { fontSize: 12, fontWeight: '600', color: Colors.textLight },
  pillTxtActive:{ color: '#fff' },

  // Cards
  card:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1, gap: 12 },
  cardSun:      { backgroundColor: '#FAFAFA', opacity: 0.75 },

  dateBlock:    { width: 46, height: 46, borderRadius: 12, backgroundColor: '#F0F2F5', justifyContent: 'center', alignItems: 'center' },
  dateBlockSun: { backgroundColor: '#FEE2E2' },
  dateNum:      { fontSize: 18, fontWeight: '800', color: Colors.text, lineHeight: 20 },
  dateDow:      { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },

  cardBody:     { flex: 1 },
  timeRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeChip:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeSep:      { width: 16, height: 1, backgroundColor: Colors.border },
  timeIn:       { fontSize: 13, fontWeight: '700', color: '#22C55E' },
  timeOut:      { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  hoursText:    { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  addrTxt:      { fontSize: 11, color: Colors.textMuted, marginTop: 2, maxWidth: 160 },
  sundayLabel:  { fontSize: 13, fontWeight: '600', color: Colors.textMuted, fontStyle: 'italic' },

  badge:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeTxt:     { fontSize: 11, fontWeight: '700' },

  center:       { paddingVertical: 60, alignItems: 'center', gap: 12 },
  emptyTxt:     { fontSize: 14, color: Colors.textMuted, fontWeight: '500' },
  salCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
});
