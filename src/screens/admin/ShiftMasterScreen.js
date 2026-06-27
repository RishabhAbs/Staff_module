import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, ActivityIndicator, Alert, Platform,
  Animated, PanResponder, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import api from '@services/api';
import dayjs from 'dayjs';

const SWIPE_THRESHOLD = 60;
const ACTION_WIDTH    = 130; // total width of revealed actions

function SwipeableRow({ children, onEdit, onDelete }) {
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
      Animated.spring(translateX, {
        toValue: shouldOpen ? -ACTION_WIDTH : 0,
        useNativeDriver: true,
      }).start();
      isOpen.current = shouldOpen;
    },
  })).current;

  const close = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    isOpen.current = false;
  };

  return (
    <View style={{ overflow: 'hidden' }}>
      {/* Action buttons revealed on swipe */}
      <View style={sw.actions}>
        <TouchableOpacity style={sw.editAction} onPress={() => { close(); onEdit(); }}>
          <Ionicons name="pencil" size={16} color="#fff" />
          <Text style={sw.actionTxt}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={sw.deleteAction} onPress={() => { close(); onDelete(); }}>
          <Ionicons name="trash-outline" size={16} color="#fff" />
          <Text style={sw.actionTxt}>Delete</Text>
        </TouchableOpacity>
      </View>
      {/* Swipeable content */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const sw = StyleSheet.create({
  actions:      { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row', width: ACTION_WIDTH },
  editAction:   { flex: 1, backgroundColor: '#1D4ED8', justifyContent: 'center', alignItems: 'center', gap: 4 },
  deleteAction: { flex: 1, backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center', gap: 4 },
  actionTxt:    { fontSize: 11, color: '#fff', fontWeight: '700' },
});

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const AMPM = ['AM', 'PM'];

// Dynamically calculates shift duration hours from start/end AM/PM strings
function calculateDuration(startStr, endStr) {
  try {
    const parseTime = (timeStr) => {
      const [time, modifier] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (modifier === 'PM' && hours !== 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes; // returns total minutes
    };

    const startMin = parseTime(startStr);
    let endMin = parseTime(endStr);
    
    if (endMin <= startMin) {
      endMin += 24 * 60; // handles overnight shifts cross-over
    }
    
    const diffMin = endMin - startMin;
    const hrs = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs} Hours`;
  } catch (e) {
    return 'N/A';
  }
}

export default function ShiftMasterScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingShift, setEditingShift] = useState(null);

  // Form Fields
  const [name, setName] = useState('');
  const [startHr, setStartHr] = useState('09');
  const [startMin, setStartMin] = useState('00');
  const [startAmPm, setStartAmPm] = useState('AM');

  const [endHr, setEndHr] = useState('05');
  const [endMin, setEndMin] = useState('00');
  const [endAmPm, setEndAmPm] = useState('PM');

  const [error, setError] = useState('');

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const data = await api.get('/shifts');
      setShifts(data || []);
    } catch (err) {
      console.error('Failed to load shifts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const openAddModal = () => {
    setEditingShift(null);
    setName('');
    setStartHr('09');
    setStartMin('00');
    setStartAmPm('AM');
    setEndHr('05');
    setEndMin('00');
    setEndAmPm('PM');
    setError('');
    setModalVisible(true);
  };

  const openEditModal = (shift) => {
    setEditingShift(shift);
    setName(shift.name);
    
    // Parse Start Time (e.g., "09:00 AM")
    try {
      const [startTime, startMod] = shift.start_time.split(' ');
      const [sH, sM] = startTime.split(':');
      setStartHr(sH);
      setStartMin(sM);
      setStartAmPm(startMod);

      const [endTime, endMod] = shift.end_time.split(' ');
      const [eH, eM] = endTime.split(':');
      setEndHr(eH);
      setEndMin(eM);
      setEndAmPm(endMod);
    } catch (e) {
      console.warn('Failed to parse shift timings for edit modal', e);
    }
    
    setError('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Shift name is required.');
      return;
    }
    
    const formattedStart = `${startHr}:${startMin} ${startAmPm}`;
    const formattedEnd = `${endHr}:${endMin} ${endAmPm}`;

    setLoading(true);
    try {
      const payload = { name: name.trim(), start_time: formattedStart, end_time: formattedEnd };
      if (editingShift) {
        await api.put(`/shifts/${editingShift.id}`, payload);
      } else {
        await api.post('/shifts', payload);
      }
      setModalVisible(false);
      fetchShifts();
    } catch (err) {
      setError(err?.error || 'Failed to save shift. Make sure the name is unique.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (Platform.OS === 'web') {
      if (!confirm('Are you sure you want to delete this shift?')) return;
    }
    try {
      await api.delete(`/shifts/${id}`);
      fetchShifts();
    } catch (err) {
      Alert.alert('Error', 'Failed to delete shift.');
    }
  };

  return (
    <View style={s.container}>
      <Navbar navigation={navigation} activeTab="Shift Master" />
      
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        
        {/* Header Summary */}
        <View style={s.header}>
          {!isMobile && (
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Shift Master Settings</Text>
            </View>
          )}
          <TouchableOpacity style={s.addBtn} onPress={openAddModal}>
            <Ionicons name="add-circle" size={18} color="#fff" />
            <Text style={s.addBtnText}>{isMobile ? 'Add' : 'Add Work Shift'}</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic List Grid */}
        {loading && shifts.length === 0 ? (
          <ActivityIndicator size="large" color={Colors.brandRed} style={{ marginTop: 40 }} />
        ) : (
          <View style={s.card}>
            {!isMobile && (
              <View style={s.tableHeader}>
                <Text style={[s.th, { flex: 2 }]}>Shift Name</Text>
                <Text style={[s.th, { flex: 1.5 }]}>Start Time</Text>
                <Text style={[s.th, { flex: 1.5 }]}>End Time</Text>
                <Text style={[s.th, { flex: 1.5 }]}>Duration</Text>
                <Text style={[s.th, { flex: 1.5, textAlign: 'right' }]}>Actions</Text>
              </View>
            )}

            {shifts.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="time-outline" size={32} color="#94A3B8" />
                <Text style={s.emptyText}>No custom shifts configured yet.</Text>
              </View>
            ) : !isMobile ? (
              shifts.map((shift, idx) => (
                <View key={shift.id} style={[s.tableRow, idx % 2 === 1 && { backgroundColor: '#F8FAFC' }]}>
                  <Text style={[s.tdName, { flex: 2 }]}>{shift.name}</Text>
                  <Text style={[s.td, { flex: 1.5 }]}>{shift.start_time}</Text>
                  <Text style={[s.td, { flex: 1.5 }]}>{shift.end_time}</Text>
                  <View style={[s.td, { flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                    <Ionicons name="hourglass-outline" size={13} color="#64748B" />
                    <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>
                      {calculateDuration(shift.start_time, shift.end_time)}
                    </Text>
                  </View>
                  <View style={[s.td, { flex: 1.5, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }]}>
                    <TouchableOpacity style={s.actionEdit} onPress={() => openEditModal(shift)}>
                      <Ionicons name="pencil" size={14} color="#1E3A8A" />
                      <Text style={s.actionTextEdit}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionDelete} onPress={() => handleDelete(shift.id)}>
                      <Ionicons name="trash-outline" size={14} color="#DC2626" />
                      <Text style={s.actionTextDelete}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              shifts.map((shift, idx) => (
                <SwipeableRow
                  key={shift.id}
                  onEdit={() => openEditModal(shift)}
                  onDelete={() => handleDelete(shift.id)}
                >
                  <View style={[s.mobileRow, idx % 2 === 1 && { backgroundColor: '#F8FAFC' }]}>
                    <View style={s.mobileRowLeft}>
                      <Text style={s.mobileShiftName}>{shift.name}</Text>
                      <Text style={s.mobileTimeTxt}>{shift.start_time}  →  {shift.end_time}</Text>
                    </View>
                    <View style={s.mobileRowRight}>
                      <Ionicons name="hourglass-outline" size={13} color="#64748B" />
                      <Text style={s.mobileDuration}>{calculateDuration(shift.start_time, shift.end_time)}</Text>
                      <Ionicons name="chevron-back-outline" size={14} color="#94A3B8" style={{ marginLeft: 6 }} />
                    </View>
                  </View>
                </SwipeableRow>
              ))
            )}
          </View>
        )}

      </ScrollView>

      {/* Modal Dialog Editor */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editingShift ? 'Edit Shift Master' : 'Create New Shift'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={s.errBox}>
                <Text style={s.errTxt}>{error}</Text>
              </View>
            ) : null}

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              
              {/* Shift Name */}
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>Shift Name *</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="e.g. Day Shift, Evening Shift, Night Shift"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Start Time Selectors */}
              <Text style={s.sectionLabel}>Start Time Configuration</Text>
              <View style={s.pickerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.subLabel}>Hour</Text>
                  <select value={startHr} onChange={e => setStartHr(e.target.value)} style={s.webSelect}>
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.subLabel}>Minute</Text>
                  <select value={startMin} onChange={e => setStartMin(e.target.value)} style={s.webSelect}>
                    {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.subLabel}>AM/PM</Text>
                  <select value={startAmPm} onChange={e => setStartAmPm(e.target.value)} style={s.webSelect}>
                    {AMPM.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </View>
              </View>

              {/* End Time Selectors */}
              <Text style={s.sectionLabel}>End Time Configuration</Text>
              <View style={s.pickerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.subLabel}>Hour</Text>
                  <select value={endHr} onChange={e => setEndHr(e.target.value)} style={s.webSelect}>
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.subLabel}>Minute</Text>
                  <select value={endMin} onChange={e => setEndMin(e.target.value)} style={s.webSelect}>
                    {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.subLabel}>AM/PM</Text>
                  <select value={endAmPm} onChange={e => setEndAmPm(e.target.value)} style={s.webSelect}>
                    {AMPM.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </View>
              </View>

            </ScrollView>

            {/* Modal Footer */}
            <View style={s.modalFooter}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={s.cancelBtnTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
                <Text style={s.saveBtnTxt}>Save Shift</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F8FAFC' },
  content:        { padding: 16, paddingBottom: 100 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 },
  title:          { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  subtitle:       { fontSize: 12, color: '#64748B', marginTop: 3, maxWidth: 640 },
  addBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.brandRed, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  addBtnText:     { fontSize: 13, fontWeight: '700', color: '#fff' },
  card:           { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  tableHeader:    { flexDirection: 'row', backgroundColor: '#F1F5F9', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 12, paddingHorizontal: 16 },
  th:             { fontSize: 11, fontWeight: '800', color: '#475569', textTransform: 'uppercase' },
  tableRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tdName:         { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  td:             { fontSize: 13, color: '#475569' },
  empty:          { padding: 40, alignItems: 'center', gap: 10 },
  emptyText:      { fontSize: 13, color: '#64748B', fontWeight: '500' },
  actionEdit:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#EFF6FF' },
  actionTextEdit: { fontSize: 11, fontWeight: '700', color: '#1E3A8A' },
  actionDelete:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#FEF2F2' },
  actionTextDelete: { fontSize: 11, fontWeight: '700', color: '#DC2626' },

  swipeHint:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  swipeHintTxt:    { fontSize: 11, color: '#94A3B8' },

  // Mobile swipeable row
  mobileRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#fff' },
  mobileRowLeft:   { flex: 1 },
  mobileShiftName: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  mobileTimeTxt:   { fontSize: 12, color: '#64748B', marginTop: 3 },
  mobileRowRight:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mobileDuration:  { fontSize: 12, fontWeight: '700', color: '#475569' },

  // Modal styling
  overlay:        { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:      { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: 20 },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 12, marginBottom: 14 },
  modalTitle:     { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  errBox:         { backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#EF4444', marginBottom: 12 },
  errTxt:         { fontSize: 12, color: '#B91C1C', fontWeight: '600' },
  fieldWrap:      { marginBottom: 12 },
  fieldLabel:     { fontSize: 11, fontWeight: '700', color: '#334155', textTransform: 'uppercase', marginBottom: 4 },
  textInput:      { height: 36, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, paddingHorizontal: 10, fontSize: 13, color: '#0F172A', backgroundColor: '#FFF' },
  sectionLabel:   { fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  pickerRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  subLabel:       { fontSize: 10, fontWeight: '600', color: '#94A3B8', marginBottom: 3 },
  webSelect:      { height: 36, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, paddingHorizontal: 8, fontSize: 13, backgroundColor: '#FFF', width: '100%', outline: 'none' },
  modalFooter:    { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 14, marginTop: 14 },
  cancelBtn:      { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  cancelBtnTxt:   { fontSize: 12, fontWeight: '600', color: '#64748B' },
  saveBtn:        { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: Colors.brandRed },
  saveBtnTxt:     { fontSize: 12, fontWeight: '700', color: '#fff' },
});
