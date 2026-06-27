import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image, Platform, useWindowDimensions, RefreshControl,
  Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import Navbar from '@components/common/Navbar';
import { Colors } from '@constants/colors';
import { useAuthStore } from '@store/authStore';
import api from '@services/api';

const ORIGIN = process.env.EXPO_PUBLIC_API_ORIGIN || '';
const buildUrl = (p) => (!p ? null : p.startsWith('http') ? p : `${ORIGIN}${p}`);
const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;
const dateKey = (d) => dayjs(d).format('YYYY-MM-DD');

const CATEGORY_SUGGESTIONS = ['Dealer', 'Customer', 'Distributor', 'Retailer', 'Wholesaler'];
const VISIT_STATUS_SUGGESTIONS = ['Visited', 'Order Taken', 'Follow-up', 'No Order', 'Closed'];

// ── Live camera capture (web webcam via getUserMedia) ─────────────────────────
function CameraCaptureModal({ onClose, onCapture }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [snapping, setSnapping] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setError('Camera is not supported in this browser. Please use Upload instead.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        setError('Unable to access the camera. Please allow camera permission, or use Upload.');
      }
    })();
    return () => { active = false; if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
  }, []);

  const snap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setSnapping(true);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      setSnapping(false);
      if (!blob) return;
      const file = new File([blob], `shop_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture?.(file);
      onClose?.();
    }, 'image/jpeg', 0.9);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.cameraCard} onPress={e => e.stopPropagation?.()}>
          <View style={s.formModalHead}>
            <Text style={s.cardTitle}>Take Photo</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
          </View>

          {error ? (
            <View style={s.cameraError}>
              <Ionicons name="camera-outline" size={36} color="#CBD5E1" />
              <Text style={s.cameraErrorTxt}>{error}</Text>
            </View>
          ) : (
            <View style={s.cameraVideoWrap}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {!ready && <ActivityIndicator color="#fff" style={s.cameraSpinner} />}
            </View>
          )}

          <View style={s.editActionsRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelBtnTxt}>Cancel</Text>
            </TouchableOpacity>
            {!error && (
              <TouchableOpacity style={[s.saveBtn, (!ready || snapping) && { opacity: 0.6 }]} onPress={snap} disabled={!ready || snapping}>
                {snapping ? <ActivityIndicator size="small" color="#fff" /> : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="camera" size={16} color="#fff" />
                    <Text style={s.saveBtnTxt}>Capture</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── User: punch a field visit (modal) ─────────────────────────────────────────
function VisitFormModal({ visible, onClose, onSaved }) {
  const [customerName, setCustomerName] = useState('');
  const [gst, setGst]         = useState('');
  const [phone, setPhone]     = useState('');
  const [dealer, setDealer]   = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress]   = useState('');
  const [district, setDistrict] = useState('');
  const [stateName, setStateName] = useState('');
  const [pinNo, setPinNo]     = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [altNo, setAltNo]     = useState('');
  const [email, setEmail]     = useState('');
  const [panNo, setPanNo]     = useState('');
  const [visitStatus, setVisitStatus] = useState('');
  const [comment, setComment] = useState('');
  const [coords, setCoords]   = useState(null);
  const [photo, setPhoto]     = useState(null); // File
  const [photoPreview, setPhotoPreview] = useState(null);
  const [nearby, setNearby]   = useState([]);
  const [radius, setRadius]   = useState('2000');
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [locating, setLocating] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [ok, setOk]           = useState('');
  const uploadRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const { user } = useAuthStore();

  const today = dayjs().format('DD MMM YYYY');

  const captureLocation = useCallback(() => {
    if (Platform.OS !== 'web' || !navigator?.geolocation) { setLocating(false); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setCoords(c);
        setLocating(false);
        api.post('/location/update', c).catch(() => {});
      },
      () => { setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => { if (visible) captureLocation(); }, [visible, captureLocation]);

  // Track whether current detail values came from auto-fill (avoids wiping manual entries)
  const autoFilledRef = useRef(false);
  useEffect(() => { autoFilledRef.current = autoFilled; }, [autoFilled]);

  // Reset only the auto-fillable master fields (keeps visit-specific status/comment)
  const clearAutoFilled = useCallback(() => {
    setGst(''); setPhone(''); setDealer(''); setCategory('');
    setAddress(''); setDistrict(''); setStateName(''); setPinNo('');
    setContactPerson(''); setAltNo(''); setEmail(''); setPanNo('');
  }, []);

  // Auto-fill known customer when name is typed (debounced)
  useEffect(() => {
    const name = customerName.trim();
    if (!name) {
      if (autoFilledRef.current) clearAutoFilled();
      setAutoFilled(false);
      return;
    }
    const t = setTimeout(() => {
      api.get(`/visits/lookup?name=${encodeURIComponent(name)}`).then(row => {
        if (row) {
          setGst(row.gst_number || '');
          setPhone(row.phone || '');
          setDealer(row.dealer_name || '');
          setCategory(row.category || '');
          setAddress(row.address || '');
          setDistrict(row.district || '');
          setStateName(row.state || '');
          setPinNo(row.pin_no || '');
          setContactPerson(row.contact_person || '');
          setAltNo(row.alternative_no || '');
          setEmail(row.email || '');
          setPanNo(row.pan_no || '');
          setAutoFilled(true);
        } else {
          if (autoFilledRef.current) clearAutoFilled();
          setAutoFilled(false);
        }
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [customerName, clearAutoFilled]);

  const onPickPhoto = (e) => {
    const f = e.target.files?.[0];
    if (f) { setPhoto(f); setPhotoPreview(URL.createObjectURL(f)); }
  };

  const submit = async () => {
    if (!customerName.trim()) { setError('Customer name is required.'); return; }
    setSaving(true); setError(''); setOk('');
    try {
      const form = new FormData();
      form.append('customer_name', customerName.trim());
      form.append('gst_number', gst.trim());
      form.append('phone', phone.trim());
      form.append('dealer_name', dealer.trim());
      form.append('category', category.trim());
      form.append('address', address.trim());
      form.append('district', district.trim());
      form.append('state', stateName.trim());
      form.append('pin_no', pinNo.trim());
      form.append('contact_person', contactPerson.trim());
      form.append('alternative_no', altNo.trim());
      form.append('email', email.trim());
      form.append('pan_no', panNo.trim());
      form.append('visit_status', visitStatus.trim());
      form.append('comment', comment.trim());
      if (coords) { form.append('latitude', coords.latitude); form.append('longitude', coords.longitude); }
      if (photo) form.append('shop_photo', photo);
      await api.postForm('/visits', form);
      setCustomerName(''); setGst(''); setPhone(''); setDealer(''); setCategory('');
      setAddress(''); setDistrict(''); setStateName(''); setPinNo(''); setContactPerson('');
      setAltNo(''); setEmail(''); setPanNo(''); setVisitStatus(''); setComment('');
      setPhoto(null); setPhotoPreview(null); setAutoFilled(false);
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e?.error || e?.message || 'Failed to record visit.');
    } finally { setSaving(false); }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={s.overlay} onPress={onClose}>
    <Pressable style={s.formModalCard} onPress={e => e.stopPropagation?.()}>
      <View style={s.formModalHead}>
        <Text style={s.cardTitle}>Punch a Visit</Text>
        <TouchableOpacity onPress={onClose} style={s.closeBtn}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
      </View>
      <ScrollView style={{ maxHeight: '78vh' }} showsVerticalScrollIndicator>

      <View style={s.metaRow}>
        <View style={s.metaItem}><Ionicons name="calendar-outline" size={14} color="#64748B" /><Text style={s.metaTxt}>{today}</Text></View>
        <View style={s.metaItem}><Ionicons name="person-outline" size={14} color="#64748B" /><Text style={s.metaTxt}>{user?.name || user?.username}</Text></View>
        <View style={s.metaItem}>
          <Ionicons name="location-outline" size={14} color={coords ? '#16A34A' : '#DC2626'} />
          <Text style={[s.metaTxt, { color: coords ? '#16A34A' : '#DC2626' }]}>
            {locating ? 'Locating…' : coords ? 'Location captured' : 'No location'}
          </Text>
          {!locating && !coords && <TouchableOpacity onPress={captureLocation}><Text style={s.retryTxt}>Retry</Text></TouchableOpacity>}
        </View>
      </View>

      <Text style={s.label}>Customer Name *</Text>
      <TextInput style={s.input} value={customerName} onChangeText={setCustomerName}
        placeholder="Type customer name" placeholderTextColor="#94A3B8" />
      {autoFilled && (
        <View style={s.autoFillNote}>
          <Ionicons name="sparkles-outline" size={12} color="#0891B2" />
          <Text style={s.autoFillTxt}>Existing customer — details auto-filled. You can edit them.</Text>
        </View>
      )}

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

      <Text style={s.label}>Visit Status</Text>
      <TextInput style={s.input} value={visitStatus} onChangeText={setVisitStatus} placeholder="e.g. Visited, Order Taken" placeholderTextColor="#94A3B8" />
      <View style={s.chipRow}>
        {VISIT_STATUS_SUGGESTIONS.map(c => (
          <TouchableOpacity key={c} style={[s.chip, visitStatus === c && s.chipActive]} onPress={() => setVisitStatus(c)}>
            <Text style={[s.chipTxt, visitStatus === c && s.chipTxtActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Comment</Text>
      <TextInput style={[s.input, s.textArea]} value={comment} onChangeText={setComment} placeholder="Add a note about this visit" placeholderTextColor="#94A3B8" multiline numberOfLines={3} />

      <Text style={s.label}>Shop Photo</Text>
      {Platform.OS === 'web' && (
        <>
          <View style={s.photoBtnRow}>
            <TouchableOpacity style={[s.photoBtn, { flex: 1 }]} onPress={() => setCameraOpen(true)}>
              <Ionicons name="camera-outline" size={18} color={Colors.primary} />
              <Text style={s.photoBtnTxt}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.photoBtn, { flex: 1 }]} onPress={() => uploadRef.current?.click()}>
              <Ionicons name="cloud-upload-outline" size={18} color={Colors.primary} />
              <Text style={s.photoBtnTxt}>Upload</Text>
            </TouchableOpacity>
          </View>
          <input ref={uploadRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickPhoto} />
          {photoPreview && <Image source={{ uri: photoPreview }} style={s.photoPreview} resizeMode="cover" />}
          {cameraOpen && (
            <CameraCaptureModal
              onClose={() => setCameraOpen(false)}
              onCapture={(file) => { setPhoto(file); setPhotoPreview(URL.createObjectURL(file)); }}
            />
          )}
        </>
      )}

      {!!error && <Text style={s.errTxt}>{error}</Text>}
      {!!ok && <Text style={s.okTxt}>{ok}</Text>}

      <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <><Ionicons name="checkmark-circle-outline" size={18} color="#fff" /><Text style={s.submitTxt}>Submit Visit</Text></>}
      </TouchableOpacity>

      {coords && (
        <View style={s.nearbyBox}>
          <Text style={s.nearbyTitle}>Nearby Parties</Text>
          <View style={s.radiusRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Radius (in meters)</Text>
              <TextInput
                style={s.input}
                value={radius}
                onChangeText={(t) => setRadius(t.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 2000"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
              />
            </View>
            <TouchableOpacity
              style={[s.radiusBtn, loadingNearby && { opacity: 0.6 }]}
              disabled={loadingNearby || !radius}
              onPress={() => {
                if (!coords || !radius) return;
                setLoadingNearby(true);
                api.get(`/visits/nearby?lat=${coords.latitude}&lng=${coords.longitude}&radius=${radius}`)
                  .then(r => setNearby(r || []))
                  .catch(() => setNearby([]))
                  .finally(() => setLoadingNearby(false));
              }}
            >
              {loadingNearby
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="search" size={15} color="#fff" /><Text style={s.radiusBtnTxt}>Search</Text></>
              }
            </TouchableOpacity>
          </View>

          {nearby.length > 0 ? (
            <>
              <Text style={[s.nearbyTitle, { marginTop: 12 }]}>Other parties near you ({nearby.length})</Text>
              {nearby.map(n => (
                <TouchableOpacity key={n.id} style={s.nearbyRow} onPress={() => setCustomerName(n.customer_name)}>
                  <Ionicons name="storefront-outline" size={15} color="#64748B" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.nearbyName}>{n.customer_name}</Text>
                    <Text style={s.nearbySub}>{n.category || 'Party'}{n.dealer_name ? ` · ${n.dealer_name}` : ''}</Text>
                  </View>
                  <Text style={s.nearbyDist}>{n.distance < 1000 ? `${n.distance} m` : `${(n.distance / 1000).toFixed(1)} km`}</Text>
                </TouchableOpacity>
              ))}
            </>
          ) : !loadingNearby && nearby.length === 0 && (
            <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
              Enter radius and tap Search to find nearby parties.
            </Text>
          )}
        </View>
      )}
      </ScrollView>
    </Pressable>
    </Pressable>
    </Modal>
  );
}

// ── User: list of customers I've visited (one row each) ───────────────────────
function CustomerList({ customers, onOpen, onEdit, onDelete }) {
  if (!customers.length) {
    return (
      <View style={s.emptyBox}>
        <Ionicons name="storefront-outline" size={40} color="#CBD5E1" />
        <Text style={s.emptyTitle}>No customers visited yet</Text>
        <Text style={s.emptySub}>Tap “Add Visit” to punch your first customer visit.</Text>
      </View>
    );
  }
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>My Customers</Text>
      {customers.map(c => (
        <View key={c.customer_name} style={s.custRow}>
          <TouchableOpacity style={s.custRowMain} onPress={() => onOpen(c)} activeOpacity={0.6}>
            <View style={s.avatar}><Text style={s.avatarTxt}>{(c.customer_name || '?').charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.custName}>{c.customer_name}</Text>
              <Text style={s.custSub}>
                {c.category || 'Customer'}{c.dealer_name ? ` · ${c.dealer_name}` : ''}
                {c.phone ? ` · ${c.phone}` : ''}
              </Text>
              <Text style={s.custMeta}>{c.visit_count} visit{c.visit_count == 1 ? '' : 's'} · last {dayjs(c.last_visited).format('DD MMM YYYY')}</Text>
            </View>
          </TouchableOpacity>
          <View style={s.custActions}>
            <TouchableOpacity style={s.custActionBtn} onPress={() => onOpen(c)} title="View details">
              <Ionicons name="information-circle-outline" size={18} color="#0891B2" />
            </TouchableOpacity>
            <TouchableOpacity style={s.custActionBtn} onPress={() => onEdit(c)} title="Edit customer">
              <Ionicons name="pencil" size={15} color="#475569" />
            </TouchableOpacity>
            <TouchableOpacity style={[s.custActionBtn, s.custDeleteBtn]} onPress={() => onDelete(c)} title="Delete customer">
              <Ionicons name="trash-outline" size={15} color="#DC2626" />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── User: edit one of my customers (master + my logs) ─────────────────────────
function CustomerEditModal({ customer, onClose, onSaved }) {
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
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  if (!customer) return null;

  const submit = async () => {
    if (!customerName.trim()) { setError('Customer name is required.'); return; }
    setSaving(true); setError('');
    try {
      await api.put('/visits/customer', {
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
    </Modal>
  );
}

// ── Customer detail (visits to one customer) ──────────────────────────────────
function CustomerDetailModal({ customer, onClose }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!customer) return;
    setLoading(true);
    api.get(`/visits/my-customer?name=${encodeURIComponent(customer.customer_name)}`)
      .then(r => setVisits(Array.isArray(r) ? r : [])).catch(() => setVisits([])).finally(() => setLoading(false));
  }, [customer]);
  if (!customer) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.modalCard} onPress={e => e.stopPropagation?.()}>
          <View style={s.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>{customer.customer_name}</Text>
              <Text style={s.modalSub}>
                {customer.category || 'Customer'}{customer.gst_number ? ` · GST ${customer.gst_number}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 440 }}>
            <Text style={s.histLabel}>Customer details</Text>
            <View style={s.detailGrid}>
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>Contact Person</Text>
                <Text style={s.detailValue}>{customer.contact_person || 'N/A'}</Text>
              </View>
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>Phone Number</Text>
                <Text style={s.detailValue}>{customer.phone || 'N/A'}</Text>
              </View>
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>Alternative No.</Text>
                <Text style={s.detailValue}>{customer.alternative_no || 'N/A'}</Text>
              </View>
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>Email</Text>
                <Text style={s.detailValue}>{customer.email || 'N/A'}</Text>
              </View>
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>Dealer Name</Text>
                <Text style={s.detailValue}>{customer.dealer_name || 'N/A'}</Text>
              </View>
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>GST Number</Text>
                <Text style={s.detailValue}>{customer.gst_number || 'N/A'}</Text>
              </View>
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>PAN Number</Text>
                <Text style={s.detailValue}>{customer.pan_no || 'N/A'}</Text>
              </View>
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>Address</Text>
                <Text style={s.detailValue}>{customer.address || 'N/A'}</Text>
              </View>
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>District</Text>
                <Text style={s.detailValue}>{customer.district || 'N/A'}</Text>
              </View>
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>State</Text>
                <Text style={s.detailValue}>{customer.state || 'N/A'}</Text>
              </View>
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>Pin No.</Text>
                <Text style={s.detailValue}>{customer.pin_no || 'N/A'}</Text>
              </View>
            </View>

            <Text style={s.histLabel}>Visit history</Text>
            {loading ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
              : visits.map(v => <VisitRow key={v.id} v={v} />)}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}



