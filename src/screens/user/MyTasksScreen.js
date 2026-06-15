import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Pressable, RefreshControl,
  Animated, PanResponder, useWindowDimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import api from '@services/api';
import { useAuthStore } from '@store/authStore';


const STATUS_META = {
  pending:    { label: 'Pending',     bg: '#EFF6FF', color: '#1D4ED8', icon: 'time-outline' },
  in_progress:{ label: 'In Progress', bg: '#FFF7ED', color: '#C2410C', icon: 'sync-outline' },
  completed:  { label: 'Completed',   bg: '#F0FDF4', color: '#15803D', icon: 'checkmark-circle-outline' },
  overdue:    { label: 'Overdue',     bg: '#FEF2F2', color: '#DC2626', icon: 'alert-circle-outline' },
  extension_requested: { label: 'Ext. Requested', bg: '#F5F3FF', color: '#7C3AED', icon: 'calendar-outline' },
};

const PRIORITY_META = {
  low:    { label: 'Low',    bg: '#F0FDF4', color: '#16A34A' },
  medium: { label: 'Medium', bg: '#FFFBEB', color: '#D97706' },
  high:   { label: 'High',   bg: '#FEF2F2', color: '#DC2626' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <View style={[bdg.box, { backgroundColor: m.bg }]}>
      <Ionicons name={m.icon} size={11} color={m.color} />
      <Text style={[bdg.txt, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

function PriorityBadge({ priority }) {
  const m = PRIORITY_META[priority] || PRIORITY_META.medium;
  return (
    <View style={[bdg.box, { backgroundColor: m.bg }]}>
      <Text style={[bdg.txt, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

const bdg = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  txt: { fontSize: 11, fontWeight: '600' },
});

// ── Calendar ──────────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function CalendarPicker({ value, onChange }) {
  const today = dayjs();
  const [open, setOpen]       = useState(false);
  const [cursor, setCursor]   = useState(value ? dayjs(value) : today);
  const [rawText, setRawText] = useState(value ? dayjs(value).format('DD/MM/YYYY') : '');

  const selected    = value ? dayjs(value) : null;
  const firstDay    = cursor.startOf('month').day();
  const daysInMonth = cursor.daysInMonth();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pick = (d) => {
    if (!d) return;
    const picked = cursor.date(d);
    if (picked.isBefore(today.startOf('day'))) return;
    onChange(picked.format('YYYY-MM-DD'));
    setRawText(picked.format('DD/MM/YYYY'));
    setCursor(picked);
    setOpen(false);
  };

  return (
    <View style={{ alignSelf: 'stretch' }}>
      <View style={cp.trigger}>
        <TextInput
          style={cp.triggerTxt}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={Colors.textMuted}
          value={rawText}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, '');
            let formatted = digits;
            if (digits.length > 2) formatted = digits.slice(0,2) + '/' + digits.slice(2);
            if (digits.length > 4) formatted = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4,8);
            setRawText(formatted);
            if (digits.length === 8) {
              const dd = digits.slice(0,2), mm = digits.slice(2,4), yyyy = digits.slice(4,8);
              const parsed = dayjs(`${yyyy}-${mm}-${dd}`);
              if (parsed.isValid()) { onChange(parsed.format('YYYY-MM-DD')); setCursor(parsed); }
            }
          }}
          maxLength={10}
        />
        <TouchableOpacity style={cp.calBtn} onPress={() => setOpen(true)}>
          <Ionicons name="calendar-outline" size={16} color={Colors.textLight} />
        </TouchableOpacity>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={cp.overlay} onPress={() => setOpen(false)}>
          <Pressable style={cp.panel} onPress={e => e.stopPropagation?.()}>
            <View style={cp.panelHeader}>
              <Text style={cp.panelTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={20} color={Colors.textLight} />
              </TouchableOpacity>
            </View>
            <View style={cp.nav}>
              <TouchableOpacity style={cp.navBtn} onPress={() => setCursor(c => c.subtract(1, 'month'))}>
                <Ionicons name="chevron-back" size={16} color={Colors.text} />
              </TouchableOpacity>
              <Text style={cp.navTitle}>{MONTHS[cursor.month()]} {cursor.year()}</Text>
              <TouchableOpacity style={cp.navBtn} onPress={() => setCursor(c => c.add(1, 'month'))}>
                <Ionicons name="chevron-forward" size={16} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={cp.weekRow}>
              {DAYS.map(d => <Text key={d} style={cp.weekDay}>{d}</Text>)}
            </View>
            <View style={cp.grid}>
              {cells.map((d, i) => {
                if (!d) return <View key={`e${i}`} style={cp.cell} />;
                const date    = cursor.date(d);
                const isPast  = date.isBefore(today.startOf('day'));
                const isToday = date.isSame(today, 'day');
                const isSel   = selected && date.isSame(selected, 'day');
                return (
                  <TouchableOpacity key={d} style={[cp.cell, isSel && cp.cellSel, isToday && !isSel && cp.cellToday]}
                    onPress={() => pick(d)} disabled={isPast}>
                    <Text style={[cp.cellTxt, isPast && cp.cellPast, isSel && cp.cellSelTxt, isToday && !isSel && cp.cellTodayTxt]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={cp.footer}>
              <TouchableOpacity style={cp.footerBtn} onPress={() => { onChange(''); setRawText(''); setOpen(false); }}>
                <Text style={cp.clearTxt}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[cp.footerBtn, cp.todayBtn]} onPress={() => { onChange(today.format('YYYY-MM-DD')); setRawText(today.format('DD/MM/YYYY')); setCursor(today); setOpen(false); }}>
                <Text style={cp.todayTxt}>Today</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function DateFilterCalendar({ value, onChange, onClose }) {
  const today = dayjs();
  const [cursor, setCursor] = useState(value ? dayjs(value) : today);
  const selected = value ? dayjs(value) : null;
  const firstDay = cursor.startOf('month').day();
  const daysInMonth = cursor.daysInMonth();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={cp.overlay} onPress={onClose}>
        <Pressable style={cp.panel} onPress={e => e.stopPropagation?.()}>
          <View style={cp.panelHeader}>
            <Text style={cp.panelTitle}>Select Date</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color={Colors.textLight} />
            </TouchableOpacity>
          </View>
          <View style={cp.nav}>
            <TouchableOpacity style={cp.navBtn} onPress={() => setCursor(c => c.subtract(1, 'month'))}>
              <Ionicons name="chevron-back" size={16} color={Colors.text} />
            </TouchableOpacity>
            <Text style={cp.navTitle}>{MONTHS[cursor.month()]} {cursor.year()}</Text>
            <TouchableOpacity style={cp.navBtn} onPress={() => setCursor(c => c.add(1, 'month'))}>
              <Ionicons name="chevron-forward" size={16} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <View style={cp.weekRow}>
            {DAYS.map(d => <Text key={d} style={cp.weekDay}>{d}</Text>)}
          </View>
          <View style={cp.grid}>
            {cells.map((d, i) => {
              if (!d) return <View key={`e${i}`} style={cp.cell} />;
              const date    = cursor.date(d);
              const isToday = date.isSame(today, 'day');
              const isSel   = selected && date.isSame(selected, 'day');
              return (
                <TouchableOpacity key={d} style={[cp.cell, isSel && cp.cellSel, isToday && !isSel && cp.cellToday]}
                  onPress={() => onChange(cursor.date(d).format('YYYY-MM-DD'))}>
                  <Text style={[cp.cellTxt, isSel && cp.cellSelTxt, isToday && !isSel && cp.cellTodayTxt]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={cp.footer}>
            <TouchableOpacity style={cp.footerBtn} onPress={() => { onChange(''); onClose(); }}>
              <Text style={cp.clearTxt}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[cp.footerBtn, cp.todayBtn]} onPress={() => { onChange(today.format('YYYY-MM-DD')); onClose(); }}>
              <Text style={cp.todayTxt}>Today</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const cp = StyleSheet.create({
  trigger:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  triggerTxt:   { flex: 1, fontSize: 14, color: Colors.text, outlineStyle: 'none', borderWidth: 0 },
  calBtn:       { width: 28, height: 28, borderRadius: 7, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  panel:        { backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: '#D1D5DB', width: '100%', maxWidth: 300, padding: 16, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, elevation: 12 },
  panelHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  panelTitle:   { fontSize: 15, fontWeight: '700', color: Colors.text },
  nav:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn:       { padding: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  navTitle:     { fontSize: 14, fontWeight: '700', color: Colors.text },
  weekRow:      { flexDirection: 'row', marginBottom: 4 },
  weekDay:      { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  grid:         { flexDirection: 'row', flexWrap: 'wrap' },
  cell:         { width: `${100/7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  cellSel:      { backgroundColor: Colors.primary },
  cellToday:    { borderWidth: 1.5, borderColor: Colors.primary },
  cellTxt:      { fontSize: 12, color: Colors.text },
  cellPast:     { color: '#D1D5DB' },
  cellSelTxt:   { color: '#fff', fontWeight: '700' },
  cellTodayTxt: { color: Colors.primary, fontWeight: '700' },
  footer:       { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.divider },
  footerBtn:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  todayBtn:     { backgroundColor: Colors.primary },
  clearTxt:     { fontSize: 13, color: Colors.textLight, fontWeight: '600' },
  todayTxt:     { fontSize: 13, color: '#fff', fontWeight: '600' },
});

// ── Swipeable Row (mobile) ────────────────────────────────────────────────────
const ACTION_WIDTH    = 100;
const SWIPE_THRESHOLD = 50;

function SwipeableRow({ children, onAction }) {
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
        <TouchableOpacity style={sw.updateAction} onPress={() => { close(); onAction(); }}>
          <Ionicons name="create-outline" size={16} color="#fff" />
          <Text style={sw.actionTxt}>Update</Text>
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
  updateAction: { flex: 1, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', gap: 4 },
  actionTxt:    { fontSize: 11, color: '#fff', fontWeight: '700' },
});

// ── Action Modal ──────────────────────────────────────────────────────────────
function ActionModal({ visible, task, onClose, onSubmit }) {
  const [mode, setMode]             = useState('complete');
  const [completionNote, setNote]   = useState('');
  const [extensionDate, setExtDate] = useState('');
  const [extensionReason, setExtReason] = useState('');
  const [docFile, setDocFile]       = useState(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef                = useRef(null);
  const videoRef                    = useRef(null);
  const streamRef                   = useRef(null);

  const isOverdue = task && task.status !== 'completed' && dayjs(task.due_date).isBefore(dayjs(), 'day');
  const reset = () => { setMode('complete'); setNote(''); setExtDate(''); setExtReason(''); setDocFile(null); setDocPreviewUrl(null); setError(''); };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      setCameraOpen(true);
      // attach stream after modal renders
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      alert('Camera access denied or not available.');
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setDocFile(file);
      setDocPreviewUrl(URL.createObjectURL(blob));
      closeCamera();
    }, 'image/jpeg', 0.92);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocFile(file);
      setDocPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (mode === 'complete') {
      if (isOverdue && !completionNote.trim()) { setError('Please provide a reason for not completing on time.'); return; }
    } else {
      if (!extensionDate) { setError('Please provide a new due date.'); return; }
      if (!extensionReason.trim()) { setError('Please provide a reason for the extension.'); return; }
      if (!completionNote.trim()) { setError('Please explain why the task was not completed on time.'); return; }
    }
    setSubmitting(true);
    try {
      await onSubmit(task.id, {
        mode,
        completion_note: completionNote.trim(),
        extension_date: mode === 'extension' ? extensionDate : undefined,
        extension_reason: mode === 'extension' ? extensionReason.trim() : undefined,
        document: docFile || undefined,
      });
      reset(); onClose();
    } catch (e) {
      setError(e?.message || 'Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!task) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { reset(); onClose(); }}>
      <View style={am.overlay}>
        <View style={am.card}>
          <View style={am.header}>
            <Text style={am.title}>Update Task</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Ionicons name="close" size={20} color={Colors.textLight} />
            </TouchableOpacity>
          </View>
          <View style={am.taskBox}>
            <Text style={am.taskName}>{task.title}</Text>
            <View style={am.taskMeta}>
              <PriorityBadge priority={task.priority} />
              <Text style={[am.dueTxt, isOverdue && { color: '#DC2626' }]}>Due: {dayjs(task.due_date).format('DD MMM YYYY')}</Text>
            </View>
          </View>
          <View style={am.modeRow}>
            <TouchableOpacity style={[am.modeBtn, mode === 'complete' && am.modeBtnActive]} onPress={() => setMode('complete')}>
              <Ionicons name="checkmark-circle-outline" size={15} color={mode === 'complete' ? Colors.primary : Colors.textLight} />
              <Text style={[am.modeTxt, mode === 'complete' && am.modeTxtActive]}>Mark Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[am.modeBtn, mode === 'extension' && { ...am.modeBtnActive, backgroundColor: '#F5F3FF', borderColor: '#7C3AED' }]} onPress={() => setMode('extension')}>
              <Ionicons name="calendar-outline" size={15} color={mode === 'extension' ? '#7C3AED' : Colors.textLight} />
              <Text style={[am.modeTxt, mode === 'extension' && { color: '#7C3AED', fontWeight: '700' }]}>Request Extension</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {(isOverdue || mode === 'extension') && (
              <>
                <Text style={am.label}>{mode === 'extension' ? 'Why was it not completed on time? *' : 'Reason for late completion *'}</Text>
                <TextInput style={am.textarea} placeholder="Explain why the task couldn't be completed on time…" placeholderTextColor={Colors.textMuted} value={completionNote} onChangeText={setNote} multiline numberOfLines={3} />
              </>
            )}
            {mode === 'extension' && (
              <>
                <Text style={am.label}>Requested New Due Date *</Text>
                <CalendarPicker value={extensionDate} onChange={setExtDate} />
                <Text style={am.label}>Reason for Extension *</Text>
                <TextInput style={am.textarea} placeholder="Why do you need more time?" placeholderTextColor={Colors.textMuted} value={extensionReason} onChangeText={setExtReason} multiline numberOfLines={3} />
              </>
            )}

            {/* Document upload — optional */}
            <Text style={am.label}>Attachment (optional)</Text>
            {Platform.OS === 'web' && (
              <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />
            )}
            {docFile ? (
              <>
                <TouchableOpacity style={am.filePreview} onPress={() => setPreviewOpen(true)}>
                  <Ionicons name="document-attach-outline" size={16} color={Colors.primary} />
                  <Text style={am.filePreviewTxt} numberOfLines={1}>{docFile.name}</Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                </TouchableOpacity>

                {/* View / Retake popup */}
                <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}>
                  <Pressable style={am.camOverlay} onPress={() => setPreviewOpen(false)}>
                    <Pressable style={am.previewBox} onPress={e => e.stopPropagation?.()}>
                      <View style={am.camHeader}>
                        <Text style={am.camTitle}>Attachment</Text>
                        <TouchableOpacity style={am.camCloseBtn} onPress={() => setPreviewOpen(false)}>
                          <Ionicons name="close" size={18} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                      {docPreviewUrl && (
                        <img src={docPreviewUrl} style={{ width: '100%', borderRadius: 8, maxHeight: 300, objectFit: 'contain', background: '#F1F5F9' }} alt="attachment" />
                      )}
                      {!docPreviewUrl && (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                          <Ionicons name="document-outline" size={48} color={Colors.textMuted} />
                          <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 8 }}>{docFile.name}</Text>
                        </View>
                      )}
                      <View style={am.previewActions}>
                        <TouchableOpacity style={am.retakeBtn} onPress={() => { setPreviewOpen(false); setDocFile(null); setDocPreviewUrl(null); }}>
                          <Ionicons name="refresh-outline" size={16} color={Colors.primary} />
                          <Text style={am.retakeTxt}>Retake / Change</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={am.viewDoneBtn} onPress={() => setPreviewOpen(false)}>
                          <Text style={am.viewDoneTxt}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    </Pressable>
                  </Pressable>
                </Modal>
              </>
            ) : (
              <View style={am.attachRow}>
                <TouchableOpacity style={am.attachBtn} onPress={openCamera}>
                  <Ionicons name="camera-outline" size={18} color={Colors.primary} />
                  <Text style={am.attachBtnTxt}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={am.attachBtn} onPress={() => fileInputRef.current?.click()}>
                  <Ionicons name="cloud-upload-outline" size={18} color={Colors.primary} />
                  <Text style={am.attachBtnTxt}>Upload File</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Camera popup */}
            {cameraOpen && (
              <Modal visible transparent animationType="fade" onRequestClose={closeCamera}>
                <Pressable style={am.camOverlay} onPress={closeCamera}>
                  <Pressable style={am.camBox} onPress={e => e.stopPropagation?.()}>
                    <View style={am.camHeader}>
                      <Text style={am.camTitle}>Take Photo</Text>
                      <TouchableOpacity style={am.camCloseBtn} onPress={closeCamera}>
                        <Ionicons name="close" size={18} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                    <View style={am.camVideoWrap}>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, display: 'block' }}
                      />
                    </View>
                    <TouchableOpacity style={am.captureBtn} onPress={capturePhoto}>
                      <View style={am.captureBtnInner} />
                    </TouchableOpacity>
                    <Text style={am.camHint}>Tap the button to capture</Text>
                  </Pressable>
                </Pressable>
              </Modal>
            )}

            {!!error && (
              <View style={am.errBox}>
                <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                <Text style={am.errTxt}>{error}</Text>
              </View>
            )}
            <TouchableOpacity style={[am.submitBtn, mode === 'extension' && { backgroundColor: '#7C3AED' }, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={am.submitTxt}>{mode === 'extension' ? 'Submit Extension Request' : 'Mark as Complete'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const am = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:         { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 460, padding: 24, maxHeight: '90%' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:        { fontSize: 17, fontWeight: '700', color: Colors.text },
  taskBox:      { backgroundColor: '#F7F8FA', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  taskName:     { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  taskMeta:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dueTxt:       { fontSize: 12, color: Colors.textLight, fontWeight: '500' },
  modeRow:      { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#F7F8FA' },
  modeBtnActive:{ backgroundColor: '#FFF0EF', borderColor: Colors.primary },
  modeTxt:      { fontSize: 12, color: Colors.textLight, fontWeight: '500' },
  modeTxtActive:{ color: Colors.primary, fontWeight: '700' },
  label:        { fontSize: 12, fontWeight: '600', color: Colors.textLight, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  textarea:     { backgroundColor: '#F7F8FA', borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 12, fontSize: 13, color: Colors.text, minHeight: 80, textAlignVertical: 'top' },
  errBox:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginTop: 12 },
  errTxt:       { fontSize: 12, color: '#DC2626', flex: 1 },
  attachRow:       { flexDirection: 'row', gap: 10 },
  attachBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F0F9FF', borderRadius: 10, borderWidth: 1, borderColor: '#BAE6FD', paddingVertical: 12 },
  attachBtnTxt:    { fontSize: 13, fontWeight: '600', color: Colors.primary },
  filePreview:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0', padding: 12 },
  filePreviewTxt:  { flex: 1, fontSize: 13, color: '#15803D', fontWeight: '500' },
  previewBox:      { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 16 },
  previewActions:  { flexDirection: 'row', gap: 10, marginTop: 14, justifyContent: 'flex-end' },
  retakeBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary },
  retakeTxt:       { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  viewDoneBtn:     { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 8, backgroundColor: Colors.primary },
  viewDoneTxt:     { fontSize: 13, color: '#fff', fontWeight: '700' },
  camOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  camBox:          { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 16, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 12 },
  camHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  camTitle:        { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  camCloseBtn:     { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  camVideoWrap:    { width: '100%', height: 280, borderRadius: 10, overflow: 'hidden', backgroundColor: '#0F172A' },
  captureBtn:      { alignSelf: 'center', marginTop: 16, width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', borderWidth: 4, borderColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  captureBtnInner: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary },
  camHint:         { textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 8 },
  submitBtn:    { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 18 },
  submitTxt:    { color: '#fff', fontSize: 14, fontWeight: '700' },
});

// ── Table (web) ───────────────────────────────────────────────────────────────
const COLS = [
  { label: '#',           flex: 0.3 },
  { label: 'Task',        flex: 2.5 },
  { label: 'Assigned On', flex: 1.2 },
  { label: 'Due Date',    flex: 1.2 },
  { label: 'Priority',    flex: 0.9 },
  { label: 'Status',      flex: 1.2 },
];

function TaskRow({ task, index, onAction }) {
  const isOverdue = task.status !== 'completed' && dayjs(task.due_date).isBefore(dayjs(), 'day');
  const effectiveStatus = task.status === 'extension_requested' ? 'extension_requested' : isOverdue ? 'overdue' : task.status;
  const sm = STATUS_META[effectiveStatus] || STATUS_META.pending;
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const daysLeft = dayjs(task.due_date).diff(dayjs(), 'day');
  const canAct = task.status !== 'completed' && task.status !== 'extension_requested';

  return (
    <TouchableOpacity
      style={[tc.row, index % 2 === 0 && tc.rowAlt, canAct && tc.rowClickable]}
      onPress={() => canAct && onAction(task)}
      activeOpacity={canAct ? 0.7 : 1}
    >
      <Text style={[tc.cell, { flex: COLS[0].flex, color: Colors.textMuted, borderLeftWidth: 0 }]}>{index + 1}</Text>
      <View style={[{ flex: COLS[1].flex, paddingRight: 8 }, tc.cellBorder]}>
        <Text style={tc.taskTitle} numberOfLines={1}>{task.title}</Text>
        {!!task.description && <Text style={tc.taskDesc} numberOfLines={1}>{task.description}</Text>}
        {task.status === 'extension_requested' && (
          <Text style={tc.extNote} numberOfLines={1}>Ext. until {task.extension_date ? dayjs(task.extension_date).format('DD MMM YY') : '—'}</Text>
        )}
      </View>
      <Text style={[tc.cell, tc.cellBorder, { flex: COLS[2].flex }]}>{task.created_at ? dayjs(task.created_at).format('DD MMM YYYY') : '—'}</Text>
      <View style={[{ flex: COLS[3].flex }, tc.cellBorder]}>
        <Text style={[tc.cell, isOverdue && { color: '#DC2626', fontWeight: '600' }]}>{dayjs(task.due_date).format('DD MMM YYYY')}</Text>
        {task.status !== 'completed' && daysLeft < 0 && <Text style={tc.overdueTag}>{Math.abs(daysLeft)}d late</Text>}
        {task.status !== 'completed' && daysLeft === 0 && <Text style={tc.todayTag}>Today</Text>}
      </View>
      <View style={[{ flex: COLS[4].flex }, tc.cellBorder]}>
        <View style={[tc.badge, { backgroundColor: pm.bg }]}>
          <Text style={[tc.badgeTxt, { color: pm.color }]}>{pm.label}</Text>
        </View>
      </View>
      <View style={[{ flex: COLS[5].flex }, tc.cellBorder]}>
        <View style={[tc.badge, { backgroundColor: sm.bg }]}>
          <Ionicons name={sm.icon} size={10} color={sm.color} />
          <Text style={[tc.badgeTxt, { color: sm.color }]}>{sm.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const tc = StyleSheet.create({
  headerRow:  { flexDirection: 'row', backgroundColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 10 },
  headerCell: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4, borderLeftWidth: 1, borderLeftColor: '#E5E7EB', paddingLeft: 8 },
  row:        { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', alignItems: 'center' },
  rowAlt:     { backgroundColor: '#FAFAFA' },
  cell:       { fontSize: 13, color: Colors.text, paddingLeft: 8 },
  cellBorder: { borderLeftWidth: 1, borderLeftColor: '#E5E7EB', paddingLeft: 8 },
  taskTitle:  { fontSize: 13, fontWeight: '600', color: Colors.text },
  taskDesc:   { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  extNote:    { fontSize: 11, color: '#7C3AED', marginTop: 2 },
  overdueTag: { fontSize: 10, color: '#DC2626', fontWeight: '700', marginTop: 1 },
  todayTag:   { fontSize: 10, color: '#D97706', fontWeight: '700', marginTop: 1 },
  badge:      { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  badgeTxt:   { fontSize: 10, fontWeight: '600' },
  rowClickable: { cursor: 'pointer' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

export default function MyTasksScreen({ navigation }) {
  const { width }  = useWindowDimensions();
  const isMobile   = width < 768;
  const { user }   = useAuthStore();
  const canCreateTask = user?.permissions?.create_task === true;

  const [tasks, setTasks]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilter]   = useState('all');
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState(null);
  const [modalVisible, setModal]    = useState(false);
  const [filterDropdown, setFilterDropdown] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [page, setPage]             = useState(1);

  const loadTasks = useCallback(async () => {
    try {
      const res = await api.get('/tasks');
      setTasks(Array.isArray(res) ? res : (res?.tasks || []));
    } catch {
      setTasks([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadTasks(); }, [loadTasks]));

  React.useEffect(() => { setPage(1); }, [search, filterStatus, dateFilter]);

  const [createVisible, setCreateVisible] = useState(false);
  const [newTitle, setNewTitle]           = useState('');
  const [newDesc, setNewDesc]             = useState('');
  const [newDueDate, setNewDueDate]       = useState('');
  const [newPriority, setNewPriority]     = useState('medium');
  const [creating, setCreating]           = useState(false);
  const [createError, setCreateError]     = useState('');
  const handleRefresh = () => { setRefreshing(true); loadTasks(); };
  const handleAction  = (task) => { setSelected(task); setModal(true); };

  const handleCreate = async () => {
    setCreateError('');
    if (!newTitle.trim()) { setCreateError('Title is required.'); return; }
    if (!newDueDate) { setCreateError('Due date is required.'); return; }
    setCreating(true);
    try {
      await api.post('/tasks', { title: newTitle.trim(), description: newDesc.trim(), due_date: newDueDate, priority: newPriority });
      setCreateVisible(false);
      setNewTitle(''); setNewDesc(''); setNewDueDate(''); setNewPriority('medium');
      loadTasks();
    } catch (e) {
      setCreateError(e?.error || e?.message || 'Failed to create task.');
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = async (taskId, payload) => {
    const body = payload.mode === 'complete'
      ? { action: 'complete', completion_note: payload.completion_note }
      : { action: 'extension', completion_note: payload.completion_note, extension_date: payload.extension_date, extension_reason: payload.extension_reason };

    if (payload.document) {
      const fd = new FormData();
      Object.entries(body).forEach(([k, v]) => v !== undefined && fd.append(k, v));
      fd.append('document', payload.document, payload.document.name);
      await api.putForm(`/tasks/${taskId}/action`, fd);
    } else {
      await api.put(`/tasks/${taskId}/action`, body);
    }
    loadTasks();
  };

  const filtered = tasks.filter(t => {
    const isOverdue = t.status !== 'completed' && dayjs(t.due_date).isBefore(dayjs(), 'day');
    const effectiveStatus = t.status === 'extension_requested' ? 'extension_requested' : isOverdue ? 'overdue' : t.status;
    const matchStatus = filterStatus === 'all' || effectiveStatus === filterStatus || t.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || t.title?.toLowerCase().includes(q);
    const matchDate = !dateFilter || dayjs(t.due_date).format('YYYY-MM-DD') === dateFilter;
    return matchStatus && matchSearch && matchDate;
  });

  const pagedData  = isMobile ? filtered : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const overdueCount = tasks.filter(t => t.status !== 'completed' && dayjs(t.due_date).isBefore(dayjs(), 'day')).length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const inProgCount  = tasks.filter(t => t.status === 'in_progress').length;
  const doneCount    = tasks.filter(t => t.status === 'completed').length;
  const extCount     = tasks.filter(t => t.status === 'extension_requested').length;

  const SUMMARY = [
    { label: 'Total',     value: tasks.length, key: 'all' },
    { label: 'Pending',   value: pendingCount,  key: 'pending' },
    { label: 'In Prog.',  value: inProgCount,   key: 'in_progress' },
    { label: 'Done',      value: doneCount,     key: 'completed' },
    { label: 'Overdue',   value: overdueCount,  key: 'overdue' },
    { label: 'Ext. Req.', value: extCount,      key: 'extension_requested' },
  ];

  const pagination = !isMobile && totalPages > 1 && (
    <View style={s.pagination}>
      <TouchableOpacity style={[s.pageBtn, page === 1 && s.pageBtnDisabled]} onPress={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
        <Ionicons name="chevron-back" size={14} color={page === 1 ? '#CBD5E1' : Colors.text} />
        <Text style={[s.pageBtnTxt, page === 1 && { color: '#CBD5E1' }]}>Prev</Text>
      </TouchableOpacity>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
        <TouchableOpacity key={n} style={[s.pageNum, n === page && s.pageNumActive]} onPress={() => setPage(n)}>
          <Text style={[s.pageNumTxt, n === page && s.pageNumTxtActive]}>{n}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={[s.pageBtn, page === totalPages && s.pageBtnDisabled]} onPress={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
        <Text style={[s.pageBtnTxt, page === totalPages && { color: '#CBD5E1' }]}>Next</Text>
        <Ionicons name="chevron-forward" size={14} color={page === totalPages ? '#CBD5E1' : Colors.text} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={s.screen}>
      <Navbar navigation={navigation} activeTab="Tasks" />

      <ScrollView style={s.container} contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}>

        {overdueCount > 0 && (
          <View style={s.overdueAlert}>
            <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
            <Text style={s.overdueAlertTxt}>You have {overdueCount} overdue {overdueCount === 1 ? 'task' : 'tasks'}. Please update or request an extension.</Text>
          </View>
        )}


        {/* Search row */}
        <View style={s.toolbar}>
          <View style={s.searchWrap}>
            <Ionicons name="search-outline" size={15} color={Colors.textMuted} />
            <TextInput style={s.searchInput} placeholder="Search tasks…" placeholderTextColor={Colors.textMuted} value={search} onChangeText={setSearch} />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter button */}
          <TouchableOpacity style={[s.filterBtn, filterStatus !== 'all' && s.filterBtnActive, isMobile && s.filterBtnIcon]} onPress={() => setFilterDropdown(true)}>
            <Ionicons name="options-outline" size={16} color={filterStatus !== 'all' ? Colors.primary : Colors.textLight} />
            {!isMobile && <Text style={[s.filterBtnTxt, filterStatus !== 'all' && { color: Colors.primary }]}>Filter</Text>}
          </TouchableOpacity>

          {/* Date filter */}
          <View style={[s.dateInputWrap, !!dateFilter && s.dateInputWrapActive]}>
            <TextInput
              style={s.dateInput}
              placeholder="DD-MM-YYYY"
              placeholderTextColor={Colors.textMuted}
              value={dateFilter ? dayjs(dateFilter).format('DD-MM-YYYY') : ''}
              onChangeText={(txt) => {
                const clean = txt.replace(/[^0-9]/g, '');
                if (clean.length === 8) {
                  const d = dayjs(`${clean.slice(4)}-${clean.slice(2,4)}-${clean.slice(0,2)}`);
                  if (d.isValid()) setDateFilter(d.format('YYYY-MM-DD'));
                } else if (txt === '') {
                  setDateFilter('');
                }
              }}
            />
            {!!dateFilter && (
              <TouchableOpacity onPress={() => setDateFilter('')}>
                <Ionicons name="close-circle" size={15} color={Colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setDatePickerOpen(true)}>
              <Ionicons name="calendar-outline" size={16} color={dateFilter ? Colors.primary : Colors.textLight} />
            </TouchableOpacity>
          </View>

          {canCreateTask && (
            <TouchableOpacity style={s.createBtn} onPress={() => setCreateVisible(true)}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={s.createBtnTxt}>New Task</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Date picker modal */}
        {datePickerOpen && (
          <DateFilterCalendar
            value={dateFilter}
            onChange={(val) => { setDateFilter(val); setDatePickerOpen(false); }}
            onClose={() => setDatePickerOpen(false)}
          />
        )}

        {/* Filter dropdown modal */}
        <Modal visible={filterDropdown} transparent animationType="fade" onRequestClose={() => setFilterDropdown(false)}>
          <Pressable style={s.filterOverlay} onPress={() => setFilterDropdown(false)}>
            <Pressable style={s.filterPanel} onPress={e => e.stopPropagation?.()}>
              <Text style={s.filterTitle}>Filter by Status</Text>
              {['all', 'pending', 'in_progress', 'completed', 'overdue', 'extension_requested'].map(st => {
                const label = st === 'all' ? 'All' : st === 'in_progress' ? 'In Progress' : st === 'extension_requested' ? 'Ext. Requested' : st.charAt(0).toUpperCase() + st.slice(1);
                const active = filterStatus === st;
                return (
                  <TouchableOpacity key={st} style={[s.filterItem, active && s.filterItemActive]} onPress={() => { setFilter(st); setFilterDropdown(false); }}>
                    <Text style={[s.filterItemTxt, active && s.filterItemTxtActive]}>{label}</Text>
                    {active && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>

        {loading ? (
          <View style={s.emptyBox}><ActivityIndicator color={Colors.primary} /></View>
        ) : filtered.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color={Colors.textMuted} />
            <Text style={s.emptyTxt}>No tasks found</Text>
            {filterStatus !== 'all' && <Text style={s.emptyHint}>Try switching the filter above</Text>}
          </View>
        ) : (
          <>
            {/* Mobile swipeable cards */}
            {isMobile && (
              <View style={s.mobileList}>
                {pagedData.map((t, i) => {
                  const isOverdue = t.status !== 'completed' && dayjs(t.due_date).isBefore(dayjs(), 'day');
                  const effectiveStatus = t.status === 'extension_requested' ? 'extension_requested' : isOverdue ? 'overdue' : t.status;
                  const sm = STATUS_META[effectiveStatus] || STATUS_META.pending;
                  const pm = PRIORITY_META[t.priority] || PRIORITY_META.medium;
                  const canAct = t.status !== 'completed' && t.status !== 'extension_requested';
                  return canAct ? (
                    <SwipeableRow key={t.id} onAction={() => handleAction(t)}>
                      <View style={[s.mCard, i > 0 && { borderTopWidth: 1, borderTopColor: '#E5E7EB' }]}>
                        <View style={s.mCardRow1}>
                          <Text style={s.mCardTitle} numberOfLines={1}>{t.title}</Text>
                          <View style={[bdg.box, { backgroundColor: sm.bg }]}>
                            <Ionicons name={sm.icon} size={10} color={sm.color} />
                            <Text style={[bdg.txt, { color: sm.color }]}>{sm.label}</Text>
                          </View>
                        </View>
                        {!!t.description && <Text style={s.mCardDesc} numberOfLines={1}>{t.description}</Text>}
                        <View style={s.mCardRow2}>
                          <View style={[bdg.box, { backgroundColor: pm.bg }]}>
                            <Text style={[bdg.txt, { color: pm.color }]}>{pm.label}</Text>
                          </View>
                          <Text style={[s.mCardDate, isOverdue && { color: '#DC2626' }]}>Due: {dayjs(t.due_date).format('DD MMM YYYY')}</Text>
                        </View>
                      </View>
                    </SwipeableRow>
                  ) : (
                    <View key={t.id} style={[s.mCard, i > 0 && { borderTopWidth: 1, borderTopColor: '#E5E7EB' }]}>
                      <View style={s.mCardRow1}>
                        <Text style={s.mCardTitle} numberOfLines={1}>{t.title}</Text>
                        <View style={[bdg.box, { backgroundColor: sm.bg }]}>
                          <Ionicons name={sm.icon} size={10} color={sm.color} />
                          <Text style={[bdg.txt, { color: sm.color }]}>{sm.label}</Text>
                        </View>
                      </View>
                      {!!t.description && <Text style={s.mCardDesc} numberOfLines={1}>{t.description}</Text>}
                      <View style={s.mCardRow2}>
                        <View style={[bdg.box, { backgroundColor: pm.bg }]}>
                          <Text style={[bdg.txt, { color: pm.color }]}>{pm.label}</Text>
                        </View>
                        <Text style={[s.mCardDate, isOverdue && { color: '#DC2626' }]}>Due: {dayjs(t.due_date).format('DD MMM YYYY')}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Web table */}
            {!isMobile && (
              <View>
                <View style={s.tableBox}>
                  <View style={tc.headerRow}>
                    {COLS.map((c, ci) => (
                      <Text key={c.label} style={[tc.headerCell, { flex: c.flex }, ci === 0 && { borderLeftWidth: 0 }]}>{c.label}</Text>
                    ))}
                  </View>
                  {pagedData.map((t, i) => (
                    <TaskRow key={t.id} task={t} index={i} onAction={handleAction} />
                  ))}
                </View>
                {pagination}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <ActionModal
        visible={modalVisible}
        task={selected}
        onClose={() => { setModal(false); setSelected(null); }}
        onSubmit={handleSubmit}
      />

      {/* Create Task Modal — only if permitted */}
      <Modal visible={createVisible && canCreateTask} transparent animationType="fade" onRequestClose={() => setCreateVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Task</Text>
              <TouchableOpacity onPress={() => setCreateVisible(false)}>
                <Ionicons name="close" size={20} color={Colors.textLight} />
              </TouchableOpacity>
            </View>

            {!!createError && (
              <View style={s.modalErrBox}>
                <Ionicons name="alert-circle-outline" size={13} color="#DC2626" />
                <Text style={s.modalErrTxt}>{createError}</Text>
              </View>
            )}

            <Text style={s.modalLabel}>Title *</Text>
            <TextInput style={s.modalInput} placeholder="Task title" placeholderTextColor={Colors.textMuted} value={newTitle} onChangeText={setNewTitle} />

            <Text style={s.modalLabel}>Description</Text>
            <TextInput style={[s.modalInput, { height: 70, textAlignVertical: 'top', paddingTop: 8 }]} placeholder="Optional description" placeholderTextColor={Colors.textMuted} value={newDesc} onChangeText={setNewDesc} multiline />

            <Text style={s.modalLabel}>Due Date *</Text>
            <CalendarPicker value={newDueDate} onChange={setNewDueDate} />

            <Text style={s.modalLabel}>Priority</Text>
            <View style={s.priorityRow}>
              {['low','medium','high'].map(p => (
                <TouchableOpacity key={p} style={[s.priorityBtn, newPriority === p && s.priorityBtnActive(p)]} onPress={() => setNewPriority(p)}>
                  <Text style={[s.priorityBtnTxt, newPriority === p && s.priorityBtnTxtActive(p)]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setCreateVisible(false)}>
                <Text style={s.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalSaveBtn, creating && { opacity: 0.6 }]} onPress={handleCreate} disabled={creating}>
                {creating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalSaveTxt}>Create Task</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },
  container:   { flex: 1, width: '100%' },
  content:     { padding: 16, paddingBottom: 100 },

  overdueAlert:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#FECACA' },
  overdueAlertTxt: { flex: 1, fontSize: 13, color: '#DC2626', fontWeight: '600', lineHeight: 18 },

  statsRow:      { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  statCard:      { flex: 1, minWidth: 80, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  statCardActive:{ borderColor: Colors.primary, backgroundColor: '#FFF8F8' },
  statVal:       { fontSize: 20, fontWeight: '700', color: '#111827' },
  statLbl:       { fontSize: 10, color: Colors.textLight, marginTop: 2, textAlign: 'center' },

  toolbar:         { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  searchWrap:      { flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 9 },
  searchInput:     { flex: 1, fontSize: 13, color: Colors.text, outlineStyle: 'none' },
  filterBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 9 },
  filterBtnIcon:   { width: 40, height: 40, paddingHorizontal: 0, justifyContent: 'center' },
  filterBtnActive: { borderColor: Colors.primary, backgroundColor: '#FFF8F8' },
  filterBtnTxt:    { fontSize: 13, color: Colors.textLight, fontWeight: '600' },
  dateInputWrap:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  dateInputWrapActive: { borderColor: Colors.primary },
  dateInput:       { fontSize: 13, color: '#0F172A', width: 90, outlineStyle: 'none' },

  filterOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  filterPanel:     { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 360, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  filterTitle:     { fontSize: 14, fontWeight: '700', color: Colors.text, padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filterItem:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  filterItemActive:{ backgroundColor: '#FFF8F8' },
  filterItemTxt:   { fontSize: 14, color: Colors.text },
  filterItemTxtActive: { color: Colors.primary, fontWeight: '600' },

  tableBox:    { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' },
  mobileList:  { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  mCard:       { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 12 },
  mCardRow1:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  mCardTitle:  { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F172A', marginRight: 8 },
  mCardDesc:   { fontSize: 12, color: '#64748B', marginBottom: 6 },
  mCardRow2:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  mCardDate:   { fontSize: 12, color: '#64748B', fontWeight: '500' },

  pagination:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  pageBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnTxt:  { fontSize: 13, color: Colors.text, fontWeight: '500' },
  pageNum:     { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  pageNumActive:{ backgroundColor: Colors.primary, borderColor: Colors.primary },
  pageNumTxt:  { fontSize: 13, color: Colors.text },
  pageNumTxtActive: { color: '#fff', fontWeight: '700' },

  emptyBox:    { paddingVertical: 60, alignItems: 'center', gap: 10 },
  emptyTxt:    { fontSize: 14, fontWeight: '600', color: Colors.textLight },
  emptyHint:   { fontSize: 12, color: Colors.textMuted },

  createBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  createBtnTxt:  { fontSize: 13, fontWeight: '700', color: '#fff' },

  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard:      { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, padding: 20 },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 12 },
  modalTitle:     { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  modalErrBox:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 10 },
  modalErrTxt:    { fontSize: 12, color: '#DC2626', flex: 1 },
  modalLabel:     { fontSize: 11, fontWeight: '700', color: '#334155', textTransform: 'uppercase', marginBottom: 4, marginTop: 12 },
  modalInput:     { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A', backgroundColor: '#fff' },
  priorityRow:    { flexDirection: 'row', gap: 8, marginTop: 2 },
  priorityBtn:    { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', backgroundColor: '#F8FAFC' },
  priorityBtnActive: (p) => ({ backgroundColor: p === 'high' ? '#FEF2F2' : p === 'medium' ? '#FFFBEB' : '#F0FDF4', borderColor: p === 'high' ? '#DC2626' : p === 'medium' ? '#D97706' : '#16A34A' }),
  priorityBtnTxt:    { fontSize: 12, color: '#64748B', fontWeight: '600' },
  priorityBtnTxtActive: (p) => ({ color: p === 'high' ? '#DC2626' : p === 'medium' ? '#D97706' : '#16A34A', fontWeight: '700' }),
  modalFooter:    { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 14, marginTop: 16 },
  modalCancelBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  modalCancelTxt: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  modalSaveBtn:   { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: Colors.primary },
  modalSaveTxt:   { fontSize: 13, fontWeight: '700', color: '#fff' },
});
