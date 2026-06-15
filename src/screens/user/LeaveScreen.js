import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Platform, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import { useLeaveStore } from '@store/leaveStore';
import { useAuthStore } from '@store/authStore';

const LEAVE_TYPES = [
  { key: 'CL',  label: 'Casual Leave',   desc: 'For personal/emergency needs',  color: '#1D4ED8', bg: '#EFF6FF' },
  { key: 'SL',  label: 'Sick Leave',     desc: 'For medical / health reasons',  color: '#15803D', bg: '#F0FDF4' },
  { key: 'EL',  label: 'Earned Leave',   desc: 'Accumulated from service',       color: '#C2410C', bg: '#FFF7ED' },
  { key: 'LOP', label: 'Loss of Pay',    desc: 'Unpaid leave, no limit',         color: '#7E22CE', bg: '#FDF4FF' },
];

const STATUS_META = {
  pending:  { label: 'Pending',  bg: '#FEF9C3', color: '#92400E', icon: 'time-outline' },
  approved: { label: 'Approved', bg: '#D1FAE5', color: '#065F46', icon: 'checkmark-circle-outline' },
  rejected: { label: 'Rejected', bg: '#FEE2E2', color: '#991B1B', icon: 'close-circle-outline' },
  on_hold:  { label: 'On Hold',  bg: '#E0F2FE', color: '#0369A1', icon: 'pause-circle-outline' },
};

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

