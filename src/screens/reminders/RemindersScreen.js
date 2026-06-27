import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Pressable, ActivityIndicator,
  useWindowDimensions, RefreshControl, Animated, PanResponder, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import api from '@services/api';
import { useAuthStore } from '@store/authStore';

// Icon + color choices offered when creating/editing a category master
const ICON_CHOICES = [
  'receipt-outline', 'shield-checkmark-outline', 'flash-outline', 'business-outline',
  'umbrella-outline', 'card-outline', 'document-text-outline', 'pricetag-outline',
  'cash-outline', 'calendar-outline', 'cube-outline', 'people-outline',
  'car-outline', 'construct-outline', 'megaphone-outline', 'create-outline',
];
const COLOR_CHOICES = [
  '#7C3AED', '#C2410C', '#D97706', '#0369A1', '#15803D', '#1D4ED8',
  '#BE185D', '#DC2626', '#0891B2', '#4D7C0F', '#9333EA', '#475569',
];

// Fallback used only until the masters load from the API.
// Real categories/presets are managed in the DB (reminder_categories / reminder_presets).
const FALLBACK_CATEGORIES = [
  { label: 'Custom', icon: 'create-outline', color: '#475569', presets: [] },
];

const REPEAT_OPTIONS = [
  { value: 'none',    label: 'No repeat',  icon: 'remove-circle-outline' },
  { value: 'daily',   label: 'Daily',      icon: 'sunny-outline' },
  { value: 'weekly',  label: 'Weekly',     icon: 'calendar-outline' },
  { value: 'monthly', label: 'Monthly',    icon: 'repeat-outline' },
  { value: 'yearly',  label: 'Yearly',     icon: 'refresh-outline' },
];

const REPEAT_COLOR = {
  none: '#94A3B8', daily: '#1D4ED8', weekly: '#7C3AED',
  monthly: '#C2410C', yearly: '#15803D',
};

// Native web date/time input — shows a calendar/clock icon and allows manual typing.
const WEB_DATE_STYLE = {
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
};

