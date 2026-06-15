import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Modal, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import { useAuthStore } from '@store/authStore';
import { useAttendanceStore } from '@store/attendanceStore';
import Navbar from '@components/common/Navbar';
import dayjs from 'dayjs';

export default function ProfileScreen({ navigation }) {
  const { user, logout, updateUser } = useAuthStore();
  const { getMonthlySummary, checkedInToday } = useAttendanceStore();
  const [showPassModal, setShowPassModal] = useState(false);
  const [oldPass, setOldPass]             = useState('');
  const [newPass, setNewPass]             = useState('');
  const [passErr, setPassErr]             = useState('');

  const month   = dayjs().format('YYYY-MM');
  const summary = getMonthlySummary(user?.id, month);

  const handleChangePass = () => {
    if (!oldPass || !newPass) { setPassErr('Both fields are required'); return; }
    if (oldPass !== user?.password) { setPassErr('Current password is incorrect'); return; }
    if (newPass.length < 4) { setPassErr('New password too short'); return; }
    updateUser({ ...user, password: newPass });
    setShowPassModal(false);
    setOldPass(''); setNewPass(''); setPassErr('');
    Alert.alert('Success', 'Password updated successfully');
  };

  const initial = (user?.name || user?.username || 'U')[0].toUpperCase();
  const joinDate = user?.createdAt ? dayjs(user.createdAt).format('DD MMM YYYY') : 'N/A';

  return (
    <View style={s.screen}>
      <Navbar navigation={navigation} activeTab="Profile" />
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={s.scroll}>

        {/* Hero card */}
        <View style={s.hero}>
          <View style={s.heroLeft}>
            <View style={s.avatar}>
              <Text style={s.avatarTxt}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.heroName}>{user?.name || user?.username}</Text>
              <Text style={s.heroEmail}>{user?.username}@abstechnologies.org.in</Text>
              {user?.number ? (
                <Text style={s.heroPhone}>
                  <Ionicons name="call-outline" size={12} color="rgba(255,255,255,0.8)" /> {user.number}
                </Text>
              ) : null}
              <View style={s.badgeRow}>
                <View style={s.badge}>
                  <Text style={s.badgeTxt}>{(user?.role || 'user').toUpperCase()}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: user?.status === 'active' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)' }]}>
                  <View style={[s.badgeDot, { backgroundColor: user?.status === 'active' ? '#22C55E' : '#EF4444' }]} />
                  <Text style={s.badgeTxt}>{(user?.status || 'active').toUpperCase()}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={s.heroRight}>
            <Text style={s.secLabel}>2FA STATUS</Text>
            <View style={[s.secBadge, { backgroundColor: user?.twoFaSetup ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)' }]}>
              <Ionicons name={user?.twoFaSetup ? 'shield-checkmark' : 'shield-outline'} size={16} color={user?.twoFaSetup ? '#22C55E' : '#EF4444'} />
              <Text style={[s.secTxt, { color: user?.twoFaSetup ? '#22C55E' : '#EF4444' }]}>
                {user?.twoFaSetup ? 'Enabled' : 'Not Set'}
              </Text>
            </View>
          </View>
        </View>

        {/* Info strip */}
        <View style={s.strip}>
          {[
            { icon: 'person-outline',   label: 'Username',   val: user?.username || '—' },
            { icon: 'shield-outline',   label: 'Role',       val: (user?.role || 'user').charAt(0).toUpperCase() + (user?.role || 'user').slice(1) },
            { icon: 'phone-portrait-outline', label: 'Mobile', val: user?.number || '—' },
            { icon: 'time-outline',     label: 'Session',    val: 'Active' },
          ].map((item, i, arr) => (
            <View key={item.label} style={[s.stripItem, i < arr.length - 1 && s.stripDiv]}>
              <Ionicons name={item.icon} size={16} color={Colors.primary} />
              <Text style={s.stripLbl}>{item.label}</Text>
              <Text style={s.stripVal}>{item.val}</Text>
            </View>
          ))}
        </View>

        {/* This month attendance */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="calendar-outline" size={16} color={Colors.text} />
            <Text style={s.sectionTitle}>This Month's Attendance</Text>
            <Text style={s.sectionSub}>{dayjs().format('MMMM YYYY')}</Text>
            <TouchableOpacity
              style={s.viewDetailsBtn}
              onPress={() => navigation.navigate('UserDetail', { userId: user?.id, name: user?.name || user?.username })}
            >
              <Text style={s.viewDetailsTxt}>View Details</Text>
              <Ionicons name="chevron-forward" size={13} color="#C0392B" />
            </TouchableOpacity>
          </View>
          <View style={s.attGrid}>
            {[
              { label: 'Present',    val: summary.present,    color: '#22C55E', bg: '#F0FDF4', icon: 'checkmark-circle-outline' },
              { label: 'Absent',     val: summary.absent,     color: '#EF4444', bg: '#FEF2F2', icon: 'close-circle-outline' },
              { label: 'Half Day',   val: summary.half_day,   color: '#8B5CF6', bg: '#F5F3FF', icon: 'remove-circle-outline' },
              { label: 'Late',       val: summary.late,       color: '#F59E0B', bg: '#FFFBEB', icon: 'time-outline' },
              { label: 'Early Out',  val: summary.early_leave,color: '#F97316', bg: '#FFF7ED', icon: 'exit-outline' },
            ].map(a => (
              <View key={a.label} style={[s.attCard, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon} size={22} color={a.color} />
                <Text style={[s.attVal, { color: a.color }]}>{a.val ?? 0}</Text>
                <Text style={s.attLbl}>{a.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Security */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="shield-outline" size={16} color={Colors.text} />
            <Text style={s.sectionTitle}>Security</Text>
          </View>

          <View style={s.secRow}>
            <View style={[s.secIcon, { backgroundColor: user?.twoFaSetup ? '#F0FDF4' : '#FEF2F2' }]}>
              <Ionicons name="phone-portrait-outline" size={20} color={user?.twoFaSetup ? '#22C55E' : '#EF4444'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.secRowTitle}>Two-Factor Authentication</Text>
              <Text style={s.secRowSub}>
                {user?.twoFaSetup
                  ? 'Your account is protected with an authenticator app.'
                  : 'Not set up. Contact admin to get your QR code.'}
              </Text>
            </View>
            <View style={[s.statusPill, { backgroundColor: user?.twoFaSetup ? '#DCFCE7' : '#FEE2E2' }]}>
              <Text style={[s.statusPillTxt, { color: user?.twoFaSetup ? '#16A34A' : '#DC2626' }]}>
                {user?.twoFaSetup ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </View>

          <View style={[s.secRow, { marginTop: 8 }]}>
            <View style={[s.secIcon, { backgroundColor: '#F7F8FA' }]}>
              <Ionicons name="key-outline" size={20} color={Colors.textLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.secRowTitle}>Password</Text>
              <Text style={s.secRowSub}>Change your account password</Text>
            </View>
            <TouchableOpacity style={s.changeBtn} onPress={() => setShowPassModal(true)}>
              <Text style={s.changeBtnTxt}>Change</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={s.logoutTxt}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={showPassModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => { setShowPassModal(false); setPassErr(''); setOldPass(''); setNewPass(''); }}>
                <Ionicons name="close" size={22} color={Colors.textLight} />
              </TouchableOpacity>
            </View>

            {passErr ? (
              <View style={s.errBox}>
                <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
                <Text style={s.errTxt}>{passErr}</Text>
              </View>
            ) : null}

            <Text style={s.fieldLbl}>Current Password</Text>
            <TextInput
              style={s.input}
              secureTextEntry
              placeholder="Enter current password"
              value={oldPass}
              onChangeText={v => { setOldPass(v); setPassErr(''); }}
            />
            <Text style={s.fieldLbl}>New Password</Text>
            <TextInput
              style={s.input}
              secureTextEntry
              placeholder="Enter new password"
              value={newPass}
              onChangeText={v => { setNewPass(v); setPassErr(''); }}
            />

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowPassModal(false); setPassErr(''); setOldPass(''); setNewPass(''); }}>
                <Text style={s.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleChangePass}>
                <Text style={s.saveTxt}>Update Password</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },
  scroll:      { padding: 20, paddingBottom: 100 },

  hero:        { backgroundColor: '#C0392B', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  heroLeft:    { flexDirection: 'row', gap: 14, flex: 1 },
  avatar:      { width: 64, height: 64, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  avatarTxt:   { fontSize: 26, fontWeight: '800', color: '#fff' },
  heroName:    { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 2 },
  heroEmail:   { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
  heroPhone:   { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  badgeRow:    { flexDirection: 'row', gap: 6 },
  badge:       { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeDot:    { width: 6, height: 6, borderRadius: 3 },
  badgeTxt:    { fontSize: 10, color: '#fff', fontWeight: '700', letterSpacing: 0.4 },
  heroRight:   { alignItems: 'center', gap: 6 },
  secLabel:    { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.6 },
  secBadge:    { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', gap: 4 },
  secTxt:      { fontSize: 12, fontWeight: '700' },

  strip:       { backgroundColor: '#fff', borderRadius: 12, flexDirection: 'row', marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  stripItem:   { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4 },
  stripDiv:    { borderRightWidth: 1, borderRightColor: '#E5E7EB' },
  stripLbl:    { fontSize: 10, color: Colors.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  stripVal:    { fontSize: 13, fontWeight: '700', color: Colors.text },

  section:     { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle:{ fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 },
  sectionSub:  { fontSize: 12, color: Colors.textLight },
  viewDetailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' },
  viewDetailsTxt: { fontSize: 12, color: '#C0392B', fontWeight: '700' },

  attGrid:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  attCard:     { flex: 1, minWidth: 80, borderRadius: 10, padding: 12, alignItems: 'center', gap: 4 },
  attVal:      { fontSize: 22, fontWeight: '800' },
  attLbl:      { fontSize: 10, color: Colors.textLight, fontWeight: '600', textAlign: 'center' },

  secRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F7F8FA', borderRadius: 10, padding: 12 },
  secIcon:     { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  secRowTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  secRowSub:   { fontSize: 11, color: Colors.textLight, lineHeight: 16 },
  statusPill:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusPillTxt:{ fontSize: 11, fontWeight: '700' },
  changeBtn:   { borderWidth: 1.5, borderColor: '#C0392B', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  changeBtnTxt:{ fontSize: 12, color: '#C0392B', fontWeight: '700' },

  logoutBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#C0392B', borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  logoutTxt:   { color: '#fff', fontWeight: '700', fontSize: 15 },

  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal:       { backgroundColor: '#fff', borderRadius: 18, padding: 22, width: '100%', maxWidth: 420 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:  { fontSize: 17, fontWeight: '700', color: Colors.text },
  errBox:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 12 },
  errTxt:      { fontSize: 12, color: '#EF4444', flex: 1 },
  fieldLbl:    { fontSize: 12, fontWeight: '600', color: Colors.text, marginBottom: 5, marginTop: 10 },
  input:       { backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: Colors.text, outlineStyle: 'none' },
  modalBtns:   { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn:   { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 9, paddingVertical: 12, alignItems: 'center' },
  cancelTxt:   { fontSize: 13, color: Colors.textLight, fontWeight: '600' },
  saveBtn:     { flex: 2, backgroundColor: '#C0392B', borderRadius: 9, paddingVertical: 12, alignItems: 'center' },
  saveTxt:     { fontSize: 13, color: '#fff', fontWeight: '700' },
});
