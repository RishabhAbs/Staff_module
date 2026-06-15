import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import api from '@services/api';

const LEDGER_TYPES = ['Asset', 'Liability', 'Income', 'Expense', 'Equity'];

export default function LedgerMasterScreen({ navigation }) {
  const [ledgers, setLedgers]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing]         = useState(null);
  const [name, setName]               = useState('');
  const [type, setType]               = useState('');
  const [description, setDescription] = useState('');
  const [error, setError]             = useState('');

  const fetchLedgers = async () => {
    setLoading(true);
    try {
      const data = await api.get('/ledgers');
      setLedgers(data || []);
    } catch (err) {
      console.error('Failed to load ledgers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLedgers(); }, []);

  const openAdd = () => {
    setEditing(null); setName(''); setType(''); setDescription(''); setError('');
    setModalVisible(true);
  };

  const openEdit = (l) => {
    setEditing(l); setName(l.name); setType(l.type || ''); setDescription(l.description || ''); setError('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Ledger name is required.'); return; }
    setLoading(true);
    try {
      const payload = { name: name.trim(), type, description: description.trim() };
      if (editing) {
        await api.put(`/ledgers/${editing.id}`, payload);
      } else {
        await api.post('/ledgers', payload);
      }
      setModalVisible(false);
      fetchLedgers();
    } catch (err) {
      setError(err?.error || 'Failed to save. Name may already exist.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (Platform.OS === 'web') {
      if (!confirm('Delete this ledger?')) return;
    }
    try {
      await api.delete(`/ledgers/${id}`);
      fetchLedgers();
    } catch {
      alert('Failed to delete ledger.');
    }
  };

  return (
    <View style={s.container}>
      <Navbar navigation={navigation} activeTab="Ledger Master" />

      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Ledger Master</Text>
            <Text style={s.subtitle}>Create and manage ledger accounts for financial tracking.</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={openAdd}>
            <Ionicons name="add-circle" size={18} color="#fff" />
            <Text style={s.addBtnText}>Add Ledger</Text>
          </TouchableOpacity>
        </View>

        {loading && ledgers.length === 0 ? (
          <ActivityIndicator size="large" color={Colors.brandRed} style={{ marginTop: 40 }} />
        ) : (
          <View style={s.card}>
            <View style={s.tableHeader}>
              <Text style={[s.th, { flex: 0.5 }]}>#</Text>
              <Text style={[s.th, { flex: 2.5 }]}>Ledger Name</Text>
              <Text style={[s.th, { flex: 1.5 }]}>Type</Text>
              <Text style={[s.th, { flex: 2.5 }]}>Description</Text>
              <Text style={[s.th, { flex: 1.5, textAlign: 'right' }]}>Actions</Text>
            </View>

            {ledgers.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="book-outline" size={32} color="#94A3B8" />
                <Text style={s.emptyText}>No ledgers created yet.</Text>
              </View>
            ) : (
              ledgers.map((l, idx) => (
                <View key={l.id} style={[s.tableRow, idx % 2 === 1 && { backgroundColor: '#F8FAFC' }]}>
                  <Text style={[s.td, { flex: 0.5, color: '#94A3B8' }]}>{idx + 1}</Text>
                  <Text style={[s.tdName, { flex: 2.5 }]}>{l.name}</Text>
                  <View style={{ flex: 1.5 }}>
                    {l.type ? (
                      <View style={[s.typeBadge, typeColor(l.type)]}>
                        <Text style={[s.typeBadgeTxt, typeTextColor(l.type)]}>{l.type}</Text>
                      </View>
                    ) : <Text style={s.td}>—</Text>}
                  </View>
                  <Text style={[s.td, { flex: 2.5 }]} numberOfLines={1}>{l.description || '—'}</Text>
                  <View style={[s.td, { flex: 1.5, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }]}>
                    <TouchableOpacity style={s.actionEdit} onPress={() => openEdit(l)}>
                      <Ionicons name="pencil" size={14} color="#1E3A8A" />
                      <Text style={s.actionTextEdit}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionDelete} onPress={() => handleDelete(l.id)}>
                      <Ionicons name="trash-outline" size={14} color="#DC2626" />
                      <Text style={s.actionTextDelete}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editing ? 'Edit Ledger' : 'Add Ledger'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {error ? <View style={s.errBox}><Text style={s.errTxt}>{error}</Text></View> : null}

            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>Ledger Name *</Text>
              <TextInput style={s.textInput} placeholder="e.g. Cash, Bank, Sales" value={name} onChangeText={setName} />
            </View>

            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>Type</Text>
              <View style={s.typeRow}>
                {LEDGER_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.typeChip, type === t && s.typeChipActive]}
                    onPress={() => setType(type === t ? '' : t)}
                  >
                    <Text style={[s.typeChipTxt, type === t && s.typeChipTxtActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>Description</Text>
              <TextInput
                style={[s.textInput, { height: 72, textAlignVertical: 'top', paddingTop: 8 }]}
                placeholder="Optional short description"
                value={description}
                onChangeText={setDescription}
                multiline
              />
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

const typeColor = (t) => {
  const map = { Asset: { backgroundColor: '#EFF6FF' }, Liability: { backgroundColor: '#FEF2F2' }, Income: { backgroundColor: '#F0FDF4' }, Expense: { backgroundColor: '#FFF7ED' }, Equity: { backgroundColor: '#F5F3FF' } };
  return map[t] || { backgroundColor: '#F1F5F9' };
};
const typeTextColor = (t) => {
  const map = { Asset: { color: '#1D4ED8' }, Liability: { color: '#DC2626' }, Income: { color: '#16A34A' }, Expense: { color: '#EA580C' }, Equity: { color: '#7C3AED' } };
  return map[t] || { color: '#475569' };
};

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
  typeBadge:        { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  typeBadgeTxt:     { fontSize: 11, fontWeight: '700' },
  empty:            { padding: 40, alignItems: 'center', gap: 10 },
  emptyText:        { fontSize: 13, color: '#64748B', fontWeight: '500' },
  actionEdit:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#EFF6FF' },
  actionTextEdit:   { fontSize: 11, fontWeight: '700', color: '#1E3A8A' },
  actionDelete:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#FEF2F2' },
  actionTextDelete: { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  overlay:          { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:        { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 20 },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 12, marginBottom: 14 },
  modalTitle:       { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  errBox:           { backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#EF4444', marginBottom: 12 },
  errTxt:           { fontSize: 12, color: '#B91C1C', fontWeight: '600' },
  fieldWrap:        { marginBottom: 12 },
  fieldLabel:       { fontSize: 11, fontWeight: '700', color: '#334155', textTransform: 'uppercase', marginBottom: 4 },
  textInput:        { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A', backgroundColor: '#FFF' },
  typeRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  typeChipActive:   { backgroundColor: Colors.brandRed, borderColor: Colors.brandRed },
  typeChipTxt:      { fontSize: 12, fontWeight: '600', color: '#475569' },
  typeChipTxtActive:{ color: '#fff' },
  modalFooter:      { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 14, marginTop: 14 },
  cancelBtn:        { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  cancelBtnTxt:     { fontSize: 12, fontWeight: '600', color: '#64748B' },
  saveBtn:          { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: Colors.brandRed },
  saveBtnTxt:       { fontSize: 12, fontWeight: '700', color: '#fff' },
});
