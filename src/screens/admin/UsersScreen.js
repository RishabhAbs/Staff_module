import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Pressable,
  StyleSheet, TextInput, Modal, Switch, ScrollView,
  KeyboardAvoidingView, Platform, Image,
  Animated, PanResponder, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import { useAuthStore } from '@store/authStore';
import { buildOtpAuthUri, buildQrUrl, verifyTOTP, generateSecret } from '@utils/totp';
import UserFormModal, { EMPTY_USER } from '@components/admin/UserFormModal';

const MOCK_USERS = [];

function UserCard({ user, onEdit, todayRecord }) {
  return (
    <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name[0]}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.meta}>@{user.username} · {user.number}</Text>
          <View style={styles.tags}>
            <View style={[styles.tag, user.role === 'admin' ? styles.tagAdmin : styles.tagUser]}>
              <Text style={styles.tagText}>{user.role}</Text>
            </View>
            <View style={[styles.tag, user.status === 'active' ? styles.tagActive : styles.tagInactive]}>
              <Text style={styles.tagText}>{user.status}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={() => onEdit(user)} style={styles.editBtn}>
          <Ionicons name="create-outline" size={20} color={Colors.blue} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
const INITIAL_USER = EMPTY_USER;

const WEB_SELECT_STYLE = {
  appearance: 'none',
  width: '100%',
  height: '100%',
  paddingLeft: 20,
  paddingRight: 35,
  fontSize: 14,
  color: Colors.text,
  border: 'none',
  backgroundColor: 'transparent',
  outline: 'none',
  cursor: 'pointer',
  zIndex: 1,
};

