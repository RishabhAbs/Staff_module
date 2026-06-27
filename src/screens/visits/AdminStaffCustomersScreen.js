import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image, Platform, RefreshControl, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { Colors } from '@constants/colors';
import api from '@services/api';

const ORIGIN = process.env.EXPO_PUBLIC_API_ORIGIN || '';
const buildUrl = (p) => (!p ? null : p.startsWith('http') ? p : `${ORIGIN}${p}`);
const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;
const dateKey = (d) => dayjs(d).format('YYYY-MM-DD');
const CATEGORY_SUGGESTIONS = ['Dealer', 'Customer', 'Distributor', 'Retailer', 'Wholesaler'];

// ── Build a Leaflet map with every visit as a marker ──────────────────────────
function buildVisitsMapHtml(visits) {
  const stops = visits.filter(s => s.latitude != null && s.longitude != null);
  if (stops.length === 0) return null;
  const center = stops[0];

  const markersJs = stops.map((v) => {
    const customer = (v.customer_name || 'Customer').replace(/'/g, "\\'");
    const timeStr  = dayjs(v.visited_at).format('DD MMM YYYY, hh:mm A');
    const dealer   = (v.dealer_name || '').replace(/'/g, "\\'");
    const category = (v.category || '').replace(/'/g, "\\'");
    return `
      markers['${v.id}'] = L.circleMarker([${v.latitude}, ${v.longitude}], {
        radius: 9, fillColor: '#C0392B', color: '#fff', weight: 1.5, fillOpacity: 0.95
      }).addTo(map).bindPopup(
        '<div style="font-family:sans-serif;min-width:160px;line-height:1.4">' +
        '<b style="font-size:13px">${customer}</b><br>' +
        '<span style="color:#64748B;font-size:11px">${timeStr}</span>' +
        '${dealer ? `<br><span style="font-size:12px;color:#334155">🏷️ ${dealer}</span>` : ''}' +
        '${category ? `<br><span style="font-size:12px;color:#334155">📁 ${category}</span>` : ''}' +
        '</div>'
      );`;
  }).join('\n');

  const polylineCoords = stops.map(s => `[${s.latitude},${s.longitude}]`).join(',');

  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%}</style>
</head><body>
<div id="map"></div>
<script>
  var map = L.map('map').setView([${center.latitude},${center.longitude}], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'© OpenStreetMap contributors', maxZoom:19
  }).addTo(map);
  var markers = {};
  ${markersJs}
  ${stops.length > 1 ? `map.fitBounds(L.latLngBounds([${polylineCoords}]), {padding:[40,40]});` : ''}
  window.addEventListener('message', function(e){
    var d = e.data;
    if (d && d.type === 'HIGHLIGHT_VISIT') {
      var m = markers[d.id];
      if (m) { map.setView(m.getLatLng(), 16); m.openPopup(); }
    }
  });
</script>
</body></html>`;
}

// ── Visit history row ─────────────────────────────────────────────────────────
function VisitRow({ v, onImagePress }) {
  return (
    <View style={s.histRow}>
      {v.shop_photo
        ? (
          <TouchableOpacity onPress={() => onImagePress?.(buildUrl(v.shop_photo))} activeOpacity={0.8}>
            <Image source={{ uri: buildUrl(v.shop_photo) }} style={s.histThumb} resizeMode="cover" />
          </TouchableOpacity>
        )
        : <View style={[s.histThumb, s.histThumbEmpty]}><Ionicons name="storefront-outline" size={18} color="#94A3B8" /></View>}
      <View style={{ flex: 1 }}>
        <Text style={s.histName}>{v.customer_name}</Text>
        <Text style={s.histSub}>
          {v.visit_status || v.category || 'Visit'}{v.dealer_name ? ` · ${v.dealer_name}` : ''}
        </Text>
        <Text style={s.histTime}>{dayjs(v.visited_at).format('DD MMM YYYY, hh:mm A')}</Text>
      </View>
      {v.latitude != null && v.longitude != null && Platform.OS === 'web' && (
        <TouchableOpacity onPress={() => window.open(mapsLink(v.latitude, v.longitude), '_blank')} style={s.locBtn}>
          <Ionicons name="location" size={15} color={Colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Customer detail (details + visit history for this salesperson) ─────────────
function CustomerDetailModal({ staffId, customer, onClose }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);
  useEffect(() => {
    if (!customer) return;
    setLoading(true);
    api.get(`/visits/by-staff/${staffId}/customer?name=${encodeURIComponent(customer.customer_name)}`)
      .then(r => setVisits(Array.isArray(r) ? r : [])).catch(() => setVisits([])).finally(() => setLoading(false));
  }, [staffId, customer]);
  if (!customer) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.modalCard} onPress={e => e.stopPropagation?.()}>
          <View style={s.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>{customer.customer_name}</Text>
              <Text style={s.modalSub}>{customer.category || 'Customer'}{customer.gst_number ? ` · GST ${customer.gst_number}` : ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 440 }}>
            <Text style={s.histLabel}>Customer details</Text>
            <View style={s.detailGrid}>
              {[
                ['Contact Person', customer.contact_person],
                ['Phone Number', customer.phone],
                ['Alternative No.', customer.alternative_no],
                ['Email', customer.email],
                ['Dealer Name', customer.dealer_name],
                ['GST Number', customer.gst_number],
                ['PAN Number', customer.pan_no],
                ['Address', customer.address],
                ['District', customer.district],
                ['State', customer.state],
                ['Pin No.', customer.pin_no],
              ].map(([label, val]) => (
                <View key={label} style={s.detailItem}>
                  <Text style={s.detailLabel}>{label}</Text>
                  <Text style={s.detailValue}>{val || 'N/A'}</Text>
                </View>
              ))}
            </View>
            <Text style={s.histLabel}>Visit history</Text>
            {loading ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
              : visits.length === 0
                ? <Text style={{ color: '#94A3B8', fontSize: 13, paddingVertical: 14 }}>No visits recorded.</Text>
                : visits.map(v => <VisitRow key={v.id} v={v} onImagePress={setLightbox} />)}
          </ScrollView>
        </Pressable>
      </Pressable>
      {lightbox && <ImageLightbox uri={lightbox} onClose={() => setLightbox(null)} />}
    </Modal>
  );
}

// ── Full-screen image viewer ──────────────────────────────────────────────────
function ImageLightbox({ uri, onClose }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.lightboxOverlay} onPress={onClose}>
        <TouchableOpacity style={s.lightboxClose} onPress={onClose}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <Pressable onPress={e => e.stopPropagation?.()}>
          <Image source={{ uri }} style={s.lightboxImg} resizeMode="contain" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Edit a salesperson's customer ─────────────────────────────────────────────
function CustomerEditModal({ staffId, customer, onClose, onSaved }) {
  const [customerName, setCustomerName] = useState(customer?.customer_name || '');
  const [gst, setGst]         = useState(customer?.gst_number || '');
  const [phone, setPhone]     = useState(customer?.phone || '');
  const [dealer, setDealer]   = useState(customer?.dealer_name || '');
  const [category, setCategory] = useState(customer?.category || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [district, setDistrict] = useState(customer?.district || '');
  const [stateName, setStateName] = useState(customer?.state || '');
  const [pinNo, setPinNo]     = useState(customer?.pin_no || '');
  const [contactPerson, setContactPerson] = useState(customer?.contact_person || '');
  const [altNo, setAltNo]     = useState(customer?.alternative_no || '');
  const [email, setEmail]     = useState(customer?.email || '');
  const [panNo, setPanNo]     = useState(customer?.pan_no || '');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [lightbox, setLightbox] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  // Pull the most recent shop photo for this customer
  useEffect(() => {
    if (!customer) return;
    api.get(`/visits/by-staff/${staffId}/customer?name=${encodeURIComponent(customer.customer_name)}`)
      .then(rows => {
        const withPhoto = (Array.isArray(rows) ? rows : []).find(v => v.shop_photo);
        setPhotoUrl(withPhoto ? buildUrl(withPhoto.shop_photo) : null);
      }).catch(() => setPhotoUrl(null));
  }, [staffId, customer]);

  if (!customer) return null;

  const submit = async () => {
    if (!customerName.trim()) { setError('Customer name is required.'); return; }
    setSaving(true); setError('');
    try {
      await api.put(`/visits/by-staff/${staffId}/customer`, {
        original_name: customer.customer_name,
        customer_name: customerName.trim(),
        gst_number: gst.trim(),
        phone: phone.trim(),
        dealer_name: dealer.trim(),
        category: category.trim(),
        address: address.trim(),
        district: district.trim(),
        state: stateName.trim(),
        pin_no: pinNo.trim(),
        contact_person: contactPerson.trim(),
        alternative_no: altNo.trim(),
        email: email.trim(),
        pan_no: panNo.trim(),
      });
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e?.error || e?.message || 'Failed to update customer.');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={s.overlay} onPress={onClose}>
    <Pressable style={s.formModalCard} onPress={e => e.stopPropagation?.()}>
      <View style={s.formModalHead}>
        <Text style={s.cardTitle}>Edit Customer</Text>
        <TouchableOpacity onPress={onClose} style={s.closeBtn}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
      </View>
      <ScrollView style={{ maxHeight: '78vh' }} showsVerticalScrollIndicator>
        {photoUrl && (
          <>
            <Text style={s.label}>Shop Photo</Text>
            <TouchableOpacity onPress={() => setLightbox(true)} activeOpacity={0.85}>
              <Image source={{ uri: photoUrl }} style={s.editPhoto} resizeMode="cover" />
            </TouchableOpacity>
          </>
        )}

        <Text style={s.label}>Customer Name *</Text>
        <TextInput style={s.input} value={customerName} onChangeText={setCustomerName} placeholder="Customer name" placeholderTextColor="#94A3B8" />

        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>GST No.</Text>
            <TextInput style={s.input} value={gst} onChangeText={setGst} placeholder="GST" placeholderTextColor="#94A3B8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Phone No.</Text>
            <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor="#94A3B8" keyboardType="phone-pad" />
          </View>
        </View>

        <Text style={s.label}>Dealer Name</Text>
        <TextInput style={s.input} value={dealer} onChangeText={setDealer} placeholder="Dealer name" placeholderTextColor="#94A3B8" />

        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Contact Person</Text>
            <TextInput style={s.input} value={contactPerson} onChangeText={setContactPerson} placeholder="Contact person" placeholderTextColor="#94A3B8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Alternative No.</Text>
            <TextInput style={s.input} value={altNo} onChangeText={setAltNo} placeholder="Alternative number" placeholderTextColor="#94A3B8" keyboardType="phone-pad" />
          </View>
        </View>

        <Text style={s.label}>Email</Text>
        <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor="#94A3B8" keyboardType="email-address" autoCapitalize="none" />

        <Text style={s.label}>Address</Text>
        <TextInput style={[s.input, s.textArea]} value={address} onChangeText={setAddress} placeholder="Shop / office address" placeholderTextColor="#94A3B8" multiline numberOfLines={2} />

        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>District</Text>
            <TextInput style={s.input} value={district} onChangeText={setDistrict} placeholder="District" placeholderTextColor="#94A3B8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>State</Text>
            <TextInput style={s.input} value={stateName} onChangeText={setStateName} placeholder="State" placeholderTextColor="#94A3B8" />
          </View>
        </View>

        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Pin No.</Text>
            <TextInput style={s.input} value={pinNo} onChangeText={setPinNo} placeholder="Pin code" placeholderTextColor="#94A3B8" keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>PAN No.</Text>
            <TextInput style={s.input} value={panNo} onChangeText={setPanNo} placeholder="PAN number" placeholderTextColor="#94A3B8" autoCapitalize="characters" />
          </View>
        </View>

        <Text style={s.label}>Category</Text>
        <TextInput style={s.input} value={category} onChangeText={setCategory} placeholder="Dealer, Customer, etc." placeholderTextColor="#94A3B8" />
        <View style={s.chipRow}>
          {CATEGORY_SUGGESTIONS.map(c => (
            <TouchableOpacity key={c} style={[s.chip, category === c && s.chipActive]} onPress={() => setCategory(c)}>
              <Text style={[s.chipTxt, category === c && s.chipTxtActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!!error && <Text style={s.errTxt}>{error}</Text>}

        <View style={s.editActionsRow}>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={saving}>
            <Text style={s.cancelBtnTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnTxt}>Save Changes</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Pressable>
    </Pressable>
    {lightbox && photoUrl && <ImageLightbox uri={photoUrl} onClose={() => setLightbox(false)} />}
    </Modal>
  );
}

export default function AdminStaffCustomersScreen({ navigation, route }) {
  const { staffId, staffName, filterDate, mode = 'customers' } = route.params || {};
  const isMap = mode === 'map';

  const [customers, setCustomers] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deletingName, setDeletingName] = useState(null);
  const scrollRef = useRef(null);
  const iframeRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const qs = filterDate ? `?date=${encodeURIComponent(filterDate)}` : '';
      const [cust, logs] = await Promise.all([
        api.get(`/visits/by-staff/${staffId}/customers${qs}`),
        api.get(`/visits/by-staff/${staffId}`),
      ]);
      setCustomers(Array.isArray(cust) ? cust : []);
      setVisits(Array.isArray(logs) ? logs : []);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [staffId, filterDate]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(async (c) => {
    const ok = Platform.OS === 'web'
      ? window.confirm(`Delete "${c.customer_name}" and all of ${staffName || 'this salesman'}'s visits to this customer? This cannot be undone.`)
      : true;
    if (!ok) return;
    setDeletingName(c.customer_name);
    try {
      await api.delete(`/visits/by-staff/${staffId}/customer?name=${encodeURIComponent(c.customer_name)}`);
      await load();
    } catch (e) {
      if (Platform.OS === 'web') window.alert(e?.error || e?.message || 'Failed to delete customer.');
    } finally { setDeletingName(null); }
  }, [staffId, staffName, load]);

  const q = search.trim().toLowerCase();
  const shownVisits = filterDate ? visits.filter(v => dateKey(v.visited_at) === filterDate) : visits;
  const mapHtml = buildVisitsMapHtml(shownVisits);

  const filteredCustomers = q
    ? customers.filter(c => (c.customer_name || '').toLowerCase().includes(q) || (c.dealer_name || '').toLowerCase().includes(q))
    : customers;
  const filteredVisits = q
    ? shownVisits.filter(v => (v.customer_name || '').toLowerCase().includes(q) || (v.dealer_name || '').toLowerCase().includes(q))
    : shownVisits;

  const highlightVisit = (v) => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: true });
    if (v.latitude != null && v.longitude != null) {
      setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage({ type: 'HIGHLIGHT_VISIT', id: v.id }, '*');
      }, 350);
    }
  };

  return (
    <View style={s.screen}>
      <ScrollView
        ref={scrollRef}
        style={s.container}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Colors.primary]} />}
      >
        <View style={s.searchRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={16} color={Colors.primary} />
            <Text style={s.backTxt}>Back</Text>
          </TouchableOpacity>
          <View style={s.searchBox}>
            <Ionicons name="search" size={16} color="#94A3B8" />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={isMap ? 'Search visit by customer or dealer…' : 'Search customer by name or dealer…'}
              placeholderTextColor="#94A3B8"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color="#CBD5E1" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : isMap ? (
          /* ── MAP MODE: full-screen map + visit list ─────────────────────── */
          <>
            {Platform.OS === 'web' && (
              mapHtml ? (
                <View style={s.mapWrap}>
                  <iframe ref={iframeRef} srcDoc={mapHtml} style={{ width: '100%', height: '100%', border: 'none' }} title="visits-map" />
                </View>
              ) : (
                <View style={[s.mapWrap, s.mapEmpty]}>
                  <Ionicons name="map-outline" size={34} color="#CBD5E1" />
                  <Text style={s.mapEmptyTxt}>{filterDate ? 'No located visits on this date' : 'No located visits to map'}</Text>
                </View>
              )
            )}
            <View style={s.card}>
              <Text style={s.cardTitle}>{staffName ? `${staffName} · Visits` : 'Visits'}{filterDate ? ` · ${dayjs(filterDate).format('DD MMM YYYY')}` : ''}</Text>
              {shownVisits.length === 0 ? (
                <View style={s.emptyBox}>
                  <Ionicons name="navigate-outline" size={40} color="#CBD5E1" />
                  <Text style={s.emptyTitle}>{filterDate ? 'No visits on this date' : 'No visits recorded yet'}</Text>
                </View>
              ) : filteredVisits.length === 0 ? (
                <Text style={{ color: '#94A3B8', fontSize: 13, paddingVertical: 14 }}>No visit matches “{search}”.</Text>
              ) : filteredVisits.map(v => {
                const hasLoc = v.latitude != null && v.longitude != null;
                return (
                  <TouchableOpacity key={v.id} style={s.custRow} onPress={() => highlightVisit(v)} activeOpacity={0.6}>
                    <View style={s.avatarSm}><Text style={s.avatarSmTxt}>{(v.customer_name || '?').charAt(0).toUpperCase()}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.custName}>{v.customer_name}</Text>
                      <Text style={s.custSub}>
                        {v.visit_status || v.category || 'Visit'}{v.dealer_name ? ` · ${v.dealer_name}` : ''}{v.phone ? ` · ${v.phone}` : ''}
                      </Text>
                      <View style={s.metaLine}>
                        <Ionicons name="time-outline" size={12} color="#94A3B8" />
                        <Text style={s.custMeta}>{dayjs(v.visited_at).format('DD MMM YYYY, hh:mm A')}</Text>
                      </View>
                    </View>
                    {hasLoc && (
                      <View style={s.locPin}>
                        <Ionicons name="location" size={15} color={Colors.primary} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          /* ── CUSTOMERS MODE: list with action buttons ───────────────────── */
          <View style={s.card}>
            <Text style={s.cardTitle}>Customers{filterDate ? ` · ${dayjs(filterDate).format('DD MMM YYYY')}` : ''}</Text>
            {customers.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="storefront-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>{filterDate ? `No customers visited on ${dayjs(filterDate).format('DD MMM YYYY')}` : 'No customers visited yet'}</Text>
              </View>
            ) : filteredCustomers.length === 0 ? (
              <Text style={{ color: '#94A3B8', fontSize: 13, paddingVertical: 14 }}>No customer matches “{search}”.</Text>
            ) : filteredCustomers.map(c => (
              <View key={c.customer_name} style={s.custRow}>
                <TouchableOpacity style={s.custRowMain} onPress={() => setDetailCustomer(c)} activeOpacity={0.6}>
                  <View style={s.avatarSm}><Text style={s.avatarSmTxt}>{(c.customer_name || '?').charAt(0).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.custName}>{c.customer_name}</Text>
                    <Text style={s.custSub}>
                      {c.category || 'Customer'}{c.dealer_name ? ` · ${c.dealer_name}` : ''}{c.phone ? ` · ${c.phone}` : ''}
                    </Text>
                    <Text style={s.custMeta}>{c.visit_count} visit{c.visit_count == 1 ? '' : 's'} · last {dayjs(c.last_visited).format('DD MMM YYYY')}</Text>
                  </View>
                </TouchableOpacity>
                <View style={s.custActions}>
                  <TouchableOpacity style={s.custActionBtn} onPress={() => setDetailCustomer(c)} title="View details">
                    <Ionicons name="information-circle-outline" size={18} color="#0891B2" />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.custActionBtn} onPress={() => setEditingCustomer(c)} title="Edit customer">
                    <Ionicons name="pencil" size={15} color="#475569" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.custActionBtn, s.custDeleteBtn]}
                    onPress={() => handleDelete(c)}
                    disabled={deletingName === c.customer_name}
                    title="Delete customer"
                  >
                    {deletingName === c.customer_name
                      ? <ActivityIndicator size="small" color="#DC2626" />
                      : <Ionicons name="trash-outline" size={15} color="#DC2626" />}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {detailCustomer && (
        <CustomerDetailModal staffId={staffId} customer={detailCustomer} onClose={() => setDetailCustomer(null)} />
      )}
      {editingCustomer && (
        <CustomerEditModal staffId={staffId} customer={editingCustomer} onClose={() => setEditingCustomer(null)} onSaved={load} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen:    { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },
  container: { flex: 1, width: '100%' },
  content:   { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, width: '100%' },

  searchRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  mapWrap:    { width: 'auto', height: '55vh', minHeight: 320, marginHorizontal: -16, marginBottom: 14, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  mapEmpty:   { justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#F1F5F9' },
  mapEmptyTxt:{ fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  backBtn:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  backTxt:    { fontSize: 13, fontWeight: '700', color: Colors.primary },

  searchBox:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput:{ flex: 1, fontSize: 13, color: '#0F172A', outlineStyle: 'none' },

  card:      { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 12 },

  custRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  custRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  custActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  custActionBtn:{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  custDeleteBtn:{ backgroundColor: '#FEE2E2' },
  avatarSm:    { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary + '18', justifyContent: 'center', alignItems: 'center' },
  avatarSmTxt: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  custName:    { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  custSub:     { fontSize: 11, color: '#64748B', marginTop: 1 },
  custMeta:    { fontSize: 11, color: '#94A3B8' },
  metaLine:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  locLine:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, alignSelf: 'flex-start' },
  locTxt:      { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  locPin:      { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center' },

  emptyBox:    { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle:  { fontSize: 15, fontWeight: '800', color: '#1E293B' },

  // Modals
  overlay:   { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16, zIndex: 9998 },
  modalCard: { backgroundColor: '#fff', borderRadius: 18, width: '100%', maxWidth: 480, padding: 18 },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle:{ fontSize: 16, fontWeight: '800', color: '#1E293B' },
  modalSub:  { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  closeBtn:  { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },

  formModalCard: { backgroundColor: '#fff', borderRadius: 18, width: '100%', maxWidth: 520, paddingHorizontal: 18, paddingBottom: 18, paddingTop: 14 },
  formModalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },

  label:     { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 5, marginTop: 4 },
  input:     { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#0F172A', outlineStyle: 'none' },
  textArea:  { minHeight: 60, textAlignVertical: 'top' },
  row2:      { flexDirection: 'row', gap: 10 },

  chipRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
  chip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F8FAFC' },
  chipActive:{ borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },
  chipTxt:   { fontSize: 12, color: '#475569', fontWeight: '600' },
  chipTxtActive: { color: Colors.primary, fontWeight: '700' },

  errTxt:    { fontSize: 12, color: '#DC2626', marginTop: 10, fontWeight: '600' },
  editActionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 11, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cancelBtnTxt: { fontSize: 13, fontWeight: '700', color: '#475569' },
  saveBtn:   { flex: 1, backgroundColor: Colors.primary, paddingVertical: 11, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  saveBtnTxt:{ fontSize: 13, fontWeight: '700', color: '#fff' },

  histLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  histRow:   { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  histThumb: { width: 46, height: 46, borderRadius: 10 },
  histThumbEmpty: { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  histName:  { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  histSub:   { fontSize: 11, color: '#64748B', marginTop: 1 },
  histTime:  { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  locBtn:    { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center' },

  editPhoto:  { width: '100%', height: 180, borderRadius: 12, marginBottom: 6, backgroundColor: '#F1F5F9' },
  lightboxOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 9999 },
  lightboxClose:   { position: 'absolute', top: 18, right: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  lightboxImg:     { width: '88vw', height: '82vh', maxWidth: 900 },
  detailGrid: { gap: 12, marginBottom: 4 },
  detailItem: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 10 },
  detailLabel:{ fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  detailValue:{ fontSize: 14, fontWeight: '600', color: '#1E293B' },
});
