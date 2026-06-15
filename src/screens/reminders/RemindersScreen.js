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

// ── Business reminder presets ─────────────────────────────────────────────────
const CATEGORIES = [
  {
    label: 'Tax & GST',
    icon: 'receipt-outline',
    color: '#7C3AED',
    presets: [
      { title: 'GST Return Filing (GSTR-1)',    note: 'Monthly GSTR-1 due on 11th',         repeat: 'monthly' },
      { title: 'GST Return Filing (GSTR-3B)',   note: 'Monthly GSTR-3B due on 20th',        repeat: 'monthly' },
      { title: 'GST Annual Return (GSTR-9)',    note: 'Annual GST return filing due 31 Dec', repeat: 'yearly'  },
      { title: 'TDS Payment',                   note: 'TDS deposit due by 7th of month',    repeat: 'monthly' },
      { title: 'Advance Tax Payment',           note: 'Quarterly advance tax installment',  repeat: 'monthly' },
      { title: 'Income Tax Return Filing',      note: 'Annual ITR filing deadline',         repeat: 'yearly'  },
    ],
  },
  {
    label: 'Duties & Compliance',
    icon: 'shield-checkmark-outline',
    color: '#C2410C',
    presets: [
      { title: 'Import/Export Duty Payment',    note: 'Customs duty clearance',             repeat: 'monthly' },
      { title: 'PF / EPF Contribution',         note: 'Employee provident fund due 15th',   repeat: 'monthly' },
      { title: 'ESI Contribution',              note: 'Employee state insurance due 15th',  repeat: 'monthly' },
      { title: 'Professional Tax Payment',      note: 'State professional tax due date',    repeat: 'monthly' },
      { title: 'ROC Annual Filing',             note: 'Annual return filing with ROC',      repeat: 'yearly'  },
      { title: 'Shop Act License Renewal',      note: 'Annual shop & establishment renewal',repeat: 'yearly'  },
    ],
  },
  {
    label: 'Utility Bills',
    icon: 'flash-outline',
    color: '#D97706',
    presets: [
      { title: 'Electricity Bill Payment',      note: 'Monthly electricity bill due',       repeat: 'monthly' },
      { title: 'Water Bill Payment',            note: 'Monthly/quarterly water charges',    repeat: 'monthly' },
      { title: 'Internet / Broadband Bill',     note: 'Monthly broadband bill due',         repeat: 'monthly' },
      { title: 'Telephone / Mobile Bill',       note: 'Monthly phone bill due',             repeat: 'monthly' },
      { title: 'Generator / Fuel Refill',       note: 'Refill diesel/petrol for generator', repeat: 'monthly' },
    ],
  },
  {
    label: 'Rent & Lease',
    icon: 'business-outline',
    color: '#0369A1',
    presets: [
      { title: 'Office Rent Payment',           note: 'Monthly office/shop rent due',       repeat: 'monthly' },
      { title: 'Warehouse Rent Payment',        note: 'Monthly warehouse rent due',         repeat: 'monthly' },
      { title: 'Equipment Lease Payment',       note: 'Monthly equipment lease installment',repeat: 'monthly' },
      { title: 'Vehicle Lease Payment',         note: 'Monthly vehicle lease EMI',          repeat: 'monthly' },
    ],
  },
  {
    label: 'Insurance',
    icon: 'umbrella-outline',
    color: '#15803D',
    presets: [
      { title: 'Business Insurance Renewal',    note: 'Annual business/fire insurance',     repeat: 'yearly'  },
      { title: 'Vehicle Insurance Renewal',     note: 'Annual vehicle insurance renewal',   repeat: 'yearly'  },
      { title: 'Health Insurance Premium',      note: 'Annual health insurance premium',    repeat: 'yearly'  },
      { title: 'Stock / Inventory Insurance',   note: 'Annual stock insurance renewal',     repeat: 'yearly'  },
    ],
  },
  {
    label: 'Banking & Finance',
    icon: 'card-outline',
    color: '#1D4ED8',
    presets: [
      { title: 'Bank Loan EMI',                 note: 'Monthly loan EMI payment',           repeat: 'monthly' },
      { title: 'Credit Card Bill Payment',      note: 'Monthly credit card due date',       repeat: 'monthly' },
      { title: 'CC Limit Renewal',              note: 'Annual cash credit limit renewal',   repeat: 'yearly'  },
      { title: 'Fixed Deposit Maturity',        note: 'FD maturity / renewal date',         repeat: 'none'    },
    ],
  },
  {
    label: 'Licences & Renewals',
    icon: 'document-text-outline',
    color: '#BE185D',
    presets: [
      { title: 'Trade License Renewal',         note: 'Annual trade/business license',      repeat: 'yearly'  },
      { title: 'FSSAI License Renewal',         note: 'Annual food safety license',         repeat: 'yearly'  },
      { title: 'Drug License Renewal',          note: 'Annual drug/pharma license',         repeat: 'yearly'  },
      { title: 'Fire NOC Renewal',              note: 'Annual fire safety certificate',     repeat: 'yearly'  },
      { title: 'Domain / Hosting Renewal',      note: 'Annual website domain renewal',      repeat: 'yearly'  },
      { title: 'Software License Renewal',      note: 'Annual software subscription',       repeat: 'yearly'  },
    ],
  },
  {
    label: 'Custom',
    icon: 'create-outline',
    color: '#475569',
    presets: [],
  },
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

// ── Form Modal ────────────────────────────────────────────────────────────────
function ReminderFormModal({ visible, onClose, onSave, editing }) {
  const [selCat, setSelCat]         = useState(null);
  const [catDropOpen, setCatDropOpen] = useState(false);
  const [catText, setCatText]       = useState('');
  const [title, setTitle]           = useState('');
  const [note, setNote]             = useState('');
  const [date, setDate]             = useState('');
  const [time, setTime]             = useState('');
  const [repeat, setRepeat]         = useState('none');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  React.useEffect(() => {
    if (visible) {
      if (editing) {
        const ec = getCatForTitle(editing.title);
        setSelCat(ec);
        setCatText(ec?.label || '');
        setTitle(editing.title || '');
        setNote(editing.note || '');
        const dt = editing.remind_at ? dayjs(editing.remind_at) : dayjs();
        setDate(dt.format('YYYY-MM-DD'));
        setTime(dt.format('HH:mm'));
        setRepeat(editing.repeat_type || 'none');
      } else {
        setSelCat(null);
        setCatText('');
        setTitle(''); setNote('');
        setDate(dayjs().format('YYYY-MM-DD'));
        setTime('10:00');
        setRepeat('none');
      }
      setCatDropOpen(false);
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
      await onSave({ title: title.trim(), note: note.trim(), remind_at, repeat_type: repeat });
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
                    {CATEGORIES.filter(cat =>
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
                <Text style={fm.label}>Date *</Text>
                <TextInput style={fm.input} placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94A3B8" value={date} onChangeText={setDate} />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={fm.label}>Time *</Text>
                <TextInput style={fm.input} placeholder="HH:MM"
                  placeholderTextColor="#94A3B8" value={time} onChangeText={setTime} />
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

// ── Main Screen ───────────────────────────────────────────────────────────────
const REPEAT_LABEL = { none: '', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };

// Map a reminder title back to its category for the icon/color on cards
function getCatForTitle(title) {
  for (const cat of CATEGORIES) {
    if (cat.presets.some(p => p.title === title)) return cat;
  }
  return CATEGORIES[CATEGORIES.length - 1]; // Custom
}

export default function RemindersScreen({ navigation }) {
  const { width }   = useWindowDimensions();
  const isMobile    = width < 768;
  const showSwipe   = isMobile;
  const showInlineActions = !isMobile;

  const [reminders, setReminders]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing]         = useState(null);
  const [filter, setFilter]           = useState('upcoming');
  const [search, setSearch]           = useState('');
  const [filterOpen, setFilterOpen]   = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/reminders');
      setReminders(Array.isArray(data) ? data : []);
    } catch { setReminders([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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

  return (
    <View style={s.screen}>
      <Navbar navigation={navigation} activeTab="Reminders" />

      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Colors.primary]} />}
      >
        {/* Header */}
        {!isMobile && (
          <View style={s.pageHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.pageTitle}>Reminders</Text>
              <Text style={s.pageSub}>GST returns, duty payments, bills, licences & more</Text>
            </View>
          </View>
        )}


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
                  const cat      = getCatForTitle(r.title);
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
                          {isOverdue && (
                            <View style={s.overdueBadge}>
                              <Text style={s.overdueBadgeTxt}>Overdue</Text>
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
  overdueBadge:   { backgroundColor: '#FEE2E2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  overdueBadgeTxt:{ fontSize: 10, fontWeight: '700', color: '#DC2626' },

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