// Custom styled dropdown replacing native <select>
function CustomSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <View>
      <TouchableOpacity
        style={csel.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={csel.triggerTxt}>{selected?.label || '—'}</Text>
        <Ionicons name="chevron-down" size={14} color={Colors.textLight} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={csel.backdrop} onPress={() => setOpen(false)}>
          <View style={csel.sheet}>
            {options.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[csel.option, opt.value === value && csel.optionActive]}
                onPress={() => { onChange(opt.value); setOpen(false); }}
              >
                <Text style={[csel.optionTxt, opt.value === value && csel.optionTxtActive]}>{opt.label}</Text>
                {opt.value === value && <Ionicons name="checkmark" size={16} color={Colors.brandRed} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
const csel = StyleSheet.create({
  trigger:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  triggerTxt:    { fontSize: 14, color: Colors.text, fontWeight: '500' },
  backdrop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  sheet:         { backgroundColor: '#fff', borderRadius: 14, width: '100%', maxWidth: 320, overflow: 'hidden', elevation: 10 },
  option:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  optionActive:  { backgroundColor: '#FFF0EF' },
  optionTxt:     { fontSize: 14, color: Colors.text },
  optionTxtActive: { color: Colors.brandRed, fontWeight: '700' },
});

const SWIPE_THRESHOLD = 50;
const ACTION_WIDTH    = 160;

function SwipeableCard({ u, todayRecord, onEdit, onResetPass, onQr, onDelete }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef    = useRef(false);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
    onPanResponderMove: (_, g) => {
      const base = openRef.current ? -ACTION_WIDTH : 0;
      const val  = Math.max(-ACTION_WIDTH, Math.min(0, base + g.dx));
      translateX.setValue(val);
    },
    onPanResponderRelease: (_, g) => {
      let shouldOpen;
      if (openRef.current) {
        // already open — close if swiped right enough
        shouldOpen = g.dx < SWIPE_THRESHOLD;
      } else {
        // closed — open if swiped left enough
        shouldOpen = g.dx < -SWIPE_THRESHOLD;
      }
      const toValue   = shouldOpen ? -ACTION_WIDTH : 0;
      openRef.current = shouldOpen;
      Animated.spring(translateX, { toValue, useNativeDriver: true, bounciness: 4 }).start();
    },
  })).current;

  return (
    <View style={sw.wrap}>
      {/* Action buttons revealed on swipe */}
      <View style={sw.actions}>
        <TouchableOpacity style={[sw.actionBtn, { backgroundColor: '#3B82F6' }]} onPress={() => onEdit(u)}>
          <Ionicons name="pencil-outline" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[sw.actionBtn, { backgroundColor: '#F59E0B' }]} onPress={() => onResetPass(u)}>
          <Ionicons name="key-outline" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[sw.actionBtn, { backgroundColor: '#8B5CF6' }]} onPress={() => onQr(u)}>
          <Ionicons name="qr-code-outline" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[sw.actionBtn, { backgroundColor: '#EF4444' }]} onPress={() => onDelete(u.id)}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Card content */}
      <Animated.View style={[sw.card, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <View style={sw.avatarBox}>
          <Text style={sw.avatarTxt}>{u.name.charAt(0)}</Text>
        </View>
        {/* Left: name + badges */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={sw.name}>{u.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <View style={[sw.badge, u.role === 'admin' ? sw.badgeAdmin : sw.badgeUser]}>
              <Text style={sw.badgeTxt}>{u.role.toUpperCase()}</Text>
            </View>
            <View style={[sw.badge, u.status === 'active' ? sw.badgeActive : sw.badgeInactive]}>
              <Text style={sw.badgeTxt}>{u.status}</Text>
            </View>
            {u.shift && (
              <View style={[
                sw.badge,
                u.shift === 'night' ? { backgroundColor: '#ECE9FC' } : 
                u.shift === 'evening' ? { backgroundColor: '#FFEDD5' } : 
                { backgroundColor: '#E0F2FE' }
              ]}>
                <Text style={[
                  sw.badgeTxt,
                  {
                    fontSize: 9,
                    color: u.shift === 'night' ? '#6D28D9' : 
                           u.shift === 'evening' ? '#C2410C' : 
                           '#0369A1'
                  }
                ]}>
                  {(u.shift === 'evening' ? 'Evening' : u.shift === 'night' ? 'Night' : 'Day').toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>
        {/* Right: 2FA + phone */}
        <View style={{ alignItems: 'flex-end', gap: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name={u.twoFaSetup ? 'shield-checkmark' : 'shield-outline'} size={13} color={u.twoFaSetup ? '#16a34a' : '#94A3B8'} />
            <Text style={{ fontSize: 11, color: u.twoFaSetup ? '#16a34a' : '#94A3B8', fontWeight: '600' }}>2FA {u.twoFaSetup ? 'ON' : 'OFF'}</Text>
          </View>
          {u.number ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="call-outline" size={13} color="#6B7280" />
              <Text style={{ fontSize: 11, color: '#6B7280' }}>{u.number}</Text>
            </View>
          ) : <Text style={{ fontSize: 11, color: '#D1D5DB' }}>No phone</Text>}
        </View>
        <Ionicons name="chevron-back-outline" size={16} color="#D1D5DB" />
      </Animated.View>
    </View>
  );
}

const sw = StyleSheet.create({
  wrap:        { marginBottom: 8, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  card:        { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, backgroundColor: '#fff', borderRadius: 14, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8 },
  avatarBox:   { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarTxt:   { fontSize: 18, fontWeight: '700', color: '#374151' },
  name:        { fontSize: 15, fontWeight: '700', color: Colors.text },
  email:       { fontSize: 11, color: Colors.textLight, marginTop: 2 },
  badge:       { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  badgeAdmin:  { backgroundColor: '#FEF3C7' },
  badgeUser:   { backgroundColor: '#EFF6FF' },
  badgeActive: { backgroundColor: '#DCFCE7' },
  badgeInactive:{ backgroundColor: '#FEE2E2' },
  badgeTxt:    { fontSize: 10, fontWeight: '700', color: '#374151' },
  actions:     { position: 'absolute', right: 0, top: 0, bottom: 0, width: 160, flexDirection: 'row' },
  actionBtn:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default function UsersScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isMobile  = width < 768;
  const { users, addUser, updateUser, deleteUser, markTwoFaSetup, loadUsers } = useAuthStore();
  const [search, setSearch]       = useState('');
  const [editUser, setEditUser]   = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [isAdding, setIsAdding]   = useState(false);
  const [qrUser, setQrUser]       = useState(null);  // user whose QR is being shown
  const [qrOtp, setQrOtp]         = useState('');
  const [qrOtpError, setQrOtpError] = useState('');
  const [qrVerifying, setQrVerifying] = useState(false);

  // Filter States
  const [filterRole, setFilterRole]     = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filter2FA, setFilter2FA]       = useState('all');
  const [todayRecords, setTodayRecords] = useState([]);

  useEffect(() => {
    const fetchToday = async () => {
      try {
        const dayjs = require('dayjs');
        const api = require('@services/api').default;
        const today = dayjs().format('YYYY-MM-DD');
        const data = await api.get(`/attendance/report?date=${today}`);
        setTodayRecords(Array.isArray(data) ? data : []);
      } catch {}
    };
    fetchToday();
  }, []);

  const stats = {
    total:  users.length,
    active: users.filter(u => u.status === 'active').length,
    twoFA:  users.filter(u => u.twoFaSetup).length,
    admins: users.filter(u => u.role === 'admin').length,
  };

  const filtered = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || 
                         u.username.toLowerCase().includes(search.toLowerCase());
    const matchesRole   = filterRole === 'all' || u.role === filterRole;
    const matchesStatus = filterStatus === 'all' || u.status === filterStatus;
    const matches2FA    = filter2FA === 'all' || (filter2FA === 'enabled' ? u.twoFaSetup : !u.twoFaSetup);
    
    return matchesSearch && matchesRole && matchesStatus && matches2FA;
  });

  const handleResetFilters = () => {
    setFilterRole('all');
    setFilterStatus('all');
    setFilter2FA('all');
    setShowFilter(false);
  };

  const uploadEmployeeDocs = async (staffId, data, staffName) => {
    const DOC_FIELDS = [
      { key: 'doc_pan',           label: 'PAN',              category: 'Employee – PAN' },
      { key: 'doc_aadhaar',       label: 'Aadhaar',          category: 'Employee – Aadhaar' },
      { key: 'doc_passport',      label: 'Passport',         category: 'Employee – Passport' },
      { key: 'doc_uan',           label: 'UAN',              category: 'Employee – UAN' },
      { key: 'doc_qualification', label: 'Certificate',      category: 'Employee – Certificate' },
    ];
    const api = require('@services/api').default;
    for (const field of DOC_FIELDS) {
      const files = data[field.key];
      if (!files) continue;
      const fileList = Array.isArray(files) ? files : [files];
      for (const file of fileList) {
        if (!file || !(file instanceof File)) continue;
        try {
          const form = new FormData();
          form.append('name', `${staffName} – ${field.label}`);
          form.append('category', field.category);
          form.append('doc_type', 'employee');
          form.append('staff_id', String(staffId));
          form.append('files', file);
          await api.postForm('/documents', form);
        } catch (e) {
          console.warn('Doc upload failed for', field.key, e?.message);
        }
      }
    }
  };

  const handleSave = async (data) => {
    if (isAdding) {
      const twoFaSecret = generateSecret();
      const created = await addUser({ ...data, twoFaSecret, twoFaSetup: false, number: data.phone });
      setShowModal(false);
      await loadUsers();
      const fresh = useAuthStore.getState().users.find(u => u.id === created?.id || u.username === data.username);
      if (fresh) {
        setQrUser(fresh);
        // Upload any attached docs to Documents vault
        if (created?.id) await uploadEmployeeDocs(created.id, data, data.name || data.first_name);
      }
    } else {
      await updateUser({ ...data, id: editUser.id, number: data.phone });
      // Upload any newly attached docs to Documents vault
      await uploadEmployeeDocs(editUser.id, data, data.name || data.first_name);
      setShowModal(false);
    }
  };

  const handleResetPass = (user) => {
    const old = user.password || '******** (Not returned by API)';
    const newPass = prompt(`Current Password: ${old}\n\nEnter new password for ${user.name}:`);
    if (newPass && newPass.trim()) {
      updateUser({ ...user, password: newPass.trim() });
      alert(`Password updated successfully for ${user.name}`);
    }
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this user?")) {
      deleteUser(id);
    }
  };

  const openAddModal = () => {
    setIsAdding(true);
    setEditUser(INITIAL_USER);
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setIsAdding(false);
    const parts = (user.name || '').trim().split(/\s+/);
    const first_name = parts[0] || '';
    const last_name = parts.length > 1 ? parts[parts.length - 1] : '';
    const middle_name = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
    setEditUser({ ...user, first_name, middle_name, last_name });
    setShowModal(true);
  };

  return (
    <View style={styles.screen}>
      <Navbar navigation={navigation} activeTab="Users" />
      
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={{ padding: 20 }}>
        {/* Stats Row — desktop only */}
        {!isMobile && <View style={styles.statsRow}>
          {[
            { label: 'Total Users', value: stats.total,  icon: 'people',      color: '#6B7280', bg: '#F7F8FA' },
            { label: 'Active',      value: stats.active, icon: 'person-add',  color: '#6B7280', bg: '#F7F8FA' },
            { label: '2FA Enabled', value: stats.twoFA,  icon: 'shield-check',color: '#6B7280', bg: '#F7F8FA' },
            { label: 'Admins',      value: stats.admins, icon: 'shield',      color: '#6B7280', bg: '#F7F8FA' },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon} size={16} color={s.color} />
              </View>
              <View>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            </View>
          ))}
        </View>}

        {/* Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={Colors.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <View style={styles.toolActions}>
            <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilter(true)}>
              <Ionicons name="filter" size={18} color={Colors.brandRed} />
              {!isMobile && <Text style={styles.filterBtnText}>Filter</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
              <Ionicons name="add" size={20} color={Colors.white} />
              {!isMobile && <Text style={styles.addBtnText}>Add User</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* User Table */}
        <View style={isMobile ? { marginTop: 8 } : styles.tableCard}>
          {/* Table Header — desktop only */}
          {!isMobile && (
            <View style={styles.tableHeader}>
              <Text style={[styles.columnHeader, { flex: 2 }]}>User</Text>
              <Text style={[styles.columnHeader, { flex: 1.2 }]}>Role</Text>
              <Text style={[styles.columnHeader, { flex: 0.8 }]}>2FA</Text>
              <Text style={[styles.columnHeader, { flex: 0.8 }]}>Status</Text>
              <Text style={[styles.columnHeader, { flex: 1.2, textAlign: 'right' }]}>Actions</Text>
            </View>
          )}

          {filtered.length > 0 ? filtered.map((u) => {
            // Mobile: swipeable cards
            if (isMobile) {
              return (
                <SwipeableCard
                  key={u.id}
                  u={u}
                  todayRecord={todayRecords.find(r => r.staff_id === u.id)}
                  onEdit={openEditModal}
                  onResetPass={handleResetPass}
                  onQr={setQrUser}
                  onDelete={handleDelete}
                />
              );
            }
            // Desktop: table rows
            const actionBtns = (
              <>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(u)}>
                  <Ionicons name="pencil-outline" size={18} color="#374151" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleResetPass(u)}>
                  <Ionicons name="key-outline" size={18} color="#6B7280" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, u.twoFaSetup && { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}
                  onPress={() => setQrUser(u)}
                >
                  <Ionicons name="qr-code-outline" size={18} color={u.twoFaSetup ? '#16a34a' : '#6B7280'} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(u.id)}>
                  <Ionicons name="trash-outline" size={18} color="#C0392B" />
                </TouchableOpacity>
              </>
            );
            return (
              <View key={u.id} style={styles.tableRow}>
                <View style={[styles.tableCell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{u.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.userName} numberOfLines={1}>{u.name}</Text>
                    <Text style={styles.userEmail} numberOfLines={1}>{u.username}@abstechnologies.org.in</Text>
                  </View>
                </View>
                <View style={[styles.tableCell, { flex: 1.2 }]}>
                  <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{u.role.toUpperCase()}</Text></View>
                  <View style={styles.geoBadge}><Text style={styles.geoBadgeText}>{u.permissions?.checkin_outside ? 'Outside' : 'Inside'}</Text></View>
                </View>
                <View style={[styles.tableCell, { flex: 0.8 }]}>
                  <View style={[styles.statusTag, u.twoFaSetup ? styles.tagOn : styles.tagOff]}>
                    <Ionicons name={u.twoFaSetup ? "shield-checkmark" : "shield-outline"} size={12} color={u.twoFaSetup ? "#22C55E" : "#94A3B8"} />
                    <Text style={[styles.statusTagText, { color: u.twoFaSetup ? "#22C55E" : "#94A3B8" }]}>{u.twoFaSetup ? 'ON' : 'OFF'}</Text>
                  </View>
                </View>
                <View style={[styles.tableCell, { flex: 0.8 }]}>
                  <View style={[styles.statusBadge, u.status === 'active' ? styles.badgeActive : styles.badgeInactive]}>
                    <View style={[styles.dot, { backgroundColor: u.status === 'active' ? '#22C55E' : '#EF4444' }]} />
                    <Text style={[styles.statusBadgeText, { color: u.status === 'active' ? '#22C55E' : '#EF4444' }]}>{u.status}</Text>
                  </View>
                </View>
                <View style={[styles.tableCell, { flex: 1.2, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }]}>
                  {actionBtns}
                </View>
              </View>
            );
          }) : (
            <View style={styles.emptyTable}>
              <Ionicons name="people-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyText}>No users found. Start by adding a new staff member.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Filter Modal */}
      <Modal visible={showFilter} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.filterModal}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="filter" size={20} color={Colors.brandRed} />
                <Text style={styles.modalTitle}>Filter Users</Text>
              </View>
              <TouchableOpacity onPress={() => setShowFilter(false)}>
                <Ionicons name="close" size={24} color={Colors.textLight} />
              </TouchableOpacity>
            </View>

            <View style={styles.filterBody}>
              <View style={styles.filterGroup}>
                <Text style={styles.fieldLabel}>Role</Text>
                <CustomSelect
                  value={filterRole}
                  onChange={setFilterRole}
                  options={[{ value: 'all', label: 'All Roles' }, { value: 'admin', label: 'Admin' }, { value: 'user', label: 'User' }]}
                />
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.fieldLabel}>Status</Text>
                <CustomSelect
                  value={filterStatus}
                  onChange={setFilterStatus}
                  options={[{ value: 'all', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
                />
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.fieldLabel}>2FA Status</Text>
                <CustomSelect
                  value={filter2FA}
                  onChange={setFilter2FA}
                  options={[{ value: 'all', label: 'All 2FA Status' }, { value: 'enabled', label: 'Enabled' }, { value: 'disabled', label: 'Disabled' }]}
                />
              </View>
            </View>

            <View style={styles.filterFooter}>
              <TouchableOpacity style={styles.resetBtn} onPress={handleResetFilters}>
                <Text style={styles.resetBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilter(false)}>
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Code Modal */}
      {qrUser && (() => {
        const secret  = qrUser.twoFaSecret || '';
        const uri     = buildOtpAuthUri(secret, qrUser.username || qrUser.name);
        const qrUrl   = buildQrUrl(uri, 220);
        const already = !!qrUser.twoFaSetup;

        const handleVerifyOtp = async () => {
          const code = qrOtp.replace(/\s/g, '');
          if (code.length < 6) { setQrOtpError('Enter the 6-digit code'); return; }
          setQrVerifying(true);
          setQrOtpError('');
          try {
            const valid = verifyTOTP(secret, code);
            if (!valid) { setQrOtpError('Invalid code. Try again.'); setQrOtp(''); return; }
            await markTwoFaSetup(qrUser.id);
            setQrUser(null); setQrOtp('');
          } catch { setQrOtpError('Verification error.'); }
          finally { setQrVerifying(false); }
        };

        const handleReset2FA = async () => {
          if (!confirm(`Reset 2FA for ${qrUser.name}? They will need to scan a new QR code to log in.`)) return;
          const newSecret = generateSecret();
          const api = require('@services/api').default;
          await api.put(`/staff/${qrUser.id}/2fa`, { setup: false, secret: newSecret });
          const updated = { ...qrUser, twoFaSecret: newSecret, twoFaSetup: false };
          setQrUser(updated);
          setQrOtp(''); setQrOtpError('');
        };

        const closeQr = () => { setQrUser(null); setQrOtp(''); setQrOtpError(''); };

        return (
          <Modal visible={!!qrUser} transparent animationType="fade" onRequestClose={closeQr}>
            <View style={styles.overlay}>
              <View style={{ backgroundColor: Colors.surface, borderRadius: 20, width: 320, maxWidth: '95%', padding: 20, alignItems: 'center' }}>

                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 14 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text }}>
                    {already ? '2FA Active' : '2FA Setup'}
                  </Text>
                  <TouchableOpacity onPress={closeQr}>
                    <Ionicons name="close" size={20} color={Colors.textLight} />
                  </TouchableOpacity>
                </View>

                {/* User info */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, alignSelf: 'flex-start', width: '100%', backgroundColor: '#F7F8FA', borderRadius: 10, padding: 10 }}>
                  <View style={[styles.avatar, { width: 36, height: 36, borderRadius: 18 }]}>
                    <Text style={[styles.avatarText, { fontSize: 14 }]}>{(qrUser.name || '?')[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>{qrUser.name}</Text>
                    <Text style={{ fontSize: 11, color: Colors.textLight }}>@{qrUser.username}</Text>
                  </View>
                  <View style={{ backgroundColor: already ? '#F0FDF4' : '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name={already ? 'shield-checkmark' : 'shield-outline'} size={12} color={already ? '#16a34a' : '#92400E'} />
                    <Text style={{ fontSize: 10, color: already ? '#16a34a' : '#92400E', fontWeight: '700' }}>{already ? '2FA ON' : '2FA OFF'}</Text>
                  </View>
                </View>

                {already ? (
                  /* ── 2FA already active — show status + reset option ── */
                  <>
                    <View style={{ width: '100%', backgroundColor: '#F0FDF4', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16, gap: 6 }}>
                      <Ionicons name="shield-checkmark" size={40} color="#16a34a" />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#15803D', textAlign: 'center' }}>
                        Two-Factor Authentication is Active
                      </Text>
                      <Text style={{ fontSize: 12, color: '#16a34a', textAlign: 'center', lineHeight: 18 }}>
                        This user has already scanned their QR code and activated 2FA on their authenticator app.
                      </Text>
                    </View>

                    <View style={{ width: '100%', backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Ionicons name="warning-outline" size={16} color="#DC2626" style={{ marginTop: 1 }} />
                      <Text style={{ fontSize: 11, color: '#991B1B', flex: 1, lineHeight: 16 }}>
                        Resetting 2FA will require the user to scan a new QR code before they can log in again.
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                      <TouchableOpacity
                        style={{ flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' }}
                        onPress={closeQr}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textLight }}>Close</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 2, paddingVertical: 11, borderRadius: 10, backgroundColor: '#C0392B', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                        onPress={handleReset2FA}
                      >
                        <Ionicons name="refresh-outline" size={15} color="#fff" />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Reset 2FA</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  /* ── 2FA not yet set — show QR + verify ── */
                  <>
                    <View style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 8, backgroundColor: '#fff', marginBottom: 10 }}>
                      <Image source={{ uri: qrUrl }} style={{ width: 160, height: 160 }} resizeMode="contain" />
                    </View>

                    <Text style={{ fontSize: 11, color: Colors.textLight, textAlign: 'center', marginBottom: 8, lineHeight: 16 }}>
                      Ask the user to scan this QR with{' '}
                      <Text style={{ fontWeight: '700', color: Colors.text }}>Google Authenticator</Text> or{' '}
                      <Text style={{ fontWeight: '700', color: Colors.text }}>Authy</Text>, then enter the 6-digit code below.
                    </Text>

                    <View style={{ backgroundColor: '#F7F8FA', borderRadius: 8, padding: 8, width: '100%', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 }}>
                      <Text style={{ fontSize: 9, color: Colors.textMuted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Manual entry key</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.text, letterSpacing: 1.5, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }}>
                        {secret.match(/.{1,4}/g)?.join(' ') || secret}
                      </Text>
                    </View>

                    <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.text, alignSelf: 'flex-start', marginBottom: 6 }}>
                      Enter code to activate 2FA
                    </Text>
                    <TextInput
                      style={{ width: '100%', borderWidth: 1.5, borderColor: qrOtpError ? '#EF4444' : '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 20, fontWeight: '700', letterSpacing: 8, textAlign: 'center', color: Colors.text, backgroundColor: '#F7F8FA', outlineStyle: 'none', marginBottom: 6 }}
                      placeholder="------"
                      placeholderTextColor="#D1D5DB"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={qrOtp}
                      onChangeText={v => { setQrOtp(v.replace(/\D/g, '')); setQrOtpError(''); }}
                      returnKeyType="go"
                      onSubmitEditing={handleVerifyOtp}
                    />
                    {qrOtpError ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                        <Ionicons name="alert-circle-outline" size={13} color="#EF4444" />
                        <Text style={{ fontSize: 12, color: '#EF4444' }}>{qrOtpError}</Text>
                      </View>
                    ) : null}
                    <TouchableOpacity
                      style={{ backgroundColor: qrOtp.length < 6 ? '#E5E7EB' : '#C0392B', borderRadius: 10, paddingVertical: 11, alignSelf: 'stretch', alignItems: 'center', marginTop: 4 }}
                      onPress={handleVerifyOtp}
                      disabled={qrOtp.length < 6 || qrVerifying}
                    >
                      <Text style={{ color: qrOtp.length < 6 ? '#9CA3AF' : '#fff', fontWeight: '700', fontSize: 14 }}>
                        {qrVerifying ? 'Verifying...' : 'Verify & Activate'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </Modal>
        );
      })()}

      <UserFormModal
        visible={showModal}
        isAdding={isAdding}
        initialData={editUser}
        onSave={handleSave}
        onClose={() => setShowModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  screen:          { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },
  statsRow:        { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard:        { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  statIcon:        { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F7F8FA', justifyContent: 'center', alignItems: 'center' },
  statValue:       { fontSize: 17, fontWeight: '700', color: '#111827' },
  statLabel:       { fontSize: 11, color: Colors.textLight },
  toolbar:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 16 },
  searchBox:       { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  searchInput:     { flex: 1, fontSize: 14, color: Colors.text, outlineStyle: 'none' },
  toolActions:     { flexDirection: 'row', gap: 12 },
  filterBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  filterBtnText:   { color: Colors.text, fontWeight: '600', fontSize: 14 },
  addBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#C0392B', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText:      { color: Colors.white, fontWeight: '700', fontSize: 14 },
  tableCard:       { backgroundColor: Colors.surface, borderRadius: 16, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 15 },
  tableHeader:     { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#F7F8FA', borderBottomWidth: 1, borderBottomColor: Colors.divider },
  columnHeader:    { fontSize: 12, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase' },
  tableRow:        { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.divider, alignItems: 'center' },
  tableCell:       { justifyContent: 'flex-start' },
  avatar:          { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  avatarText:      { fontSize: 16, fontWeight: '700', color: Colors.text },
  userName:        { fontSize: 14, fontWeight: '700', color: Colors.text },
  userEmail:       { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  roleBadge:       { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 4 },
  roleBadgeText:   { fontSize: 10, fontWeight: '700', color: '#374151', letterSpacing: 0.5 },
  geoBadge:        { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  geoBadgeText:    { fontSize: 10, fontWeight: '600', color: '#6B7280' },
  statusTag:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.border },
  statusTagText:   { fontSize: 11, fontWeight: '700' },
  statusBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  badgeActive:     { backgroundColor: '#F0FDF4' },
  badgeInactive:   { backgroundColor: '#FEF2F2' },
  dot:             { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  actionBtn:       { width: 34, height: 34, borderRadius: 8, backgroundColor: '#F7F8FA', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  emptyTable:      { padding: 60, alignItems: 'center', gap: 12 },
  emptyText:       { color: Colors.textLight, textAlign: 'center', fontSize: 14, maxWidth: 300 },
  overlay:         { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal:           { backgroundColor: Colors.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 640, maxHeight: '90%' },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:      { fontSize: 20, fontWeight: '700', color: Colors.text },
  modalScroll:     { marginBottom: 20 },
  sectionTitle:    { fontSize: 13, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  formRow:         { flexDirection: 'row', gap: 16, marginBottom: 16 },
  formGroup:       { flex: 1 },
  fieldLabel:      { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input:           { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: Colors.text, outlineStyle: 'none' },
  dropdownWrap:    { position: 'relative', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, height: 46, justifyContent: 'center' },
  webSelect:       { appearance: 'none', width: '100%', height: '100%', paddingLeft: 20, paddingRight: 35, fontSize: 14, color: Colors.text, border: 'none', backgroundColor: 'transparent', outline: 'none', outlineStyle: 'none', cursor: 'pointer', zIndex: 1 },
  dropdownIcon:    { position: 'absolute', right: 12, top: 14, zIndex: 0 },
  permHeaderRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, marginBottom: 16 },
  permContainer:   { backgroundColor: Colors.surface, borderRadius: 16, borderWeight: 1, borderColor: Colors.border, padding: 1, overflow: 'hidden', borderWidth: 1, borderColor: Colors.divider },
  permGroup:       { padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  permGroupLabel:  { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 14 },
  permBtnRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  permBtn:         { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white },
  permBtnActive:   { backgroundColor: '#FFF0EF', borderColor: '#FECACA' },
  permBtnText:     { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  permBtnTextActive: { color: Colors.brandRed },
  modalActions:    { borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 16 },
  saveBtn:         { backgroundColor: '#C0392B', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnText:     { fontSize: 16, color: Colors.white, fontWeight: '700' },
  filterModal:     { backgroundColor: Colors.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 440, elevation: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20 },
  filterBody:      { gap: 16, marginBottom: 24 },
  filterGroup:     { gap: 8 },
  filterFooter:    { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 20 },
  resetBtn:        { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  resetBtnText:    { color: Colors.text, fontWeight: '600', fontSize: 14 },
  applyBtn:        { flex: 2, backgroundColor: '#C0392B', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  applyBtnText:    { color: Colors.white, fontWeight: '700', fontSize: 14 },
  emptyContainer:  { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60, opacity: 0.6 },
  emptyTitle:      { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 16 },
  emptySub:        { fontSize: 14, color: Colors.textLight, marginTop: 4, textAlign: 'center' },
});
