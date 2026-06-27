import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Pressable, ActivityIndicator, Image,
  useWindowDimensions, RefreshControl, Platform, Animated, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import api from '@services/api';
import CameraModal from '@components/common/CameraModal';

const DOC_CATEGORIES = [
  { label: 'Company',        icon: 'business-outline',        color: '#1D4ED8' },
  { label: 'Tax & GST',      icon: 'receipt-outline',         color: '#7C3AED' },
  { label: 'Legal',          icon: 'shield-checkmark-outline',color: '#C2410C' },
  { label: 'HR & Payroll',   icon: 'people-outline',          color: '#0369A1' },
  { label: 'Insurance',      icon: 'umbrella-outline',        color: '#15803D' },
  { label: 'Banking',        icon: 'card-outline',            color: '#B45309' },
  { label: 'Licence',        icon: 'document-text-outline',   color: '#BE185D' },
  { label: 'Employee – PAN',      icon: 'person-outline', color: '#6D28D9' },
  { label: 'Employee – Aadhaar',  icon: 'person-outline', color: '#0891B2' },
  { label: 'Employee – Passport', icon: 'person-outline', color: '#065F46' },
  { label: 'Employee – UAN',      icon: 'person-outline', color: '#92400E' },
  { label: 'Employee – Certificate', icon: 'school-outline', color: '#1E40AF' },
  { label: 'Other',          icon: 'folder-outline',          color: '#475569' },
];

function catMeta(label) {
  return DOC_CATEGORIES.find(c => c.label === label) || DOC_CATEGORIES[DOC_CATEGORIES.length - 1];
}