// ── Form Modal ────────────────────────────────────────────────────────────────
function ReminderFormModal({ visible, onClose, onSave, editing, categories, isAdmin, staff }) {
  const CATS = categories && categories.length ? categories : FALLBACK_CATEGORIES;
  const [selCat, setSelCat]         = useState(null);
  const [catDropOpen, setCatDropOpen] = useState(false);
  const [catText, setCatText]       = useState('');
  const [title, setTitle]           = useState('');
  const [note, setNote]             = useState('');
  const [date, setDate]             = useState('');
  const [time, setTime]             = useState('');
  const [repeat, setRepeat]         = useState('none');
  const [assignedTo, setAssignedTo] = useState(null);
  const [assignDropOpen, setAssignDropOpen] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  React.useEffect(() => {
    if (visible) {
      if (editing) {
        const ec = getCatForTitle(editing.title, CATS);
        setSelCat(ec);
        setCatText(ec?.label || '');
        setTitle(editing.title || '');
        setNote(editing.note || '');
        const dt = editing.remind_at ? dayjs(editing.remind_at) : dayjs();
        setDate(dt.format('YYYY-MM-DD'));
        setTime(dt.format('HH:mm'));
        setRepeat(editing.repeat_type || 'none');
        setAssignedTo(editing.assigned_to || null);
      } else {
        setSelCat(null);
        setCatText('');
        setTitle(''); setNote('');
        setDate(dayjs().format('YYYY-MM-DD'));
        setTime('10:00');
        setRepeat('none');
        setAssignedTo(null);
      }
      setCatDropOpen(false);
      setAssignDropOpen(false);
      setError('');
    }
  }, [visible, editing]);

  const pickCategory = (cat) => {
    setSelCat(cat);
    setCatText(cat.label);
    setCatDropOpen(false);
    if (cat.presets.length > 0) {
      setTitle(cat.presets[0].title);
      setNote(cat.presets[0].note || '');
      setRepeat(cat.presets[0].repeat || 'none');
    } else {
      setTitle(''); setNote(''); setRepeat('none');
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!date)         { setError('Date is required.'); return; }
    if (!time)         { setError('Time is required.'); return; }
    setSaving(true); setError('');
    try {
      const remind_at = `${date} ${time}:00`;
      const payload = { title: title.trim(), note: note.trim(), remind_at, repeat_type: repeat };
      if (isAdmin) payload.assigned_to = assignedTo || null;
      await onSave(payload);
      onClose();
    } catch (e) {
      setError(e?.error || e?.message || 'Failed to save.');
    } finally { setSaving(false); }
  };

  const catColor = selCat?.color || Colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={fm.overlay} onPress={onClose}>
        <Pressable style={fm.card} onPress={e => e.stopPropagation?.()}>

          {/* Header */}
          <View style={fm.header}>
            {selCat && (
              <View style={[fm.catIcon, { backgroundColor: catColor + '18', marginRight: 8 }]}>
                <Ionicons name={selCat.icon} size={14} color={catColor} />
              </View>
            )}
            <Text style={[fm.title, { flex: 1 }]}>{editing ? 'Edit Reminder' : 'New Reminder'}</Text>
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

          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>

            {/* Category selector */}
            <Text style={fm.label}>Category</Text>
            <View style={fm.catWrap}>
              <View style={[fm.input, fm.catSelector, selCat && { borderColor: catColor + '80' }]}>
                {selCat && (
                  <View style={[fm.catIcon, { backgroundColor: catColor + '18', marginRight: 8 }]}>
                    <Ionicons name={selCat.icon} size={14} color={catColor} />
                  </View>
                )}
                <TextInput
                  style={[fm.catTextInput, selCat && { color: catColor, fontWeight: '700' }]}
                  placeholder="Select or type a category…"
                  placeholderTextColor="#94A3B8"
                  value={catText}
                  onChangeText={(t) => {
                    setCatText(t);
                    setSelCat(null);
                    setCatDropOpen(true);
                  }}
                  onFocus={() => setCatDropOpen(true)}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {(selCat || catText.length > 0) && (
                    <TouchableOpacity
                      onPress={() => { setSelCat(null); setCatText(''); setCatDropOpen(false); }}
                      style={fm.catClearBtn}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close" size={13} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setCatDropOpen(v => !v)}>
                    <Ionicons name={catDropOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>

              {catDropOpen && (
                <View style={fm.catDropdown}>
                  <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    {CATS.filter(cat =>
                      !catText || cat.label.toLowerCase().includes(catText.toLowerCase())
                    ).map(cat => (
                      <TouchableOpacity
                        key={cat.label}
                        style={[fm.catDropItem, selCat?.label === cat.label && { backgroundColor: cat.color + '12' }]}
                        onPress={() => pickCategory(cat)}
                      >
                        <View style={[fm.catIcon, { backgroundColor: cat.color + '18' }]}>
                          <Ionicons name={cat.icon} size={14} color={cat.color} />
                        </View>
                        <Text style={[fm.catDropTxt, { color: cat.color }]}>{cat.label}</Text>
                        {selCat?.label === cat.label && (
                          <Ionicons name="checkmark" size={14} color={cat.color} style={{ marginLeft: 'auto' }} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>


            {/* Preset suggestions for selected category */}
            {selCat && selCat.presets.length > 0 && (
              <>
                <Text style={fm.label}>Quick select</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 2 }}>
                    {selCat.presets.map((preset, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[fm.presetChip, title === preset.title && { borderColor: catColor, backgroundColor: catColor + '12' }]}
                        onPress={() => { setTitle(preset.title); setNote(preset.note || ''); setRepeat(preset.repeat || 'none'); }}
                      >
                        <Text style={[fm.presetChipTxt, title === preset.title && { color: catColor, fontWeight: '700' }]} numberOfLines={1}>
                          {preset.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            <Text style={fm.label}>Title *</Text>
            <TextInput style={fm.input} placeholder="e.g. GST Return Filing or write your own"
              placeholderTextColor="#94A3B8" value={title} onChangeText={setTitle} />

            <Text style={fm.label}>Note (optional)</Text>
            <TextInput style={[fm.input, { height: 60, textAlignVertical: 'top', paddingTop: 8 }]}
              placeholder="Additional details…" placeholderTextColor="#94A3B8"
              value={note} onChangeText={setNote} multiline />

            <View style={fm.row}>
              <View style={{ flex: 1 }}>
                <Text style={fm.label}>Due date *</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={WEB_DATE_STYLE}
                  />
                ) : (
                  <TextInput style={fm.input} placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8" value={date} onChangeText={setDate} />
                )}
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={fm.label}>Time *</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    style={WEB_DATE_STYLE}
                  />
                ) : (
                  <TextInput style={fm.input} placeholder="HH:MM"
                    placeholderTextColor="#94A3B8" value={time} onChangeText={setTime} />
                )}
              </View>
            </View>

            <Text style={fm.label}>Repeat</Text>
            <View style={fm.repeatGrid}>
              {REPEAT_OPTIONS.map(r => (
                <TouchableOpacity
                  key={r.value}
                  style={[fm.repeatBtn, repeat === r.value && { borderColor: REPEAT_COLOR[r.value], backgroundColor: REPEAT_COLOR[r.value] + '15' }]}
                  onPress={() => setRepeat(r.value)}
                >
                  <Ionicons name={r.icon} size={14} color={repeat === r.value ? REPEAT_COLOR[r.value] : '#94A3B8'} />
                  <Text style={[fm.repeatTxt, repeat === r.value && { color: REPEAT_COLOR[r.value], fontWeight: '700' }]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Assign to user (admin only) */}
            {isAdmin && (
              <>
                <Text style={fm.label}>Assign to (optional)</Text>
                <View style={fm.assignWrap}>
                  <TouchableOpacity
                    style={[fm.input, fm.catSelector]}
                    onPress={() => setAssignDropOpen(v => !v)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Ionicons name="person-outline" size={14} color={assignedTo ? Colors.primary : '#94A3B8'} />
                      <Text style={[{ fontSize: 13, color: '#94A3B8' }, assignedTo && { color: '#0F172A', fontWeight: '600' }]}>
                        {assignedTo
                          ? (staff.find(u => String(u.id) === String(assignedTo))?.name || 'Selected user')
                          : 'No one (personal reminder)'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {assignedTo && (
                        <TouchableOpacity onPress={() => setAssignedTo(null)} style={fm.catClearBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Ionicons name="close" size={13} color="#94A3B8" />
                        </TouchableOpacity>
                      )}
                      <Ionicons name={assignDropOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
                    </View>
                  </TouchableOpacity>

                  {assignDropOpen && (
                    <View style={fm.catDropdown}>
                      <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator nestedScrollEnabled>
                        {staff.length === 0 && (
                          <Text style={{ fontSize: 12, color: '#94A3B8', padding: 12 }}>No users found.</Text>
                        )}
                        {staff.map(u => (
                          <TouchableOpacity
                            key={u.id}
                            style={[fm.catDropItem, String(assignedTo) === String(u.id) && { backgroundColor: Colors.primary + '10' }]}
                            onPress={() => { setAssignedTo(u.id); setAssignDropOpen(false); }}
                          >
                            <Ionicons name="person-circle-outline" size={18} color="#64748B" />
                            <Text style={[fm.catDropTxt, { color: '#0F172A' }]}>{u.name}</Text>
                            {String(assignedTo) === String(u.id) && (
                              <Ionicons name="checkmark" size={14} color={Colors.primary} style={{ marginLeft: 'auto' }} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
                {assignedTo && (
                  <Text style={fm.assignHint}>
                    A task will be created for this user, and they'll be notified one day before the due date.
                  </Text>
                )}
              </>
            )}
          </ScrollView>

          <View style={fm.footer}>
            <TouchableOpacity style={fm.cancelBtn} onPress={onClose}>
              <Text style={fm.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[fm.saveBtn, { backgroundColor: catColor }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={fm.saveTxt}>{editing ? 'Update' : 'Save'}</Text>}
            </TouchableOpacity>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const fm = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  card:       { backgroundColor: '#fff', borderRadius: 18, width: '100%', maxWidth: 520, padding: 20, alignSelf: 'center' },
  header:     { flexDirection: 'row', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 12 },
  title:      { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  closeBtn:   { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  backBtn:    { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  catIcon:    { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  catWrap:            { position: 'relative', zIndex: 100 },
  catSelector:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catSelectorInner:   { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  catSelectorTxt:     { fontSize: 13, color: '#0F172A' },
  catSelectorPlaceholder: { fontSize: 13, color: '#94A3B8', flex: 1 },
  catDropdown:        { position: 'absolute', top: '100%', left: 0, right: 0, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, backgroundColor: '#fff', zIndex: 200, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 8, marginTop: 2 },
  catDropItem:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  catDropTxt:         { fontSize: 13, fontWeight: '600' },
  catClearBtn:        { width: 20, height: 20, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  catTextInput:       { flex: 1, fontSize: 13, color: '#0F172A', outlineStyle: 'none', paddingVertical: 0 },

  presetChip:         { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', maxWidth: 180 },
  presetChipTxt:      { fontSize: 12, color: '#64748B', fontWeight: '500' },

  assignWrap:         { position: 'relative', zIndex: 90 },
  assignHint:         { fontSize: 11, color: '#15803D', marginTop: 6, lineHeight: 15 },

  errBox:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 10 },
  errTxt:     { fontSize: 12, color: '#DC2626', flex: 1 },
  label:      { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 12 },
  input:      { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#0F172A', backgroundColor: '#FAFAFA', outlineStyle: 'none' },
  row:        { flexDirection: 'row' },
  repeatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 4 },
  repeatBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  repeatTxt:  { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  footer:     { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  cancelBtn:  { paddingVertical: 9, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  cancelTxt:  { fontSize: 13, fontWeight: '600', color: '#64748B' },
  saveBtn:    { paddingVertical: 9, paddingHorizontal: 22, borderRadius: 10, backgroundColor: Colors.primary },
  saveTxt:    { fontSize: 13, fontWeight: '700', color: '#fff' },
});

// Swipeable card component for mobile reminders
function SwipeableReminderCard({ reminder, onEdit, onDelete, children }) {
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
          onPress={() => { close(); onEdit(reminder); }}
        >
          <Ionicons name="pencil-outline" size={16} color="#fff" />
          <Text style={s.swipeActionTxt}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[s.swipeActionBtn, { backgroundColor: '#EF4444' }]} 
          onPress={() => { close(); onDelete(reminder.id); }}
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

// Auto-pick an icon by matching keywords in the category name; falls back to rotation.
const ICON_KEYWORDS = [
  [['tax', 'gst', 'tds', 'invoice', 'bill', 'receipt'], 'receipt-outline'],
  [['compliance', 'duty', 'duties', 'legal', 'audit', 'pf', 'esi'], 'shield-checkmark-outline'],
  [['electric', 'power', 'utility', 'energy'], 'flash-outline'],
  [['rent', 'lease', 'office', 'property', 'building', 'warehouse'], 'business-outline'],
  [['insurance', 'policy', 'cover'], 'umbrella-outline'],
  [['bank', 'finance', 'loan', 'emi', 'credit', 'payment', 'salary', 'cash'], 'card-outline'],
  [['licence', 'license', 'renewal', 'certificate', 'permit', 'doc'], 'document-text-outline'],
  [['vehicle', 'car', 'transport', 'fuel'], 'car-outline'],
  [['maintenance', 'repair', 'service', 'equipment'], 'construct-outline'],
  [['marketing', 'ad', 'promo', 'campaign'], 'megaphone-outline'],
  [['staff', 'employee', 'hr', 'team', 'people'], 'people-outline'],
  [['stock', 'inventory', 'item', 'product', 'goods'], 'cube-outline'],
];
function autoPickIcon(label, existingCount) {
  const l = (label || '').toLowerCase();
  for (const [keys, icon] of ICON_KEYWORDS) {
    if (keys.some(k => l.includes(k))) return icon;
  }
  return ICON_CHOICES[existingCount % ICON_CHOICES.length];
}
function autoPickColor(existingCount) {
  return COLOR_CHOICES[existingCount % COLOR_CHOICES.length];
}

// ── Manage Categories & Presets (master) ──────────────────────────────────────
function ManageCategoriesModal({ visible, onClose, categories, onChanged }) {
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null); // category id whose presets are open

  // Category editor state
  const [catForm, setCatForm] = useState(null); // { id?, label, icon, color }
  // Preset editor state
  const [presetForm, setPresetForm] = useState(null); // { id?, category_id, title, note, repeat_type }

  const scrollRef = useRef(null);

  React.useEffect(() => {
    if (visible) { setError(''); setCatForm(null); setPresetForm(null); setExpanded(null); }
  }, [visible]);

  // When a sub-form opens, scroll to the bottom so it's visible
  React.useEffect(() => {
    if (catForm || presetForm) {
      setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 50);
    }
  }, [catForm, presetForm]);

  const run = async (fn) => {
    setBusy(true); setError('');
    try { await fn(); await onChanged(); }
    catch (e) { setError(e?.error || e?.message || 'Operation failed.'); }
    finally { setBusy(false); }
  };

  const saveCategory = () => {
    const label = catForm?.label?.trim();
    if (!label) { setError('Category name is required.'); return; }
    run(async () => {
      if (catForm.id) {
        // editing — keep existing icon/colour, only update the name
        await api.put(`/reminder-masters/categories/${catForm.id}`, { label });
      } else {
        // creating — auto-assign icon (keyword-matched) & colour
        const count = (categories || []).filter(c => c.id != null).length;
        await api.post('/reminder-masters/categories', {
          label,
          icon:  autoPickIcon(label, count),
          color: autoPickColor(count),
        });
      }
      setCatForm(null);
    });
  };

  const deleteCategory = (cat) => {
    if (!confirm(`Delete category "${cat.label}" and all its quick-select presets?`)) return;
    run(async () => { await api.delete(`/reminder-masters/categories/${cat.id}`); });
  };

  const savePreset = () => {
    if (!presetForm?.title?.trim()) { setError('Preset title is required.'); return; }
    run(async () => {
      const body = { title: presetForm.title.trim(), note: presetForm.note, repeat_type: presetForm.repeat_type, category_id: presetForm.category_id };
      if (presetForm.id) await api.put(`/reminder-masters/presets/${presetForm.id}`, body);
      else               await api.post('/reminder-masters/presets', body);
      setPresetForm(null);
    });
  };

  const deletePreset = (preset) => {
    if (!confirm(`Delete quick-select "${preset.title}"?`)) return;
    run(async () => { await api.delete(`/reminder-masters/presets/${preset.id}`); });
  };

  // Only real DB categories have numeric ids; fallback "Custom" has none
  const dbCats = (categories || []).filter(c => c.id != null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={fm.overlay} onPress={onClose}>
        <Pressable style={[fm.card, { maxWidth: 560, maxHeight: '90%' }]} onPress={e => e.stopPropagation?.()}>
          <View style={fm.header}>
            <View style={[fm.catIcon, { backgroundColor: Colors.primary + '18', marginRight: 8 }]}>
              <Ionicons name="settings-outline" size={14} color={Colors.primary} />
            </View>
            <Text style={[fm.title, { flex: 1 }]}>Manage Categories & Quick-Select</Text>
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

          <ScrollView ref={scrollRef} style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 4 }} showsVerticalScrollIndicator>
            {dbCats.map(cat => (
              <View key={cat.id} style={mc.catRow}>
                <View style={mc.catHead}>
                  <View style={[fm.catIcon, { backgroundColor: cat.color + '18' }]}>
                    <Ionicons name={cat.icon} size={14} color={cat.color} />
                  </View>
                  <Text style={[mc.catLabel, { color: cat.color }]}>{cat.label}</Text>
                  <Text style={mc.presetCount}>{(cat.presets || []).length}</Text>
                  <TouchableOpacity style={mc.iconBtn} onPress={() => setExpanded(expanded === cat.id ? null : cat.id)}>
                    <Ionicons name={expanded === cat.id ? 'chevron-up' : 'chevron-down'} size={15} color="#64748B" />
                  </TouchableOpacity>
                  <TouchableOpacity style={mc.iconBtn} onPress={() => setCatForm({ id: cat.id, label: cat.label, icon: cat.icon, color: cat.color })}>
                    <Ionicons name="pencil-outline" size={14} color="#1D4ED8" />
                  </TouchableOpacity>
                  <TouchableOpacity style={mc.iconBtn} onPress={() => deleteCategory(cat)}>
                    <Ionicons name="trash-outline" size={14} color="#DC2626" />
                  </TouchableOpacity>
                </View>

                {expanded === cat.id && (
                  <View style={mc.presetWrap}>
                    {(cat.presets || []).map(p => (
                      <View key={p.id} style={mc.presetRow}>
                        <Ionicons name="ellipse" size={6} color={cat.color} style={{ marginRight: 6 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={mc.presetTitle} numberOfLines={1}>{p.title}</Text>
                          {!!p.note && <Text style={mc.presetNote} numberOfLines={1}>{p.note}</Text>}
                        </View>
                        <Text style={mc.repeatTag}>{p.repeat_type !== 'none' ? p.repeat_type : ''}</Text>
                        <TouchableOpacity style={mc.iconBtn} onPress={() => setPresetForm({ id: p.id, category_id: cat.id, title: p.title, note: p.note || '', repeat_type: p.repeat_type || 'none' })}>
                          <Ionicons name="pencil-outline" size={13} color="#1D4ED8" />
                        </TouchableOpacity>
                        <TouchableOpacity style={mc.iconBtn} onPress={() => deletePreset(p)}>
                          <Ionicons name="trash-outline" size={13} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity style={mc.addPresetBtn} onPress={() => setPresetForm({ category_id: cat.id, title: '', note: '', repeat_type: 'none' })}>
                      <Ionicons name="add" size={14} color={Colors.primary} />
                      <Text style={mc.addPresetTxt}>Add quick-select</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity style={mc.addCatBtn} onPress={() => setCatForm({ label: '' })}>
              <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
              <Text style={mc.addCatTxt}>Add Category</Text>
            </TouchableOpacity>

          {/* Category sub-form */}
          {catForm && (
            <View style={mc.subForm}>
              <View style={mc.subHead}>
                <Text style={[mc.subTitle, { flex: 1, marginBottom: 0 }]}>{catForm.id ? 'Edit Category' : 'New Category'}</Text>
                <TouchableOpacity onPress={() => setCatForm(null)} style={mc.subClose} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
              <TextInput style={fm.input} placeholder="Category name" placeholderTextColor="#94A3B8"
                value={catForm.label} onChangeText={t => setCatForm(f => ({ ...f, label: t }))} />
              <View style={mc.subActions}>
                <TouchableOpacity style={fm.cancelBtn} onPress={() => setCatForm(null)}><Text style={fm.cancelTxt}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[fm.saveBtn, busy && { opacity: 0.6 }]} onPress={saveCategory} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={fm.saveTxt}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Preset sub-form */}
          {presetForm && (
            <View style={mc.subForm}>
              <View style={mc.subHead}>
                <Text style={[mc.subTitle, { flex: 1, marginBottom: 0 }]}>{presetForm.id ? 'Edit Quick-Select' : 'New Quick-Select'}</Text>
                <TouchableOpacity onPress={() => setPresetForm(null)} style={mc.subClose} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
              <TextInput style={fm.input} placeholder="Title (e.g. GST Return Filing)" placeholderTextColor="#94A3B8"
                value={presetForm.title} onChangeText={t => setPresetForm(f => ({ ...f, title: t }))} />
              <TextInput style={[fm.input, { marginTop: 8 }]} placeholder="Note (optional)" placeholderTextColor="#94A3B8"
                value={presetForm.note} onChangeText={t => setPresetForm(f => ({ ...f, note: t }))} />
              <Text style={mc.pickLabel}>Default repeat</Text>
              <View style={fm.repeatGrid}>
                {REPEAT_OPTIONS.map(r => (
                  <TouchableOpacity key={r.value}
                    style={[fm.repeatBtn, presetForm.repeat_type === r.value && { borderColor: REPEAT_COLOR[r.value], backgroundColor: REPEAT_COLOR[r.value] + '15' }]}
                    onPress={() => setPresetForm(f => ({ ...f, repeat_type: r.value }))}>
                    <Ionicons name={r.icon} size={13} color={presetForm.repeat_type === r.value ? REPEAT_COLOR[r.value] : '#94A3B8'} />
                    <Text style={[fm.repeatTxt, presetForm.repeat_type === r.value && { color: REPEAT_COLOR[r.value], fontWeight: '700' }]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={mc.subActions}>
                <TouchableOpacity style={fm.cancelBtn} onPress={() => setPresetForm(null)}><Text style={fm.cancelTxt}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[fm.saveBtn, busy && { opacity: 0.6 }]} onPress={savePreset} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={fm.saveTxt}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const mc = StyleSheet.create({
  catRow:       { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  catHead:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#FAFBFC' },
  catLabel:     { fontSize: 13, fontWeight: '700', flex: 1 },
  presetCount:  { fontSize: 11, color: '#94A3B8', fontWeight: '600', backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  iconBtn:      { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  presetWrap:   { padding: 8, gap: 4, backgroundColor: '#fff' },
  presetRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#F5F6F8' },
  presetTitle:  { fontSize: 12, fontWeight: '600', color: '#1E293B' },
  presetNote:   { fontSize: 10, color: '#94A3B8' },
  repeatTag:    { fontSize: 10, color: '#94A3B8', fontStyle: 'italic', marginRight: 4 },
  addPresetBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 6 },
  addPresetTxt: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  addCatBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.primary + '60', marginTop: 4, marginBottom: 4 },
  addCatTxt:    { fontSize: 13, fontWeight: '700', color: Colors.primary },
  subForm:      { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 12, paddingTop: 12 },
  subHead:      { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  subClose:     { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  subTitle:     { fontSize: 12, fontWeight: '800', color: '#1E293B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  pickLabel:    { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 6 },
  subActions:   { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
const REPEAT_LABEL = { none: '', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };

// Map a reminder title back to its category for the icon/color on cards
function getCatForTitle(title, cats) {
  const list = cats && cats.length ? cats : FALLBACK_CATEGORIES;
  for (const cat of list) {
    if ((cat.presets || []).some(p => p.title === title)) return cat;
  }
  return list[list.length - 1]; // last = Custom fallback
}

export default function RemindersScreen({ navigation }) {
  const { width }   = useWindowDimensions();
  const isMobile    = width < 768;
  const showSwipe   = isMobile;
  const showInlineActions = !isMobile;

  const role        = useAuthStore(s => s.role);
  const isAdmin     = role === 'admin';

  const [reminders, setReminders]     = useState([]);
  const [categories, setCategories]   = useState(FALLBACK_CATEGORIES);
  const [staff, setStaff]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [manageVisible, setManageVisible] = useState(false);
  const [editing, setEditing]         = useState(null);
  const [filter, setFilter]           = useState('upcoming');
  const [search, setSearch]           = useState('');
  const [filterOpen, setFilterOpen]   = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const data = await api.get('/reminder-masters');
      if (Array.isArray(data) && data.length) {
        // normalise preset note: backend stores null, form expects string
        setCategories(data.map(c => ({ ...c, presets: (c.presets || []).map(p => ({ ...p, note: p.note || '', repeat: p.repeat_type })) })));
      }
    } catch { /* keep fallback */ }
  }, []);

  const loadStaff = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await api.get('/staff');
      setStaff(Array.isArray(data) ? data.filter(u => u.status !== 'inactive') : []);
    } catch { /* ignore */ }
  }, [isAdmin]);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/reminders');
      setReminders(Array.isArray(data) ? data : []);
    } catch { setReminders([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); loadCategories(); loadStaff(); }, [load, loadCategories, loadStaff]));

  const handleSave = async (payload) => {
    if (editing) {
      await api.put(`/reminders/${editing.id}`, payload);
    } else {
      await api.post('/reminders', payload);
    }
    setEditing(null);
    load();
  };

  const handleDone = async (r) => {
    await api.put(`/reminders/${r.id}`, { is_done: !r.is_done });
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this reminder?')) return;
    await api.delete(`/reminders/${id}`);
    load();
  };

  const now = dayjs();
  const filtered = reminders.filter(r => {
    if (filter === 'upcoming') return !r.is_done;
    if (filter === 'done')     return !!r.is_done;
    return true;
  }).filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.title.toLowerCase().includes(q) || (r.note || '').toLowerCase().includes(q);
  });

  const groups = { Overdue: [], Today: [], 'This Week': [], Later: [], Done: [] };
  filtered.forEach(r => {
    if (r.is_done) { groups.Done.push(r); return; }
    const dt = dayjs(r.next_trigger || r.remind_at);
    if (dt.isBefore(now, 'minute'))          groups.Overdue.push(r);
    else if (dt.isSame(now, 'day'))          groups.Today.push(r);
    else if (dt.isBefore(now.add(7, 'day'))) groups['This Week'].push(r);
    else                                     groups.Later.push(r);
  });

  // Reminders is an admin-only feature. Block direct/deep-link access by non-admins.
  if (!isAdmin) {
    return (
      <View style={s.screen}>
        <Navbar navigation={navigation} activeTab="Reminders" />
        <View style={[s.empty, { paddingVertical: 80 }]}>
          <View style={s.emptyIconBox}>
            <Ionicons name="lock-closed-outline" size={44} color="#C0392B" />
          </View>
          <Text style={s.emptyTxt}>Admins only</Text>
          <Text style={s.emptySub}>You don't have access to Reminders.{'\n'}Assigned items appear in your Tasks tab.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <Navbar navigation={navigation} activeTab="Reminders" />

      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Colors.primary]} />}
      >


        {/* Search + Filter row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, position: 'relative', zIndex: 50 }}>
          <View style={s.searchRow}>
            <Ionicons name="search-outline" size={15} color="#94A3B8" />
            <TextInput
              style={s.searchInput}
              placeholder="Search reminders…"
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
          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              style={[s.filterBtn, filterOpen && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
              onPress={() => setFilterOpen(o => !o)}
            >
              <Ionicons name="options-outline" size={16} color={filterOpen ? '#fff' : '#64748B'} />
              {filter !== 'all' && <View style={s.filterDot} />}
            </TouchableOpacity>

            {filterOpen && (
              <View style={s.filterDropdown}>
                {[['upcoming','Upcoming'],['done','Done'],['all','All']].map(([val, lbl]) => (
                  <TouchableOpacity
                    key={val}
                    style={[s.filterDropItem, filter === val && s.filterDropItemActive]}
                    onPress={() => { setFilter(val); setFilterOpen(false); }}
                  >
                    <Ionicons
                      name={val === 'upcoming' ? 'time-outline' : val === 'done' ? 'checkmark-circle-outline' : 'list-outline'}
                      size={14}
                      color={filter === val ? Colors.primary : '#64748B'}
                    />
                    <Text style={[s.filterDropTxt, filter === val && s.filterDropTxtActive]}>{lbl}</Text>
                    {filter === val && <Ionicons name="checkmark" size={13} color={Colors.primary} style={{ marginLeft: 'auto' }} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {isAdmin && (
            <TouchableOpacity style={s.manageBtn} onPress={() => setManageVisible(true)}>
              <Ionicons name="settings-outline" size={16} color="#475569" />
              {!isMobile && <Text style={s.manageBtnTxt}>Manage</Text>}
            </TouchableOpacity>
          )}

          {!isMobile && (
            <TouchableOpacity style={s.newBtn} onPress={() => { setEditing(null); setFormVisible(true); }}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={s.newBtnTxt}>New Reminder</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={[s.empty, isMobile && s.emptyMobile]}>
            <View style={s.emptyIconBox}>
              <Ionicons name="alarm-outline" size={isMobile ? 40 : 48} color="#C0392B" />
            </View>
            <Text style={s.emptyTxt}>No reminders yet</Text>
            <Text style={s.emptySub}>Add reminders for GST returns,{'\n'}bills, duties, licences & more</Text>
            {!isMobile && (
              <TouchableOpacity style={s.emptyBtn} onPress={() => { setEditing(null); setFormVisible(true); }}>
                <Ionicons name="add" size={15} color="#fff" />
                <Text style={s.emptyBtnTxt}>Create Reminder</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          Object.entries(groups).map(([groupName, items]) => {
            if (!items.length) return null;
            const isOverdue = groupName === 'Overdue';
            const isDone    = groupName === 'Done';
            return (
              <View key={groupName} style={s.group}>
                <View style={s.groupHeader}>
                  <View style={[s.groupDot, { backgroundColor: isOverdue ? '#DC2626' : isDone ? '#94A3B8' : Colors.primary }]} />
                  <Text style={[s.groupTitle, isOverdue && { color: '#DC2626' }]}>{groupName}</Text>
                  <Text style={s.groupCount}>{items.length}</Text>
                </View>

                {items.map(r => {
                  const dt       = dayjs(r.next_trigger || r.remind_at);
                  const repColor = REPEAT_COLOR[r.repeat_type] || '#94A3B8';
                  const repLabel = REPEAT_LABEL[r.repeat_type];
                  const cat      = getCatForTitle(r.title, categories);
                  const accentColor = r.is_done ? '#94A3B8' : isOverdue ? '#DC2626' : cat.color;

                  const renderCardContent = () => (
                    <View style={[s.card, { marginBottom: showSwipe ? 0 : 8 }, r.is_done && s.cardDone, isOverdue && s.cardOverdue]}>
                      {/* Left accent bar */}
                      <View style={[s.cardAccent, { backgroundColor: accentColor }]} />

                      {/* Category icon / done toggle */}
                      <TouchableOpacity onPress={() => handleDone(r)} style={s.catIconWrap}>
                        {r.is_done ? (
                          <Ionicons name="checkmark-circle" size={32} color="#16A34A" />
                        ) : (
                          <View style={[s.cardCatIcon, { backgroundColor: accentColor + '18' }]}>
                            <Ionicons name={cat.icon} size={17} color={accentColor} />
                          </View>
                        )}
                      </TouchableOpacity>

                      {/* Content */}
                      <View style={s.cardBody}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <Text style={[s.cardTitle, r.is_done && s.cardTitleDone]} numberOfLines={1}>{r.title}</Text>
                          {r.is_done ? (
                            <View style={[s.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                              <Ionicons name="checkmark-circle" size={10} color="#16A34A" />
                              <Text style={[s.statusBadgeTxt, { color: '#16A34A' }]}>Completed</Text>
                            </View>
                          ) : isOverdue ? (
                            <View style={s.overdueBadge}>
                              <Text style={s.overdueBadgeTxt}>Overdue</Text>
                            </View>
                          ) : r.task_created ? (
                            <View style={[s.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                              <Ionicons name="hourglass-outline" size={10} color="#B45309" />
                              <Text style={[s.statusBadgeTxt, { color: '#B45309' }]}>Task sent</Text>
                            </View>
                          ) : (
                            <View style={[s.statusBadge, { backgroundColor: '#E0E7FF' }]}>
                              <Ionicons name="time-outline" size={10} color="#4338CA" />
                              <Text style={[s.statusBadgeTxt, { color: '#4338CA' }]}>Pending</Text>
                            </View>
                          )}
                        </View>
                        {!!r.note && <Text style={s.cardNote} numberOfLines={1}>{r.note}</Text>}
                        <View style={s.cardMeta}>
                          <Ionicons name="calendar-outline" size={11} color={isOverdue ? '#DC2626' : '#94A3B8'} />
                          <Text style={[s.cardTime, isOverdue && { color: '#DC2626', fontWeight: '600' }]}>
                            {dt.format('DD MMM YYYY')}
                          </Text>
                          <Text style={{ color: '#CBD5E1', fontSize: 10 }}>·</Text>
                          <Ionicons name="time-outline" size={11} color={isOverdue ? '#DC2626' : '#94A3B8'} />
                          <Text style={[s.cardTime, isOverdue && { color: '#DC2626', fontWeight: '600' }]}>
                            {dt.format('hh:mm A')}
                          </Text>
                          {!!repLabel && (
                            <View style={[s.repeatBadge, { backgroundColor: repColor + '18' }]}>
                              <Ionicons name="repeat-outline" size={10} color={repColor} />
                              <Text style={[s.repeatBadgeTxt, { color: repColor }]}>{repLabel}</Text>
                            </View>
                          )}
                          {!!r.assignee_name && (
                            <View style={s.assigneeBadge}>
                              <Ionicons name="person-outline" size={10} color="#1D4ED8" />
                              <Text style={s.assigneeBadgeTxt}>{r.assignee_name}</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Actions */}
                      {showInlineActions && (
                        <View style={s.cardActions}>
                          <TouchableOpacity style={s.editBtn} onPress={() => { setEditing(r); setFormVisible(true); }}>
                            <Ionicons name="pencil-outline" size={14} color="#1D4ED8" />
                          </TouchableOpacity>
                          <TouchableOpacity style={s.delBtn} onPress={() => handleDelete(r.id)}>
                            <Ionicons name="trash-outline" size={14} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );

                  if (showSwipe) {
                    return (
                      <SwipeableReminderCard
                        key={r.id}
                        reminder={r}
                        onEdit={() => { setEditing(r); setFormVisible(true); }}
                        onDelete={handleDelete}
                      >
                        {renderCardContent()}
                      </SwipeableReminderCard>
                    );
                  }

                  return renderCardContent();
                })}
              </View>
            );
          })
        )}
      </ScrollView>

      {isMobile && (
        <View style={s.fabWrap}>
          <TouchableOpacity style={s.fab} onPress={() => { setEditing(null); setFormVisible(true); }}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <ReminderFormModal
        visible={formVisible}
        onClose={() => { setFormVisible(false); setEditing(null); }}
        onSave={handleSave}
        editing={editing}
        categories={categories}
        isAdmin={isAdmin}
        staff={staff}
      />

      <ManageCategoriesModal
        visible={manageVisible}
        onClose={() => setManageVisible(false)}
        categories={categories}
        onChanged={loadCategories}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },
  container:   { flex: 1, width: '100%' },
  content:     { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 90 },

  pageHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  pageTitle:   { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  pageSub:     { fontSize: 12, color: '#64748B', marginTop: 2 },
  newBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  manageBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, height: 40, borderRadius: 10, justifyContent: 'center' },
  manageBtnTxt:{ fontSize: 13, fontWeight: '700', color: '#475569' },
  fabWrap:     { position: 'fixed', bottom: 80, right: 20, zIndex: 999, pointerEvents: 'box-none' },
  fab:         { width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8 },
  newBtnTxt:   { fontSize: 14, fontWeight: '700', color: '#fff' },

  searchRow:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A', outlineStyle: 'none' },

  filterBtn:   { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  filterDot:   { position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },
  filterDropdown: { position: 'absolute', top: 46, right: 0, width: 160, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 10, zIndex: 999 },
  filterDropItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  filterDropItemActive: { backgroundColor: Colors.primary + '08' },
  filterDropTxt:  { fontSize: 13, color: '#64748B', fontWeight: '600', flex: 1 },
  filterDropTxtActive: { color: Colors.primary, fontWeight: '700' },

  group:       { marginBottom: 20 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  groupDot:    { width: 8, height: 8, borderRadius: 4 },
  groupTitle:  { fontSize: 12, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 },
  groupCount:  { fontSize: 12, color: '#94A3B8', fontWeight: '600' },

  card:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardDone:    { opacity: 0.55, backgroundColor: '#F8FAFC' },
  cardOverdue: { borderColor: '#FCA5A5', backgroundColor: '#FFFAFA' },
  cardAccent:  { width: 4, alignSelf: 'stretch', minHeight: 60 },

  swipeWrap: {
    position: 'relative',
    marginBottom: 8,
    borderRadius: 14,
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

  catIconWrap:   { paddingLeft: 12, paddingRight: 4 },
  cardCatIcon:   { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  cardBody:    { flex: 1, paddingVertical: 12, paddingLeft: 10, paddingRight: 4 },
  cardTitle:   { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  cardTitleDone: { textDecorationLine: 'line-through', color: '#94A3B8' },
  cardNote:    { fontSize: 11, color: '#64748B', marginBottom: 5, lineHeight: 15 },
  cardMeta:    { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 4 },
  cardTime:    { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  repeatBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  repeatBadgeTxt: { fontSize: 10, fontWeight: '700' },
  assigneeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, backgroundColor: '#EFF6FF' },
  assigneeBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },
  overdueBadge:   { backgroundColor: '#FEE2E2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  overdueBadgeTxt:{ fontSize: 10, fontWeight: '700', color: '#DC2626' },
  statusBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  statusBadgeTxt: { fontSize: 10, fontWeight: '700' },

  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 14 },
  editBtn:     { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#DBEAFE' },
  delBtn:      { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  swipeOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },

  empty:       { alignItems: 'center', paddingVertical: 50, gap: 12 },
  emptyMobile: { paddingVertical: 40, marginTop: 10 },
  emptyIconBox:{ width: 80, height: 80, borderRadius: 24, backgroundColor: '#FFF0EF', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTxt:    { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  emptySub:    { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  emptyBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.primary, marginTop: 6 },
  emptyBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
