import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, ActivityIndicator, Platform, FlatList,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import api from '@services/api';
import dayjs from 'dayjs';

const STATUS_COLORS = {
  pending:   { bg: '#FFF7ED', text: '#C2410C' },
  confirmed: { bg: '#EFF6FF', text: '#1D4ED8' },
  delivered: { bg: '#F0FDF4', text: '#15803D' },
  cancelled: { bg: '#FEF2F2', text: '#DC2626' },
};

export default function OrdersScreen({ navigation }) {
  const { width }                       = useWindowDimensions();
  const isMobile                        = width < 768;
  const [orders, setOrders]             = useState([]);
  const [loading, setLoading]           = useState(false);
  const [search, setSearch]             = useState('');
  const [showCreate, setShowCreate]     = useState(false);
  const [showDetail, setShowDetail]     = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await api.get('/orders');
      setOrders(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, []);

  const filtered = orders.filter(o =>
    o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    o.order_number.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id) => {
    if (Platform.OS === 'web' && !confirm('Delete this order?')) return;
    try { await api.delete(`/orders/${id}`); fetchOrders(); }
    catch { alert('Failed to delete order.'); }
  };

  const handleStatusChange = async (id, status) => {
    try { await api.put(`/orders/${id}/status`, { status }); fetchOrders(); }
    catch { alert('Failed to update status.'); }
  };

  return (
    <View style={s.container}>
      <Navbar navigation={navigation} activeTab="Orders" />

      <View style={s.topBar}>
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={16} color="#94A3B8" />
          <TextInput
            style={s.searchInput}
            placeholder="Search by customer or order ID..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.brandRed} style={{ marginTop: 60 }} />
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
          <Text style={s.emptyTxt}>No orders found.</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, width: '100%' }}
          data={filtered}
          keyExtractor={o => String(o.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item: o }) => {
            const sc = STATUS_COLORS[o.status] || STATUS_COLORS.pending;
            return (
              <TouchableOpacity style={s.card} onPress={() => setShowDetail(o)} activeOpacity={0.85}>
                <View style={s.cardTop}>
                  <View>
                    <Text style={s.orderNum}>{o.order_number}</Text>
                    <Text style={s.customer}>{o.customer_name}</Text>
                  </View>
                  <View style={s.cardRight}>
                    <Text style={s.total}>₹{parseFloat(o.total).toFixed(2)}</Text>
                    <View style={[s.badge, { backgroundColor: sc.bg }]}>
                      <Text style={[s.badgeTxt, { color: sc.text }]}>{o.status}</Text>
                    </View>
                  </View>
                </View>
                <View style={s.cardBottom}>
                  <Ionicons name="calendar-outline" size={12} color="#94A3B8" />
                  <Text style={s.cardDate}>{dayjs(o.date).format('DD MMM YYYY')}</Text>
                  <Text style={s.dot}>·</Text>
                  <Ionicons name="cube-outline" size={12} color="#94A3B8" />
                  <Text style={s.cardDate}>{o.item_count} item{o.item_count !== 1 ? 's' : ''}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={[s.fab, isMobile && { bottom: 80 }]} onPress={() => setShowCreate(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create Modal */}
      <CreateOrderModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); fetchOrders(); }}
      />

      {/* Detail Modal */}
      {showDetail && (
        <OrderDetailModal
          order={showDetail}
          onClose={() => setShowDetail(null)}
          onDelete={() => { setShowDetail(null); handleDelete(showDetail.id); }}
          onStatusChange={(s) => { handleStatusChange(showDetail.id, s); setShowDetail(null); }}
        />
      )}
    </View>
  );
}