// ── Document Form Modal ───────────────────────────────────────────────────────
function DocFormModal({ visible, onClose, onSave, editing, staffList, presetCategory }) {
  const [name, setName]             = useState('');
  const [category, setCategory]     = useState('');
  const [catText, setCatText]       = useState('');
  const [catOpen, setCatOpen]       = useState(false);
  const [docType, setDocType]       = useState('company');
  const [staffId, setStaffId]       = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffOpen, setStaffOpen]   = useState(false);
  const [gst, setGst]               = useState('');
  const [renewal, setRenewal]       = useState('');
  const [notes, setNotes]           = useState('');
  const [files, setFiles]           = useState([]);
  const [existingFiles, setExistingFiles] = useState([]); // already-uploaded files kept on edit
  const [cameraOpen, setCameraOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const fileRef = useRef(null);

  React.useEffect(() => {
    if (visible) {
      if (editing) {
        setName(editing.name || '');
        setCategory(editing.category || '');
        setCatText(editing.category || '');
        setDocType(editing.doc_type || 'company');
        setStaffId(editing.staff_id ? String(editing.staff_id) : '');
        setStaffSearch(editing.staff_name || '');
        setGst(editing.gst_number || '');
        setRenewal(editing.renewal_date ? dayjs(editing.renewal_date).format('YYYY-MM-DD') : '');
        setNotes(editing.notes || '');
        setFiles([]);
        setExistingFiles(parseFiles(editing.file_path));
      } else {
        setName('');
        setCategory(presetCategory || ''); setCatText(presetCategory || '');
        setDocType('company'); setStaffId(''); setStaffSearch('');
        setGst(''); setRenewal(''); setNotes(''); setFiles([]); setExistingFiles([]);
      }
      setCatOpen(false); setStaffOpen(false); setError('');
    }
  }, [visible, editing]);

  const pickCat = (c) => { setCategory(c.label); setCatText(c.label); setCatOpen(false); };
  const pickStaff = (s) => { setStaffId(String(s.id)); setStaffSearch(s.name); setStaffOpen(false); };

  const handleSave = async () => {
    if (!name.trim()) { setError('Document name is required.'); return; }
    setSaving(true); setError('');
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('category', category || catText || 'Other');
      form.append('doc_type', docType);
      if (staffId) form.append('staff_id', staffId);
      if (gst.trim()) form.append('gst_number', gst.trim());
      if (renewal) form.append('renewal_date', renewal);
      if (notes.trim()) form.append('notes', notes.trim());
      files.forEach(f => form.append('files', f));
      // Existing files to keep (edit mode); backend merges these with newly uploaded ones
      if (editing) form.append('keep_files', JSON.stringify(existingFiles));
      if (editing) {
        await api.putForm(`/documents/${editing.id}`, form);
      } else {
        await api.postForm('/documents', form);
      }
      onSave();
      onClose();
    } catch (e) {
      setError(e?.error || e?.message || 'Failed to save.');
    } finally { setSaving(false); }
  };

  const filteredCats = DOC_CATEGORIES.filter(c =>
    !catText || c.label.toLowerCase().includes(catText.toLowerCase())
  );
  const filteredStaff = staffList.filter(s =>
    !staffSearch || s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    (s.employee_id || '').toLowerCase().includes(staffSearch.toLowerCase())
  );

  const catColor = catMeta(category || catText).color;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={fm.overlay} onPress={onClose}>
        <Pressable style={fm.card} onPress={e => e.stopPropagation?.()}>
          <View style={fm.header}>
            <Text style={fm.title}>{editing ? 'Edit Document' : 'Add Document'}</Text>
            <TouchableOpacity onPress={onClose} style={fm.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {!!error && (
            <View style={fm.errBox}>
              <Ionicons name="alert-circle-outline" size={13} color="#DC2626" />
              <Text style={fm.errTxt}>{error}</Text>
            </View>
          )}

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 4 }} showsVerticalScrollIndicator={false}>

            {/* Doc type toggle */}
            <Text style={fm.label}>Document Type</Text>
            <View style={fm.toggle}>
              {['company', 'employee'].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[fm.toggleBtn, docType === t && fm.toggleBtnActive]}
                  onPress={() => { setDocType(t); if (t === 'company') { setStaffId(''); setStaffSearch(''); } }}
                >
                  <Ionicons name={t === 'company' ? 'business-outline' : 'person-outline'} size={14} color={docType === t ? '#fff' : '#64748B'} />
                  <Text style={[fm.toggleTxt, docType === t && fm.toggleTxtActive]}>
                    {t === 'company' ? 'Company' : 'Employee'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Employee picker — only when employee type */}
            {docType === 'employee' && (
              <>
                <Text style={fm.label}>Employee *</Text>
                <View style={fm.dropWrap}>
                  <View style={fm.inputRow}>
                    <Ionicons name="person-outline" size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                    <TextInput
                      style={fm.inlineInput}
                      placeholder="Search employee…"
                      placeholderTextColor="#94A3B8"
                      value={staffSearch}
                      onChangeText={t => { setStaffSearch(t); setStaffId(''); setStaffOpen(true); }}
                      onFocus={() => setStaffOpen(true)}
                    />
                    {staffSearch.length > 0 && (
                      <TouchableOpacity onPress={() => { setStaffSearch(''); setStaffId(''); setStaffOpen(false); }}>
                        <Ionicons name="close" size={13} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>
                  {staffOpen && filteredStaff.length > 0 && (
                    <View style={fm.dropList}>
                      <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                        {filteredStaff.map(s => (
                          <TouchableOpacity key={s.id} style={fm.dropItem} onPress={() => pickStaff(s)}>
                            <Ionicons name="person-circle-outline" size={16} color="#64748B" />
                            <Text style={fm.dropItemTxt}>{s.name}</Text>
                            {s.employee_id ? <Text style={fm.dropItemSub}>#{s.employee_id}</Text> : null}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Category */}
            <Text style={fm.label}>Category</Text>
            <View style={fm.dropWrap}>
              <View style={[fm.inputRow, category && { borderColor: catColor + '80' }]}>
                {category ? (
                  <View style={[fm.catDot, { backgroundColor: catColor + '20', marginRight: 6 }]}>
                    <Ionicons name={catMeta(category).icon} size={12} color={catColor} />
                  </View>
                ) : null}
                <TextInput
                  style={[fm.inlineInput, category && { color: catColor, fontWeight: '700' }]}
                  placeholder="Select or type category…"
                  placeholderTextColor="#94A3B8"
                  value={catText}
                  onChangeText={t => { setCatText(t); setCategory(''); setCatOpen(true); }}
                  onFocus={() => setCatOpen(true)}
                />
                {catText.length > 0 && (
                  <TouchableOpacity onPress={() => { setCatText(''); setCategory(''); setCatOpen(false); }}>
                    <Ionicons name="close" size={13} color="#94A3B8" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setCatOpen(v => !v)} style={{ marginLeft: 4 }}>
                  <Ionicons name={catOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              {catOpen && filteredCats.length > 0 && (
                <View style={fm.dropList}>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                    {filteredCats.map(c => (
                      <TouchableOpacity key={c.label} style={[fm.dropItem, category === c.label && { backgroundColor: c.color + '10' }]} onPress={() => pickCat(c)}>
                        <View style={[fm.catDot, { backgroundColor: c.color + '20' }]}>
                          <Ionicons name={c.icon} size={12} color={c.color} />
                        </View>
                        <Text style={[fm.dropItemTxt, { color: c.color }]}>{c.label}</Text>
                        {category === c.label && <Ionicons name="checkmark" size={14} color={c.color} style={{ marginLeft: 'auto' }} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Name */}
            <Text style={fm.label}>Document Name *</Text>
            <TextInput style={fm.input} placeholder="e.g. GST Registration Certificate"
              placeholderTextColor="#94A3B8" value={name} onChangeText={setName} />

            {/* GST & Renewal */}
            <View style={fm.row}>
              <View style={{ flex: 1 }}>
                <Text style={fm.label}>GST Number</Text>
                <TextInput style={fm.input} placeholder="22AAAAA0000A1Z5"
                  placeholderTextColor="#94A3B8" value={gst} onChangeText={setGst} autoCapitalize="characters" />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={fm.label}>Renewal Date</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={renewal}
                    onChange={(e) => setRenewal(e.target.value)}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '9px 12px',
                      fontSize: '13px',
                      color: '#0F172A',
                      backgroundColor: '#FAFAFA',
                      fontFamily: 'inherit',
                      width: '100%',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                ) : (
                  <TextInput style={fm.input} placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8" value={renewal} onChangeText={setRenewal} />
                )}
              </View>
            </View>

            {/* Notes */}
            <Text style={fm.label}>Notes</Text>
            <TextInput style={[fm.input, { height: 56, textAlignVertical: 'top', paddingTop: 8 }]}
              placeholder="Additional details…" placeholderTextColor="#94A3B8"
              value={notes} onChangeText={setNotes} multiline />

            {/* File upload — web only */}
            {Platform.OS === 'web' && (
              <>
                <Text style={fm.label}>Attach Files (PDF / Image, max 10 MB each)</Text>
                <View style={fm.uploadRow}>
                  <TouchableOpacity style={fm.uploadBtn} onPress={() => fileRef.current?.click()}>
                    <Ionicons name="cloud-upload-outline" size={18} color={Colors.primary} />
                    <Text style={fm.uploadBtnTxt}>Upload File</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[fm.uploadBtn, { borderColor: '#0369A1' + '50' }]} onPress={() => setCameraOpen(true)}>
                    <Ionicons name="camera-outline" size={18} color="#0369A1" />
                    <Text style={[fm.uploadBtnTxt, { color: '#0369A1' }]}>Camera</Text>
                  </TouchableOpacity>
                </View>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files?.length) {
                      setFiles(prev => [...prev, ...Array.from(e.target.files)]);
                      e.target.value = '';
                    }
                  }}
                />
                <CameraModal
                  visible={cameraOpen}
                  onCapture={file => setFiles(prev => [...prev, file])}
                  onClose={() => setCameraOpen(false)}
                />
                {/* Existing server files — kept unless removed */}
                {existingFiles.length > 0 && (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {existingFiles.map((f, i) => {
                      const isImage = isImagePath(f.path);
                      return (
                        <View key={`ex-${i}`} style={fm.fileChip}>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
                            onPress={() => { if (isImage) setPreviewUrl(buildFileUrl(f.path)); }}
                            activeOpacity={isImage ? 0.7 : 1}
                          >
                            <Ionicons name={isImage ? 'image-outline' : 'document-outline'} size={13} color={isImage ? Colors.primary : '#64748B'} />
                            <Text style={[fm.fileChipTxt, isImage && { color: Colors.primary, textDecorationLine: 'underline' }]} numberOfLines={1}>{f.name || `File ${i + 1}`}</Text>
                            <Text style={fm.fileChipSub}>(existing)</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setExistingFiles(prev => prev.filter((_, j) => j !== i))}>
                            <Ionicons name="close-circle" size={15} color="#94A3B8" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
                {/* Newly selected files */}
                {files.length > 0 && (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {files.map((f, i) => {
                      const isImage = f.type?.startsWith('image');
                      return (
                        <View key={i} style={fm.fileChip}>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
                            onPress={() => {
                              if (isImage) setPreviewUrl(URL.createObjectURL(f));
                            }}
                            activeOpacity={isImage ? 0.7 : 1}
                          >
                            <Ionicons name={isImage ? 'image-outline' : 'document-outline'} size={13} color={isImage ? Colors.primary : '#64748B'} />
                            <Text style={[fm.fileChipTxt, isImage && { color: Colors.primary, textDecorationLine: 'underline' }]} numberOfLines={1}>{f.name}</Text>
                            <Text style={fm.fileChipSize}>({(f.size / 1024).toFixed(0)} KB)</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setFiles(prev => prev.filter((_, j) => j !== i))}>
                            <Ionicons name="close-circle" size={15} color="#94A3B8" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Image preview — fixed overlay, works inside nested modals on web */}
                {previewUrl && (
                  <Pressable style={fm.previewOverlay} onPress={() => setPreviewUrl(null)}>
                    <Pressable style={fm.previewBox} onPress={e => e.stopPropagation?.()}>
                      <TouchableOpacity style={fm.previewClose} onPress={() => setPreviewUrl(null)}>
                        <Ionicons name="close" size={20} color="#fff" />
                      </TouchableOpacity>
                      <Image source={{ uri: previewUrl }} style={fm.previewImg} resizeMode="contain" />
                    </Pressable>
                  </Pressable>
                )}
              </>
            )}
          </ScrollView>

          <View style={fm.footer}>
            <TouchableOpacity style={fm.cancelBtn} onPress={onClose}>
              <Text style={fm.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[fm.saveBtn, { backgroundColor: catColor }, saving && { opacity: 0.6 }]}
              onPress={handleSave} disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={fm.saveTxt}>{editing ? 'Update' : 'Save'}</Text>}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const fm = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16, paddingVertical: 24 },
  card:      { backgroundColor: '#fff', borderRadius: 18, width: '100%', maxWidth: 560, alignSelf: 'center', maxHeight: '92%', display: 'flex', flexDirection: 'column' },
  header:    { flexDirection: 'row', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 12, paddingHorizontal: 20, paddingTop: 20 },
  title:     { fontSize: 15, fontWeight: '800', color: '#1E293B', flex: 1 },
  closeBtn:  { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  errBox:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 10, marginHorizontal: 20 },
  errTxt:    { fontSize: 12, color: '#DC2626', flex: 1 },
  label:     { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 12 },
  input:     { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#0F172A', backgroundColor: '#FAFAFA', outlineStyle: 'none' },
  row:       { flexDirection: 'row' },
  toggle:    { flexDirection: 'row', gap: 8, marginTop: 2 },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  toggleBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleTxt: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  toggleTxtActive: { color: '#fff' },
  dropWrap:  { position: 'relative', zIndex: 50 },
  inputRow:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#FAFAFA' },
  inlineInput: { flex: 1, fontSize: 13, color: '#0F172A', outlineStyle: 'none', paddingVertical: 0 },
  dropList:  { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, zIndex: 100, marginTop: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 },
  dropItem:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dropItemTxt: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  dropItemSub: { fontSize: 11, color: '#94A3B8', marginLeft: 4 },
  catDot:    { width: 22, height: 22, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  uploadRow:     { flexDirection: 'row', gap: 10, marginTop: 2 },
  uploadBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.primary + '50', borderRadius: 10, borderStyle: 'dashed', paddingVertical: 12, backgroundColor: Colors.primary + '06' },
  uploadBtnTxt:  { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  fileChip:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 7 },
  fileChipTxt:   { fontSize: 12, color: '#0F172A', fontWeight: '500', flex: 1 },
  fileChipSize:  { fontSize: 11, color: '#94A3B8' },
  fileChipSub:   { fontSize: 11, color: '#94A3B8', fontStyle: 'italic' },
  previewOverlay:{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.88)', zIndex: 9999, justifyContent: 'center', alignItems: 'center' },
  previewBox:    { width: '90%', maxWidth: 640, maxHeight: '80%', backgroundColor: '#111', borderRadius: 14, overflow: 'hidden', position: 'relative' },
  previewImg:    { width: '100%', height: 480 },
  previewClose:  { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  footer:    { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingTop: 12, paddingBottom: 16, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  cancelBtn: { paddingVertical: 9, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  cancelTxt: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  saveBtn:   { paddingVertical: 9, paddingHorizontal: 22, borderRadius: 10 },
  saveTxt:   { fontSize: 13, fontWeight: '700', color: '#fff' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function DocumentsScreen({ navigation }) {
  const { width }  = useWindowDimensions();
  const isMobile   = width < 768;

  const [docs, setDocs]           = useState([]);
  const [staff, setStaff]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [filterCat, setFilterCat] = useState('All');
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch]       = useState('');
  const [viewFile, setViewFile]   = useState(null); // { url, isImage }
  const [filterOpen, setFilterOpen] = useState(false);
  const [openFolder, setOpenFolder] = useState(null); // null = folder grid; else category name
  const [presetCat, setPresetCat]   = useState(null); // pre-filled category when adding into a folder

  // Keyboard navigation for the file preview viewer (← → to step, Esc to close)
  React.useEffect(() => {
    if (!viewFile || viewFile.mode !== 'preview' || Platform.OS !== 'web') return;
    const handler = (e) => {
      if (e.key === 'Escape') { setViewFile(null); return; }
      const list = viewFile.files || [];
      if (list.length < 2) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const cur = viewFile.index ?? 0;
        const n = ((e.key === 'ArrowRight' ? cur + 1 : cur - 1) + list.length) % list.length;
        const f = list[n];
        setViewFile({ mode: 'preview', url: buildFileUrl(f.path), isImage: isImagePath(f.path), files: list, index: n });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [viewFile]);

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([api.get('/documents'), api.get('/staff')]);
      setDocs(Array.isArray(d) ? d : []);
      setStaff(Array.isArray(s) ? s : []);
    } catch { setDocs([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = async (id) => {
    if (!confirm('Delete this document?')) return;
    await api.delete(`/documents/${id}`);
    load();
  };

  // Filter
  const allCats = ['All', ...Array.from(new Set(docs.map(d => d.category).filter(Boolean)))];
  const filtered = docs.filter(d => {
    if (filterType !== 'all' && d.doc_type !== filterType) return false;
    if (filterCat !== 'All' && d.category !== filterCat) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) &&
        !(d.staff_name || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by category (category == folder)
  const groups = {};
  filtered.forEach(d => {
    const key = d.category || 'Other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  });

  // Folder view state: when searching, show a flat result list (ignore folders).
  const isSearching = !!search.trim();
  const folderNames = Object.keys(groups).sort((a, b) => a.localeCompare(b));
  // If the open folder no longer has matches, fall back to the grid.
  const activeFolder = openFolder && groups[openFolder] ? openFolder : null;
  const docsInFolder = activeFolder ? groups[activeFolder] : [];

  return (
    <View style={s.screen}>
      <Navbar navigation={navigation} activeTab="Documents" />

      <ScrollView
        style={s.container}
        contentContainerStyle={[s.content, isMobile && { paddingHorizontal: 10 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Colors.primary]} />}
      >
        {/* Search + Filter + Add row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, position: 'relative', zIndex: 50 }}>
          <View style={[s.searchRow, { flex: 1, marginBottom: 0 }]}>
            <Ionicons name="search-outline" size={15} color="#94A3B8" />
            <TextInput
              style={s.searchInput}
              placeholder="Search documents…"
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={15} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter button */}
          <TouchableOpacity
            style={[s.toolBtn, filterOpen && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
            onPress={() => setFilterOpen(o => !o)}
          >
            <Ionicons name="options-outline" size={16} color={filterOpen ? '#fff' : '#64748B'} />
            {(filterType !== 'all' || filterCat !== 'All') && (
              <View style={s.filterDot} />
            )}
          </TouchableOpacity>

          {/* Add Document button */}
          <TouchableOpacity style={s.newBtn} onPress={() => { setEditing(null); setPresetCat(openFolder && groups[openFolder] ? openFolder : null); setFormVisible(true); }}>
            <Ionicons name="add" size={18} color="#fff" />
            {!isMobile && <Text style={s.newBtnTxt}>Add Document</Text>}
          </TouchableOpacity>

        </View>

        {/* Filter dropdown panel */}
        {filterOpen && (
          <View style={s.filterPanel}>
            <View style={s.filterHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="options-outline" size={15} color="#475569" />
                <Text style={s.filterHeadTitle}>Filters</Text>
              </View>
              {(filterType !== 'all' || filterCat !== 'All') && (
                <TouchableOpacity
                  style={s.filterReset}
                  onPress={() => { setFilterType('all'); setFilterCat('All'); }}
                >
                  <Ionicons name="refresh-outline" size={13} color="#64748B" />
                  <Text style={s.filterResetTxt}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={s.filterSection}>
              <Text style={s.filterPanelLabel}>Type</Text>
              <View style={s.filterRow}>
                {[['all','All'], ['company','Company'], ['employee','Employee']].map(([val, lbl]) => (
                  <TouchableOpacity
                    key={val}
                    style={[s.filterChip, filterType === val && s.filterChipActive]}
                    onPress={() => setFilterType(val)}
                  >
                    <Text style={[s.filterChipTxt, filterType === val && s.filterChipTxtActive]}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {allCats.length > 2 && (
              <View style={[s.filterSection, { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12, marginTop: 2 }]}>
                <Text style={s.filterPanelLabel}>Category</Text>
                <View style={[s.filterRow, { flexWrap: 'wrap' }]}>
                  {allCats.map(cat => {
                    const meta = catMeta(cat);
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[s.filterChip, filterCat === cat && { borderColor: meta.color, backgroundColor: meta.color + '12' }]}
                        onPress={() => setFilterCat(cat)}
                      >
                        {cat !== 'All' && <Ionicons name={meta.icon} size={11} color={filterCat === cat ? meta.color : '#94A3B8'} />}
                        <Text style={[s.filterChipTxt, filterCat === cat && { color: meta.color, fontWeight: '700' }]}>{cat}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {(() => {
          // Renders a list of documents (mobile cards or desktop table)
          const renderDocList = (items, meta) => (
            isMobile ? (
              items.map(doc => (
                <SwipeableDocCard
                  key={doc.id}
                  doc={doc}
                  onEdit={() => { setEditing(doc); setFormVisible(true); }}
                  onDelete={() => handleDelete(doc.id)}
                >
                  <DocCardMobile doc={doc} meta={catMeta(doc.category)} onView={setViewFile} />
                </SwipeableDocCard>
              ))
            ) : (
              <View style={s.tableWrap}>
                <View style={s.tableHead}>
                  <Text style={[s.th, { flex: 2 }]}>Document Name</Text>
                  <Text style={[s.th, { flex: 1.2 }]}>Employee</Text>
                  <Text style={[s.th, { flex: 1 }]}>GST Number</Text>
                  <Text style={[s.th, { flex: 1 }]}>Renewal Date</Text>
                  <Text style={[s.th, { width: 80, textAlign: 'center' }]}>File</Text>
                  <Text style={[s.th, { width: 80, textAlign: 'right' }]}>Actions</Text>
                </View>
                {items.map(doc => <DocRow key={doc.id} doc={doc} meta={catMeta(doc.category)} onEdit={() => { setEditing(doc); setFormVisible(true); }} onDelete={() => handleDelete(doc.id)} onView={setViewFile} />)}
              </View>
            )
          );

          if (loading) return <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />;

          if (filtered.length === 0) return (
            <View style={s.empty}>
              <Ionicons name="folder-open-outline" size={48} color="#CBD5E1" />
              <Text style={s.emptyTxt}>No documents found</Text>
              <Text style={s.emptySub}>Upload company licences, GST certificates, employee docs & more</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => { setEditing(null); setFormVisible(true); }}>
                <Ionicons name="add" size={15} color="#fff" />
                <Text style={s.emptyBtnTxt}>Add Document</Text>
              </TouchableOpacity>
            </View>
          );

          // While searching, show flat results across all folders
          if (isSearching) {
            return (
              <View style={s.group}>
                <Text style={[s.groupCount, { marginBottom: 8 }]}>{filtered.length} result{filtered.length > 1 ? 's' : ''}</Text>
                {renderDocList(filtered)}
              </View>
            );
          }

          // Inside an opened folder
          if (activeFolder) {
            const meta = catMeta(activeFolder);
            return (
              <View style={s.group}>
                {/* Compact folder header: breadcrumb + name + add */}
                <View style={s.folderBar}>
                  <TouchableOpacity style={s.crumbBtn} onPress={() => setOpenFolder(null)}>
                    <Ionicons name="chevron-back" size={15} color="#64748B" />
                    <Text style={s.crumbTxt}>All Folders</Text>
                  </TouchableOpacity>
                  <Text style={s.folderBarSep}>/</Text>
                  <Ionicons name={meta.icon} size={15} color={meta.color} />
                  <Text style={s.folderBarTitle} numberOfLines={1}>{activeFolder}</Text>
                  <Text style={s.folderBarCount}>({docsInFolder.length})</Text>
                </View>

                {renderDocList(docsInFolder, meta)}
              </View>
            );
          }

          // Folder grid (top level)
          return (
            <View>
              <View style={s.folderGrid}>
              {folderNames.map(cat => {
                const meta = catMeta(cat);
                const count = groups[cat].length;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[s.folderTile, isMobile && { width: '47%' }]}
                    onPress={() => setOpenFolder(cat)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.folderTileIcon, { backgroundColor: meta.color + '18' }]}>
                      <Ionicons name="folder" size={26} color={meta.color} />
                    </View>
                    <Text style={s.folderTileLabel} numberOfLines={1}>{cat}</Text>
                    <Text style={s.folderTileCount}>{count} {count === 1 ? 'document' : 'documents'}</Text>
                  </TouchableOpacity>
                );
              })}
              </View>
            </View>
          );
        })()}
      </ScrollView>

      {isMobile && (
        <View style={s.fabWrap}>
          <TouchableOpacity style={s.fab} onPress={() => { setEditing(null); setFormVisible(true); }}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <DocFormModal
        visible={formVisible}
        onClose={() => { setFormVisible(false); setEditing(null); setPresetCat(null); }}
        onSave={load}
        editing={editing}
        staffList={staff}
        presetCategory={presetCat}
      />

      {/* File viewer popup — gallery or full preview */}
      {viewFile && (
        <Pressable
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}
          onPress={() => setViewFile(null)}
        >
          <Pressable onPress={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 780, backgroundColor: '#1a1a1a', borderRadius: 16, overflow: 'hidden' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#111' }}>
              {viewFile.mode === 'preview' ? (
                <TouchableOpacity onPress={() => setViewFile({ mode: 'gallery', files: viewFile.files })} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="chevron-back" size={16} color="#aaa" />
                  <Text style={{ color: '#aaa', fontSize: 13 }}>All files</Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                  {viewFile.files.length} {viewFile.files.length === 1 ? 'File' : 'Files'}
                </Text>
              )}
              <TouchableOpacity onPress={() => setViewFile(null)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Gallery mode — thumbnails grid */}
            {viewFile.mode === 'gallery' && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 }}>
                {viewFile.files.map((f, i) => {
                  const url = buildFileUrl(f.path);
                  const isImg = isImagePath(f.path);
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setViewFile({ mode: 'preview', url, isImage: isImg, files: viewFile.files, index: i })}
                      style={{ width: 110, height: 90, borderRadius: 10, overflow: 'hidden', backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' }}
                    >
                      {isImg ? (
                        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <View style={{ alignItems: 'center', gap: 6 }}>
                          <Ionicons name="document-outline" size={28} color="#aaa" />
                          <Text style={{ fontSize: 10, color: '#aaa', textAlign: 'center', paddingHorizontal: 4 }} numberOfLines={2}>
                            {f.name || `File ${i + 1}`}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Preview mode — full image or iframe, with prev/next */}
            {viewFile.mode === 'preview' && (() => {
              const list = viewFile.files || [];
              const hasMany = list.length > 1;
              const goTo = (idx) => {
                const n = (idx + list.length) % list.length;
                const f = list[n];
                setViewFile({ mode: 'preview', url: buildFileUrl(f.path), isImage: isImagePath(f.path), files: list, index: n });
              };
              const cur = viewFile.index ?? 0;
              return (
                <View style={{ position: 'relative', width: '100%', backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
                  {viewFile.isImage ? (
                    <img src={viewFile.url} style={{ width: '100%', height: 500, objectFit: 'contain', display: 'block' }} alt="preview" />
                  ) : (
                    <iframe src={viewFile.url} style={{ width: '100%', height: '75vh', border: 'none', display: 'block', backgroundColor: '#fff' }} title="file preview" />
                  )}
                  {hasMany && (
                    <>
                      <TouchableOpacity onPress={() => goTo(cur - 1)}
                        style={{ position: 'absolute', left: 10, top: '50%', marginTop: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="chevron-back" size={24} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => goTo(cur + 1)}
                        style={{ position: 'absolute', right: 10, top: '50%', marginTop: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="chevron-forward" size={24} color="#fff" />
                      </TouchableOpacity>
                      <View style={{ position: 'absolute', bottom: 12, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, left: 0, right: 0, marginHorizontal: 'auto', width: 64, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{cur + 1} / {list.length}</Text>
                      </View>
                    </>
                  )}
                </View>
              );
            })()}
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

function parseFiles(filePath) {
  if (!filePath) return [];
  try {
    const parsed = JSON.parse(filePath);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return [];
  } catch {
    // plain string path
    return [{ path: filePath, name: 'View file' }];
  }
}

function buildFileUrl(path) {
  // Same-origin: backend serves /uploads from this host. Override for local/native dev.
  const base = process.env.EXPO_PUBLIC_API_ORIGIN || '';
  return path.startsWith('http') ? path : `${base}${path}`;
}

function isImagePath(path) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(path);
}

function FileLinks({ filePath, onView }) {
  const files = parseFiles(filePath);
  if (!files.length) return null;
  const first = files[0];
  // Single file → go straight to preview; multiple → open gallery
  const handlePress = () => {
    if (!onView) return;
    if (files.length === 1) {
      onView({ mode: 'preview', url: buildFileUrl(first.path), isImage: isImagePath(first.path), files });
    } else {
      onView({ mode: 'gallery', files });
    }
  };
  return (
    <TouchableOpacity style={s.viewBtn} onPress={handlePress}>
      <Ionicons name="images-outline" size={15} color={Colors.primary} />
    </TouchableOpacity>
  );
}

function DocRow({ doc, meta, onEdit, onDelete, onView }) {
  const renewal = doc.renewal_date ? dayjs(doc.renewal_date) : null;
  const isExpiring = renewal && renewal.diff(dayjs(), 'day') <= 30 && renewal.diff(dayjs(), 'day') >= 0;
  const isExpired  = renewal && renewal.isBefore(dayjs(), 'day');
  return (
    <View style={s.tableRow}>
      <View style={[s.td, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
        <View style={[s.docIcon, { backgroundColor: meta.color + '18' }]}>
          <Ionicons name={meta.icon} size={13} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.docName} numberOfLines={1}>{doc.name}</Text>
          {doc.notes ? <Text style={s.docNote} numberOfLines={1}>{doc.notes}</Text> : null}
        </View>
      </View>
      <Text style={[s.td, { flex: 1.2, color: '#64748B' }]} numberOfLines={1}>{doc.staff_name || '—'}</Text>
      <Text style={[s.td, { flex: 1, color: '#64748B', fontSize: 12 }]} numberOfLines={1}>{doc.gst_number || '—'}</Text>
      <View style={[s.td, { flex: 1 }]}>
        <Text style={{ color: '#334155', fontSize: 12 }} numberOfLines={1}>
          {renewal ? renewal.format('DD MMM YYYY') : '—'}
        </Text>
        {isExpired ? (
          <Text style={s.expTag}>Expired</Text>
        ) : isExpiring ? (
          <Text style={s.expTagSoon}>Expiring soon</Text>
        ) : null}
      </View>
      <View style={[s.td, { width: 80, alignItems: 'center' }]}>
        {doc.file_path ? <FileLinks filePath={doc.file_path} onView={onView} /> : <Text style={{ color: '#94A3B8', fontSize: 12 }}>—</Text>}
      </View>
      <View style={[s.td, { width: 80, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }]}>
        <TouchableOpacity style={s.editBtn} onPress={(e) => { e.stopPropagation?.(); onEdit(); }}>
          <Ionicons name="pencil-outline" size={13} color="#1D4ED8" />
        </TouchableOpacity>
        <TouchableOpacity style={s.delBtn} onPress={(e) => { e.stopPropagation?.(); onDelete(); }}>
          <Ionicons name="trash-outline" size={13} color="#DC2626" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Swipeable card component for mobile documents
function SwipeableDocCard({ doc, onEdit, onDelete, children }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [isOpen, setIsOpen] = useState(false);
  
  const isOpenRef = useRef(false);
  React.useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const ACTION_WIDTH = 120;
  const SWIPE_THRESHOLD = 45;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dy) < 15,
      onPanResponderMove: (_, g) => {
        const base = isOpenRef.current ? -ACTION_WIDTH : 0;
        const val = Math.max(-ACTION_WIDTH, Math.min(0, base + g.dx));
        translateX.setValue(val);
      },
      onPanResponderRelease: (_, g) => {
        let shouldOpen = isOpenRef.current;
        if (isOpenRef.current) {
          if (g.dx > SWIPE_THRESHOLD) shouldOpen = false;
        } else {
          if (g.dx < -SWIPE_THRESHOLD) shouldOpen = true;
        }
        
        setIsOpen(shouldOpen);
        Animated.spring(translateX, {
          toValue: shouldOpen ? -ACTION_WIDTH : 0,
          useNativeDriver: true,
          bounciness: 4,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: isOpenRef.current ? -ACTION_WIDTH : 0,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const close = () => {
    setIsOpen(false);
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={s.swipeWrap}>
      <View style={s.swipeActions}>
        <TouchableOpacity 
          style={[s.swipeActionBtn, { backgroundColor: '#3B82F6' }]} 
          onPress={() => { close(); onEdit(doc); }}
        >
          <Ionicons name="pencil-outline" size={16} color="#fff" />
          <Text style={s.swipeActionTxt}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[s.swipeActionBtn, { backgroundColor: '#EF4444' }]} 
          onPress={() => { close(); onDelete(doc.id); }}
        >
          <Ionicons name="trash-outline" size={16} color="#fff" />
          <Text style={s.swipeActionTxt}>Delete</Text>
        </TouchableOpacity>
      </View>

      <Animated.View 
        style={{ 
          transform: [{ translateX }], 
          touchAction: 'pan-y',
          userSelect: 'none',
          cursor: isOpen ? 'grabbing' : 'grab',
        }} 
        {...panResponder.panHandlers}
      >
        {children}
        {isOpen && (
          <TouchableOpacity 
            activeOpacity={1} 
            style={s.swipeOverlay} 
            onPress={close}
          />
        )}
      </Animated.View>
    </View>
  );
}

function DocCardMobile({ doc, meta, onView }) {
  const renewal = doc.renewal_date ? dayjs(doc.renewal_date) : null;
  const isExpiring = renewal && renewal.diff(dayjs(), 'day') <= 30 && renewal.diff(dayjs(), 'day') >= 0;
  const isExpired  = renewal && renewal.isBefore(dayjs(), 'day');
  return (
    <View style={[s.mCard, { marginBottom: 0 }]}>
      {/* Top: icon + info */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={[s.docIcon, { backgroundColor: meta.color + '18' }]}>
          <Ionicons name={meta.icon} size={16} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.docName} numberOfLines={1}>{doc.name}</Text>
            </View>
            {!!doc.file_path && (
              <FileLinks filePath={doc.file_path} onView={onView} />
            )}
          </View>
          {doc.staff_name ? <Text style={s.docNote}>{doc.staff_name}</Text> : null}
          {doc.gst_number ? <Text style={s.docNote}>GST: {doc.gst_number}</Text> : null}
          {renewal ? (
            <Text style={[s.docNote, { marginTop: 4 }]}>
              Renewal: {renewal.format('DD MMM YYYY')}
              {isExpired ? '  • Expired' : isExpiring ? '  • Expiring soon' : ''}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen:    { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },
  container: { flex: 1, width: '100%' },
  content:   { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },

  pageHeader:{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  pageSub:   { fontSize: 12, color: '#64748B', marginTop: 2 },
  newBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  newBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },

  alertBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FCD34D' },
  alertTxt:  { fontSize: 12, color: '#92400E', flex: 1, lineHeight: 18 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10 },
  searchInput:{ flex: 1, fontSize: 13, color: '#0F172A', outlineStyle: 'none' },

  toolBtn:   { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  filterDot: { position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },

  filterPanel: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12 },
  filterHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  filterHeadTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  filterReset: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#F1F5F9' },
  filterResetTxt: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  filterSection: { marginBottom: 8 },
  filterPanelLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterChip:{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F8FAFC' },
  filterChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },
  filterChipTxt:    { fontSize: 12.5, color: '#475569', fontWeight: '600' },
  filterChipTxtActive: { color: Colors.primary, fontWeight: '700' },

  group:        { marginBottom: 20 },
  groupHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  groupIcon:    { width: 24, height: 24, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  groupTitle:   { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 },
  groupCount:   { fontSize: 12, color: '#94A3B8', fontWeight: '600' },

  // Folder grid + opened-folder header
  folderGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 4 },
  folderTile:     { width: 170, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 16, alignItems: 'flex-start', gap: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  folderTileIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  folderTileLabel:{ fontSize: 14, fontWeight: '700', color: '#1E293B', width: '100%' },
  folderTileCount:{ fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  folderBar:        { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  crumbBtn:         { flexDirection: 'row', alignItems: 'center', gap: 2 },
  crumbTxt:         { fontSize: 13, fontWeight: '600', color: '#64748B' },
  folderBarSep:     { fontSize: 13, color: '#CBD5E1' },
  folderBarTitle:   { fontSize: 14, fontWeight: '800', color: '#1E293B', maxWidth: 220 },
  folderBarCount:   { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  addToFolderBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 9 },
  addToFolderTxt:   { fontSize: 13, fontWeight: '700', color: '#fff' },

  tableWrap:    { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  tableHead:    { flexDirection: 'row', backgroundColor: '#F8FAFC', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  th:           { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4 },
  tableRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  td:           { fontSize: 13, color: '#0F172A' },

  mCard:     { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB', gap: 10 },
  mCardActions: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8, marginTop: 2 },

  docIcon:   { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  docName:   { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 1 },
  docNote:   { fontSize: 11, color: '#64748B' },

  renewBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, backgroundColor: '#F1F5F9' },
  renewExpired: { backgroundColor: '#F1F5F9' },
  renewSoon:    { backgroundColor: '#F1F5F9' },
  renewTxt:     { fontSize: 10, fontWeight: '700', color: '#334155' },
  expTag:       { fontSize: 10, fontWeight: '700', color: '#DC2626', marginTop: 2 },
  expTagSoon:   { fontSize: 10, fontWeight: '700', color: '#B45309', marginTop: 2 },

  viewBtn:   { flexDirection: 'row', alignItems: 'center', gap: 2, width: 26, height: 26, borderRadius: 7, backgroundColor: '#FFF0F0', justifyContent: 'center' },
  viewBtnTxt:{ fontSize: 10, color: Colors.primary, fontWeight: '700' },
  infoBtn:   { width: 26, height: 26, borderRadius: 7, backgroundColor: '#ECFEFF', justifyContent: 'center', alignItems: 'center' },
  editBtn:   { width: 26, height: 26, borderRadius: 7, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  delBtn:    { width: 26, height: 26, borderRadius: 7, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  swipeWrap: {
    position: 'relative',
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  swipeActions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 120,
    flexDirection: 'row',
  },
  swipeActionBtn: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  swipeActionTxt: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  swipeOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },

  empty:     { alignItems: 'center', paddingVertical: 50, gap: 12 },
  emptyTxt:  { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  emptySub:  { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  emptyBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.primary, marginTop: 6 },
  emptyBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },

  fabWrap:   { position: 'fixed', bottom: 80, right: 20, zIndex: 999, pointerEvents: 'box-none' },
  fab:       { width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8 },
});
