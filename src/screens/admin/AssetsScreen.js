import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, useWindowDimensions, Modal, Pressable, Platform, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import Navbar from '@components/common/Navbar';
import { Colors } from '@constants/colors';
import { useAuthStore } from '@store/authStore';
import api from '@services/api';

const STATUS_OPTIONS = ['issued', 'returned', 'lost', 'damaged'];
const DEFAULT_TYPES = ['SIM Card', 'Laptop', 'Mobile Phone', 'Tablet', 'ID Card', 'Vehicle', 'Key', 'Uniform', 'Other'];

function AssetFormModal({ visible, onClose, onSaved, asset, staffList }) {
  const isEdit = !!asset;
  const [assetTypes, setAssetTypes] = useState([]);
  const [assetName, setAssetName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [status, setStatus] = useState('issued');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setAssetTypes(asset?.asset_type ? asset.asset_type.split(', ') : []);
      setAssetName(asset?.asset_name || '');
      setIdentifier(asset?.identifier || '');
      setAssignedTo(asset?.assigned_to ? String(asset.assigned_to) : '');
      setIssuedDate(asset?.issued_date ? dayjs(asset.issued_date).format('YYYY-MM-DD') : '');
      setReturnDate(asset?.return_date ? dayjs(asset.return_date).format('YYYY-MM-DD') : '');
      setStatus(asset?.status || 'issued');
      setRemarks(asset?.remarks || '');
      setError('');
    }
  }, [visible, asset]);

  const submit = async () => {
    if (assetTypes.length === 0 || !assetName.trim()) { setError('Asset type and name are required.'); return; }
    setSaving(true); setError('');
    try {
      const body = {
        asset_type: assetTypes.join(', '),
        asset_name: assetName.trim(),
        identifier: identifier.trim(),
        assigned_to: assignedTo || null,
        issued_date: issuedDate || null,
        return_date: returnDate || null,
        status,
        remarks: remarks.trim(),
      };
      if (isEdit) await api.put(`/assets/${asset.id}`, body);
      else await api.post('/assets', body);
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e?.error || e?.message || 'Failed to save asset.');
    } finally { setSaving(false); }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.formCard} onPress={e => e.stopPropagation?.()}>
          <View style={s.formHead}>
            <Text style={s.formTitle}>{isEdit ? 'Edit Asset' : 'Add Asset'}</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: '75vh' }} showsVerticalScrollIndicator>
            <Text style={s.label}>Asset Type * (select one or more)</Text>
            <View style={s.chipRow}>
              {DEFAULT_TYPES.map(t => {
                const sel = assetTypes.includes(t);
                return (
                  <TouchableOpacity key={t} style={[s.chip, sel && s.chipActive]} onPress={() => setAssetTypes(prev => sel ? prev.filter(x => x !== t) : [...prev, t])}>
                    <Text style={[s.chipTxt, sel && s.chipTxtActive]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.label}>Asset Name / Description *</Text>
            <TextInput style={s.input} value={assetName} onChangeText={setAssetName} placeholder="e.g. Dell Latitude 5520, Jio SIM" placeholderTextColor="#94A3B8" />

            <Text style={s.label}>Identifier (Serial No / IMEI / SIM No.)</Text>
            <TextInput style={s.input} value={identifier} onChangeText={setIdentifier} placeholder="Serial number, IMEI, SIM number, etc." placeholderTextColor="#94A3B8" />

            <Text style={s.label}>Assigned To</Text>
            {Platform.OS === 'web' ? (
              <select
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                style={{
                  backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9,
                  padding: '9px 12px', fontSize: 13, color: '#0F172A', outline: 'none', width: '100%',
                }}
              >
                <option value="">— Not assigned —</option>
                {staffList.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
              </select>
            ) : (
              <TextInput style={s.input} value={assignedTo} onChangeText={setAssignedTo} placeholder="Staff ID" placeholderTextColor="#94A3B8" keyboardType="number-pad" />
            )}

            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Issued Date</Text>
                {Platform.OS === 'web' ? (
                  <input type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)}
                    style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: '9px 12px', fontSize: 13, color: '#0F172A', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                ) : (
                  <TextInput style={s.input} value={issuedDate} onChangeText={setIssuedDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Return Date</Text>
                {Platform.OS === 'web' ? (
                  <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}
                    style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: '9px 12px', fontSize: 13, color: '#0F172A', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                ) : (
                  <TextInput style={s.input} value={returnDate} onChangeText={setReturnDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
                )}
              </View>
            </View>

            <Text style={s.label}>Status</Text>
            <View style={s.chipRow}>
              {STATUS_OPTIONS.map(st => (
                <TouchableOpacity key={st} style={[s.chip, status === st && s.chipActive]} onPress={() => setStatus(st)}>
                  <Text style={[s.chipTxt, status === st && s.chipTxtActive]}>{st.charAt(0).toUpperCase() + st.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Remarks</Text>
            <TextInput style={[s.input, s.textArea]} value={remarks} onChangeText={setRemarks} placeholder="Any additional notes" placeholderTextColor="#94A3B8" multiline numberOfLines={3} />

            {!!error && <Text style={s.errTxt}>{error}</Text>}

            <View style={s.actionsRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={onClose}><Text style={s.cancelBtnTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnTxt}>{isEdit ? 'Save Changes' : 'Add Asset'}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const STATUS_COLORS = {
  issued: { bg: '#DBEAFE', text: '#1D4ED8' },
  returned: { bg: '#D1FAE5', text: '#059669' },
  lost: { bg: '#FEE2E2', text: '#DC2626' },
  damaged: { bg: '#FEF3C7', text: '#D97706' },
};

export default function AssetsScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [assets, setAssets] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editAsset, setEditAsset] = useState(null);

  const load = useCallback(async () => {
    try {
      const [a, st] = await Promise.all([
        api.get('/assets'),
        isAdmin ? api.get('/staff') : Promise.resolve([]),
      ]);
      setAssets(Array.isArray(a) ? a : []);
      setStaffList(Array.isArray(st) ? st : []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (Platform.OS === 'web' && !window.confirm('Delete this asset?')) return;
    try { await api.delete(`/assets/${id}`); load(); } catch {}
  };

  const q = search.trim().toLowerCase();
  const filtered = assets.filter(a => {
    if (filterType && a.asset_type !== filterType) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    if (q && !(a.asset_name || '').toLowerCase().includes(q)
        && !(a.asset_type || '').toLowerCase().includes(q)
        && !(a.identifier || '').toLowerCase().includes(q)
        && !(a.assigned_to_name || '').toLowerCase().includes(q)) return false;
    return true;
  });

  const types = [...new Set(assets.map(a => a.asset_type).filter(Boolean))];

  return (
    <View style={s.screen}>
      <Navbar navigation={navigation} activeTab="Assets" />
      <ScrollView
        style={s.container}
        contentContainerStyle={[s.content, isMobile && { paddingHorizontal: 10 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Colors.primary]} />}
      >
        {/* Title row */}
        <View style={s.titleRow}>
          <Text style={s.pageTitle}>Assets</Text>
          <Text style={s.badge}>{filtered.length}</Text>
          <View style={{ flex: 1 }} />
          {isAdmin && (
            <TouchableOpacity style={s.addBtn} onPress={() => { setEditAsset(null); setFormOpen(true); }}>
              <Ionicons name="add" size={18} color="#fff" />
              {!isMobile && <Text style={s.addBtnTxt}>Add Asset</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* Toolbar */}
        <View style={s.toolbar}>
          <View style={s.searchBox}>
            <Ionicons name="search" size={16} color="#94A3B8" />
            <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search assets…" placeholderTextColor="#94A3B8" />
            {!!search && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color="#CBD5E1" /></TouchableOpacity>}
          </View>
          {Platform.OS === 'web' && (
            <View style={s.filterRow}>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#0F172A', background: '#F8FAFC', outline: 'none' }}>
                <option value="">All Types</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#0F172A', background: '#F8FAFC', outline: 'none' }}>
                <option value="">All Status</option>
                {STATUS_OPTIONS.map(st => <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>)}
              </select>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="hardware-chip-outline" size={44} color="#CBD5E1" />
            <Text style={s.emptyTitle}>No assets found</Text>
            <Text style={s.emptySub}>{isAdmin ? 'Tap "Add Asset" to assign an asset to a staff member.' : 'No assets assigned to you yet.'}</Text>
          </View>
        ) : isMobile ? (
          /* Mobile: cards */
          filtered.map(a => {
            const sc = STATUS_COLORS[a.status] || STATUS_COLORS.issued;
            return (
              <View key={a.id} style={s.mCard}>
                <View style={s.mCardTop}>
                  <View style={s.mCardIcon}>
                    <Ionicons name={a.asset_type === 'Laptop' ? 'laptop-outline' : a.asset_type === 'SIM Card' ? 'call-outline' : a.asset_type === 'Mobile Phone' ? 'phone-portrait-outline' : 'hardware-chip-outline'} size={20} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.mCardName}>{a.asset_name}</Text>
                    <Text style={s.mCardType}>{a.asset_type}{a.identifier ? ` · ${a.identifier}` : ''}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[s.statusTxt, { color: sc.text }]}>{a.status}</Text>
                  </View>
                </View>
                <View style={s.mCardMeta}>
                  <Text style={s.mCardMetaTxt}><Text style={s.mCardMetaLabel}>Assigned to: </Text>{a.assigned_to_name || '—'}</Text>
                  {a.issued_date && <Text style={s.mCardMetaTxt}><Text style={s.mCardMetaLabel}>Issued: </Text>{dayjs(a.issued_date).format('DD MMM YYYY')}</Text>}
                  {a.return_date && <Text style={s.mCardMetaTxt}><Text style={s.mCardMetaLabel}>Return: </Text>{dayjs(a.return_date).format('DD MMM YYYY')}</Text>}
                  {a.remarks ? <Text style={s.mCardMetaTxt}><Text style={s.mCardMetaLabel}>Remarks: </Text>{a.remarks}</Text> : null}
                </View>
                {isAdmin && (
                  <View style={s.mCardActions}>
                    <TouchableOpacity style={s.mActionBtn} onPress={() => { setEditAsset(a); setFormOpen(true); }}>
                      <Ionicons name="pencil" size={14} color="#475569" /><Text style={s.mActionTxt}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.mActionBtn, s.mDeleteBtn]} onPress={() => handleDelete(a.id)}>
                      <Ionicons name="trash-outline" size={14} color="#DC2626" /><Text style={[s.mActionTxt, { color: '#DC2626' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          /* Desktop: table */
          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={[s.th, { flex: 0.5 }]}>#</Text>
              <Text style={[s.th, { flex: 1.2 }]}>Type</Text>
              <Text style={[s.th, { flex: 1.8 }]}>Name</Text>
              <Text style={[s.th, { flex: 1.3 }]}>Identifier</Text>
              <Text style={[s.th, { flex: 1.3 }]}>Assigned To</Text>
              <Text style={[s.th, { flex: 1 }]}>Issued</Text>
              <Text style={[s.th, { flex: 1 }]}>Return</Text>
              <Text style={[s.th, { flex: 0.8 }]}>Status</Text>
              <Text style={[s.th, { flex: 1.5 }]}>Remarks</Text>
              {isAdmin && <Text style={[s.th, { flex: 0.8 }]}>Action</Text>}
            </View>
            {filtered.map((a, i) => {
              const sc = STATUS_COLORS[a.status] || STATUS_COLORS.issued;
              return (
                <View key={a.id} style={[s.tRow, i % 2 === 0 && s.tRowAlt]}>
                  <Text style={[s.td, { flex: 0.5 }]}>{i + 1}</Text>
                  <Text style={[s.td, { flex: 1.2 }]}>{a.asset_type}</Text>
                  <Text style={[s.td, { flex: 1.8, fontWeight: '600' }]}>{a.asset_name}</Text>
                  <Text style={[s.td, { flex: 1.3 }]}>{a.identifier || '—'}</Text>
                  <Text style={[s.td, { flex: 1.3 }]}>{a.assigned_to_name || '—'}</Text>
                  <Text style={[s.td, { flex: 1 }]}>{a.issued_date ? dayjs(a.issued_date).format('DD MMM YY') : '—'}</Text>
                  <Text style={[s.td, { flex: 1 }]}>{a.return_date ? dayjs(a.return_date).format('DD MMM YY') : '—'}</Text>
                  <View style={[s.td, { flex: 0.8 }]}>
                    <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[s.statusTxt, { color: sc.text }]}>{a.status}</Text>
                    </View>
                  </View>
                  <Text style={[s.td, { flex: 1.5 }]} numberOfLines={2}>{a.remarks || '—'}</Text>
                  {isAdmin && (
                    <View style={[s.td, { flex: 0.8, flexDirection: 'row', gap: 6 }]}>
                      <TouchableOpacity style={s.tActionBtn} onPress={() => { setEditAsset(a); setFormOpen(true); }}>
                        <Ionicons name="pencil" size={14} color="#475569" />
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.tActionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => handleDelete(a.id)}>
                        <Ionicons name="trash-outline" size={14} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <AssetFormModal visible={formOpen} onClose={() => setFormOpen(false)} onSaved={load} asset={editAsset} staffList={staffList} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },
  container: { flex: 1, width: '100%' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, width: '100%' },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  pageTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  badge: { backgroundColor: Colors.primary + '18', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontSize: 12, fontWeight: '700', color: Colors.primary, overflow: 'hidden' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  addBtnTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  toolbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  searchBox: { flex: 1, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A', outlineStyle: 'none' },
  filterRow: { flexDirection: 'row', gap: 8 },

  emptyBox: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  emptySub: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },

  // Table (desktop)
  table: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  tHead: { flexDirection: 'row', backgroundColor: '#F8FAFC', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  th: { fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.3 },
  tRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tRowAlt: { backgroundColor: '#FAFBFC' },
  td: { fontSize: 13, color: '#334155' },
  tActionBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  statusTxt: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  // Mobile cards
  mCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, marginBottom: 10 },
  mCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mCardIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center' },
  mCardName: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  mCardType: { fontSize: 11, color: '#64748B', marginTop: 1 },
  mCardMeta: { marginTop: 10, gap: 3 },
  mCardMetaTxt: { fontSize: 12, color: '#475569' },
  mCardMetaLabel: { fontWeight: '700', color: '#64748B' },
  mCardActions: { flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  mActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F1F5F9' },
  mDeleteBtn: { backgroundColor: '#FEE2E2' },
  mActionTxt: { fontSize: 12, fontWeight: '600', color: '#475569' },

  // Form modal
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16, zIndex: 9998 },
  formCard: { backgroundColor: '#fff', borderRadius: 18, width: '100%', maxWidth: 520, paddingHorizontal: 18, paddingBottom: 18, paddingTop: 14 },
  formHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  formTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },

  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 5, marginTop: 8 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#0F172A', outlineStyle: 'none' },
  textArea: { minHeight: 60, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 10 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F8FAFC' },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },
  chipTxt: { fontSize: 12, color: '#475569', fontWeight: '600' },
  chipTxtActive: { color: Colors.primary, fontWeight: '700' },

  errTxt: { fontSize: 12, color: '#DC2626', marginTop: 10, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 11, borderRadius: 9, alignItems: 'center' },
  cancelBtnTxt: { fontSize: 13, fontWeight: '700', color: '#475569' },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, paddingVertical: 11, borderRadius: 9, alignItems: 'center' },
  saveBtnTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