// ─── Create Order Modal ────────────────────────────────────────────────────────
function CreateOrderModal({ visible, onClose, onCreated }) {
  const [customer, setCustomer]       = useState('');
  const [ledgerSugg, setLedgerSugg]   = useState([]);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [date, setDate]               = useState(dayjs().format('DD-MM-YYYY'));
  const [itemSearch, setItemSearch]   = useState('');
  const [itemSugg, setItemSugg]       = useState([]);
  const [orderItems, setOrderItems]   = useState([]);
  const [notes, setNotes]             = useState('');
  const [showNotes, setShowNotes]     = useState(false);
  const [error, setError]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [allLedgers, setAllLedgers]   = useState([]);
  const [allItems, setAllItems]       = useState([]);
  const [itemModal, setItemModal]     = useState(null);

  useEffect(() => {
    if (visible) {
      setCustomer(''); setSelectedLedger(null); setDate(dayjs().format('DD-MM-YYYY'));
      setItemSearch(''); setOrderItems([]); setNotes(''); setError(''); setShowNotes(false);
      api.get('/ledgers').then(d => setAllLedgers(d || [])).catch(() => {});
      api.get('/items').then(d => setAllItems(d || [])).catch(() => {});
    }
  }, [visible]);

  const onCustomerChange = (txt) => {
    setCustomer(txt); setSelectedLedger(null);
    if (txt.length >= 2) {
      setLedgerSugg(allLedgers.filter(l => l.name.toLowerCase().includes(txt.toLowerCase())).slice(0, 5));
    } else setLedgerSugg([]);
  };

  const onItemSearch = (txt) => {
    setItemSearch(txt);
    if (txt.length >= 3) {
      setItemSugg(allItems.filter(i => i.name.toLowerCase().includes(txt.toLowerCase())).slice(0, 6));
    } else setItemSugg([]);
  };

  const addItem = (item) => {
    setItemModal({ item_id: item.id, item_name: item.name, unit: item.unit || '',
      feet: '', inch: '', length: '', width: '', totalRnft: '', sqm: '', rnmt: '', rnft: '', bundle: '', quantity: '1', rate: '', discount: '', total: '' });
    setItemSearch(''); setItemSugg([]);
  };

  const updateItemModal = (key, val) => {
    setItemModal(prev => {
      const next = { ...prev, [key]: val };
      const rate = parseFloat(next.rate) || 0;
      const qty = parseFloat(next.quantity) || 0;
      const disc = parseFloat(next.discount) || 0;
      next.total = String(((rate * qty) - (rate * qty * disc / 100)).toFixed(2));
      return next;
    });
  };

  const confirmItemModal = () => {
    if (!itemModal) return;
    const { _editIdx, ...data } = itemModal;
    const item = { ...data, price: data.rate };
    if (_editIdx !== undefined) {
      setOrderItems(prev => prev.map((it, i) => i === _editIdx ? item : it));
    } else {
      setOrderItems(prev => [...prev, item]);
    }
    setItemModal(null);
  };

  const updateItem = (idx, field, val) => {
    setOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  const removeItem = (idx) => setOrderItems(prev => prev.filter((_, i) => i !== idx));

  const total = orderItems.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);

  const handleCreate = async () => {
    if (!customer.trim()) { setError('Customer name is required.'); return; }
    if (!orderItems.length) { setError('Add at least one item.'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/orders', {
        customer_name: customer.trim(),
        customer_ledger_id: selectedLedger?.id || null,
        date: dayjs(date, 'DD-MM-YYYY').format('YYYY-MM-DD'),
        notes: notes.trim() || null,
        items: orderItems.map(i => ({
          item_id: i.item_id, item_name: i.item_name,
          quantity: parseFloat(i.quantity) || 1,
          price: parseFloat(i.price) || 0,
          unit: i.unit,
        })),
      });
      onCreated();
    } catch (e) {
      setError(e?.error || 'Failed to create order.');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={m.backdrop}>
        <View style={m.sheet}>
          {/* Header */}
          <View style={m.header}>
            <Text style={m.title}>Create Order</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}><Ionicons name="close" size={24} color="#64748B" /></TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {error ? <View style={m.errBox}><Text style={m.errTxt}>{error}</Text></View> : null}

            {/* Customer + Date row */}
            <View style={m.row}>
              <View style={{ flex: 1 }}>
                <Text style={[m.label, { paddingHorizontal: 0 }]}>CUSTOMER</Text>
                <View style={[m.inputBox, { marginHorizontal: 0 }]}>
                  <Ionicons name="search-outline" size={15} color="#94A3B8" />
                  <TextInput
                    style={m.input}
                    placeholder="Search customer..."
                    placeholderTextColor="#94A3B8"
                    value={customer}
                    onChangeText={onCustomerChange}
                  />
                </View>
                {ledgerSugg.length > 0 && (
                  <View style={[m.sugg, { marginHorizontal: 0 }]}>
                    {ledgerSugg.map(l => (
                      <TouchableOpacity key={l.id} style={m.suggItem} onPress={() => { setCustomer(l.name); setSelectedLedger(l); setLedgerSugg([]); }}>
                        <Ionicons name="person-outline" size={13} color="#64748B" />
                        <Text style={m.suggTxt}>{l.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <View style={{ width: 160 }}>
                <Text style={[m.label, { paddingHorizontal: 0 }]}>DATE</Text>
                <View style={[m.inputBox, { marginHorizontal: 0 }]}>
                  <TextInput style={m.input} value={date} onChangeText={setDate} />
                  <Ionicons name="calendar-outline" size={15} color="#94A3B8" />
                </View>
              </View>
            </View>

            {/* Items */}
            <Text style={[m.label, { marginTop: 16, marginBottom: 8 }]}>ADD ITEMS</Text>
            <View style={m.inputBox}>
              <Ionicons name="search-outline" size={15} color="#94A3B8" />
              <TextInput
                style={m.input}
                placeholder="Type 3+ letters to search item..."
                placeholderTextColor="#94A3B8"
                value={itemSearch}
                onChangeText={onItemSearch}
              />
            </View>
            {itemSugg.length > 0 && (
              <View style={m.sugg}>
                {itemSugg.map(i => (
                  <TouchableOpacity key={i.id} style={m.suggItem} onPress={() => addItem(i)}>
                    <Ionicons name="cube-outline" size={13} color="#64748B" />
                    <Text style={m.suggTxt}>{i.name}</Text>
                    {i.unit ? <Text style={m.suggUnit}>{i.unit}</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Order Items list */}
            {orderItems.length > 0 && (
              <View style={m.itemsTable}>
                <View style={m.itemsHeader}>
                  <Text style={[m.iht, { flex: 3 }]}>Item</Text>
                  <Text style={[m.iht, { flex: 1, textAlign: 'center' }]}>Qty</Text>
                  <Text style={[m.iht, { flex: 1, textAlign: 'center' }]}>Rate</Text>
                  <Text style={[m.iht, { flex: 1, textAlign: 'center' }]}>Disc%</Text>
                  <Text style={[m.iht, { flex: 1.2, textAlign: 'right' }]}>Total</Text>
                  <View style={{ width: 56 }} />
                </View>
                {orderItems.map((it, idx) => (
                  <View key={idx} style={m.itemRow}>
                    <View style={{ flex: 3 }}>
                      <Text style={m.itemName}>{it.item_name}</Text>
                      {it.unit ? <Text style={m.itemUnit}>{it.unit}</Text> : null}
                    </View>
                    <Text style={[m.cellText, { flex: 1, textAlign: 'center' }]}>{it.quantity || '-'}</Text>
                    <Text style={[m.cellText, { flex: 1, textAlign: 'center' }]}>{it.rate || '-'}</Text>
                    <Text style={[m.cellText, { flex: 1, textAlign: 'center' }]}>{it.discount || '0'}%</Text>
                    <Text style={[m.subtotal, { flex: 1.2 }]}>₹{parseFloat(it.total || 0).toFixed(2)}</Text>
                    <TouchableOpacity onPress={() => setItemModal({ ...it, _editIdx: idx })} style={{ width: 28, alignItems: 'center' }}>
                      <Ionicons name="pencil" size={15} color="#F87171" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeItem(idx)} style={{ width: 28, alignItems: 'center' }}>
                      <Ionicons name="close-circle" size={18} color="#F87171" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 12 }} />
          </ScrollView>

          {/* Add Notes — sits between content and footer */}
          <TouchableOpacity style={m.notesBtn} onPress={() => setShowNotes(true)}>
            <Ionicons name="chatbox-outline" size={14} color="#64748B" />
            <Text style={m.notesBtnTxt}>{notes ? 'Edit Notes' : 'Add Notes'}</Text>
            {notes ? <View style={m.notesDot} /> : null}
          </TouchableOpacity>

          {/* Footer */}
          <View style={m.footer}>
            <View>
              <Text style={m.totalLabel}>TOTAL</Text>
              <Text style={m.totalVal}>₹{total.toFixed(2)}</Text>
            </View>
            <View style={m.footerBtns}>
              <TouchableOpacity style={m.cancelBtn} onPress={onClose}>
                <Text style={m.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.createBtn} onPress={handleCreate} disabled={saving}>
                <Text style={m.createTxt}>{saving ? 'Creating...' : 'Create Order'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Item Detail Modal */}
      <Modal visible={!!itemModal} transparent animationType="fade" onRequestClose={() => setItemModal(null)}>
        <View style={im.backdrop}>
          <View style={im.sheet}>
            <View style={im.header}>
              <Text style={im.title}>{itemModal?.item_name || 'Item Details'}</Text>
              <TouchableOpacity onPress={() => setItemModal(null)}><Ionicons name="close" size={22} color="#64748B" /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={im.grid}>
                {[
                  { key: 'feet', label: 'Feet' }, { key: 'inch', label: 'Inch' },
                  { key: 'length', label: 'Length' }, { key: 'width', label: 'Width' },
                  { key: 'totalRnft', label: 'Total RNFT' }, { key: 'sqm', label: 'SQM' },
                  { key: 'rnmt', label: 'RNMT' }, { key: 'rnft', label: 'RNFT' },
                  { key: 'bundle', label: 'Bundle' }, { key: 'quantity', label: 'Qty' },
                  { key: 'rate', label: 'Rate' }, { key: 'discount', label: 'Discount %' },
                ].map(f => (
                  <View key={f.key} style={im.field}>
                    <Text style={im.fieldLabel}>{f.label}</Text>
                    <TextInput
                      style={im.fieldInput}
                      value={String(itemModal?.[f.key] || '')}
                      onChangeText={v => updateItemModal(f.key, v)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#CBD5E1"
                    />
                  </View>
                ))}
                <View style={im.field}>
                  <Text style={im.fieldLabel}>Total</Text>
                  <View style={[im.fieldInput, { backgroundColor: '#EEF2FF' }]}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>₹{itemModal?.total || '0.00'}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
            <View style={im.footer}>
              <TouchableOpacity style={im.cancelBtn} onPress={() => setItemModal(null)}>
                <Text style={im.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={im.addBtn} onPress={confirmItemModal}>
                <Text style={im.addTxt}>{itemModal?._editIdx !== undefined ? 'Update Item' : 'Add Item'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notes bottom sheet */}
      <Modal visible={showNotes} transparent animationType="slide" onRequestClose={() => setShowNotes(false)}>
        <View style={n.backdrop}>
          <View style={n.sheet}>
            <View style={n.header}>
              <Text style={n.title}>Order Notes</Text>
              <TouchableOpacity onPress={() => setShowNotes(false)}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
            </View>
            <TextInput
              style={n.input}
              placeholder="Add any notes for this order..."
              placeholderTextColor="#94A3B8"
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity style={n.doneBtn} onPress={() => setShowNotes(false)}>
              <Text style={n.doneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

// ─── Order Detail Modal ────────────────────────────────────────────────────────
function OrderDetailModal({ order, onClose, onDelete, onStatusChange }) {
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/orders/${order.id}`)
      .then(d => setDetail(d))
      .catch(() => setDetail({ ...order, items: [] }))
      .finally(() => setLoading(false));
  }, [order.id]);

  const sc = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
  const STATUSES = ['pending', 'confirmed', 'delivered', 'cancelled'];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={d.backdrop}>
        <View style={d.sheet}>
          <View style={d.header}>
            <View>
              <Text style={d.orderNum}>{order.order_number}</Text>
              <Text style={d.customer}>{order.customer_name}</Text>
            </View>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#64748B" /></TouchableOpacity>
          </View>

          <View style={d.metaRow}>
            <View style={[d.badge, { backgroundColor: sc.bg }]}>
              <Text style={[d.badgeTxt, { color: sc.text }]}>{order.status}</Text>
            </View>
            <Text style={d.metaDate}>{dayjs(order.date).format('DD MMM YYYY')}</Text>
            <Text style={d.metaTotal}>₹{parseFloat(order.total).toFixed(2)}</Text>
          </View>

          {/* Status change */}
          <View style={d.statusRow}>
            {STATUSES.map(st => (
              <TouchableOpacity
                key={st}
                style={[d.stBtn, order.status === st && d.stBtnActive]}
                onPress={() => onStatusChange(st)}
              >
                <Text style={[d.stTxt, order.status === st && d.stTxtActive]}>{st}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? <ActivityIndicator style={{ margin: 20 }} color={Colors.brandRed} /> : (
            <ScrollView style={{ maxHeight: 260 }}>
              {(detail?.items || []).map((it, i) => (
                <View key={i} style={d.itemRow}>
                  <Text style={d.itemName}>{it.item_name}</Text>
                  <Text style={d.itemQty}>{it.quantity} {it.unit || ''}</Text>
                  <Text style={d.itemPrice}>₹{parseFloat(it.price).toFixed(2)}</Text>
                  <Text style={d.itemSub}>₹{parseFloat(it.subtotal).toFixed(2)}</Text>
                </View>
              ))}
              {detail?.notes ? (
                <View style={d.notesBox}>
                  <Ionicons name="chatbox-outline" size={13} color="#94A3B8" />
                  <Text style={d.notesTxt}>{detail.notes}</Text>
                </View>
              ) : null}
            </ScrollView>
          )}

          <TouchableOpacity style={d.deleteBtn} onPress={onDelete}>
            <Ionicons name="trash-outline" size={15} color="#DC2626" />
            <Text style={d.deleteTxt}>Delete Order</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:   { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F8FAFC' },
  topBar:      { padding: 12, paddingBottom: 0 },
  searchBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', outlineStyle: 'none' },
  empty:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTxt:    { fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  card:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardRight:   { alignItems: 'flex-end', gap: 6 },
  orderNum:    { fontSize: 13, fontWeight: '800', color: '#1E293B' },
  customer:    { fontSize: 14, fontWeight: '600', color: '#0F172A', marginTop: 2 },
  total:       { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  badge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeTxt:    { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardBottom:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardDate:    { fontSize: 12, color: '#94A3B8' },
  dot:         { fontSize: 12, color: '#CBD5E1' },
  fab:         { position: 'absolute', bottom: 28, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.brandRed, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8 },
});

const m = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: '#fff' },
  sheet:       { flex: 1, backgroundColor: '#fff' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title:       { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  row:         { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 20 },
  label:       { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 6, paddingHorizontal: 20 },
  inputBox:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: '#F8FAFC', gap: 8, marginHorizontal: 20 },
  input:       { flex: 1, fontSize: 14, color: '#0F172A', outlineStyle: 'none' },
  sugg:        { marginHorizontal: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, overflow: 'hidden', marginTop: 2 },
  suggItem:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  suggTxt:     { fontSize: 13, color: '#0F172A', flex: 1 },
  suggUnit:    { fontSize: 11, color: '#94A3B8', backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  itemsTable:  { marginHorizontal: 20, marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, overflow: 'hidden' },
  itemsHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  iht:         { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
  itemRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 4 },
  itemName:    { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  itemUnit:    { fontSize: 10, color: '#94A3B8' },
  cellInput:   { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, paddingVertical: 5, paddingHorizontal: 4, fontSize: 13, color: '#0F172A', backgroundColor: '#fff' },
  cellText:    { fontSize: 13, color: '#0F172A' },
  subtotal:    { fontSize: 13, fontWeight: '700', color: '#0F172A', textAlign: 'right' },
  notesBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', marginRight: 20, marginBottom: 0, paddingHorizontal: 14, paddingVertical: 10 },
  notesBtnTxt: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  notesDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.brandRed },
  errBox:      { marginHorizontal: 20, marginTop: 12, backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#EF4444' },
  errTxt:      { fontSize: 12, color: '#B91C1C', fontWeight: '600' },
  footer:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  totalLabel:  { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
  totalVal:    { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  footerBtns:  { flexDirection: 'row', gap: 10 },
  cancelBtn:   { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  cancelTxt:   { fontSize: 14, fontWeight: '600', color: '#64748B' },
  createBtn:   { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 10, backgroundColor: Colors.brandRed },
  createTxt:   { fontSize: 14, fontWeight: '700', color: '#fff' },
});

const n = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  sheet:    { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title:    { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  input:    { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 14, fontSize: 14, color: '#0F172A', minHeight: 120, borderWidth: 1, borderColor: '#E2E8F0' },
  doneBtn:  { backgroundColor: Colors.brandRed, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  doneTxt:  { fontSize: 15, fontWeight: '700', color: '#fff' },
});

const im = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet:       { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, padding: 20 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:       { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field:       { width: '47%' },
  fieldLabel:  { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase' },
  fieldInput:  { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A', backgroundColor: '#F8FAFC', outlineStyle: 'none' },
  footer:      { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16 },
  cancelBtn:   { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  cancelTxt:   { fontSize: 14, fontWeight: '600', color: '#64748B' },
  addBtn:      { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 10, backgroundColor: Colors.brandRed },
  addTxt:      { fontSize: 14, fontWeight: '700', color: '#fff' },
});

const d = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet:       { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 20 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderNum:    { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  customer:    { fontSize: 17, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  badge:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTxt:    { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  metaDate:    { fontSize: 13, color: '#64748B', flex: 1 },
  metaTotal:   { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  statusRow:   { flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  stBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  stBtnActive: { backgroundColor: Colors.brandRed, borderColor: Colors.brandRed },
  stTxt:       { fontSize: 11, fontWeight: '600', color: '#64748B', textTransform: 'capitalize' },
  stTxtActive: { color: '#fff' },
  itemRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 8 },
  itemName:    { flex: 2.5, fontSize: 13, fontWeight: '600', color: '#0F172A' },
  itemQty:     { flex: 1.2, fontSize: 12, color: '#64748B', textAlign: 'center' },
  itemPrice:   { flex: 1.2, fontSize: 12, color: '#64748B', textAlign: 'center' },
  itemSub:     { flex: 1.5, fontSize: 13, fontWeight: '700', color: '#0F172A', textAlign: 'right' },
  notesBox:    { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 8, marginTop: 10 },
  notesTxt:    { fontSize: 13, color: '#64748B', flex: 1, lineHeight: 18 },
  deleteBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  deleteTxt:   { fontSize: 13, fontWeight: '700', color: '#DC2626' },
});
