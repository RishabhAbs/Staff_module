import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import { useLeaveStore } from '@store/leaveStore';
import { useAuthStore } from '@store/authStore';

const LEAVE_COLORS = {
  CL:  { bg: '#EFF6FF', color: '#1D4ED8', label: 'Casual Leave' },
  SL:  { bg: '#F0FDF4', color: '#15803D', label: 'Sick Leave' },
  EL:  { bg: '#FFF7ED', color: '#C2410C', label: 'Earned Leave' },
  LOP: { bg: '#FDF4FF', color: '#7E22CE', label: 'Loss of Pay' },
};

const STATUS_META = {
  pending:  { label: 'Pending',  bg: '#FEF9C3', color: '#92400E', icon: 'time-outline' },
  approved: { label: 'Approved', bg: '#D1FAE5', color: '#065F46', icon: 'checkmark-circle-outline' },
  rejected: { label: 'Rejected', bg: '#FEE2E2', color: '#991B1B', icon: 'close-circle-outline' },
  on_hold:  { label: 'On Hold',  bg: '#E0F2FE', color: '#0369A1', icon: 'pause-circle-outline' },
};

const MONTHS = [
  'All', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function LeaveTypeBadge({ type }) {
  const c = LEAVE_COLORS[type] || { bg: '#F3F4F6', color: '#374151', label: type };
  return (
    <View style={[badge.box, { backgroundColor: c.bg }]}>
      <Text style={[badge.text, { color: c.color }]}>{type}</Text>
    </View>
  );
}
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <View style={[badge.box, { backgroundColor: m.bg }]}>
      <Ionicons name={m.icon} size={11} color={m.color} />
      <Text style={[badge.text, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}
const badge = StyleSheet.create({
  box:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  text: { fontSize: 11, fontWeight: '600' },
});

// ── Action Modal ──────────────────────────────────────────────────────────────
function ActionModal({ req, visible, onClose, onAction }) {
  const [note, setNote] = useState('');
  useEffect(() => { if (visible) setNote(''); }, [visible]);
  if (!req) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={am.overlay}>
        <View style={am.card}>
          <View style={am.header}>
            <Text style={am.title}>Leave Request</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={20} color={Colors.textLight} /></TouchableOpacity>
          </View>
          <View style={am.infoRow}>
            <Text style={am.infoLabel}>Employee</Text>
            <Text style={am.infoVal}>{req.userName}</Text>
          </View>
          <View style={am.infoRow}>
            <Text style={am.infoLabel}>Type</Text>
            <LeaveTypeBadge type={req.type} />
          </View>
          <View style={am.infoRow}>
            <Text style={am.infoLabel}>Duration</Text>
            <Text style={am.infoVal}>{dayjs(req.fromDate).format('DD MMM')} – {dayjs(req.toDate).format('DD MMM YYYY')} ({req.days}d)</Text>
          </View>
          <View style={am.infoRow}>
            <Text style={am.infoLabel}>Reason</Text>
            <Text style={[am.infoVal, { flex: 1, textAlign: 'right' }]}>{req.reason}</Text>
          </View>
          <Text style={am.noteLabel}>Admin Note (optional)</Text>
          <TextInput
            style={am.noteInput}
            placeholder="Add a note..."
            placeholderTextColor={Colors.textMuted}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
          />
          <View style={am.btnRow}>
            <TouchableOpacity style={[am.btn, { backgroundColor: '#D1FAE5' }]} onPress={() => onAction('approved', note)}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#065F46" />
              <Text style={[am.btnTxt, { color: '#065F46' }]}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[am.btn, { backgroundColor: '#E0F2FE' }]} onPress={() => onAction('on_hold', note)}>
              <Ionicons name="pause-circle-outline" size={16} color="#0369A1" />
              <Text style={[am.btnTxt, { color: '#0369A1' }]}>Hold</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[am.btn, { backgroundColor: '#FEE2E2' }]} onPress={() => onAction('rejected', note)}>
              <Ionicons name="close-circle-outline" size={16} color="#991B1B" />
              <Text style={[am.btnTxt, { color: '#991B1B' }]}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const am = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:      { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 420, padding: 24 },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:     { fontSize: 17, fontWeight: '700', color: Colors.text },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  infoLabel: { fontSize: 13, color: Colors.textLight },
  infoVal:   { fontSize: 13, fontWeight: '600', color: Colors.text },
  noteLabel: { fontSize: 13, color: Colors.textLight, marginTop: 16, marginBottom: 6 },
  noteInput: { backgroundColor: '#F7F8FA', borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 10, fontSize: 13, color: Colors.text, minHeight: 70, textAlignVertical: 'top' },
  btnRow:    { flexDirection: 'row', gap: 8, marginTop: 16 },
  btn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 10 },
  btnTxt:    { fontSize: 13, fontWeight: '700' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AdminLeaveScreen({ navigation }) {
  const { getAllRequests, updateStatus, getStats, ready } = useLeaveStore();
  const { users: localUsers } = useAuthStore();

  const [tab, setTab]           = useState('requests'); // 'requests' | 'stats'
  const [monthIdx, setMonthIdx] = useState(0);          // 0 = All
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState(null);
  const [actionVisible, setActionVisible] = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [rows, setRows]         = useState([]);
  const [stats, setStats]       = useState([]);

  const load = useCallback(() => {
    const month = monthIdx === 0 ? null : monthIdx;
    const year  = new Date().getFullYear();
    let reqs = getAllRequests(month, year);
    if (filterStatus !== 'all') reqs = reqs.filter(r => r.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      reqs = reqs.filter(r => r.userName?.toLowerCase().includes(q) || r.type?.toLowerCase().includes(q));
    }
    setRows(reqs);
    setStats(getStats());
  }, [monthIdx, filterStatus, search, getAllRequests, getStats]);

  useFocusEffect(useCallback(() => { if (ready) load(); }, [ready, load]));

  useEffect(() => { if (ready) load(); }, [monthIdx, filterStatus, search]);

  const handleRefresh = () => { setRefreshing(true); load(); setRefreshing(false); };

  const handleAction = (status, note) => {
    if (selected) updateStatus(selected.id, status, note);
    setActionVisible(false);
    setSelected(null);
    load();
  };

  const openAction = (req) => { setSelected(req); setActionVisible(true); };

  // Summary chips at top
  const allReqs = getAllRequests(null, null);
  const pendingCount  = allReqs.filter(r => r.status === 'pending').length;
  const approvedCount = allReqs.filter(r => r.status === 'approved').length;
  const rejectedCount = allReqs.filter(r => r.status === 'rejected').length;

  const SUMMARY = [
    { label: 'Total',    value: allReqs.length  },
    { label: 'Pending',  value: pendingCount    },
    { label: 'Approved', value: approvedCount   },
    { label: 'Rejected', value: rejectedCount   },
  ];

  return (
    <View style={s.screen}>
      <Navbar navigation={navigation} activeTab="Leave" />

      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
      >
        <Text style={s.pageTitle}>Leave Management</Text>

        {/* Summary row */}
        <View style={s.summaryRow}>
          {SUMMARY.map(c => (
            <View key={c.label} style={s.summaryCard}>
              <Text style={s.summaryVal}>{c.value}</Text>
              <Text style={s.summaryLbl}>{c.label}</Text>
            </View>
          ))}
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          {['requests', 'stats'].map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tab, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                {t === 'requests' ? 'Leave Requests' : 'Staff Statistics'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'requests' && (
          <>
            {/* Month filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.monthScroll} contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}>
              {MONTHS.map((m, i) => (
                <TouchableOpacity
                  key={m}
                  style={[s.monthChip, monthIdx === i && s.monthChipActive]}
                  onPress={() => setMonthIdx(i)}
                >
                  <Text style={[s.monthTxt, monthIdx === i && s.monthTxtActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Status filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 6 }}>
              {['all', 'pending', 'approved', 'on_hold', 'rejected'].map(st => (
                <TouchableOpacity
                  key={st}
                  style={[s.statusChip, filterStatus === st && s.statusChipActive]}
                  onPress={() => setFilterStatus(st)}
                >
                  <Text style={[s.statusChipTxt, filterStatus === st && s.statusChipTxtActive]}>
                    {st === 'all' ? 'All' : st === 'on_hold' ? 'On Hold' : st.charAt(0).toUpperCase() + st.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Search */}
            <View style={s.searchWrap}>
              <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
              <TextInput
                style={s.searchInput}
                placeholder="Search by name or leave type…"
                placeholderTextColor={Colors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {/* Table header */}
            <View style={[s.tableRow, s.tableHeader]}>
              <Text style={[s.th, { flex: 2 }]}>Employee</Text>
              <Text style={[s.th, { flex: 1 }]}>Type</Text>
              <Text style={[s.th, { flex: 2 }]}>Date</Text>
              <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>Days</Text>
              <Text style={[s.th, { flex: 1.5, textAlign: 'center' }]}>Status</Text>
              <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>Action</Text>
            </View>

            {!ready ? (
              <View style={s.loadingBox}><ActivityIndicator color={Colors.primary} /></View>
            ) : rows.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="document-text-outline" size={32} color={Colors.textMuted} />
                <Text style={s.emptyTxt}>No leave requests found</Text>
              </View>
            ) : rows.map((r, idx) => (
              <View key={r.id} style={[s.tableRow, idx % 2 === 1 && { backgroundColor: '#FAFAFA' }]}>
                <View style={[s.td, { flex: 2 }]}>
                  <View style={s.avatarSmall}>
                    <Text style={s.avatarInitial}>{(r.userName || '?')[0].toUpperCase()}</Text>
                  </View>
                  <Text style={s.tdName} numberOfLines={1}>{r.userName}</Text>
                </View>
                <View style={[s.td, { flex: 1 }]}>
                  <LeaveTypeBadge type={r.type} />
                </View>
                <View style={[s.td, { flex: 2, flexDirection: 'column', alignItems: 'flex-start', gap: 0 }]}>
                  <Text style={s.dateMain}>{dayjs(r.fromDate).format('DD MMM')}</Text>
                  <Text style={s.dateSub}>to {dayjs(r.toDate).format('DD MMM YY')}</Text>
                </View>
                <Text style={[s.tdCenter, { flex: 1 }]}>{r.days}d</Text>
                <View style={[s.td, { flex: 1.5, justifyContent: 'center' }]}>
                  <StatusBadge status={r.status} />
                </View>
                <View style={[s.td, { flex: 1, justifyContent: 'center' }]}>
                  <TouchableOpacity style={s.actionBtn} onPress={() => openAction(r)}>
                    <Ionicons name="ellipsis-horizontal" size={16} color={Colors.textLight} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {tab === 'stats' && (
          <>
            <Text style={s.statsSub}>Annual leave usage per employee ({new Date().getFullYear()})</Text>
            {/* Stats table header */}
            <View style={[s.tableRow, s.tableHeader]}>
              <Text style={[s.th, { flex: 2 }]}>Employee</Text>
              <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>CL</Text>
              <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>SL</Text>
              <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>EL</Text>
              <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>LOP</Text>
              <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>Total</Text>
              <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>Pending</Text>
            </View>

            {stats.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="bar-chart-outline" size={32} color={Colors.textMuted} />
                <Text style={s.emptyTxt}>No leave data available</Text>
              </View>
            ) : stats.map((st, idx) => (
              <View key={st.userId} style={[s.tableRow, idx % 2 === 1 && { backgroundColor: '#FAFAFA' }]}>
                <View style={[s.td, { flex: 2 }]}>
                  <View style={s.avatarSmall}>
                    <Text style={s.avatarInitial}>{(st.userName || '?')[0].toUpperCase()}</Text>
                  </View>
                  <Text style={s.tdName} numberOfLines={1}>{st.userName}</Text>
                </View>
                <Text style={[s.tdCenter, { flex: 1 }]}>{st.CL || 0}</Text>
                <Text style={[s.tdCenter, { flex: 1 }]}>{st.SL || 0}</Text>
                <Text style={[s.tdCenter, { flex: 1 }]}>{st.EL || 0}</Text>
                <Text style={[s.tdCenter, { flex: 1 }]}>{st.LOP || 0}</Text>
                <Text style={[s.tdCenter, { flex: 1, fontWeight: '700', color: Colors.text }]}>{st.total || 0}</Text>
                <Text style={[s.tdCenter, { flex: 1, color: Colors.textMuted }]}>{st.pending || 0}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <ActionModal
        req={selected}
        visible={actionVisible}
        onClose={() => { setActionVisible(false); setSelected(null); }}
        onAction={handleAction}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen:        { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },
  container:     { flex: 1, width: '100%' },
  content:       { padding: 16, paddingBottom: 40 },
  pageTitle:     { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 16 },

  summaryRow:    { flexDirection: 'row', gap: 10, marginBottom: 18 },
  summaryCard:   { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  summaryVal:    { fontSize: 22, fontWeight: '700', color: '#111827' },
  summaryLbl:    { fontSize: 11, color: Colors.textLight, marginTop: 2 },

  tabRow:        { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  tab:           { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  tabActive:     { backgroundColor: '#FFF0EF' },
  tabTxt:        { fontSize: 13, fontWeight: '600', color: Colors.textLight },
  tabTxtActive:  { color: Colors.primary, fontWeight: '700' },

  monthScroll:   { marginBottom: 10 },
  monthChip:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  monthChipActive: { backgroundColor: '#FFF0EF', borderColor: Colors.primary },
  monthTxt:      { fontSize: 12, color: Colors.textLight, fontWeight: '500' },
  monthTxtActive: { color: Colors.primary, fontWeight: '700' },

  statusChip:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  statusChipActive: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  statusChipTxt: { fontSize: 12, color: Colors.textLight, fontWeight: '500' },
  statusChipTxtActive: { color: Colors.text, fontWeight: '700' },

  searchWrap:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  searchInput:   { flex: 1, fontSize: 13, color: Colors.text, outlineStyle: 'none' },

  tableHeader:   { backgroundColor: '#F7F8FA', borderRadius: 0, borderBottomWidth: 2, borderBottomColor: '#E5E7EB' },
  tableRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  th:            { fontSize: 11, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
  td:            { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tdName:        { fontSize: 13, fontWeight: '600', color: Colors.text, flexShrink: 1 },
  tdCenter:      { fontSize: 13, color: Colors.textLight, textAlign: 'center' },
  dateMain:      { fontSize: 12, fontWeight: '600', color: Colors.text },
  dateSub:       { fontSize: 11, color: Colors.textLight },

  avatarSmall:   { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 12, fontWeight: '700', color: '#374151' },
  actionBtn:     { padding: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },

  loadingBox:    { paddingVertical: 40, alignItems: 'center' },
  emptyBox:      { paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyTxt:      { fontSize: 13, color: Colors.textMuted },
  statsSub:      { fontSize: 13, color: Colors.textLight, marginBottom: 12 },
});