function VisitRow({ v, showSalesperson, onLocPress, onPress }) {
  const content = (
    <>
      {v.shop_photo
        ? <Image source={{ uri: buildUrl(v.shop_photo) }} style={s.histThumb} resizeMode="cover" />
        : <View style={[s.histThumb, s.histThumbEmpty]}><Ionicons name="storefront-outline" size={18} color="#94A3B8" /></View>}
      <View style={{ flex: 1 }}>
        <Text style={s.histName}>{v.customer_name}</Text>
        <Text style={s.histSub}>
          {v.category || 'Visit'}{v.dealer_name ? ` · ${v.dealer_name}` : ''}{v.phone ? ` · ${v.phone}` : ''}
        </Text>
        <Text style={s.histTime}>
          {showSalesperson ? `${v.salesperson_name} · ` : ''}{dayjs(v.visited_at).format('DD MMM YYYY, hh:mm A')}
        </Text>
      </View>
    </>
  );

  return (
    <View style={s.histRow}>
      {onPress ? (
        <TouchableOpacity style={s.histRowContent} onPress={onPress}>
          {content}
        </TouchableOpacity>
      ) : (
        <View style={s.histRowContent}>
          {content}
        </View>
      )}
      {v.latitude != null && v.longitude != null && Platform.OS === 'web' && (
        <TouchableOpacity 
          onPress={(e) => {
            e.stopPropagation();
            if (onLocPress) {
              onLocPress(v.latitude, v.longitude, v.id);
            } else {
              window.open(mapsLink(v.latitude, v.longitude), '_blank');
            }
          }} 
          style={s.locBtn}
        >
          <Ionicons name="location" size={15} color={Colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Build Leaflet HTML with all visits as markers ──────────────────────────────
function buildVisitsMapHtml(visits, personName) {
  const stops = visits.filter(s => s.latitude != null && s.longitude != null);
  if (stops.length === 0) return null;

  const center = stops[0];

  const markersJs = stops.map((v, i) => {
    const color = '#C0392B'; // Brand primary red
    const customer = (v.customer_name || 'Customer').replace(/'/g, "\\'");
    const timeStr = dayjs(v.visited_at).format('DD MMM YYYY, hh:mm A');
    const category = (v.category || '').replace(/'/g, "\\'");
    const dealer = (v.dealer_name || '').replace(/'/g, "\\'");
    
    return `
      markers['${v.id}'] = L.circleMarker([${v.latitude}, ${v.longitude}], {
        radius: 9,
        fillColor: '${color}',
        color: '#fff',
        weight: 1.5,
        fillOpacity: 0.95
      }).addTo(map).bindPopup(
        '<div style="font-family:sans-serif;min-width:160px;line-height:1.4">' +
        '<b style="font-size:13px">${customer}</b><br>' +
        '<span style="color:#64748B;font-size:11px">${timeStr}</span><br>' +
        '${dealer ? `<span style="font-size:12px;color:#334155">🏷️ ${dealer}</span><br>` : ''}' +
        '${category ? `<span style="font-size:12px;color:#334155">📁 ${category}</span>` : ''}' +
        '</div>'
      );
    `;
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
  ${stops.length > 1 ? `
    var bounds = L.latLngBounds([${polylineCoords}]);
    map.fitBounds(bounds, {padding:[40,40]});
  ` : ''}

  window.addEventListener('message', function(e) {
    var data = e.data;
    if (data && data.type === 'HIGHLIGHT_VISIT') {
      var marker = markers[data.id];
      if (marker) {
        map.setView(marker.getLatLng(), 16);
        marker.openPopup();
      }
    }
  });
</script>
</body></html>`;
}
// ── Admin: per-salesperson Track modal ────────────────────────────────────────
function TrackModal({ person, onClose, refreshKey, filterDate }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!person) return;
    setLoading(true);
    api.get(`/visits/by-staff/${person.id}`).then(r => setVisits(Array.isArray(r) ? r : [])).catch(() => setVisits([])).finally(() => setLoading(false));
  }, [person, refreshKey]);

  if (!person) return null;
  const shown = filterDate ? visits.filter(v => dateKey(v.visited_at) === filterDate) : visits;
  const mapHtml = buildVisitsMapHtml(shown, person.name);

  const highlightVisit = (lat, lng, id) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'HIGHLIGHT_VISIT',
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        id: id
      }, '*');
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.modalCard} onPress={e => e.stopPropagation?.()}>
          <View style={s.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>{person.name}</Text>
              <Text style={s.modalSub}>
                {shown.length} visit{shown.length === 1 ? '' : 's'}{filterDate ? ` · ${dayjs(filterDate).format('DD MMM YYYY')}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 40 }} />
          ) : (
            <>
              {mapHtml && Platform.OS === 'web' && (
                <View style={s.modalMapWrap}>
                  <iframe ref={iframeRef} srcDoc={mapHtml} style={{ width: '100%', height: '100%', border: 'none' }} title="visits-map" />
                </View>
              )}

              <ScrollView style={{ maxHeight: 280 }}>
                {shown.length === 0 ? (
                  <Text style={{ color: '#94A3B8', fontSize: 13, paddingVertical: 20, textAlign: 'center' }}>
                    {filterDate ? 'No visits on this date.' : 'No visits recorded yet.'}
                  </Text>
                ) : shown.map(v => (
                  <VisitRow 
                    key={v.id} 
                    v={v} 
                    onLocPress={(lat, lng, id) => highlightVisit(lat, lng, id)}
                  />
                ))}
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Admin: list of salespeople with Track buttons ─────────────────────────────
function AdminView({ staff, counts, onSelectStaff, refreshKey, filterDate, onFilterDateChange }) {
  const [search, setSearch] = useState('');
  const today = dateKey(new Date());
  const q = search.trim().toLowerCase();
  const filteredStaff = q ? staff.filter(p => (p.name || '').toLowerCase().includes(q)) : staff;
  return (
    <>
      <View style={s.adminToolbar}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={16} color="#94A3B8" />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search salesman by name…"
            placeholderTextColor="#94A3B8"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#CBD5E1" />
            </TouchableOpacity>
          ) : null}
        </View>
        {Platform.OS === 'web' && (
          <View style={s.dateFilterRow}>
            <input
              type="date"
              value={filterDate}
              max={today}
              onChange={(e) => onFilterDateChange(e.target.value)}
              style={{
                border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 10px',
                fontSize: 13, color: '#0F172A', background: '#F8FAFC', outline: 'none',
              }}
            />
          </View>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Salesman Tracking</Text>
        {staff.length === 0 ? (
          <Text style={{ color: '#94A3B8', fontSize: 13, paddingVertical: 10 }}>No staff found.</Text>
        ) : filteredStaff.length === 0 ? (
          <Text style={{ color: '#94A3B8', fontSize: 13, paddingVertical: 10 }}>No salesman matches “{search}”.</Text>
        ) : filteredStaff.map(p => (
        <TouchableOpacity key={p.id} style={s.staffRow} onPress={() => onSelectStaff(p)}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{(p.name || '?').charAt(0).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.staffName}>{p.name}</Text>
            <Text style={s.staffSub}>
              {counts[p.id] ? `${counts[p.id]} visit${counts[p.id] === 1 ? '' : 's'}` : 'No visits'}
              {p.last_seen ? ` · last active ${dayjs(p.last_seen).fromNow?.() || dayjs(p.last_seen).format('DD MMM, hh:mm A')}` : ''}
            </Text>
          </View>
          <TouchableOpacity style={s.trackBtn} onPress={(e) => { e.stopPropagation(); onSelectStaff(p, 'map'); }}>
            <Ionicons name="navigate-outline" size={14} color="#fff" />
            <Text style={s.trackBtnTxt}>Track</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
      </View>
    </>
  );
}

// ── Admin: Staff Visits Modal (displays all customer visits of a salesperson) ──
function StaffVisitsModal({ staff, onClose, onSelectVisit, refreshKey, filterDate }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!staff) return;
    setLoading(true);
    api.get(`/visits/by-staff/${staff.id}`)
      .then(r => setVisits(Array.isArray(r) ? r : []))
      .catch(() => setVisits([]))
      .finally(() => setLoading(false));
  }, [staff, refreshKey]);

  if (!staff) return null;
  const shown = filterDate ? visits.filter(v => dateKey(v.visited_at) === filterDate) : visits;
  const mapHtml = buildVisitsMapHtml(shown, staff.name);

  const highlightVisit = (lat, lng, id) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'HIGHLIGHT_VISIT',
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        id: id
      }, '*');
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.modalCard} onPress={e => e.stopPropagation?.()}>
          <View style={s.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>{staff.name}'s Visits</Text>
              <Text style={s.modalSub}>
                {shown.length} visit{shown.length === 1 ? '' : 's'}{filterDate ? ` · ${dayjs(filterDate).format('DD MMM YYYY')}` : ' recorded'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
          ) : (
            <>
              {mapHtml && Platform.OS === 'web' && (
                <View style={s.modalMapWrap}>
                  <iframe ref={iframeRef} srcDoc={mapHtml} style={{ width: '100%', height: '100%', border: 'none' }} title="visits-map" />
                </View>
              )}

              <ScrollView style={{ maxHeight: '40vh' }} showsVerticalScrollIndicator>
                {shown.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Ionicons name="storefront-outline" size={40} color="#CBD5E1" />
                    <Text style={s.emptyTitle}>{filterDate ? 'No visits on this date' : 'No visits recorded yet'}</Text>
                  </View>
                ) : (
                  shown.map(v => (
                    <VisitRow
                      key={v.id}
                      v={v}
                      onPress={() => onSelectVisit(v)}
                      onLocPress={(lat, lng, id) => highlightVisit(lat, lng, id)}
                    />
                  ))
                )}
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Admin/User: Visit Details Modal ──────────────────────────────────────────
// ── Admin/User: Visit Details Modal ──────────────────────────────────────────
function VisitDetailsModal({ visit, onClose, onRefresh }) {
  if (!visit) return null;

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [isEditing, setIsEditing] = useState(false);
  const [customerName, setCustomerName] = useState(visit.customer_name || '');
  const [category, setCategory] = useState(visit.category || '');
  const [dealerName, setDealerName] = useState(visit.dealer_name || '');
  const [phone, setPhone] = useState(visit.phone || '');
  const [gstNumber, setGstNumber] = useState(visit.gst_number || '');
  const [address, setAddress] = useState(visit.address || '');
  const [district, setDistrict] = useState(visit.district || '');
  const [stateName, setStateName] = useState(visit.state || '');
  const [pinNo, setPinNo] = useState(visit.pin_no || '');
  const [contactPerson, setContactPerson] = useState(visit.contact_person || '');
  const [altNo, setAltNo] = useState(visit.alternative_no || '');
  const [email, setEmail] = useState(visit.email || '');
  const [panNo, setPanNo] = useState(visit.pan_no || '');
  const [visitStatus, setVisitStatus] = useState(visit.visit_status || '');
  const [comment, setComment] = useState(visit.comment || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visit) {
      setCustomerName(visit.customer_name || '');
      setCategory(visit.category || '');
      setDealerName(visit.dealer_name || '');
      setPhone(visit.phone || '');
      setGstNumber(visit.gst_number || '');
      setAddress(visit.address || '');
      setDistrict(visit.district || '');
      setStateName(visit.state || '');
      setPinNo(visit.pin_no || '');
      setContactPerson(visit.contact_person || '');
      setAltNo(visit.alternative_no || '');
      setEmail(visit.email || '');
      setPanNo(visit.pan_no || '');
      setVisitStatus(visit.visit_status || '');
      setComment(visit.comment || '');
      setIsEditing(false);
      setError('');
    }
  }, [visit]);

  const latVal = visit.latitude != null ? parseFloat(visit.latitude) : NaN;
  const lngVal = visit.longitude != null ? parseFloat(visit.longitude) : NaN;
  const hasCoords = !isNaN(latVal) && !isNaN(lngVal);

  const mapUrl = hasCoords ? mapsLink(latVal, lngVal) : null;
  const imageUrl = buildUrl(visit.shop_photo);

  const handleSave = async () => {
    if (!customerName.trim()) {
      setError('Customer name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.put(`/visits/${visit.id}`, {
        customer_name: customerName.trim(),
        gst_number: gstNumber.trim(),
        phone: phone.trim(),
        dealer_name: dealerName.trim(),
        category: category.trim(),
        address: address.trim(),
        district: district.trim(),
        state: stateName.trim(),
        pin_no: pinNo.trim(),
        contact_person: contactPerson.trim(),
        alternative_no: altNo.trim(),
        email: email.trim(),
        pan_no: panNo.trim(),
        visit_status: visitStatus.trim(),
        comment: comment.trim(),
      });
      setIsEditing(false);
      onRefresh?.();
      onClose?.();
    } catch (e) {
      setError(e?.error || e?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = Platform.OS === 'web' 
      ? window.confirm('Are you sure you want to delete this visit?')
      : true;
    if (!ok) return;

    setDeleting(true);
    setError('');
    try {
      await api.delete(`/visits/${visit.id}`);
      onRefresh?.();
      onClose?.();
    } catch (e) {
      setError(e?.error || e?.message || 'Failed to delete visit.');
      setDeleting(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.modalCard} onPress={e => e.stopPropagation?.()}>
          <View style={s.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>{isEditing ? 'Edit Visit' : customerName}</Text>
              <Text style={s.modalSub}>
                {isEditing ? 'Modify field visit details' : `Recorded on ${dayjs(visit.visited_at).format('DD MMM YYYY, hh:mm A')}`}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isAdmin && !isEditing && (
                <>
                  <TouchableOpacity onPress={() => setIsEditing(true)} style={s.actionBtn} title="Edit Visit">
                    <Ionicons name="pencil" size={15} color="#475569" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDelete} style={[s.actionBtn, s.deleteActionBtn]} disabled={deleting} title="Delete Visit">
                    <Ionicons name="trash-outline" size={15} color="#DC2626" />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={{ maxHeight: '75vh' }} showsVerticalScrollIndicator>
            {/* Shop photo if exists */}
            {!isEditing && (
              visit.shop_photo ? (
                <Image source={{ uri: imageUrl }} style={s.detailPhoto} resizeMode="cover" />
              ) : (
                <View style={s.detailPhotoEmpty}>
                  <Ionicons name="storefront-outline" size={48} color="#CBD5E1" />
                  <Text style={s.detailPhotoEmptyTxt}>No photo captured</Text>
                </View>
              )
            )}

            {isEditing ? (
              <View style={s.editForm}>
                <Text style={s.label}>Customer Name *</Text>
                <TextInput
                  style={s.input}
                  value={customerName}
                  onChangeText={setCustomerName}
                  placeholder="Customer Name"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={s.label}>Category</Text>
                <TextInput
                  style={s.input}
                  value={category}
                  onChangeText={setCategory}
                  placeholder="Category (e.g. Dealer, Retailer)"
                  placeholderTextColor="#94A3B8"
                />
                
                <View style={s.chipRow}>
                  {CATEGORY_SUGGESTIONS.map(c => (
                    <TouchableOpacity key={c} style={[s.chip, category === c && s.chipActive]} onPress={() => setCategory(c)}>
                      <Text style={[s.chipTxt, category === c && s.chipTxtActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.label}>Dealer Name</Text>
                <TextInput
                  style={s.input}
                  value={dealerName}
                  onChangeText={setDealerName}
                  placeholder="Dealer Name"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={s.label}>Phone Number</Text>
                <TextInput
                  style={s.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone Number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />

                <Text style={s.label}>GST Number</Text>
                <TextInput
                  style={s.input}
                  value={gstNumber}
                  onChangeText={setGstNumber}
                  placeholder="GST Number"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={s.label}>Contact Person</Text>
                <TextInput style={s.input} value={contactPerson} onChangeText={setContactPerson} placeholder="Contact Person" placeholderTextColor="#94A3B8" />

                <Text style={s.label}>Alternative No.</Text>
                <TextInput style={s.input} value={altNo} onChangeText={setAltNo} placeholder="Alternative Number" placeholderTextColor="#94A3B8" keyboardType="phone-pad" />

                <Text style={s.label}>Email</Text>
                <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#94A3B8" keyboardType="email-address" autoCapitalize="none" />

                <Text style={s.label}>Address</Text>
                <TextInput style={[s.input, s.textArea]} value={address} onChangeText={setAddress} placeholder="Address" placeholderTextColor="#94A3B8" multiline numberOfLines={2} />

                <Text style={s.label}>District</Text>
                <TextInput style={s.input} value={district} onChangeText={setDistrict} placeholder="District" placeholderTextColor="#94A3B8" />

                <Text style={s.label}>State</Text>
                <TextInput style={s.input} value={stateName} onChangeText={setStateName} placeholder="State" placeholderTextColor="#94A3B8" />

                <Text style={s.label}>Pin No.</Text>
                <TextInput style={s.input} value={pinNo} onChangeText={setPinNo} placeholder="Pin Code" placeholderTextColor="#94A3B8" keyboardType="number-pad" />

                <Text style={s.label}>PAN No.</Text>
                <TextInput style={s.input} value={panNo} onChangeText={setPanNo} placeholder="PAN Number" placeholderTextColor="#94A3B8" autoCapitalize="characters" />

                <Text style={s.label}>Visit Status</Text>
                <TextInput style={s.input} value={visitStatus} onChangeText={setVisitStatus} placeholder="e.g. Visited, Order Taken" placeholderTextColor="#94A3B8" />
                <View style={s.chipRow}>
                  {VISIT_STATUS_SUGGESTIONS.map(c => (
                    <TouchableOpacity key={c} style={[s.chip, visitStatus === c && s.chipActive]} onPress={() => setVisitStatus(c)}>
                      <Text style={[s.chipTxt, visitStatus === c && s.chipTxtActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.label}>Comment</Text>
                <TextInput style={[s.input, s.textArea]} value={comment} onChangeText={setComment} placeholder="Comment" placeholderTextColor="#94A3B8" multiline numberOfLines={3} />

                {!!error && <Text style={s.errTxt}>{error}</Text>}

                <View style={s.editActionsRow}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setIsEditing(false)} disabled={saving}>
                    <Text style={s.cancelBtnTxt}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnTxt}>Save Changes</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {/* Meta grid */}
                <View style={s.detailGrid}>
                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Salesperson</Text>
                    <Text style={s.detailValue}>{visit.salesperson_name || 'N/A'}</Text>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Category</Text>
                    <Text style={s.detailValue}>{visit.category || 'N/A'}</Text>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Dealer Name</Text>
                    <Text style={s.detailValue}>{visit.dealer_name || 'N/A'}</Text>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>GST Number</Text>
                    <Text style={s.detailValue}>{visit.gst_number || 'N/A'}</Text>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Phone Number</Text>
                    <Text style={s.detailValue}>{visit.phone || 'N/A'}</Text>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Visit Status</Text>
                    <Text style={s.detailValue}>{visit.visit_status || 'N/A'}</Text>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Contact Person</Text>
                    <Text style={s.detailValue}>{visit.contact_person || 'N/A'}</Text>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Alternative No.</Text>
                    <Text style={s.detailValue}>{visit.alternative_no || 'N/A'}</Text>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Email</Text>
                    <Text style={s.detailValue}>{visit.email || 'N/A'}</Text>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>PAN Number</Text>
                    <Text style={s.detailValue}>{visit.pan_no || 'N/A'}</Text>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Address</Text>
                    <Text style={s.detailValue}>{visit.address || 'N/A'}</Text>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>District</Text>
                    <Text style={s.detailValue}>{visit.district || 'N/A'}</Text>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>State</Text>
                    <Text style={s.detailValue}>{visit.state || 'N/A'}</Text>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Pin No.</Text>
                    <Text style={s.detailValue}>{visit.pin_no || 'N/A'}</Text>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Comment</Text>
                    <Text style={s.detailValue}>{visit.comment || 'N/A'}</Text>
                  </View>

                  {hasCoords && (
                    <View style={s.detailItem}>
                      <Text style={s.detailLabel}>Coordinates</Text>
                      <Text style={s.detailValue}>{latVal.toFixed(6)}, {lngVal.toFixed(6)}</Text>
                    </View>
                  )}
                </View>

                {mapUrl && Platform.OS === 'web' && (
                  <TouchableOpacity onPress={() => window.open(mapUrl, '_blank')} style={s.detailMapBtn}>
                    <Ionicons name="location-outline" size={16} color="#fff" />
                    <Text style={s.detailMapBtnTxt}>Open Location in Google Maps</Text>
                  </TouchableOpacity>
                )}
                {!!error && <Text style={s.errTxt}>{error}</Text>}
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}


export default function VisitsScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isMobile  = width < 768;
  const { user }  = useAuthStore();
  const isAdmin   = user?.role === 'admin';

  const [customers, setCustomers] = useState([]);
  const [staff, setStaff]         = useState([]);
  const [allVisits, setAllVisits] = useState([]);
  const [filterDate, setFilterDate] = useState(dateKey(new Date())); // defaults to today; '' = all dates
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen]   = useState(false);
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deletingCustomer, setDeletingCustomer] = useState(null);

  // Admin specific navigation states
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);

  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    try {
      if (isAdmin) {
        const [people, all] = await Promise.all([api.get('/staff'), api.get('/visits/all')]);
        const list = (Array.isArray(people) ? people : []).filter(p => p.role !== 'admin');
        setStaff(list);
        setAllVisits(Array.isArray(all) ? all : []);
      } else {
        const r = await api.get('/visits/my-customers');
        setCustomers(Array.isArray(r) ? r : []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [isAdmin]);

  const handleRefresh = useCallback(() => {
    load();
    setRefreshKey(prev => prev + 1);
  }, [load]);

  const handleDeleteCustomer = useCallback(async (c) => {
    const ok = Platform.OS === 'web'
      ? window.confirm(`Delete "${c.customer_name}" and all your visits to this customer? This cannot be undone.`)
      : true;
    if (!ok) return;
    setDeletingCustomer(c.customer_name);
    try {
      await api.delete(`/visits/customer?name=${encodeURIComponent(c.customer_name)}`);
      await load();
    } catch (e) {
      if (Platform.OS === 'web') window.alert(e?.error || e?.message || 'Failed to delete customer.');
    } finally {
      setDeletingCustomer(null);
    }
  }, [load]);

  // Per-salesperson visit counts, respecting the admin date filter
  const counts = useMemo(() => {
    const c = {};
    allVisits.forEach(v => {
      if (filterDate && dateKey(v.visited_at) !== filterDate) return;
      c[v.salesperson_id] = (c[v.salesperson_id] || 0) + 1;
    });
    return c;
  }, [allVisits, filterDate]);

  useEffect(() => { load(); }, [load]);

  // Continuous live location while a salesperson has this screen open
  useEffect(() => {
    if (isAdmin || Platform.OS !== 'web' || !navigator?.geolocation) return;
    const post = () => navigator.geolocation.getCurrentPosition(
      (pos) => api.post('/location/update', {
        latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy,
      }).catch(() => {}),
      () => {}, { enableHighAccuracy: true, timeout: 10000 }
    );
    post();
    const t = setInterval(post, 60000);
    return () => clearInterval(t);
  }, [isAdmin]);

  return (
    <View style={s.screen}>
      <Navbar navigation={navigation} activeTab="New" />
      <ScrollView
        style={s.container}
        contentContainerStyle={[s.content, isMobile && { paddingHorizontal: 10 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Colors.primary]} />}
      >
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : isAdmin ? (
          <AdminView
            staff={staff}
            counts={counts}
            onSelectStaff={(p, mode = 'customers') => navigation.navigate('StaffCustomers', { staffId: p.id, staffName: p.name, filterDate, mode })}
            refreshKey={refreshKey}
            filterDate={filterDate}
            onFilterDateChange={setFilterDate}
          />
        ) : (
          <>
            <View style={s.topBar}>
              <Text style={s.topBarTitle}>Field Visits</Text>
              <TouchableOpacity style={s.addBtn} onPress={() => setFormOpen(true)}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={s.addBtnTxt}>Add Visit</Text>
              </TouchableOpacity>
            </View>
            <CustomerList
              customers={customers}
              onOpen={setDetailCustomer}
              onEdit={setEditingCustomer}
              onDelete={handleDeleteCustomer}
            />
            <VisitFormModal visible={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
            {detailCustomer && <CustomerDetailModal customer={detailCustomer} onClose={() => setDetailCustomer(null)} />}
            {editingCustomer && (
              <CustomerEditModal
                customer={editingCustomer}
                onClose={() => setEditingCustomer(null)}
                onSaved={load}
              />
            )}
          </>
        )}
      </ScrollView>

      {/* Admin specific Modals */}
      {selectedStaff && (
        <StaffVisitsModal
          staff={selectedStaff}
          onClose={() => setSelectedStaff(null)}
          onSelectVisit={(v) => {
            setSelectedVisit(v);
          }}
          refreshKey={refreshKey}
          filterDate={filterDate}
        />
      )}
      {selectedVisit && (
        <VisitDetailsModal
          visit={selectedVisit}
          onClose={() => setSelectedVisit(null)}
          onRefresh={handleRefresh}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen:    { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },
  container: { flex: 1, width: '100%' },
  content:   { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, width: '100%' },

  card:      { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 12 },

  topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  topBarTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  addBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  addBtnTxt:   { fontSize: 14, fontWeight: '700', color: '#fff' },

  custRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  custRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  custActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  custActionBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  custDeleteBtn: { backgroundColor: '#FEE2E2' },
  custName:  { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  custSub:   { fontSize: 11, color: '#64748B', marginTop: 1 },
  custMeta:  { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  emptyBox:    { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyTitle:  { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  emptySub:    { fontSize: 12, color: '#94A3B8', textAlign: 'center' },

  detailMeta:   { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  detailMetaTxt:{ fontSize: 12, color: '#475569', fontWeight: '600' },
  histLabel:    { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },

  formModalCard: { backgroundColor: '#fff', borderRadius: 18, width: '100%', maxWidth: 520, paddingHorizontal: 18, paddingBottom: 18, paddingTop: 14 },
  formModalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },

  metaRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  metaItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt:   { fontSize: 12, color: '#64748B', fontWeight: '600' },
  retryTxt:  { fontSize: 12, color: Colors.primary, fontWeight: '700', marginLeft: 4 },

  label:     { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 5, marginTop: 4 },
  input:     { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#0F172A', outlineStyle: 'none' },
  textArea:  { minHeight: 60, textAlignVertical: 'top' },
  row2:      { flexDirection: 'row', gap: 10 },

  autoFillNote: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, backgroundColor: '#ECFEFF', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  autoFillTxt:  { fontSize: 11, color: '#0891B2', fontWeight: '600', flex: 1 },

  chipRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
  chip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F8FAFC' },
  chipActive:{ borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },
  chipTxt:   { fontSize: 12, color: '#475569', fontWeight: '600' },
  chipTxtActive: { color: Colors.primary, fontWeight: '700' },

  photoBtnRow:{ flexDirection: 'row', gap: 10 },
  cameraCard:    { backgroundColor: '#fff', borderRadius: 18, width: '100%', maxWidth: 480, padding: 18 },
  cameraVideoWrap:{ width: '100%', height: 320, borderRadius: 12, backgroundColor: '#0F172A', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginVertical: 12 },
  cameraSpinner: { position: 'absolute' },
  cameraError:   { alignItems: 'center', gap: 10, paddingVertical: 36 },
  cameraErrorTxt:{ fontSize: 13, color: '#64748B', fontWeight: '600', textAlign: 'center', paddingHorizontal: 20 },
  photoBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.primary + '55', borderStyle: 'dashed', borderRadius: 10, paddingVertical: 14, backgroundColor: '#FFF8F8' },
  photoBtnTxt:{ fontSize: 13, color: Colors.primary, fontWeight: '700' },
  photoPreview:{ width: '100%', height: 180, borderRadius: 10, marginTop: 10 },

  errTxt:    { fontSize: 12, color: '#DC2626', marginTop: 10, fontWeight: '600' },
  okTxt:     { fontSize: 12, color: '#16A34A', marginTop: 10, fontWeight: '600' },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 13, marginTop: 14 },
  submitTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },

  nearbyBox: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  nearbyTitle:{ fontSize: 12, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  radiusRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 4 },
  radiusBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9, marginBottom: 1 },
  radiusBtnTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
  nearbyRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F6F8' },
  nearbyName:{ fontSize: 13, fontWeight: '600', color: '#1E293B' },
  nearbySub: { fontSize: 11, color: '#94A3B8' },
  nearbyDist:{ fontSize: 11, color: '#64748B', fontWeight: '700' },

  // Admin toolbar (search + date filter) above the card
  adminToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  searchBox:    { flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput:  { flex: 1, fontSize: 13, color: '#0F172A', outlineStyle: 'none' },
  dateFilterRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateClearBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F1F5F9' },
  dateClearTxt: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  dateFilterNote:{ fontSize: 12, color: Colors.primary, fontWeight: '700', marginBottom: 10 },

  // Admin staff list
  staffRow:  { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  avatar:    { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary + '18', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  staffName: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  staffSub:  { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  trackBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 9 },
  trackBtnTxt:{ fontSize: 12, fontWeight: '700', color: '#fff' },

  // Track modal
  overlay:   { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16, zIndex: 9998 },
  modalCard: { backgroundColor: '#fff', borderRadius: 18, width: '100%', maxWidth: 480, padding: 18 },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle:{ fontSize: 16, fontWeight: '800', color: '#1E293B' },
  modalSub:  { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  closeBtn:  { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  lastLoc:   { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#F0F9FF', borderRadius: 10, padding: 11, marginVertical: 8 },
  lastLocTitle:{ fontSize: 12, fontWeight: '700', color: '#1E293B' },
  lastLocSub:{ fontSize: 11, color: '#64748B', marginTop: 1 },

  histRow:   { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  histRowContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  histThumb: { width: 46, height: 46, borderRadius: 10 },
  histThumbEmpty: { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  histName:  { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  histSub:   { fontSize: 11, color: '#64748B', marginTop: 1 },
  histTime:  { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  locBtn:    { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center' },

  // Visits map in TrackModal
  modalMapWrap: { width: '100%', height: 260, backgroundColor: '#E2E8F0', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },

  // Visit details modal styles
  detailPhoto: { width: '100%', height: 200, borderRadius: 12, marginBottom: 16 },
  detailPhotoEmpty: { width: '100%', height: 160, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  detailPhotoEmptyTxt: { fontSize: 13, color: '#94A3B8', marginTop: 8, fontWeight: '600' },
  detailGrid: { gap: 12, marginBottom: 16 },
  detailItem: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 10 },
  detailLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  detailMapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  detailMapBtnTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  actionBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  deleteActionBtn: { backgroundColor: '#FEE2E2' },
  editForm: { gap: 10, marginTop: 8 },
  editActionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 11, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cancelBtnTxt: { fontSize: 13, fontWeight: '700', color: '#475569' },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, paddingVertical: 11, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  saveBtnTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