// ── Apply Modal ───────────────────────────────────────────────────────────────
function ApplyModal({ visible, onClose, onSubmit, balance }) {
  const [type, setType]     = useState('CL');
  const [from, setFrom]     = useState('');
  const [to, setTo]         = useState('');
  const [reason, setReason] = useState('');
  const [error, setError]   = useState('');

  useEffect(() => { if (visible) { setType('CL'); setFrom(''); setTo(''); setReason(''); setError(''); } }, [visible]);

  const selected = LEAVE_TYPES.find(t => t.key === type);
  const days = from && to ? _workingDays(from, to) : 0;
  const bal  = balance?.[type];
  const over = type !== 'LOP' && bal && days > bal.remaining;

  const submit = () => {
    if (!from)   return setError('Please select start date');
    if (!to)     return setError('Please select end date');
    if (dayjs(to).isBefore(dayjs(from))) return setError('End date must be after start date');
    if (!reason.trim()) return setError('Please provide a reason');
    setError('');
    onSubmit({ type, fromDate: from, toDate: to, reason: reason.trim(), days });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ap.overlay}>
        <View style={ap.card}>
          <View style={ap.header}>
            <Text style={ap.title}>Apply for Leave</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={20} color={Colors.textLight} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Leave Type */}
            <Text style={ap.label}>Leave Type</Text>
            <View style={ap.typeGrid}>
              {LEAVE_TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[ap.typeCard, type === t.key && { borderColor: t.color, backgroundColor: t.bg }]}
                  onPress={() => setType(t.key)}
                >
                  <Text style={[ap.typeKey, { color: type === t.key ? t.color : Colors.textLight }]}>{t.key}</Text>
                  <Text style={[ap.typeName, { color: type === t.key ? t.color : Colors.text }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Balance hint */}
            {type !== 'LOP' && bal && (
              <View style={ap.balHint}>
                <Ionicons name="information-circle-outline" size={14} color={Colors.textLight} />
                <Text style={ap.balHintTxt}>
                  Balance: {bal.remaining} day{bal.remaining !== 1 ? 's' : ''} remaining of {bal.total}
                </Text>
              </View>
            )}

            {/* Dates */}
            <View style={ap.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={ap.label}>From Date</Text>
                <TextInput
                  style={ap.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                  value={from}
                  onChangeText={setFrom}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ap.label}>To Date</Text>
                <TextInput
                  style={ap.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                  value={to}
                  onChangeText={setTo}
                />
              </View>
            </View>

            {days > 0 && (
              <View style={[ap.balHint, over && { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name={over ? 'warning-outline' : 'calendar-outline'} size={14} color={over ? '#991B1B' : Colors.textLight} />
                <Text style={[ap.balHintTxt, over && { color: '#991B1B' }]}>
                  {days} working day{days !== 1 ? 's' : ''} selected{over ? ' — exceeds balance!' : ''}
                </Text>
              </View>
            )}

            {/* Reason */}
            <Text style={ap.label}>Reason</Text>
            <TextInput
              style={[ap.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Briefly describe the reason for leave…"
              placeholderTextColor={Colors.textMuted}
              value={reason}
              onChangeText={setReason}
              multiline
            />

            {error ? <Text style={ap.error}>{error}</Text> : null}

            <TouchableOpacity style={ap.submitBtn} onPress={submit}>
              <Ionicons name="paper-plane-outline" size={16} color="#fff" />
              <Text style={ap.submitTxt}>Submit Request</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const ap = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  card:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:      { fontSize: 17, fontWeight: '700', color: Colors.text },
  label:      { fontSize: 12, fontWeight: '600', color: Colors.textLight, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  typeGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeCard:   { width: '47%', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', padding: 12, backgroundColor: '#F7F8FA' },
  typeKey:    { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  typeName:   { fontSize: 11, fontWeight: '500' },
  balHint:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F7F8FA', borderRadius: 8, padding: 8, marginTop: 8 },
  balHintTxt: { fontSize: 12, color: Colors.textLight },
  dateRow:    { flexDirection: 'row', gap: 10 },
  input:      { backgroundColor: '#F7F8FA', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.text },
  error:      { fontSize: 12, color: '#DC2626', marginTop: 8 },
  submitBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, marginTop: 20, marginBottom: 8 },
  submitTxt:  { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function UserLeaveScreen({ navigation }) {
  const { user } = useAuthStore();
  const { applyLeave, getUserRequests, getBalance, ready } = useLeaveStore();

  const [tab, setTab]           = useState('balance');
  const [applyVisible, setApplyVisible] = useState(false);
  const [requests, setRequests] = useState([]);
  const [balance, setBalance]   = useState({});
  const [refreshing, setRefreshing]   = useState(false);

  const load = useCallback(() => {
    if (!user?.id) return;
    setRequests(getUserRequests(user.id));
    setBalance(getBalance(user.id));
  }, [user?.id, getUserRequests, getBalance]);

  useFocusEffect(useCallback(() => { if (ready) load(); }, [ready, load]));

  const handleSubmit = ({ type, fromDate, toDate, reason, days }) => {
    applyLeave({
      userId:   user?.id,
      userName: user?.name || user?.username,
      type, fromDate, toDate, reason,
    });
    setApplyVisible(false);
    load();
  };

  const handleRefresh = () => { setRefreshing(true); load(); setRefreshing(false); };

  const BALANCE_CARDS = [
    { key: 'CL',  label: 'Casual Leave',  color: '#1D4ED8', bg: '#EFF6FF', icon: 'cafe-outline' },
    { key: 'SL',  label: 'Sick Leave',    color: '#15803D', bg: '#F0FDF4', icon: 'medical-outline' },
    { key: 'EL',  label: 'Earned Leave',  color: '#C2410C', bg: '#FFF7ED', icon: 'gift-outline' },
    { key: 'LOP', label: 'Loss of Pay',   color: '#7E22CE', bg: '#FDF4FF', icon: 'remove-circle-outline' },
  ];

  return (
    <View style={s.screen}>
      <Navbar navigation={navigation} activeTab="Leave" />

      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
      >
        <View style={s.titleRow}>
          <View>
            <Text style={s.pageTitle}>Leave</Text>
            <Text style={s.pageSub}>{dayjs().format('YYYY')} · {user?.name || user?.username}</Text>
          </View>
          <TouchableOpacity style={s.applyBtn} onPress={() => setApplyVisible(true)}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.applyTxt}>Apply</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          {['balance', 'history'].map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tab, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                {t === 'balance' ? 'Leave Balance' : 'My Requests'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'balance' && (
          <>
            <View style={s.balGrid}>
              {BALANCE_CARDS.map(c => {
                const b = balance[c.key] || { total: c.key === 'LOP' ? '∞' : 0, used: 0, remaining: c.key === 'LOP' ? '∞' : 0 };
                return (
                  <View key={c.key} style={[s.balCard, { borderTopColor: c.color, borderTopWidth: 3 }]}>
                    <View style={[s.balIconWrap, { backgroundColor: c.bg }]}>
                      <Ionicons name={c.icon} size={20} color={c.color} />
                    </View>
                    <Text style={s.balType}>{c.key}</Text>
                    <Text style={[s.balRemaining, { color: c.color }]}>{b.remaining}</Text>
                    <Text style={s.balLabel}>remaining</Text>
                    {c.key !== 'LOP' && (
                      <View style={s.balBar}>
                        <View style={[s.balFill, {
                          width: `${Math.min(100, (b.used / (b.total || 1)) * 100)}%`,
                          backgroundColor: c.color,
                        }]} />
                      </View>
                    )}
                    <Text style={s.balUsed}>{c.key === 'LOP' ? `${b.used} used` : `${b.used} used / ${b.total} total`}</Text>
                  </View>
                );
              })}
            </View>

            {/* Legend */}
            <View style={s.legendCard}>
              <Text style={s.legendTitle}>Leave Policy</Text>
              {LEAVE_TYPES.map(t => (
                <View key={t.key} style={s.legendRow}>
                  <View style={[s.legendDot, { backgroundColor: t.color }]} />
                  <Text style={s.legendKey}>{t.key}</Text>
                  <Text style={s.legendDesc}>{t.label} — {t.key === 'LOP' ? 'Unlimited (unpaid)' : t.key === 'CL' ? '12/year' : t.key === 'SL' ? '12/year' : '15/year'}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {tab === 'history' && (
          <>
            {requests.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="document-text-outline" size={36} color={Colors.textMuted} />
                <Text style={s.emptyTxt}>No leave requests yet</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => setApplyVisible(true)}>
                  <Text style={s.emptyBtnTxt}>Apply for Leave</Text>
                </TouchableOpacity>
              </View>
            ) : requests.map((r) => {
              const lc = LEAVE_TYPES.find(t => t.key === r.type);
              return (
                <View key={r.id} style={s.reqCard}>
                  <View style={s.reqTop}>
                    <View style={[s.reqTypeBadge, { backgroundColor: lc?.bg || '#F3F4F6' }]}>
                      <Text style={[s.reqTypeKey, { color: lc?.color || Colors.text }]}>{r.type}</Text>
                      <Text style={[s.reqTypeName, { color: lc?.color || Colors.textLight }]}>{lc?.label}</Text>
                    </View>
                    <StatusBadge status={r.status} />
                  </View>
                  <View style={s.reqMeta}>
                    <View style={s.reqMetaItem}>
                      <Ionicons name="calendar-outline" size={13} color={Colors.textLight} />
                      <Text style={s.reqMetaTxt}>{dayjs(r.fromDate).format('DD MMM')} – {dayjs(r.toDate).format('DD MMM YYYY')}</Text>
                    </View>
                    <View style={s.reqMetaItem}>
                      <Ionicons name="time-outline" size={13} color={Colors.textLight} />
                      <Text style={s.reqMetaTxt}>{r.days} working day{r.days !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>
                  <Text style={s.reqReason} numberOfLines={2}>{r.reason}</Text>
                  {r.adminNote ? (
                    <View style={s.adminNote}>
                      <Ionicons name="chatbubble-ellipses-outline" size={12} color={Colors.textLight} />
                      <Text style={s.adminNoteTxt}>{r.adminNote}</Text>
                    </View>
                  ) : null}
                  <Text style={s.reqDate}>Applied {dayjs(r.appliedAt).format('DD MMM YYYY, hh:mm A')}</Text>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <ApplyModal
        visible={applyVisible}
        onClose={() => setApplyVisible(false)}
        onSubmit={handleSubmit}
        balance={balance}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },
  container:    { flex: 1, width: '100%' },
  content:      { padding: 16, paddingBottom: 40 },
  titleRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pageTitle:    { fontSize: 22, fontWeight: '700', color: Colors.text },
  pageSub:      { fontSize: 13, color: Colors.textLight },
  applyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  applyTxt:     { color: '#fff', fontWeight: '700', fontSize: 13 },

  tabRow:       { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  tab:          { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  tabActive:    { backgroundColor: Colors.primary },
  tabTxt:       { fontSize: 13, fontWeight: '600', color: Colors.textLight },
  tabTxtActive: { color: '#fff' },

  balGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  balCard:      { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  balIconWrap:  { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  balType:      { fontSize: 12, fontWeight: '700', color: Colors.textLight, marginBottom: 4 },
  balRemaining: { fontSize: 32, fontWeight: '800' },
  balLabel:     { fontSize: 11, color: Colors.textMuted, marginBottom: 8 },
  balBar:       { height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  balFill:      { height: '100%', borderRadius: 2 },
  balUsed:      { fontSize: 11, color: Colors.textMuted },

  legendCard:   { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', gap: 10 },
  legendTitle:  { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  legendRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendKey:    { fontSize: 12, fontWeight: '700', color: Colors.text, width: 32 },
  legendDesc:   { fontSize: 12, color: Colors.textLight, flex: 1 },

  reqCard:      { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  reqTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  reqTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  reqTypeKey:   { fontSize: 13, fontWeight: '800' },
  reqTypeName:  { fontSize: 12, fontWeight: '500' },
  reqMeta:      { flexDirection: 'row', gap: 16, marginBottom: 8 },
  reqMetaItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reqMetaTxt:   { fontSize: 12, color: Colors.textLight },
  reqReason:    { fontSize: 13, color: Colors.text, lineHeight: 18, marginBottom: 8 },
  adminNote:    { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#F7F8FA', borderRadius: 8, padding: 8, marginBottom: 6 },
  adminNoteTxt: { fontSize: 12, color: Colors.textLight, flex: 1 },
  reqDate:      { fontSize: 11, color: Colors.textMuted },

  emptyBox:     { paddingVertical: 48, alignItems: 'center', gap: 10 },
  emptyTxt:     { fontSize: 14, color: Colors.textMuted },
  emptyBtn:     { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnTxt:  { color: '#fff', fontWeight: '700', fontSize: 13 },
});

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
