import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, ActivityIndicator, Platform,
  Animated, PanResponder, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import api from '@services/api';

const ACTION_WIDTH    = 130;
const SWIPE_THRESHOLD = 60;

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
        <TouchableOpacity style={sw.editAction} onPress={() => { close(); onEdit(); }}>
          <Ionicons name="pencil" size={16} color="#fff" />
          <Text style={sw.actionTxt}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={sw.deleteAction} onPress={() => { close(); onDelete(); }}>
          <Ionicons name="trash-outline" size={16} color="#fff" />
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
  actions:      { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row', width: ACTION_WIDTH },
  editAction:   { flex: 1, backgroundColor: '#1D4ED8', justifyContent: 'center', alignItems: 'center', gap: 4 },
  deleteAction: { flex: 1, backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center', gap: 4 },
  actionTxt:    { fontSize: 11, color: '#fff', fontWeight: '700' },
});

export default function DepartmentMasterScreen({ navigation }) {
  const { width }  = useWindowDimensions();
  const isMobile   = width < 768;

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing]         = useState(null);
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [error, setError]             = useState('');

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const data = await api.get('/departments');
      setDepartments(data || []);
    } catch (err) {
      console.error('Failed to load departments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDepartments(); }, []);

  const openAdd = () => {
    setEditing(null); setName(''); setDescription(''); setError('');
    setModalVisible(true);
  };

  const openEdit = (dept) => {
    setEditing(dept); setName(dept.name); setDescription(dept.description || ''); setError('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Department name is required.'); return; }
    setLoading(true);
    try {
      const payload = { name: name.trim(), description: description.trim() };
      if (editing) await api.put(`/departments/${editing.id}`, payload);
      else         await api.post('/departments', payload);
      setModalVisible(false);
      fetchDepartments();
    } catch (err) {
      setError(err?.error || 'Failed to save. Name may already exist.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this department?')) return;
    try {
      await api.delete(`/departments/${id}`);
      fetchDepartments();
    } catch {
      alert('Failed to delete department.');
    }
  };

  return (
    <View style={s.container}>
      <Navbar navigation={navigation} activeTab="Departments" />

      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          {!isMobile && (
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Department Master</Text>
              <Text style={s.subtitle}>Create and manage departments. These will be available when adding or editing employees.</Text>
            </View>
          )}
          <TouchableOpacity style={s.addBtn} onPress={openAdd}>
            <Ionicons name="add-circle" size={18} color="#fff" />
            <Text style={s.addBtnText}>{isMobile ? 'Add' : 'Add Department'}</Text>
          </TouchableOpacity>
        </View>

        {loading && departments.length === 0 ? (
          <ActivityIndicator size="large" color={Colors.brandRed} style={{ marginTop: 40 }} />
        ) : (
          <View style={s.card}>
            {/* Web table header */}
            {!isMobile && (
              <View style={s.tableHeader}>
                <Text style={[s.th, { flex: 0.5 }]}>#</Text>
                <Text style={[s.th, { flex: 2 }]}>Department Name</Text>
                <Text style={[s.th, { flex: 3 }]}>Description</Text>
                <Text style={[s.th, { flex: 1.5, textAlign: 'right' }]}>Actions</Text>
              </View>
            )}

            {departments.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="business-outline" size={32} color="#94A3B8" />
                <Text style={s.emptyText}>No departments created yet.</Text>
              </View>
            ) : !isMobile ? (
              /* Web rows */
              departments.map((dept, idx) => (
                <View key={dept.id} style={[s.tableRow, idx % 2 === 1 && { backgroundColor: '#F8FAFC' }]}>
                  <Text style={[s.td, { flex: 0.5, color: '#94A3B8' }]}>{idx + 1}</Text>
                  <Text style={[s.tdName, { flex: 2 }]}>{dept.name}</Text>
                  <Text style={[s.td, { flex: 3 }]} numberOfLines={1}>{dept.description || '—'}</Text>
                  <View style={[s.td, { flex: 1.5, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }]}>
                    <TouchableOpacity style={s.actionEdit} onPress={() => openEdit(dept)}>
                      <Ionicons name="pencil" size={14} color="#1E3A8A" />
                      <Text style={s.actionTextEdit}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionDelete} onPress={() => handleDelete(dept.id)}>
                      <Ionicons name="trash-outline" size={14} color="#DC2626" />
                      <Text style={s.actionTextDelete}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              /* Mobile swipeable rows */
              departments.map((dept, idx) => (
                <SwipeableRow key={dept.id} onEdit={() => openEdit(dept)} onDelete={() => handleDelete(dept.id)}>
                  <View style={[s.mobileRow, idx % 2 === 1 && { backgroundColor: '#F8FAFC' }]}>
                    <View style={s.mobileLeft}>
                      <Text style={s.mobileName}>{dept.name}</Text>
                      {!!dept.description && <Text style={s.mobileDesc} numberOfLines={1}>{dept.description}</Text>}
                    </View>
                    <Ionicons name="chevron-back-outline" size={16} color="#CBD5E1" />
                  </View>
                </SwipeableRow>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editing ? 'Edit Department' : 'Add Department'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {!!error && <View style={s.errBox}><Text style={s.errTxt}>{error}</Text></View>}

            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>Department Name *</Text>
              <TextInput style={s.textInput} placeholder="e.g. Engineering, HR, Sales"
                value={name} onChangeText={setName} />
            </View>

            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>Description</Text>
              <TextInput style={[s.textInput, { height: 72, textAlignVertical: 'top', paddingTop: 8 }]}
                placeholder="Optional short description" value={description}
                onChangeText={setDescription} multiline />
            </View>

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={s.cancelBtnTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={loading}>
                <Text style={s.saveBtnTxt}>{loading ? 'Saving...' : editing ? 'Update' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F8FAFC' },
  content:          { padding: 16, paddingBottom: 100 },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 },
  title:            { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  subtitle:         { fontSize: 12, color: '#64748B', marginTop: 3, maxWidth: 640 },
  addBtn:           { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.brandRed, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  addBtnText:       { fontSize: 13, fontWeight: '700', color: '#fff' },
  card:             { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  tableHeader:      { flexDirection: 'row', backgroundColor: '#F1F5F9', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 12, paddingHorizontal: 16 },
  th:               { fontSize: 11, fontWeight: '800', color: '#475569', textTransform: 'uppercase' },
  tableRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tdName:           { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  td:               { fontSize: 13, color: '#475569' },
  empty:            { padding: 40, alignItems: 'center', gap: 10 },
  emptyText:        { fontSize: 13, color: '#64748B', fontWeight: '500' },
  actionEdit:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#EFF6FF' },
  actionTextEdit:   { fontSize: 11, fontWeight: '700', color: '#1E3A8A' },
  actionDelete:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#FEF2F2' },
  actionTextDelete: { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  // Mobile
  mobileRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#fff' },
  mobileLeft:       { flex: 1 },
  mobileName:       { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  mobileDesc:       { fontSize: 12, color: '#64748B', marginTop: 2 },
  // Modal
  overlay:          { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:        { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: 20 },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 12, marginBottom: 14 },
  modalTitle:       { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  errBox:           { backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#EF4444', marginBottom: 12 },
  errTxt:           { fontSize: 12, color: '#B91C1C', fontWeight: '600' },
  fieldWrap:        { marginBottom: 12 },
  fieldLabel:       { fontSize: 11, fontWeight: '700', color: '#334155', textTransform: 'uppercase', marginBottom: 4 },
  textInput:        { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A', backgroundColor: '#FFF' },
  modalFooter:      { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 14, marginTop: 14 },
  cancelBtn:        { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  cancelBtnTxt:     { fontSize: 12, fontWeight: '600', color: '#64748B' },
  saveBtn:          { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: Colors.brandRed },
  saveBtnTxt:       { fontSize: 12, fontWeight: '700', color: '#fff' },
});
