import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Pressable, RefreshControl,
  Animated, PanResponder, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import { useAuthStore } from '@store/authStore';
import api from '@services/api';

const ACTION_WIDTH    = 130;
const SWIPE_THRESHOLD = 60;

function SwipeableRow({ children, onEdit, onDelete, onExtension }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen     = useRef(false);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
    onPanResponderMove: (_, g) => {
      const val = Math.max(-ACTION_WIDTH, Math.min(0, g.dx + (isOpen.current ? -ACTION_WIDTH : 0)));
      translateX.setValue(val);
    },
    onPanResponderRelease: (_, g) => {
      const shouldOpen = isOpen.current ? g.dx < SWIPE_THRESHOLD : g.dx < -SWIPE_THRESHOLD;
      Animated.spring(translateX, { toValue: shouldOpen ? -ACTION_WIDTH : 0, useNativeDriver: true }).start();
      isOpen.current = shouldOpen;
    },
  })).current;

  const close = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    isOpen.current = false;
  };

  return (
    <View style={{ overflow: 'hidden' }}>
      <View style={sw.actions}>
        {!!onExtension && (
          <TouchableOpacity style={sw.extAction} onPress={() => { close(); onExtension(); }}>
            <Ionicons name="calendar-outline" size={15} color="#fff" />
            <Text style={sw.actionTxt}>Ext.</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={sw.editAction} onPress={() => { close(); onEdit(); }}>
          <Ionicons name="pencil" size={15} color="#fff" />
          <Text style={sw.actionTxt}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={sw.deleteAction} onPress={() => { close(); onDelete(); }}>
          <Ionicons name="trash-outline" size={15} color="#fff" />
          <Text style={sw.actionTxt}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const sw = StyleSheet.create({
  actions:    { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row', width: ACTION_WIDTH },
  extAction:  { flex: 1, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center', gap: 3 },
  editAction: { flex: 1, backgroundColor: '#1D4ED8', justifyContent: 'center', alignItems: 'center', gap: 3 },
  deleteAction:{ flex: 1, backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center', gap: 3 },
  actionTxt:  { fontSize: 11, color: '#fff', fontWeight: '700' },
});

const PRIORITY_META = {
  low:    { label: 'Low',    bg: '#F0FDF4', color: '#16A34A' },
  medium: { label: 'Medium', bg: '#FFFBEB', color: '#D97706' },
  high:   { label: 'High',   bg: '#FEF2F2', color: '#DC2626' },
};

const STATUS_META = {
  pending:    { label: 'Pending',     bg: '#EFF6FF', color: '#1D4ED8', icon: 'time-outline' },
  in_progress:{ label: 'In Progress', bg: '#FFF7ED', color: '#C2410C', icon: 'sync-outline' },
  completed:  { label: 'Completed',   bg: '#F0FDF4', color: '#15803D', icon: 'checkmark-circle-outline' },
  overdue:    { label: 'Overdue',     bg: '#FEF2F2', color: '#DC2626', icon: 'alert-circle-outline' },
  extension_requested: { label: 'Ext. Requested', bg: '#F5F3FF', color: '#7C3AED', icon: 'calendar-outline' },
};

function PriorityBadge({ priority }) {
  const m = PRIORITY_META[priority] || PRIORITY_META.medium;
  return (
    <View style={[bdg.box, { backgroundColor: m.bg }]}>
      <Text style={[bdg.txt, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <View style={[bdg.box, { backgroundColor: m.bg }]}>
      <Ionicons name={m.icon} size={11} color={m.color} />
      <Text style={[bdg.txt, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

const bdg = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  txt: { fontSize: 11, fontWeight: '600' },
});

// ── Calendar Picker ───────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function CalendarPicker({ value, onChange }) {
  const today = dayjs();
  const [open, setOpen]       = useState(false);
  const [cursor, setCursor]   = useState(value ? dayjs(value) : today);
  const [rawText, setRawText] = useState(value ? dayjs(value).format('DD/MM/YYYY') : '');

  const selected    = value ? dayjs(value) : null;
  const firstDay    = cursor.startOf('month').day();
  const daysInMonth = cursor.daysInMonth();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pick = (d) => {
    if (!d) return;
    const picked = cursor.date(d);
    if (picked.isBefore(today.startOf('day'))) return;
    const formatted = picked.format('YYYY-MM-DD');
    onChange(formatted);
    setRawText(picked.format('DD/MM/YYYY'));
    setOpen(false);
  };

  return (
    <View style={{ alignSelf: 'stretch' }}>
      <View style={cp.trigger}>
        <TextInput
          style={cp.triggerTxt}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={Colors.textMuted}
          value={rawText}
          onChangeText={(text) => {
            // strip non-digits
            const digits = text.replace(/\D/g, '');
            // auto-insert slashes: DD/MM/YYYY
            let formatted = digits;
            if (digits.length > 2) formatted = digits.slice(0,2) + '/' + digits.slice(2);
            if (digits.length > 4) formatted = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4,8);
            setRawText(formatted);
            if (digits.length === 8) {
              const dd = digits.slice(0,2), mm = digits.slice(2,4), yyyy = digits.slice(4,8);
              const parsed = dayjs(`${yyyy}-${mm}-${dd}`);
              if (parsed.isValid()) {
                onChange(parsed.format('YYYY-MM-DD'));
                setCursor(parsed);
              }
            }
          }}
          maxLength={10}
        />
        <TouchableOpacity style={cp.calBtn} onPress={() => setOpen(true)}>
          <Ionicons name="calendar-outline" size={16} color={Colors.textLight} />
        </TouchableOpacity>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={cp.overlay} onPress={() => setOpen(false)}>
          <Pressable style={cp.panel} onPress={e => e.stopPropagation?.()}>

            <View style={cp.panelHeader}>
              <Text style={cp.panelTitle}>Select Due Date</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={20} color={Colors.textLight} />
              </TouchableOpacity>
            </View>

            <View style={cp.nav}>
              <TouchableOpacity style={cp.navBtn} onPress={() => setCursor(c => c.subtract(1, 'month'))}>
                <Ionicons name="chevron-back" size={16} color={Colors.text} />
              </TouchableOpacity>
              <Text style={cp.navTitle}>{MONTHS[cursor.month()]} {cursor.year()}</Text>
              <TouchableOpacity style={cp.navBtn} onPress={() => setCursor(c => c.add(1, 'month'))}>
                <Ionicons name="chevron-forward" size={16} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={cp.weekRow}>
              {DAYS.map(d => <Text key={d} style={cp.weekDay}>{d}</Text>)}
            </View>

            <View style={cp.grid}>
              {cells.map((d, i) => {
                if (!d) return <View key={`e${i}`} style={cp.cell} />;
                const date    = cursor.date(d);
                const isPast  = date.isBefore(today.startOf('day'));
                const isToday = date.isSame(today, 'day');
                const isSel   = selected && date.isSame(selected, 'day');
                return (
                  <TouchableOpacity
                    key={d}
                    style={[cp.cell, isSel && cp.cellSel, isToday && !isSel && cp.cellToday]}
                    onPress={() => pick(d)}
                    disabled={isPast}
                  >
                    <Text style={[cp.cellTxt, isPast && cp.cellPast, isSel && cp.cellSelTxt, isToday && !isSel && cp.cellTodayTxt]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={cp.footer}>
              <TouchableOpacity style={cp.footerBtn} onPress={() => { onChange(''); setRawText(''); setOpen(false); }}>
                <Text style={cp.clearTxt}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[cp.footerBtn, cp.todayBtn]} onPress={() => { onChange(today.format('YYYY-MM-DD')); setRawText(today.format('DD/MM/YYYY')); setCursor(today); setOpen(false); }}>
                <Text style={cp.todayTxt}>Today</Text>
              </TouchableOpacity>
            </View>

          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function DateFilterCalendar({ value, onChange, onClose }) {
  const today    = dayjs();
  const [cursor, setCursor] = useState(value ? dayjs(value) : today);
  const selected = value ? dayjs(value) : null;
  const firstDay = cursor.startOf('month').day();
  const daysInMonth = cursor.daysInMonth();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={cp.overlay} onPress={onClose}>
        <Pressable style={cp.panel} onPress={e => e.stopPropagation?.()}>
          <View style={cp.panelHeader}>
            <Text style={cp.panelTitle}>Select Date</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color={Colors.textLight} />
            </TouchableOpacity>
          </View>
          <View style={cp.nav}>
            <TouchableOpacity style={cp.navBtn} onPress={() => setCursor(c => c.subtract(1, 'month'))}>
              <Ionicons name="chevron-back" size={16} color={Colors.text} />
            </TouchableOpacity>
            <Text style={cp.navTitle}>{MONTHS[cursor.month()]} {cursor.year()}</Text>
            <TouchableOpacity style={cp.navBtn} onPress={() => setCursor(c => c.add(1, 'month'))}>
              <Ionicons name="chevron-forward" size={16} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <View style={cp.weekRow}>
            {DAYS.map(d => <Text key={d} style={cp.weekDay}>{d}</Text>)}
          </View>
          <View style={cp.grid}>
            {cells.map((d, i) => {
              if (!d) return <View key={`e${i}`} style={cp.cell} />;
              const date   = cursor.date(d);
              const isToday = date.isSame(today, 'day');
              const isSel   = selected && date.isSame(selected, 'day');
              return (
                <TouchableOpacity
                  key={d}
                  style={[cp.cell, isSel && cp.cellSel, isToday && !isSel && cp.cellToday]}
                  onPress={() => onChange(cursor.date(d).format('YYYY-MM-DD'))}
                >
                  <Text style={[cp.cellTxt, isSel && cp.cellSelTxt, isToday && !isSel && cp.cellTodayTxt]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={cp.footer}>
            <TouchableOpacity style={cp.footerBtn} onPress={() => { onChange(''); onClose(); }}>
              <Text style={cp.clearTxt}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[cp.footerBtn, cp.todayBtn]} onPress={() => { onChange(today.format('YYYY-MM-DD')); onClose(); }}>
              <Text style={cp.todayTxt}>Today</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const cp = StyleSheet.create({
  trigger:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, alignSelf: 'stretch' },
  triggerTxt:  { flex: 1, fontSize: 14, color: Colors.text, outlineStyle: 'none' },
  calBtn:      { width: 28, height: 28, borderRadius: 7, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  panel:       { backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: '#D1D5DB', width: '100%', maxWidth: 300, padding: 16, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, elevation: 12 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  panelTitle:  { fontSize: 15, fontWeight: '700', color: Colors.text },
  nav:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn:      { padding: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  navTitle:    { fontSize: 14, fontWeight: '700', color: Colors.text },
  weekRow:     { flexDirection: 'row', marginBottom: 4 },
  weekDay:     { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  grid:        { flexDirection: 'row', flexWrap: 'wrap' },
  cell:        { width: `${100/7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  cellSel:     { backgroundColor: Colors.primary },
  cellToday:   { borderWidth: 1.5, borderColor: Colors.primary },
  cellTxt:     { fontSize: 12, color: Colors.text },
  cellPast:    { color: '#D1D5DB' },
  cellSelTxt:  { color: '#fff', fontWeight: '700' },
  cellTodayTxt:{ color: Colors.primary, fontWeight: '700' },
  footer:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.divider },
  footerBtn:   { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  todayBtn:    { backgroundColor: Colors.primary },
  clearTxt:    { fontSize: 13, color: Colors.textLight, fontWeight: '600' },
  todayTxt:    { fontSize: 13, color: '#fff', fontWeight: '600' },
});

// ── Create / Edit Task Modal ──────────────────────────────────────────────────
function TaskFormModal({ visible, onClose, onSave, users, editTask }) {
  const [title, setTitle]       = useState('');
  const [description, setDesc]  = useState('');
  const [assignedTo, setAssign] = useState(null);
  const [dueDate, setDue]       = useState('');
  const [priority, setPriority] = useState('medium');
  const [userSearch, setUSearch]= useState('');
  const [showUserList, setShowUserList] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!visible) return;
    if (editTask) {
      setTitle(editTask.title || '');
      setDesc(editTask.description || '');
      setAssign(editTask.assigned_to ? { id: editTask.assigned_to, name: editTask.assigned_name } : null);
      setDue(editTask.due_date ? dayjs(editTask.due_date).format('YYYY-MM-DD') : '');
      setPriority(editTask.priority || 'medium');
    } else {
      setTitle(''); setDesc(''); setAssign(null); setDue(''); setPriority('medium');
    }
    setError('');
    setUSearch('');
    setShowUserList(false);
  }, [visible, editTask]);

  const filteredUsers = users.filter(u =>
    (u.name || u.username || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  const handleSave = async () => {
    if (!title.trim()) { setError('Task title is required.'); return; }
    if (!assignedTo)   { setError('Please assign the task to an employee.'); return; }
    if (!dueDate)      { setError('Due date is required.'); return; }
    setSaving(true); setError('');
    try {
      await onSave({ title: title.trim(), description: description.trim(), assigned_to: assignedTo.id, due_date: dueDate, priority });
      onClose();
    } catch (e) {
      setError(e?.message || 'Failed to save task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={fm.overlay}>
        <View style={fm.card}>
          <View style={fm.header}>
            <Text style={fm.title}>{editTask ? 'Edit Task' : 'New Task'}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={20} color={Colors.textLight} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={fm.label}>Task Title *</Text>
            <TextInput style={fm.input} placeholder="Enter task title" placeholderTextColor={Colors.textMuted}
              value={title} onChangeText={setTitle} />

            <Text style={fm.label}>Description</Text>
            <TextInput style={[fm.input, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="Describe the task…" placeholderTextColor={Colors.textMuted}
              value={description} onChangeText={setDesc} multiline numberOfLines={4} />

            <Text style={fm.label}>Assign To *</Text>
            <View style={{ zIndex: 999 }}>
              <TouchableOpacity
                style={[fm.input, showUserList && { borderColor: Colors.primary, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
                onPress={() => { setShowUserList(!showUserList); setUSearch(''); }}
              >
                <Text style={assignedTo ? fm.inputVal : fm.inputPlaceholder}>
                  {assignedTo ? (assignedTo.name || assignedTo.username) : 'Select employee…'}
                </Text>
                <Ionicons name={showUserList ? 'chevron-up' : 'chevron-down'} size={16} color={showUserList ? Colors.primary : Colors.textMuted} />
              </TouchableOpacity>

              {showUserList && (
                <View style={fm.dropdownBox}>
                  {/* Search inside dropdown */}
                  <View style={fm.dropSearch}>
                    <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
                    <TextInput
                      style={fm.dropSearchInput}
                      placeholder="Search employee…"
                      placeholderTextColor={Colors.textMuted}
                      value={userSearch}
                      onChangeText={setUSearch}
                    />
                    {!!userSearch && (
                      <TouchableOpacity onPress={() => setUSearch('')}>
                        <Ionicons name="close-circle" size={14} color={Colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                    {filteredUsers.map(u => {
                      const displayName = u.name || u.username || '?';
                      const isSelected = assignedTo?.id === u.id;
                      return (
                        <TouchableOpacity
                          key={u.id}
                          style={[fm.dropItem, isSelected && fm.dropItemActive]}
                          onPress={() => { setAssign({ ...u, name: displayName }); setShowUserList(false); setUSearch(''); }}
                        >
                          <View style={[fm.dropAvatar, isSelected && { backgroundColor: '#FFF0EF' }]}>
                            <Text style={[fm.dropAvatarTxt, isSelected && { color: Colors.primary }]}>{displayName[0].toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[fm.dropName, isSelected && { color: Colors.primary }]}>{displayName}</Text>
                            {!!u.email && <Text style={fm.dropEmail}>{u.email}</Text>}
                          </View>
                          {isSelected && <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />}
                        </TouchableOpacity>
                      );
                    })}
                    {filteredUsers.length === 0 && (
                      <Text style={fm.dropEmpty}>No employees found</Text>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>

            <Text style={fm.label}>Due Date *</Text>
            <CalendarPicker value={dueDate} onChange={setDue} />

            <Text style={fm.label}>Priority</Text>
            <View style={fm.priorityRow}>
              {['low', 'medium', 'high'].map(p => (
                <TouchableOpacity key={p} style={[fm.priorityBtn, priority === p && { backgroundColor: PRIORITY_META[p].bg, borderColor: PRIORITY_META[p].color }]}
                  onPress={() => setPriority(p)}>
                  <Text style={[fm.priorityTxt, priority === p && { color: PRIORITY_META[p].color, fontWeight: '700' }]}>
                    {PRIORITY_META[p].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {!!error && (
              <View style={fm.errBox}>
                <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                <Text style={fm.errTxt}>{error}</Text>
              </View>
            )}

            <TouchableOpacity style={[fm.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={fm.saveTxt}>{editTask ? 'Save Changes' : 'Create Task'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const fm = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:        { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 480, padding: 24, maxHeight: '90%' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:       { fontSize: 17, fontWeight: '700', color: Colors.text },
  label:       { fontSize: 12, fontWeight: '600', color: Colors.textLight, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F7F8FA', borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text },
  inputVal:    { fontSize: 14, color: Colors.text, flex: 1 },
  inputPlaceholder: { fontSize: 14, color: Colors.textMuted, flex: 1 },
  dropdownBox:    { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderTopWidth: 0, borderColor: Colors.primary, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 10, zIndex: 999 },
  dropSearch:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.divider, backgroundColor: '#F9FAFB' },
  dropSearchInput:{ flex: 1, fontSize: 13, color: Colors.text, outlineStyle: 'none' },
  dropItem:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  dropItemActive: { backgroundColor: '#FFF8F8' },
  dropAvatar:     { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  dropAvatarTxt:  { fontSize: 12, fontWeight: '700', color: '#374151' },
  dropName:       { fontSize: 13, fontWeight: '600', color: Colors.text },
  dropEmail:      { fontSize: 11, color: Colors.textMuted },
  dropEmpty:      { padding: 14, textAlign: 'center', color: Colors.textMuted, fontSize: 13 },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: '#F7F8FA' },
  priorityTxt: { fontSize: 13, color: Colors.textLight, fontWeight: '500' },
  errBox:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginTop: 14 },
  errTxt:      { fontSize: 12, color: '#DC2626', flex: 1 },
  saveBtn:     { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 20 },
  saveTxt:     { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ── Extension Request Detail Modal ────────────────────────────────────────────
function ExtensionModal({ visible, task, onClose, onDecide }) {
  const [deciding, setDeciding] = useState(false);

  const handleDecide = async (approved) => {
    setDeciding(true);
    await onDecide(task.id, approved);
    setDeciding(false);
    onClose();
  };

  if (!task) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={em.overlay}>
        <View style={em.card}>
          <View style={em.header}>
            <Text style={em.title}>Extension Request</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={20} color={Colors.textLight} /></TouchableOpacity>
          </View>
          <View style={em.row}><Text style={em.lbl}>Task</Text><Text style={em.val} numberOfLines={2}>{task.title}</Text></View>
          <View style={em.row}><Text style={em.lbl}>Employee</Text><Text style={em.val}>{task.assigned_name}</Text></View>
          <View style={em.row}><Text style={em.lbl}>Original Due</Text><Text style={em.val}>{dayjs(task.due_date).format('DD MMM YYYY')}</Text></View>
          <View style={em.row}><Text style={em.lbl}>Requested Until</Text>
            <Text style={[em.val, { color: Colors.purple }]}>{task.extension_date ? dayjs(task.extension_date).format('DD MMM YYYY') : '—'}</Text>
          </View>
          <Text style={em.reasonLbl}>Reason for non-completion</Text>
          <View style={em.reasonBox}><Text style={em.reasonTxt}>{task.completion_note || '—'}</Text></View>
          <Text style={em.reasonLbl}>Extension reason</Text>
          <View style={em.reasonBox}><Text style={em.reasonTxt}>{task.extension_reason || '—'}</Text></View>
          <View style={em.btnRow}>
            <TouchableOpacity style={[em.btn, { backgroundColor: '#D1FAE5' }]} onPress={() => handleDecide(true)} disabled={deciding}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#065F46" />
              <Text style={[em.btnTxt, { color: '#065F46' }]}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[em.btn, { backgroundColor: '#FEE2E2' }]} onPress={() => handleDecide(false)} disabled={deciding}>
              <Ionicons name="close-circle-outline" size={16} color="#991B1B" />
              <Text style={[em.btnTxt, { color: '#991B1B' }]}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const em = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:      { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 440, padding: 24 },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title:     { fontSize: 17, fontWeight: '700', color: Colors.text },
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.divider, gap: 12 },
  lbl:       { fontSize: 13, color: Colors.textLight, width: 110 },
  val:       { fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1, textAlign: 'right' },
  reasonLbl: { fontSize: 12, fontWeight: '600', color: Colors.textLight, marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  reasonBox: { backgroundColor: '#F7F8FA', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border },
  reasonTxt: { fontSize: 13, color: Colors.text, lineHeight: 20 },
  btnRow:    { flexDirection: 'row', gap: 10, marginTop: 20 },
  btn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10 },
  btnTxt:    { fontSize: 13, fontWeight: '700' },
});

// ── Reassign Modal ────────────────────────────────────────────────────────────
function ReassignModal({ visible, task, users, onClose, onReassign }) {
  const [search, setSearch]   = useState('');
  const [saving, setSaving]   = useState(false);

  if (!task) return null;

  const filtered = users.filter(u => {
    const name = (u.name || u.username || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    return name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
  });

  const handlePick = async (user) => {
    setSaving(true);
    try {
      await onReassign(task.id, user.id);
      onClose();
    } catch (e) {
      alert(e?.message || 'Failed to reassign task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={rm.overlay}>
        <View style={rm.card}>
          <View style={rm.header}>
            <View>
              <Text style={rm.title}>Reassign Task</Text>
              <Text style={rm.sub} numberOfLines={1}>{task.title}</Text>
            </View>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={20} color={Colors.textLight} /></TouchableOpacity>
          </View>

          <Text style={rm.current}>Currently: <Text style={{ color: Colors.text, fontWeight: '700' }}>{task.assigned_name}</Text></Text>

          <View style={rm.searchBox}>
            <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
            <TextInput
              style={rm.searchInput}
              placeholder="Search employee…"
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>

          <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
            {filtered.map(u => {
              const name = u.name || u.username || '?';
              const isCurrent = String(u.id) === String(task.assigned_to);
              return (
                <TouchableOpacity
                  key={u.id}
                  style={[rm.item, isCurrent && rm.itemCurrent]}
                  onPress={() => !isCurrent && handlePick(u)}
                  disabled={isCurrent || saving}
                >
                  <View style={rm.avatar}>
                    <Text style={rm.avatarTxt}>{name[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[rm.name, isCurrent && { color: Colors.primary }]}>{name}</Text>
                    {!!u.email && <Text style={rm.email}>{u.email}</Text>}
                  </View>
                  {isCurrent
                    ? <View style={rm.currentBadge}><Text style={rm.currentBadgeTxt}>Current</Text></View>
                    : <Ionicons name="arrow-forward-circle-outline" size={20} color={Colors.textMuted} />
                  }
                </TouchableOpacity>
              );
            })}
            {filtered.length === 0 && <Text style={rm.empty}>No employees found</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const rm = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:         { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 420, padding: 20 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  title:        { fontSize: 16, fontWeight: '700', color: Colors.text },
  sub:          { fontSize: 12, color: Colors.textMuted, marginTop: 2, maxWidth: 280 },
  current:      { fontSize: 12, color: Colors.textLight, marginBottom: 12 },
  searchBox:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  searchInput:  { flex: 1, fontSize: 13, color: Colors.text, outlineStyle: 'none' },
  item:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  itemCurrent:  { backgroundColor: '#FFF8F8' },
  avatar:       { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  avatarTxt:    { fontSize: 13, fontWeight: '700', color: '#374151' },
  name:         { fontSize: 13, fontWeight: '600', color: Colors.text },
  email:        { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  currentBadge: { backgroundColor: '#FFF0EF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  currentBadgeTxt: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  empty:        { textAlign: 'center', color: Colors.textMuted, fontSize: 13, padding: 20 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function TaskManagementScreen({ navigation }) {
  const { width }                       = useWindowDimensions();
  const isMobile                        = width < 768;
  const { users: storeUsers, loadUsers } = useAuthStore();
  const [tasks, setTasks]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilter]       = useState('all');
  const [formVisible, setFormVisible]   = useState(false);
  const [editTask, setEditTask]         = useState(null);
  const [extTask, setExtTask]           = useState(null);
  const [extVisible, setExtVisible]     = useState(false);
  const [reassignTask, setReassignTask] = useState(null);
  const [reassignVisible, setReassignVisible] = useState(false);
  const [filterDropdown, setFilterDropdown] = useState(false);
  const [dateFilter, setDateFilter]     = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [page, setPage]                 = useState(1);
  const PAGE_SIZE = 10;

  const [users, setUsers] = useState(storeUsers || []);

  useEffect(() => {
    if (storeUsers?.length) {
      setUsers(storeUsers);
    } else {
      loadUsers().then(loaded => { if (loaded?.length) setUsers(loaded); }).catch(() => {});
    }
  }, [storeUsers]);

  const loadData = useCallback(async () => {
    try {
      const tasksRes = await api.get('/tasks');
      setTasks(Array.isArray(tasksRes) ? tasksRes : (tasksRes?.tasks || []));
    } catch {
      setTasks([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleRefresh = () => { setRefreshing(true); loadData(); };

  const handleCreate = async (data) => {
    await api.post('/tasks', data);
    loadData();
  };

  const handleEdit = async (data) => {
    await api.put(`/tasks/${editTask.id}`, data);
    setEditTask(null);
    loadData();
  };

  const handleDelete = async (id) => {
    await api.delete(`/tasks/${id}`);
    loadData();
  };

  const handleExtensionDecide = async (taskId, approved) => {
    await api.put(`/tasks/${taskId}/extension`, { approved });
    loadData();
  };

  useEffect(() => { setPage(1); }, [search, filterStatus, dateFilter]);

  const handleReassign = async (taskId, newUserId) => {
    await api.put(`/tasks/${taskId}`, { assigned_to: newUserId });
    loadData();
  };

  const openEdit = (task) => { setEditTask(task); setFormVisible(true); };
  const openReassign = (task) => { setReassignTask(task); setReassignVisible(true); };
  const openExtension = (task) => { setExtTask(task); setExtVisible(true); };

  const filtered = tasks.filter(t => {
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || t.title?.toLowerCase().includes(q) || t.assigned_name?.toLowerCase().includes(q);
    const matchDate = !dateFilter || dayjs(t.due_date).format('YYYY-MM-DD') === dateFilter;
    return matchStatus && matchSearch && matchDate;
  });

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedData   = isMobile ? filtered : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
    extension_requested: tasks.filter(t => t.status === 'extension_requested').length,
  };

  const SUMMARY = [
    { label: 'Total',       value: counts.all,         key: 'all' },
    { label: 'Pending',     value: counts.pending,     key: 'pending' },
    { label: 'In Progress', value: counts.in_progress, key: 'in_progress' },
    { label: 'Completed',   value: counts.completed,   key: 'completed' },
    { label: 'Overdue',     value: counts.overdue,     key: 'overdue' },
  ];

  const STAT_ICON_META = {
    all:         { icon: 'layers-outline',            bg: '#F3F4F6', color: '#6B7280' },
    pending:     { icon: 'time-outline',              bg: '#F3F4F6', color: '#6B7280' },
    in_progress: { icon: 'sync-outline',              bg: '#F3F4F6', color: '#6B7280' },
    completed:   { icon: 'checkmark-circle-outline',  bg: '#F3F4F6', color: '#6B7280' },
    overdue:     { icon: 'alert-circle-outline',      bg: '#F3F4F6', color: '#6B7280' },
  };

  return (
    <View style={s.screen}>
      <Navbar navigation={navigation} activeTab="Tasks" />

      <ScrollView style={s.container} contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}>

        {/* Extension requests alert */}
        {counts.extension_requested > 0 && (
          <TouchableOpacity style={s.extAlert} onPress={() => setFilter('extension_requested')}>
            <Ionicons name="calendar-outline" size={16} color="#7C3AED" />
            <Text style={s.extAlertTxt}>
              {counts.extension_requested} extension {counts.extension_requested === 1 ? 'request' : 'requests'} pending review
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#7C3AED" />
          </TouchableOpacity>
        )}


        {/* Search + Filter + Date + New Task — all in one row */}
        <View style={s.searchRow}>
          <View style={s.searchWrap}>
            <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
            <TextInput style={s.searchInput} placeholder="Search by task or employee…"
              placeholderTextColor={Colors.textMuted} value={search} onChangeText={setSearch} />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[s.filterBtn, filterStatus !== 'all' && s.filterBtnActive, isMobile && s.filterBtnIcon]}
            onPress={() => setFilterDropdown(true)}
          >
            <Ionicons name="options-outline" size={16} color={filterStatus !== 'all' ? Colors.primary : Colors.textLight} />
            {!isMobile && <Text style={[s.filterBtnTxt, filterStatus !== 'all' && { color: Colors.primary }]}>Filter</Text>}
            {!isMobile && filterStatus !== 'all' && <View style={s.filterDot} />}
          </TouchableOpacity>
          {/* Date filter — type or pick */}
          <View style={[s.dateInputWrap, !!dateFilter && s.dateInputWrapActive]}>
            <TextInput
              style={s.dateInput}
              placeholder="DD-MM-YYYY"
              placeholderTextColor={Colors.textMuted}
              value={dateFilter ? dayjs(dateFilter).format('DD-MM-YYYY') : ''}
              onChangeText={(txt) => {
                const clean = txt.replace(/[^0-9]/g, '');
                if (clean.length === 8) {
                  const d = dayjs(`${clean.slice(4)}-${clean.slice(2,4)}-${clean.slice(0,2)}`);
                  if (d.isValid()) setDateFilter(d.format('YYYY-MM-DD'));
                } else if (txt === '') {
                  setDateFilter('');
                }
              }}
            />
            {!!dateFilter && (
              <TouchableOpacity onPress={() => setDateFilter('')}>
                <Ionicons name="close-circle" size={15} color={Colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setDatePickerOpen(true)}>
              <Ionicons name="calendar-outline" size={16} color={dateFilter ? Colors.primary : Colors.textLight} />
            </TouchableOpacity>
          </View>
          {!isMobile && (
            <TouchableOpacity style={s.createBtn} onPress={() => { setEditTask(null); setFormVisible(true); }}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={s.createBtnTxt}>New Task</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Date picker modal */}
        {datePickerOpen && (
          <DateFilterCalendar
            value={dateFilter}
            onChange={(val) => { setDateFilter(val); setDatePickerOpen(false); }}
            onClose={() => setDatePickerOpen(false)}
          />
        )}

        {/* Filter dropdown modal */}
        <Modal visible={filterDropdown} transparent animationType="fade" onRequestClose={() => setFilterDropdown(false)}>
          <Pressable style={s.filterOverlay} onPress={() => setFilterDropdown(false)}>
            <View style={s.filterPanel}>
              <View style={s.filterPanelHeader}>
                <Text style={s.filterPanelTitle}>Filter by Status</Text>
                {filterStatus !== 'all' && (
                  <TouchableOpacity onPress={() => { setFilter('all'); setFilterDropdown(false); }}>
                    <Text style={s.filterClear}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
              {[
                { key: 'all',                  label: 'All Tasks',           icon: 'list-outline' },
                { key: 'pending',              label: 'Pending',             icon: 'time-outline' },
                { key: 'in_progress',          label: 'In Progress',         icon: 'sync-outline' },
                { key: 'completed',            label: 'Completed',           icon: 'checkmark-circle-outline' },
                { key: 'overdue',              label: 'Overdue',             icon: 'alert-circle-outline' },
                { key: 'extension_requested',  label: 'Extension Requested', icon: 'calendar-outline' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.filterOption, filterStatus === opt.key && s.filterOptionActive]}
                  onPress={() => { setFilter(opt.key); setFilterDropdown(false); }}
                >
                  <Ionicons name={opt.icon} size={16} color={filterStatus === opt.key ? Colors.primary : Colors.textLight} />
                  <Text style={[s.filterOptionTxt, filterStatus === opt.key && s.filterOptionTxtActive]}>{opt.label}</Text>
                  {counts[opt.key] > 0 && (
                    <View style={[s.filterCount, filterStatus === opt.key && s.filterCountActive]}>
                      <Text style={[s.filterCountTxt, filterStatus === opt.key && { color: Colors.primary }]}>{counts[opt.key]}</Text>
                    </View>
                  )}
                  {filterStatus === opt.key && <Ionicons name="checkmark" size={15} color={Colors.primary} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>

        {loading && (
          <View style={s.emptyBox}><ActivityIndicator color={Colors.primary} /></View>
        )}
        {!loading && filtered.length === 0 && (
          <View style={s.emptyBox}>
            <Ionicons name="checkmark-done-outline" size={36} color={Colors.textMuted} />
            <Text style={s.emptyTxt}>No tasks found</Text>
            <Text style={s.emptyHint}>Create a new task to get started</Text>
          </View>
        )}
        {!loading && filtered.length > 0 && isMobile && filtered.map((t, idx) => {
          const isOverdue = t.status !== 'completed' && dayjs(t.due_date).isBefore(dayjs(), 'day');
          const effectiveStatus = t.status === 'extension_requested' ? 'extension_requested' : isOverdue ? 'overdue' : t.status;
          return (
            <SwipeableRow
              key={t.id}
              onEdit={() => openEdit(t)}
              onDelete={() => handleDelete(t.id)}
              onExtension={t.status === 'extension_requested' ? () => openExtension(t) : null}
            >
              <View style={[s.mCard, idx % 2 === 1 && { backgroundColor: '#FAFAFA' }]}>
                <View style={s.mRow}>
                  <Text style={s.mTitle} numberOfLines={1}>{t.title}</Text>
                  <StatusBadge status={effectiveStatus} />
                </View>
                <View style={s.mRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={s.avatar}><Text style={s.avatarTxt}>{(t.assigned_name || '?')[0].toUpperCase()}</Text></View>
                    <Text style={s.mEmp} numberOfLines={1}>{t.assigned_name}</Text>
                  </View>
                  <PriorityBadge priority={t.priority} />
                </View>
                <View style={s.mRow}>
                  <Text style={[s.mMeta, isOverdue && { color: '#DC2626' }]}>Due: {dayjs(t.due_date).format('DD MMM YY')}</Text>
                  <Text style={s.mMeta}>{t.created_at ? dayjs(t.created_at).format('DD MMM YY') : '—'}</Text>
                </View>
              </View>
            </SwipeableRow>
          );
        })}
        {!loading && filtered.length > 0 && !isMobile && (
          <View>
            <View style={s.tableBox}>
              <View style={[s.row, s.tableHeader]}>
                <Text style={[s.th, { flex: 2.5 }]}>Task</Text>
                <Text style={[s.th, s.thCell, { flex: 1.5 }]}>Assigned To</Text>
                <Text style={[s.th, s.thCell, { flex: 1.2, textAlign: 'center' }]}>Assigned On</Text>
                <Text style={[s.th, s.thCell, { flex: 1.2, textAlign: 'center' }]}>Due Date</Text>
                <Text style={[s.th, s.thCell, { flex: 1, textAlign: 'center' }]}>Priority</Text>
                <Text style={[s.th, s.thCell, { flex: 1.5, textAlign: 'center' }]}>Status</Text>
                <Text style={[s.th, s.thCell, { flex: 1, textAlign: 'center' }]}>Action</Text>
              </View>
              {pagedData.map((t, idx) => {
                const isOverdue = t.status !== 'completed' && dayjs(t.due_date).isBefore(dayjs(), 'day');
                const effectiveStatus = t.status === 'extension_requested' ? 'extension_requested' : isOverdue ? 'overdue' : t.status;
                return (
                  <View key={t.id} style={[s.row, s.tableRow, idx % 2 === 1 && { backgroundColor: '#FAFAFA' }]}>
                    <View style={[s.td, { flex: 2.5, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }]}>
                      <Text style={s.taskTitle} numberOfLines={2}>{t.title}</Text>
                      {!!t.description && <Text style={s.taskDesc} numberOfLines={1}>{t.description}</Text>}
                    </View>
                    <View style={[s.td, s.tdCell, { flex: 1.5 }]}>
                      <Text style={s.empName} numberOfLines={1}>{t.assigned_name}</Text>
                    </View>
                    <View style={[s.td, s.tdCell, { flex: 1.2, flexDirection: 'column', alignItems: 'center', gap: 0 }]}>
                      <Text style={s.assignedDate}>{t.created_at ? dayjs(t.created_at).format('DD MMM YY') : '—'}</Text>
                      {!!t.created_at && <Text style={s.assignedTime}>{dayjs(t.created_at).format('hh:mm A')}</Text>}
                    </View>
                    <View style={[s.td, s.tdCell, { flex: 1.2, flexDirection: 'column', alignItems: 'center', gap: 0 }]}>
                      <Text style={[s.dueDate, isOverdue && { color: '#DC2626' }]}>{dayjs(t.due_date).format('DD MMM YY')}</Text>
                      {isOverdue && <Text style={s.overdueTag}>Overdue</Text>}
                    </View>
                    <View style={[s.td, s.tdCell, { flex: 1, justifyContent: 'center' }]}>
                      <PriorityBadge priority={t.priority} />
                    </View>
                    <View style={[s.td, s.tdCell, { flex: 1.5, justifyContent: 'center' }]}>
                      <StatusBadge status={effectiveStatus} />
                    </View>
                    <View style={[s.td, s.tdCell, { flex: 1, justifyContent: 'center', gap: 6 }]}>
                      {t.status === 'extension_requested' && (
                        <TouchableOpacity style={s.actionIconBtn} onPress={() => openExtension(t)}>
                          <Ionicons name="calendar-outline" size={15} color="#7C3AED" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[s.actionIconBtn, { backgroundColor: '#EFF6FF' }]} onPress={() => openReassign(t)}>
                        <Ionicons name="person-outline" size={15} color="#1D4ED8" />
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actionIconBtn} onPress={() => openEdit(t)}>
                        <Ionicons name="pencil-outline" size={15} color={Colors.textLight} />
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.actionIconBtn, { backgroundColor: '#FEF2F2' }]} onPress={() => handleDelete(t.id)}>
                        <Ionicons name="trash-outline" size={15} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
            {totalPages > 1 && (
              <View style={s.pagination}>
                <TouchableOpacity
                  style={[s.pageBtn, page === 1 && s.pageBtnDisabled]}
                  onPress={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <Ionicons name="chevron-back" size={14} color={page === 1 ? '#CBD5E1' : Colors.text} />
                  <Text style={[s.pageBtnTxt, page === 1 && { color: '#CBD5E1' }]}>Prev</Text>
                </TouchableOpacity>
                <View style={s.pageNumbers}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                    .reduce((acc, n, i, arr) => {
                      if (i > 0 && n - arr[i - 1] > 1) acc.push('...');
                      acc.push(n);
                      return acc;
                    }, [])
                    .map((n, i) => n === '...' ? (
                      <Text key={`e${i}`} style={s.pageDots}>…</Text>
                    ) : (
                      <TouchableOpacity key={n} style={[s.pageNum, page === n && s.pageNumActive]} onPress={() => setPage(n)}>
                        <Text style={[s.pageNumTxt, page === n && s.pageNumTxtActive]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
                <TouchableOpacity
                  style={[s.pageBtn, page === totalPages && s.pageBtnDisabled]}
                  onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <Text style={[s.pageBtnTxt, page === totalPages && { color: '#CBD5E1' }]}>Next</Text>
                  <Ionicons name="chevron-forward" size={14} color={page === totalPages ? '#CBD5E1' : Colors.text} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {isMobile && (
        <View style={s.fabWrap}>
          <TouchableOpacity style={s.fab} onPress={() => { setEditTask(null); setFormVisible(true); }}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <TaskFormModal
        visible={formVisible}
        onClose={() => { setFormVisible(false); setEditTask(null); }}
        onSave={editTask ? handleEdit : handleCreate}
        users={users}
        editTask={editTask}
      />

      <ExtensionModal
        visible={extVisible}
        task={extTask}
        onClose={() => { setExtVisible(false); setExtTask(null); }}
        onDecide={handleExtensionDecide}
      />

      <ReassignModal
        visible={reassignVisible}
        task={reassignTask}
        users={users}
        onClose={() => { setReassignVisible(false); setReassignTask(null); }}
        onReassign={handleReassign}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen:        { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },
  container:     { flex: 1, width: '100%' },
  content:       { padding: 14, paddingBottom: 100 },

  createBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  createBtnTxt:  { color: '#fff', fontSize: 13, fontWeight: '700' },

  extAlert:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F3FF', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#DDD6FE' },
  extAlertTxt:   { flex: 1, fontSize: 13, color: '#7C3AED', fontWeight: '600' },

  statsGrid:     { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  statCardActive:{ borderColor: Colors.primary },
  statIconBox:   { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  statVal:       { fontSize: 18, fontWeight: '800', color: '#111827', lineHeight: 22 },
  statLbl:       { fontSize: 11, color: Colors.textLight, fontWeight: '500', marginTop: 1 },

  searchRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  searchWrap:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 8 },
  searchInput:   { flex: 1, fontSize: 13, color: Colors.text, outlineStyle: 'none' },

  filterBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  dateInputWrap:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  dateInputWrapActive: { borderColor: Colors.primary },
  dateInput:        { fontSize: 13, color: '#0F172A', width: 90, outlineStyle: 'none' },
  filterBtnActive: { borderColor: Colors.primary, backgroundColor: '#FFF0EF' },
  filterBtnTxt:  { fontSize: 13, color: Colors.textLight, fontWeight: '600' },
  filterDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },

  filterOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  filterPanel:   { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 360, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  filterPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filterPanelTitle:  { fontSize: 15, fontWeight: '700', color: Colors.text },
  filterClear:       { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  filterOption:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  filterOptionActive:{ backgroundColor: '#FFF8F8' },
  filterOptionTxt:   { fontSize: 14, color: Colors.textLight, fontWeight: '500', flex: 1 },
  filterOptionTxtActive: { color: Colors.primary, fontWeight: '700' },
  filterCount:       { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  filterCountActive: { backgroundColor: '#FECACA' },
  filterCountTxt:    { fontSize: 11, fontWeight: '700', color: Colors.textLight },

  tableBox:      { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', marginBottom: 14 },
  tableHeader:   { backgroundColor: '#F7F8FA', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tableRow:      { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  row:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, backgroundColor: '#fff' },
  th:            { fontSize: 11, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
  thCell:        { borderLeftWidth: 1, borderLeftColor: '#E5E7EB', paddingLeft: 10 },
  td:            { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tdCell:        { borderLeftWidth: 1, borderLeftColor: '#F3F4F6', paddingLeft: 10 },

  taskTitle:     { fontSize: 13, fontWeight: '600', color: Colors.text },
  taskDesc:      { fontSize: 11, color: Colors.textMuted },
  avatar:        { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  avatarTxt:     { fontSize: 12, fontWeight: '700', color: '#374151' },
  empName:       { fontSize: 12, fontWeight: '500', color: Colors.text, flexShrink: 1 },
  assignedDate:  { fontSize: 12, fontWeight: '600', color: Colors.text },
  assignedTime:  { fontSize: 10, color: Colors.textMuted },
  dueDate:       { fontSize: 12, fontWeight: '600', color: Colors.text },
  overdueTag:    { fontSize: 10, color: '#DC2626', fontWeight: '600' },
  actionIconBtn: { padding: 5, borderRadius: 7, backgroundColor: '#F3F4F6' },

  pagination:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4 },
  pageBtn:          { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  pageBtnDisabled:  { borderColor: '#F3F4F6', backgroundColor: '#FAFAFA' },
  pageBtnTxt:       { fontSize: 13, fontWeight: '600', color: Colors.text },
  pageNumbers:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageNum:          { minWidth: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  pageNumActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pageNumTxt:       { fontSize: 13, fontWeight: '600', color: Colors.text },
  pageNumTxtActive: { color: '#fff' },
  pageDots:         { fontSize: 13, color: Colors.textMuted, paddingHorizontal: 4 },
  emptyBox:      { paddingVertical: 50, alignItems: 'center', gap: 8 },
  emptyTxt:      { fontSize: 14, fontWeight: '600', color: Colors.textLight },
  emptyHint:     { fontSize: 12, color: Colors.textMuted },

  // Mobile stat card
  statCardMobile:{ paddingVertical: 10, paddingHorizontal: 10, minWidth: 70, flex: 0 },

  // Mobile filter button (icon only)
  filterBtnIcon: { paddingHorizontal: 10, paddingVertical: 9 },

  // Mobile task card
  mCard:         { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 12, gap: 7 },
  mRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  mTitle:        { fontSize: 13, fontWeight: '700', color: '#0F172A', flex: 1 },
  mEmp:          { fontSize: 12, color: '#374151', fontWeight: '500', flexShrink: 1, maxWidth: 120 },
  mMeta:         { fontSize: 11, color: '#64748B', fontWeight: '500' },
  fabWrap:   { position: 'fixed', bottom: 80, right: 20, zIndex: 999, pointerEvents: 'box-none' },
  fab:       { width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8 },
});
