import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, ActivityIndicator, Modal, Pressable, Platform,
  useWindowDimensions,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import api from '@services/api';
import { useAuthStore } from '@store/authStore';

// ── helpers ───────────────────────────────────────────────────────────────────
function formatAge(dateStr) {
  if (!dateStr) return '—';
  const then = new Date(dateStr).getTime();
  if (!isFinite(then)) return '—';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1)  return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

const STATUS_COLORS = {
  'Open':        { bg: '#FEF3C7', fg: '#B45309' },
  'In Progress': { bg: '#DBEAFE', fg: '#1D4ED8' },
  'Cancelled':   { bg: '#FEE2E2', fg: '#DC2626' },
  'Joined':      { bg: '#DCFCE7', fg: '#15803D' },
};

// table column flex weights (kept in sync between header and rows)
const COLS = {
  sr: 0.4, company: 1.4, contact: 1.1, mobile: 1, handled: 1.2,
  type: 0.6, remark: 1.6, last: 0.7, next: 0.7, status: 0.9, age: 0.5, action: 0.9,
};

export default function LeadScreen({ navigation }) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const { width } = useWindowDimensions();
  const isMobile = width < 760;

  const [tab, setTab]         = useState('unalloted'); // 'unalloted' | 'pending'
  const [leads, setLeads]     = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [handler, setHandler]         = useState(''); // staff id or ''
  const [type, setType]               = useState(''); // lead type or ''

  const [staff, setStaff] = useState([]);
  const [types, setTypes] = useState([]);

  // dropdown / popover state
  const [handlerOpen, setHandlerOpen] = useState(false);
  const [typeOpen, setTypeOpen]       = useState(false);
  const [menuFor, setMenuFor]         = useState(null); // lead id
  const [menuPos, setMenuPos]         = useState({ top: 0, left: 0 });

  // modal state
  const [addOpen, setAddOpen]         = useState(false);
  const [viewLead, setViewLead]       = useState(null);
  const [transferFor, setTransferFor] = useState(null);

  const handlerBtnRef = useRef(null);
  const typeBtnRef    = useRef(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ section: tab });
      if (handler) params.append('handler', handler);
      if (type)    params.append('type', type);
      if (search)  params.append('search', search);
      const rows = await api.get(`/leads?${params.toString()}`);
      setLeads(Array.isArray(rows) ? rows : []);
    } catch (_) {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [tab, handler, type, search]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    api.get('/staff').then(r => setStaff(Array.isArray(r) ? r : [])).catch(() => {});
    api.get('/leads/types').then(r => setTypes(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const runSearch = () => setSearch(searchInput.trim());

  const openMenu = (e, leadId) => {
    const { pageX, pageY } = e.nativeEvent || {};
    setMenuPos({ top: (pageY || 0) + 8, left: Math.max(8, (pageX || 0) - 150) });
    setMenuFor(leadId);
  };

  const doAction = async (leadId, action) => {
    setMenuFor(null);
    try {
      if (action === 'pick')   await api.post(`/leads/${leadId}/pick`, {});
      if (action === 'cancel') await api.post(`/leads/${leadId}/cancel`, {});
      if (action === 'join')   await api.post(`/leads/${leadId}/join`, {});
      fetchLeads();
      api.get('/leads/types').then(r => setTypes(Array.isArray(r) ? r : [])).catch(() => {});
    } catch (err) {
      if (Platform.OS === 'web') window.alert(err?.error || err?.message || 'Action failed');
    }
  };

  const handlerLabel = handler
    ? (staff.find(s => String(s.id) === String(handler))?.name || 'Handler')
    : 'All Handlers';

  // Handler + Type filter dropdowns (placed in title row on mobile, toolbar row on web)
  const filterSelects = (
    <>
      <View ref={handlerBtnRef} style={isMobile ? { flex: 1 } : null}>
        <TouchableOpacity
          style={[s.selectBtn, isMobile && s.selectBtnMobile]}
          onPress={() => {
            handlerBtnRef.current?.measure?.((x, y, w, h, px, py) => {
              setMenuPos({ top: py + h + 4, left: px });
            });
            setHandlerOpen(o => !o);
          }}
        >
          <Text style={[s.selectTxt, isMobile && s.selectTxtMobile]} numberOfLines={1}>{handlerLabel}</Text>
          <Ionicons name="chevron-down" size={14} color="#64748B" />
        </TouchableOpacity>
      </View>

      <View ref={typeBtnRef} style={isMobile ? { flex: 1 } : null}>
        <TouchableOpacity
          style={[s.selectBtn, isMobile && s.selectBtnMobile]}
          onPress={() => {
            typeBtnRef.current?.measure?.((x, y, w, h, px, py) => {
              setMenuPos({ top: py + h + 4, left: px });
            });
            setTypeOpen(o => !o);
          }}
        >
          <Text style={[s.selectTxt, isMobile && s.selectTxtMobile]} numberOfLines={1}>{type || 'All Types'}</Text>
          <Ionicons name="chevron-down" size={14} color="#64748B" />
        </TouchableOpacity>
      </View>
    </>
  );

  // swipe-revealed actions for mobile cards
  const renderSwipeActions = (l) => {
    const btns = tab === 'unalloted'
      ? [
          { icon: 'call-outline', bg: '#C0392B', label: 'Pick',   onPress: () => doAction(l.id, 'pick') },
          { icon: 'close',        bg: '#64748B', label: 'Cancel', onPress: () => doAction(l.id, 'cancel') },
        ]
      : [
          { icon: 'eye-outline',              bg: '#C0392B', label: 'View',   onPress: () => openView(l.id) },
          { icon: 'checkmark-circle-outline', bg: '#15803D', label: 'Join',   onPress: () => doAction(l.id, 'join') },
          { icon: 'close',                    bg: '#64748B', label: 'Cancel', onPress: () => doAction(l.id, 'cancel') },
          ...(isAdmin ? [{ icon: 'swap-horizontal-outline', bg: '#C2410C', label: 'Transfer', onPress: () => setTransferFor(l.id) }] : []),
        ];
    return (
      <View style={s.swipeActions}>
        {btns.map(b => (
          <TouchableOpacity key={b.label} style={[s.swipeBtn, { backgroundColor: b.bg }]} onPress={b.onPress}>
            <Ionicons name={b.icon} size={18} color="#fff" />
            <Text style={s.swipeBtnTxt}>{b.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={s.container}>
      <Navbar navigation={navigation} activeTab="Leads" />

      {/* Header / toolbar */}
      <View style={s.toolbar}>
        <View style={s.titleRow}>
          <Text style={[s.title, isMobile && s.titleMobile]} numberOfLines={1}>Lead Pending</Text>
          <View style={[s.resultBadge, isMobile && s.resultBadgeMobile]}>
            <Text style={s.resultBadgeTxt}>{leads.length}{isMobile ? '' : ' results'}</Text>
          </View>

          {isMobile && filterSelects}
        </View>

        <View style={s.toolbarRight}>
          {!isMobile && filterSelects}
          {!isMobile && <View style={s.flexSpacer} />}

          {/* Search */}
          <View style={[s.searchBox, isMobile && s.searchBoxMobile]}>
            <Ionicons name="search-outline" size={15} color="#94A3B8" />
            <TextInput
              style={s.searchInput}
              placeholder="Search leads..."
              placeholderTextColor="#94A3B8"
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmitEditing={runSearch}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity style={s.searchBtn} onPress={runSearch}>
            <Text style={s.searchBtnTxt}>Search</Text>
          </TouchableOpacity>

          {!isMobile && <View style={s.divider} />}

          <TouchableOpacity style={[s.iconBtn, isMobile && s.iconBtnMobile]} onPress={fetchLeads}>
            <Ionicons name="refresh-outline" size={16} color="#475569" />
            {!isMobile && <Text style={s.iconBtnTxt}>Refresh</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[s.iconBtn, isMobile && s.iconBtnMobile]} onPress={() => { setSearchInput(''); setSearch(''); setHandler(''); setType(''); }}>
            <Ionicons name="filter-outline" size={16} color="#475569" />
            {!isMobile && <Text style={s.iconBtnTxt}>Filter</Text>}
          </TouchableOpacity>
          {!isMobile && (
            <TouchableOpacity style={s.addBtn} onPress={() => setAddOpen(true)}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={s.addBtnTxt}>Add Lead</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Section tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tab, tab === 'unalloted' && s.tabActive]} onPress={() => setTab('unalloted')}>
          <Text style={[s.tabTxt, tab === 'unalloted' && s.tabTxtActive]}>Unalloted</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'pending' && s.tabActive]} onPress={() => setTab('pending')}>
          <Text style={[s.tabTxt, tab === 'pending' && s.tabTxtActive]}>Pending</Text>
        </TouchableOpacity>
      </View>

      {/* Table (wide) / Cards (mobile) */}
      {isMobile ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 10 }}>
          {loading ? (
            <ActivityIndicator color={Colors.brandRed} style={{ marginTop: 40 }} />
          ) : leads.length === 0 ? (
            <Text style={s.empty}>No leads found.</Text>
          ) : leads.map((l) => {
            const sc = STATUS_COLORS[l.status] || { bg: '#F1F5F9', fg: '#475569' };
            return (
              <Swipeable
                key={l.id}
                friction={2}
                rightThreshold={36}
                renderRightActions={() => renderSwipeActions(l)}
                overshootRight={false}
              >
                <TouchableOpacity style={s.card} activeOpacity={0.9} onPress={() => openView(l.id)}>
                  <View style={s.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle} numberOfLines={1}>{l.company || 'Walk-in'}</Text>
                      <Text style={s.cardMobile}>{l.mobile || '—'}</Text>
                    </View>
                    <View style={[s.statusPill, { backgroundColor: sc.bg }]}>
                      <Text style={[s.statusTxt, { color: sc.fg }]}>{l.status}</Text>
                    </View>
                  </View>

                  <View style={s.cardMeta}>
                    {!!l.lead_type && <CardTag label={l.lead_type} />}
                    <CardTag label={`Handled: ${l.handled_by_name || '—'}`} />
                    <CardTag label={`Age: ${formatAge(l.created_at)}`} />
                  </View>

                  {!!l.contact_person && <Text style={s.cardLine}>Contact: {l.contact_person}</Text>}
                  {!!l.remark && <Text style={s.cardLine} numberOfLines={2}>{l.remark}</Text>}

                  <View style={s.cardFooter}>
                    <Text style={s.cardDates}>Last {formatDate(l.last_contact_at)} · Next {formatDate(l.next_followup_at)}</Text>
                  </View>
                </TouchableOpacity>
              </Swipeable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {/* header */}
          <View style={s.thead}>
            <Text style={[s.th, { flex: COLS.sr }]}>SR</Text>
            <Text style={[s.th, { flex: COLS.company }]}>COMPANY</Text>
            <Text style={[s.th, { flex: COLS.contact }]}>CONTACT</Text>
            <Text style={[s.th, { flex: COLS.mobile }]}>MOBILE</Text>
            <Text style={[s.th, { flex: COLS.handled }]}>HANDLED BY</Text>
            <Text style={[s.th, { flex: COLS.type }]}>TYPE</Text>
            <Text style={[s.th, { flex: COLS.remark }]}>REMARK</Text>
            <Text style={[s.th, { flex: COLS.last }]}>LAST</Text>
            <Text style={[s.th, { flex: COLS.next }]}>NEXT</Text>
            <Text style={[s.th, { flex: COLS.status }]}>STATUS</Text>
            <Text style={[s.th, { flex: COLS.age }]}>AGE</Text>
            <Text style={[s.th, { flex: COLS.action, textAlign: 'right' }]}>ACTION</Text>
          </View>

          <ScrollView style={{ flex: 1 }}>
            {loading ? (
              <ActivityIndicator color={Colors.brandRed} style={{ marginTop: 40 }} />
            ) : leads.length === 0 ? (
              <Text style={s.empty}>No leads found.</Text>
            ) : leads.map((l, i) => {
              const sc = STATUS_COLORS[l.status] || { bg: '#F1F5F9', fg: '#475569' };
              return (
                <TouchableOpacity key={l.id} style={[s.tr, i % 2 === 1 && s.trAlt]} activeOpacity={0.7} onPress={() => openView(l.id)}>
                  <Text style={[s.td, { flex: COLS.sr }]}>{i + 1}</Text>
                  <Text style={[s.td, s.tdStrong, { flex: COLS.company }]} numberOfLines={1}>{l.company || 'Walk-in'}</Text>
                  <Text style={[s.td, { flex: COLS.contact }]} numberOfLines={1}>{l.contact_person || '—'}</Text>
                  <Text style={[s.td, { flex: COLS.mobile }]} numberOfLines={1}>{l.mobile || '—'}</Text>
                  <Text style={[s.td, { flex: COLS.handled }]} numberOfLines={1}>{l.handled_by_name || '—'}</Text>
                  <Text style={[s.td, { flex: COLS.type }]} numberOfLines={1}>{l.lead_type || '—'}</Text>
                  <Text style={[s.td, { flex: COLS.remark }]} numberOfLines={1}>{l.remark || '—'}</Text>
                  <Text style={[s.td, { flex: COLS.last }]}>{formatDate(l.last_contact_at)}</Text>
                  <Text style={[s.td, { flex: COLS.next }]}>{formatDate(l.next_followup_at)}</Text>
                  <View style={{ flex: COLS.status, justifyContent: 'center' }}>
                    <View style={[s.statusPill, { backgroundColor: sc.bg }]}>
                      <Text style={[s.statusTxt, { color: sc.fg }]}>{l.status}</Text>
                    </View>
                  </View>
                  <Text style={[s.td, { flex: COLS.age }]}>{formatAge(l.created_at)}</Text>
                  <View style={{ flex: COLS.action, alignItems: 'flex-end', justifyContent: 'center' }}>
                    <TouchableOpacity style={s.actionBtn} onPress={(e) => openMenu(e, l.id)}>
                      <Ionicons name="ellipsis-horizontal" size={14} color="#fff" />
                      <Text style={s.actionBtnTxt}>Action</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Handler dropdown */}
      <DropdownMenu
        visible={handlerOpen}
        pos={menuPos}
        onClose={() => setHandlerOpen(false)}
        items={[{ label: 'All Handlers', value: '' }, ...staff.map(st => ({ label: st.name, value: String(st.id) }))]}
        selected={handler}
        onSelect={(v) => { setHandler(v); setHandlerOpen(false); }}
      />

      {/* Type dropdown */}
      <DropdownMenu
        visible={typeOpen}
        pos={menuPos}
        onClose={() => setTypeOpen(false)}
        items={[{ label: 'All Types', value: '' }, ...types.map(t => ({ label: t, value: t }))]}
        selected={type}
        onSelect={(v) => { setType(v); setTypeOpen(false); }}
      />

      {/* Row action menu */}
      <Modal visible={!!menuFor} transparent animationType="none" onRequestClose={() => setMenuFor(null)}>
        <Pressable style={s.backdropClear} onPress={() => setMenuFor(null)}>
          <View style={[s.actionMenu, { top: menuPos.top, left: menuPos.left }]}>
            {tab === 'unalloted' ? (
              <>
                <ActionItem icon="call-outline" color="#C0392B" label="Pick Lead" onPress={() => doAction(menuFor, 'pick')} />
                <ActionItem icon="close" color="#DC2626" label="Cancel Lead" onPress={() => doAction(menuFor, 'cancel')} />
              </>
            ) : (
              <>
                <ActionItem icon="eye-outline" color="#C0392B" label="View Lead" onPress={() => { const id = menuFor; setMenuFor(null); openView(id); }} />
                <ActionItem icon="checkmark-circle-outline" color="#15803D" label="Lead Joint" onPress={() => doAction(menuFor, 'join')} />
                <ActionItem icon="close" color="#DC2626" label="Cancel Lead" onPress={() => doAction(menuFor, 'cancel')} />
                {isAdmin && (
                  <ActionItem icon="swap-horizontal-outline" color="#C2410C" label="Transfer Lead" onPress={() => { const id = menuFor; setMenuFor(null); setTransferFor(id); }} />
                )}
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Add lead modal */}
      <LeadFormModal
        visible={addOpen}
        staff={staff}
        types={types}
        isAdmin={isAdmin}
        onClose={() => setAddOpen(false)}
        onSaved={() => { setAddOpen(false); fetchLeads(); api.get('/leads/types').then(r => setTypes(Array.isArray(r) ? r : [])).catch(() => {}); }}
      />

      {/* Lead detail modal */}
      <LeadDetailModal lead={viewLead} isMobile={isMobile} onClose={() => setViewLead(null)} />

      {/* Transfer modal */}
      <TransferModal
        leadId={transferFor}
        staff={staff}
        onClose={() => setTransferFor(null)}
        onDone={() => { setTransferFor(null); fetchLeads(); }}
      />

      {/* Floating Add button (mobile) */}
      {isMobile && (
        <TouchableOpacity style={s.fab} onPress={() => setAddOpen(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );

  function openView(id) {
    api.get(`/leads/${id}`).then(setViewLead).catch(() => {});
  }
}

// ── small components ────────────────────────────────────────────────────────────
function ActionItem({ icon, color, label, onPress }) {
  return (
    <TouchableOpacity style={s.actionItem} onPress={onPress}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[s.actionItemTxt, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function CardTag({ label }) {
  return (
    <View style={s.cardTag}>
      <Text style={s.cardTagTxt} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function DropdownMenu({ visible, pos, onClose, items, selected, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={s.backdropClear} onPress={onClose}>
        <View style={[s.dropdown, { top: pos.top, left: pos.left }]}>
          <ScrollView style={{ maxHeight: 280 }}>
            {items.map(it => (
              <TouchableOpacity
                key={it.value || '__all'}
                style={[s.dropdownItem, String(selected) === String(it.value) && s.dropdownItemActive]}
                onPress={() => onSelect(it.value)}
              >
                <Text style={[s.dropdownTxt, String(selected) === String(it.value) && s.dropdownTxtActive]} numberOfLines={1}>{it.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || label}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
      />
    </View>
  );
}

const DEFAULT_LEAD_TYPES = ['TDL', 'Walk-in', 'Reference'];

function LeadFormModal({ visible, staff, types, isAdmin, onClose, onSaved }) {
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);
  const [assign, setAssign]   = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  // merge known types with sensible defaults, de-duplicated
  const typeOptions = Array.from(new Set([...DEFAULT_LEAD_TYPES, ...(types || [])]));

  useEffect(() => {
    if (visible) { setForm({}); setAssign(false); setTypeOpen(false); }
  }, [visible]);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    const mobile = (form.mobile || '').trim();
    if (!/^\d{10}$/.test(mobile)) {
      if (Platform.OS === 'web') window.alert('Enter a valid 10-digit mobile number.');
      return;
    }
    if (!form.lead_type?.trim()) {
      if (Platform.OS === 'web') window.alert('Select a lead type.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, mobile };
      if (!assign) delete payload.handled_by;
      await api.post('/leads', payload);
      onSaved();
    } catch (err) {
      if (Platform.OS === 'web') window.alert(err?.error || err?.message || 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={s.modalCard} onPress={e => e.stopPropagation?.()}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add Lead</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#64748B" /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: 18 }}>
            <View style={s.formRow}>
              {/* Mobile */}
              <View style={s.formCol}>
                <Text style={s.fieldLabel}>MOBILE NO. <Text style={s.req}>*</Text></Text>
                <TextInput
                  style={s.fieldInput}
                  value={form.mobile}
                  onChangeText={(v) => set('mobile')(v.replace(/[^\d]/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit mobile"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              {/* Lead type */}
              <View style={[s.formCol, { zIndex: 10 }]}>
                <Text style={s.fieldLabel}>LEAD TYPE <Text style={s.req}>*</Text></Text>
                <TouchableOpacity
                  style={[s.fieldInput, s.selectInput]}
                  onPress={() => setTypeOpen(o => !o)}
                >
                  <Text style={[s.selectInputTxt, !form.lead_type && { color: '#94A3B8' }]} numberOfLines={1}>
                    {form.lead_type || 'Select type...'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#64748B" />
                </TouchableOpacity>
                {typeOpen && (
                  <View style={s.inlineDropdown}>
                    <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {typeOptions.length === 0 ? (
                        <Text style={s.inlineDropdownEmpty}>No types yet</Text>
                      ) : typeOptions.map(t => (
                        <TouchableOpacity key={t} style={s.dropdownItem} onPress={() => { set('lead_type')(t); setTypeOpen(false); }}>
                          <Text style={[s.dropdownTxt, form.lead_type === t && s.dropdownTxtActive]} numberOfLines={1}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            {/* Remark */}
            <View style={{ marginBottom: 12 }}>
              <Text style={s.fieldLabel}>REMARK</Text>
              <TextInput
                style={[s.fieldInput, s.textArea]}
                value={form.remark}
                onChangeText={set('remark')}
                placeholder="Enter remark or details..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Assign toggle */}
            <TouchableOpacity style={s.checkRow} onPress={() => setAssign(a => !a)} activeOpacity={0.7}>
              <View style={[s.checkbox, assign && s.checkboxOn]}>
                {assign && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={s.checkLabel}>Assign to someone (Handled By)</Text>
            </TouchableOpacity>

            {assign && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 12 }}>
                <Chip label="Unalloted" active={!form.handled_by} onPress={() => set('handled_by')('')} />
                {staff.map(st => (
                  <Chip key={st.id} label={st.name} active={String(form.handled_by) === String(st.id)} onPress={() => set('handled_by')(st.id)} />
                ))}
              </ScrollView>
            )}
          </ScrollView>
          <View style={s.modalFooter}>
            <TouchableOpacity style={s.btnGhost} onPress={onClose}><Text style={s.btnGhostTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={s.btnPrimary} onPress={save} disabled={saving}>
              <Text style={s.btnPrimaryTxt}>{saving ? 'Saving…' : 'Save Lead'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress}>
      <Text style={[s.chipTxt, active && s.chipTxtActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const DETAIL_TABS = [
  { key: 'requirement', label: 'Requirement' },
  { key: 'correction',  label: 'Correction' },
  { key: 'update',      label: 'Update' },
];
const STATUS_PILL = {
  'Open':        { bg: '#FEF3C7', fg: '#B45309' },
  'In Progress': { bg: '#DBEAFE', fg: '#1D4ED8' },
  'Cancelled':   { bg: '#FEE2E2', fg: '#DC2626' },
  'Joined':      { bg: '#DCFCE7', fg: '#15803D' },
};

function LeadDetailModal({ lead, isMobile, onClose }) {
  const [tab, setTab]       = useState('requirement');
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const leadId = lead?.id;

  const fetchItems = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const rows = await api.get(`/leads/${leadId}/items?kind=${tab}`);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (_) { setItems([]); } finally { setLoading(false); }
  }, [leadId, tab]);

  useEffect(() => { if (leadId) { setTab('requirement'); } }, [leadId]);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  if (!lead) return null;

  const sc = STATUS_PILL[lead.status] || { bg: '#F1F5F9', fg: '#475569' };
  const activeLabel = DETAIL_TABS.find(t => t.key === tab)?.label || 'Requirement';

  const content = (
    <>
          {/* Header */}
          <View style={s.detailHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
              <Text style={s.detailCompany} numberOfLines={1}>{lead.company || 'Walk-in'}</Text>
              <View style={[s.statusPill, { backgroundColor: sc.bg }]}>
                <Text style={[s.statusTxt, { color: sc.fg }]}>{(lead.status || '').toUpperCase()}</Text>
              </View>
              {!!lead.lead_type && (
                <View style={[s.statusPill, { backgroundColor: '#EEF2FF' }]}>
                  <Text style={[s.statusTxt, { color: '#4338CA' }]}>{lead.lead_type}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#64748B" /></TouchableOpacity>
          </View>

          {/* Info grid */}
          <View style={s.infoGrid}>
            <View style={s.infoCell}><Text style={s.infoKey}>Mobile: </Text><Text style={s.infoVal}>{lead.mobile || '—'}</Text></View>
            <View style={s.infoCell}><Text style={s.infoKey}>Handler: </Text><Text style={s.infoVal}>{lead.handled_by_name || 'Unassigned'}</Text></View>
            <View style={s.infoCell}><Text style={s.infoKey}>Age: </Text><Text style={s.infoVal}>{formatAge(lead.created_at)}</Text></View>
          </View>
          <View style={s.infoRemark}>
            <Text style={[s.infoKey, { color: Colors.brandRed }]}>Remark: </Text>
            <Text style={s.infoVal}>{lead.remark || '—'}</Text>
          </View>

          {/* Tabs */}
          <View style={s.detailTabs}>
            {DETAIL_TABS.map(t => (
              <TouchableOpacity key={t.key} style={[s.detailTab, tab === t.key && s.detailTabActive]} onPress={() => setTab(t.key)}>
                <Text style={[s.detailTabTxt, tab === t.key && s.detailTabTxtActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Items list */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, flexGrow: 1 }}>
            {loading ? (
              <ActivityIndicator color={Colors.brandRed} style={{ marginTop: 30 }} />
            ) : items.length === 0 ? (
              <Text style={s.detailEmpty}>No {tab}s yet</Text>
            ) : items.map(it => (
              <View key={it.id} style={s.itemRow}>
                <Text style={s.itemDesc}>{it.description}</Text>
                <View style={s.itemMeta}>
                  {!!it.deadline && <Text style={s.itemMetaTxt}>Due {formatDate(it.deadline)}</Text>}
                  {it.amount != null && <Text style={s.itemMetaTxt}>₹{Number(it.amount).toFixed(2)}</Text>}
                  {!!it.created_by_name && <Text style={s.itemMetaTxt}>· {it.created_by_name}</Text>}
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Add FAB */}
          <TouchableOpacity style={[s.detailFab, isMobile && s.detailFabMobile]} activeOpacity={0.85} onPress={() => setAddOpen(true)}>
            <Ionicons name="add" size={26} color="#fff" />
          </TouchableOpacity>

          <AddItemModal
            visible={addOpen}
            leadName={lead.company || 'Walk-in'}
            kind={tab}
            kindLabel={activeLabel}
            leadId={leadId}
            onClose={() => setAddOpen(false)}
            onSaved={() => { setAddOpen(false); fetchItems(); }}
          />
    </>
  );

  // Mobile: full-screen overlay inside the Leads screen (keeps the bottom tab bar visible)
  if (isMobile) {
    return <View style={s.detailFull}>{content}</View>;
  }

  // Web/tablet: centered card modal
  return (
    <Modal visible={!!lead} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={s.detailCard} onPress={e => e.stopPropagation?.()}>
          {content}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// dd-mm-yyyy (typed) → yyyy-mm-dd (API); returns null if not a full valid date
function toISODate(s) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec((s || '').trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function AddItemModal({ visible, leadName, kind, kindLabel, leadId, onClose, onSaved }) {
  const [desc, setDesc]       = useState('');
  const [deadline, setDeadline] = useState('');
  const [amount, setAmount]   = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => { if (visible) { setDesc(''); setDeadline(''); setAmount(''); } }, [visible]);

  const save = async () => {
    if (!desc.trim()) { if (Platform.OS === 'web') window.alert('Enter a description.'); return; }
    setSaving(true);
    try {
      await api.post(`/leads/${leadId}/items`, {
        kind,
        description: desc.trim(),
        deadline: toISODate(deadline),
        amount: amount === '' ? null : Number(amount),
      });
      onSaved();
    } catch (err) {
      if (Platform.OS === 'web') window.alert(err?.error || err?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  // format typed digits as dd-mm-yyyy
  const onDeadline = (v) => {
    const d = v.replace(/[^\d]/g, '').slice(0, 8);
    let out = d;
    if (d.length > 4) out = `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
    else if (d.length > 2) out = `${d.slice(0, 2)}-${d.slice(2)}`;
    setDeadline(out);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={s.modalCard} onPress={e => e.stopPropagation?.()}>
          <View style={s.modalHeader}>
            <View>
              <Text style={s.modalTitle}>Add {kindLabel}</Text>
              <Text style={s.modalSub}>{leadName}</Text>
            </View>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#64748B" /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: 18 }}>
            <Text style={s.fieldLabel}>DESCRIPTION</Text>
            <TextInput
              style={[s.fieldInput, s.textArea]}
              value={desc}
              onChangeText={setDesc}
              placeholder="What needs to be done?"
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
            />
            <View style={[s.formRow, { marginTop: 12 }]}>
              <View style={s.formCol}>
                <Text style={s.fieldLabel}>DEADLINE</Text>
                <TextInput
                  style={s.fieldInput}
                  value={deadline}
                  onChangeText={onDeadline}
                  placeholder="dd-mm-yyyy"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>
              <View style={s.formCol}>
                <Text style={s.fieldLabel}>AMOUNT</Text>
                <TextInput
                  style={s.fieldInput}
                  value={amount}
                  onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))}
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </ScrollView>
          <View style={s.modalFooter}>
            <TouchableOpacity style={s.btnGhost} onPress={onClose}><Text style={s.btnGhostTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={s.btnPrimary} onPress={save} disabled={saving}>
              <Text style={s.btnPrimaryTxt}>{saving ? 'Saving…' : `Add ${kindLabel}`}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TransferModal({ leadId, staff, onClose, onDone }) {
  const [sel, setSel]       = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (leadId) setSel(''); }, [leadId]);

  const submit = async () => {
    if (!sel) { if (Platform.OS === 'web') window.alert('Select a staff member.'); return; }
    setSaving(true);
    try {
      await api.post(`/leads/${leadId}/transfer`, { handled_by: sel });
      onDone();
    } catch (err) {
      if (Platform.OS === 'web') window.alert(err?.error || err?.message || 'Transfer failed');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={!!leadId} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={[s.modalCard, { maxWidth: 380 }]} onPress={e => e.stopPropagation?.()}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Transfer Lead</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#64748B" /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ padding: 18 }}>
            <Text style={[s.fieldLabel, { marginBottom: 10 }]}>Assign to</Text>
            {staff.map(st => (
              <TouchableOpacity
                key={st.id}
                style={[s.transferRow, String(sel) === String(st.id) && s.transferRowActive]}
                onPress={() => setSel(st.id)}
              >
                <Ionicons name={String(sel) === String(st.id) ? 'radio-button-on' : 'radio-button-off'} size={18} color={String(sel) === String(st.id) ? Colors.brandRed : '#94A3B8'} />
                <Text style={s.transferName}>{st.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={s.modalFooter}>
            <TouchableOpacity style={s.btnGhost} onPress={onClose}><Text style={s.btnGhostTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={s.btnPrimary} onPress={submit} disabled={saving}>
              <Text style={s.btnPrimaryTxt}>{saving ? 'Transferring…' : 'Transfer'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  toolbar:    { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  titleRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title:      { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  titleMobile:{ fontSize: 14 },
  resultBadge:{ backgroundColor: '#FFF0EF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  resultBadgeMobile: { paddingHorizontal: 8, paddingVertical: 3 },
  resultBadgeTxt: { color: '#C0392B', fontSize: 12, fontWeight: '700' },

  toolbarRight:{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  flexSpacer:  { flex: 1, minWidth: 8 },
  selectBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, minWidth: 130, justifyContent: 'space-between' },
  selectBtnMobile: { minWidth: 0, paddingHorizontal: 10 },
  selectTxt:   { fontSize: 13, color: '#334155', fontWeight: '600', maxWidth: 130 },
  selectTxtMobile: { fontSize: 11, maxWidth: undefined, flex: 1 },

  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, height: 38, width: 260 },
  searchBoxMobile: { width: undefined, flex: 1, minWidth: 0 },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A', outlineStyle: 'none' },
  searchBtn:   { backgroundColor: '#FFF0EF', borderRadius: 10, paddingHorizontal: 16, height: 38, justifyContent: 'center' },
  searchBtnTxt:{ color: '#C0392B', fontWeight: '700', fontSize: 13 },

  divider:     { width: 1, height: 26, backgroundColor: '#E2E8F0', marginHorizontal: 2 },
  iconBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, height: 38 },
  iconBtnMobile: { width: 38, paddingHorizontal: 0, justifyContent: 'center' },
  iconBtnTxt:  { fontSize: 13, color: '#475569', fontWeight: '600' },
  addBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#C0392B', borderRadius: 10, paddingHorizontal: 14, height: 38 },
  addBtnTxt:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  fab:         { position: 'absolute', right: 20, bottom: 84, width: 56, height: 56, borderRadius: 28, backgroundColor: '#C0392B', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6, zIndex: 20 },

  tabRow:      { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tab:         { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive:   { borderBottomColor: '#0F172A' },
  tabTxt:      { fontSize: 15, fontWeight: '600', color: '#94A3B8' },
  tabTxtActive:{ color: '#0F172A', fontWeight: '700' },

  thead:       { flexDirection: 'row', backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 12, paddingHorizontal: 12 },
  th:          { fontSize: 11, fontWeight: '700', color: '#64748B', letterSpacing: 0.4 },
  tr:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  trAlt:       { backgroundColor: '#FCFCFD' },
  td:          { fontSize: 13, color: '#475569' },
  tdStrong:    { color: '#0F172A', fontWeight: '600' },
  empty:       { textAlign: 'center', color: '#94A3B8', fontSize: 14, marginTop: 40 },

  statusPill:  { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  statusTxt:   { fontSize: 11, fontWeight: '700' },

  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#0F172A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  actionBtnTxt:{ color: '#fff', fontSize: 12, fontWeight: '700' },

  // mobile card layout
  card:        { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#EEF2F6', padding: 14, gap: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cardMobile:  { fontSize: 13, color: '#475569', marginTop: 2 },
  cardMeta:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cardTag:     { backgroundColor: '#F1F5F9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  cardTagTxt:  { fontSize: 11, color: '#475569', fontWeight: '600' },
  cardLine:    { fontSize: 13, color: '#475569' },
  cardFooter:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, gap: 8 },
  cardDates:   { fontSize: 11, color: '#94A3B8', flex: 1 },

  swipeActions:{ flexDirection: 'row', alignItems: 'stretch', marginLeft: 8 },
  swipeBtn:    { width: 72, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, marginLeft: 6 },
  swipeBtnTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },

  backdropClear: { flex: 1 },
  actionMenu:  { position: 'absolute', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 6, minWidth: 170, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, elevation: 8 },
  actionItem:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11 },
  actionItemTxt: { fontSize: 13, fontWeight: '600' },

  dropdown:    { position: 'absolute', backgroundColor: '#fff', borderRadius: 10, minWidth: 160, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, elevation: 8, overflow: 'hidden' },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dropdownItemActive: { backgroundColor: '#FFF0EF' },
  dropdownTxt: { fontSize: 13, color: '#334155', fontWeight: '500' },
  dropdownTxtActive: { color: '#C0392B', fontWeight: '700' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard:   { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  modalTitle:  { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  modalSub:    { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  btnGhost:    { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  btnGhostTxt: { color: '#64748B', fontWeight: '600', fontSize: 13 },
  btnPrimary:  { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: '#C0392B' },
  btnPrimaryTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },

  fieldLabel:  { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  req:         { color: '#EF4444' },
  fieldInput:  { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 13, color: '#0F172A', outlineStyle: 'none' },
  textArea:    { minHeight: 90, paddingTop: 12 },

  formRow:     { flexDirection: 'row', gap: 14, marginBottom: 12, zIndex: 20, position: 'relative' },
  formCol:     { flex: 1 },
  selectInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectInputTxt: { fontSize: 13, color: '#0F172A', flex: 1 },
  inlineDropdown: { position: 'absolute', top: 70, left: 0, right: 0, zIndex: 50, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, elevation: 8, overflow: 'hidden' },
  inlineDropdownEmpty: { fontSize: 12, color: '#94A3B8', padding: 14, textAlign: 'center' },

  checkRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  checkbox:    { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  checkboxOn:  { backgroundColor: '#C0392B', borderColor: '#C0392B' },
  checkLabel:  { fontSize: 14, color: '#0F172A', fontWeight: '600' },

  chip:        { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive:  { backgroundColor: '#FFF0EF', borderColor: '#C0392B' },
  chipTxt:     { fontSize: 12, color: '#475569', fontWeight: '600' },
  chipTxtActive: { color: '#C0392B', fontWeight: '700' },

  detailRow:   { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailKey:   { width: 120, fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  detailVal:   { flex: 1, fontSize: 13, color: '#0F172A', fontWeight: '500' },

  // lead detail modal
  detailCard:  { backgroundColor: '#fff', borderRadius: 16, width: '92%', maxWidth: 1100, height: '85%', maxHeight: 680, overflow: 'hidden' },
  detailFull:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', zIndex: 40 },
  detailHeader:{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  detailCompany: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  infoGrid:    { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 12, gap: 6 },
  infoCell:    { flexDirection: 'row', alignItems: 'center', minWidth: '45%' },
  infoKey:     { fontSize: 13, color: '#64748B' },
  infoVal:     { fontSize: 13, color: '#0F172A', fontWeight: '700' },
  infoRemark:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingVertical: 8, marginTop: 12 },
  detailTabs:  { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  detailTab:   { flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  detailTabActive: { borderBottomColor: '#0F172A' },
  detailTabTxt: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  detailTabTxtActive: { color: '#0F172A', fontWeight: '700' },
  detailEmpty: { textAlign: 'center', color: '#94A3B8', fontSize: 14, marginTop: 40 },
  detailFab:   { position: 'absolute', right: 18, bottom: 18, width: 52, height: 52, borderRadius: 26, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6, zIndex: 20 },
  detailFabMobile: { bottom: 84 },
  itemRow:     { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EEF2F6', borderRadius: 12, padding: 12, marginBottom: 10 },
  itemDesc:    { fontSize: 14, color: '#0F172A', fontWeight: '600' },
  itemMeta:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  itemMetaTxt: { fontSize: 12, color: '#64748B', fontWeight: '600' },

  logRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  logTxt:      { fontSize: 12, color: '#334155' },
  logNote:     { fontSize: 12, color: '#64748B', marginTop: 2 },
  logTime:     { fontSize: 10, color: '#94A3B8', marginTop: 2 },

  transferRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 8 },
  transferRowActive: { backgroundColor: '#FFF0EF' },
  transferName:{ fontSize: 13, color: '#0F172A', fontWeight: '600' },
});
