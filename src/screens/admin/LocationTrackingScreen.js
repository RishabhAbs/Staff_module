import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Platform,
  RefreshControl, TextInput, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuthStore } from '@store/authStore';
import api from '@services/api';
import { useAttendanceStore } from '@store/attendanceStore';
import { useLocationStore, buildTimeline } from '@store/locationStore';

dayjs.extend(relativeTime);

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(ts) {
  if (!ts) return '--';
  return dayjs(ts).format('hh:mm A');
}

function durLabel(from, to) {
  const mins = dayjs(to).diff(dayjs(from), 'minute');
  if (mins < 1)  return '< 1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Build Leaflet HTML with all stops as markers + polyline ──────────────────
function buildMapHtml(timeline, userName, isToday, checkOut) {
  const stops = timeline.filter(s => s.latitude != null && s.longitude != null);
  if (stops.length === 0) return null;

  const center = stops[0];
  const lastIdx = stops.length - 1;

  const markersJs = stops.map((s, i) => {
    const color  = i === 0 ? '#22c55e' : i === lastIdx ? '#f59e0b' : '#3b82f6';
    const isLast = i === lastIdx;
    const addr   = (s.address || `${s.latitude.toFixed(5)}, ${s.longitude.toFixed(5)}`).replace(/'/g, "\\'");
    const fromFmt = fmt(s.from);

    if (isLast && isToday) {
      if (checkOut) {
        // Checked out — show static checkout time
        const checkOutFmt = (() => {
          const [hh, mm, ss] = checkOut.split(':').map(Number);
          const ampm = hh >= 12 ? 'PM' : 'AM';
          const h12  = hh % 12 || 12;
          return `${String(h12).padStart(2,'0')}:${String(mm).padStart(2,'0')} ${ampm}`;
        })();
        const dur = durLabel(s.from, `${new Date().toISOString().slice(0,10)}T${checkOut}`);
        return `
          L.circleMarker([${s.latitude}, ${s.longitude}], {
            radius: 10, fillColor: '${color}', color: '#fff', weight: 2, fillOpacity: 1
          }).addTo(map).bindPopup(
            '<div style="font-family:sans-serif;min-width:160px">' +
            '<b style="font-size:13px">${fromFmt} → <span style="color:#f59e0b">${checkOutFmt}</span></b><br>' +
            '<span style="color:#6b7280;font-size:11px">${dur} · Checked out</span><br>' +
            '<span style="font-size:12px">${addr}</span>' +
            '</div>'
          ).openPopup();
        `;
      }
      // Not checked out yet — live clock
      return `
        var liveMarker = L.circleMarker([${s.latitude}, ${s.longitude}], {
          radius: 10, fillColor: '${color}', color: '#fff', weight: 2, fillOpacity: 1
        }).addTo(map);
        function fmtTime(d) {
          var h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
          var ampm = h >= 12 ? 'PM' : 'AM';
          h = h % 12 || 12;
          return (h<10?'0':'')+h+':'+(m<10?'0':'')+m+':'+(s<10?'0':'')+s+' '+ampm;
        }
        function updatePopup() {
          var now = fmtTime(new Date());
          liveMarker.setPopupContent(
            '<div style="font-family:sans-serif;min-width:160px">' +
            '<b style="font-size:13px">${fromFmt} → <span style="color:#22c55e">' + now + '</span></b><br>' +
            '<span style="color:#6b7280;font-size:11px">Live</span><br>' +
            '<span style="font-size:12px">${addr}</span>' +
            '</div>'
          );
        }
        liveMarker.bindPopup('').openPopup();
        updatePopup();
        setInterval(updatePopup, 1000);
      `;
    }

    const timeStr = `${fromFmt}${s.from !== s.to ? ' → ' + fmt(s.to) : ''}`;
    const dur     = durLabel(s.from, s.to);
    return `
      L.circleMarker([${s.latitude}, ${s.longitude}], {
        radius: ${i === 0 || isLast ? 10 : 8},
        fillColor: '${color}', color: '#fff', weight: 2, fillOpacity: 1
      }).addTo(map).bindPopup(
        '<div style="font-family:sans-serif;min-width:160px">' +
        '<b style="font-size:13px">${timeStr}</b><br>' +
        '<span style="color:#6b7280;font-size:11px">${dur}</span><br>' +
        '<span style="font-size:12px">${addr}</span>' +
        '</div>'
      )${i === 0 && !isToday ? '.openPopup()' : ''};
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
  var map = L.map('map').setView([${center.latitude},${center.longitude}], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'© OpenStreetMap contributors', maxZoom:19
  }).addTo(map);
  ${stops.length > 1 ? `L.polyline([${polylineCoords}],{color:'#3b82f6',weight:3,opacity:0.6,dashArray:'6,4'}).addTo(map);` : ''}
  ${markersJs}
  ${stops.length > 1 ? `map.fitBounds([${polylineCoords}],{padding:[30,30]});` : ''}
</script>
</body></html>`;
}

// ── Track Modal — full-day timeline for a user ────────────────────────────────
function TrackModal({ visible, user, onClose, initialDate }) {
  const [date, setDate]         = useState(initialDate || dayjs().format('YYYY-MM-DD'));
  const [apiHistory, setApiHistory] = useState([]);
  const [attRec, setAttRec]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [liveTime, setLiveTime] = useState(dayjs().format('hh:mm:ss A'));
  const [mapHeight, setMapHeight] = useState(280);
  const dragRef = React.useRef(null);
  const today                   = dayjs().format('YYYY-MM-DD');

  // Tick live clock every second — only when today & no checkout
  React.useEffect(() => {
    const isLiveMode = date === today && !attRec?.check_out;
    if (!isLiveMode) return;
    const t = setInterval(() => setLiveTime(dayjs().format('hh:mm:ss A')), 1000);
    return () => clearInterval(t);
  }, [date, today, attRec?.check_out]);

  React.useEffect(() => {
    if (visible) setDate(initialDate || dayjs().format('YYYY-MM-DD'));
  }, [visible, user?.id, initialDate]);

  React.useEffect(() => {
    if (!visible || !user?.id || !date) return;
    setLoading(true);
    setApiHistory([]);
    setAttRec(null);

    Promise.all([
      api.get(`/location/history?staffId=${user.id}&date=${date}`).catch(() => []),
      api.get(`/attendance/report?date=${date}`).catch(() => []),
    ]).then(([locRows, attRows]) => {
      // location_history rows
      setApiHistory(Array.isArray(locRows) ? locRows : []);
      // find this user's attendance record for the date
      const att = Array.isArray(attRows)
        ? attRows.find(r => String(r.staff_id) === String(user.id))
        : null;
      setAttRec(att || null);
    }).finally(() => setLoading(false));
  }, [visible, user?.id, date]);

  const changeDay = (d) => {
    const next = dayjs(date).add(d, 'day');
    if (next.isAfter(dayjs())) return;
    setDate(next.format('YYYY-MM-DD'));
  };

  const timeline = React.useMemo(() => {
    if (!user || !date) return [];

    // Points from location_history table
    const fromApi = apiHistory
      .filter(p => p.latitude != null && p.longitude != null)
      .map(p => ({
        userId: user.id,
        name: user.name,
        latitude:  parseFloat(p.latitude),
        longitude: parseFloat(p.longitude),
        address: null,
        timestamp: (() => {
          const ts = p.recorded_at_iso || p.recorded_at;
          if (!ts) return `${date}T00:00:00`;
          // Ensure UTC timestamps are parsed correctly by adding Z if missing
          return ts.includes('Z') || ts.includes('+') ? ts : ts + 'Z';
        })(),
      }));

    // Fallback: use check-in lat/lng from attendance table
    const synthetic = [];
    if (attRec?.check_in_lat != null && attRec?.check_in_lng != null) {
      synthetic.push({
        userId: user.id, name: user.name,
        latitude:  parseFloat(attRec.check_in_lat),
        longitude: parseFloat(attRec.check_in_lng),
        address: attRec.address || null,
        timestamp: `${date}T${attRec.check_in || '00:00:00'}`,
      });
    }

    const allTs  = new Set(fromApi.map(p => p.timestamp));
    const merged = [...fromApi, ...synthetic.filter(p => !allTs.has(p.timestamp))];
    return buildTimeline(merged);
  }, [user, date, apiHistory, attRec]);

  if (!user) return null;

  const mapHtml = buildMapHtml(timeline, user.name, date === dayjs().format('YYYY-MM-DD'), attRec?.check_out || null);
  const hasMap  = mapHtml != null;
  const isToday = date === today;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={tm.screen}>

        {/* Top bar */}
        <View style={tm.header}>
          <TouchableOpacity style={tm.backBtn} onPress={onClose}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <View style={tm.avatar}>
            <Text style={tm.avatarTxt}>{(user.name || '?')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={tm.userName}>{user.name}</Text>
            <Text style={tm.userSub}>Location history</Text>
          </View>
          {/* Date navigator inline in header */}
          <TouchableOpacity onPress={() => changeDay(-1)} style={tm.navBtn}>
            <Ionicons name="chevron-back" size={16} color={Colors.text} />
          </TouchableOpacity>
          <View style={tm.dateLabelWrap}>
            <Text style={tm.dateLabel}>{isToday ? 'Today' : dayjs(date).format('DD MMM')}</Text>
            {isToday && <View style={tm.todayBadge}><Text style={tm.todayTxt}>LIVE</Text></View>}
          </View>
          <TouchableOpacity onPress={() => changeDay(1)} style={[tm.navBtn, isToday && { opacity: 0.3 }]} disabled={isToday}>
            <Ionicons name="chevron-forward" size={16} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={tm.empty}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={tm.emptySubtitle}>Loading location data...</Text>
          </View>
        ) : timeline.length === 0 ? (
          <View style={tm.empty}>
            <Ionicons name="location-outline" size={48} color={Colors.textMuted} />
            <Text style={tm.emptyTitle}>No GPS data</Text>
            {attRec?.check_in ? (
              <>
                <Text style={tm.emptySubtitle}>GPS coordinates were not captured for this check-in.</Text>
                <View style={{ backgroundColor: '#F7F8FA', borderRadius: 12, padding: 16, marginTop: 12, width: '100%', borderWidth: 1, borderColor: '#E5E7EB', gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="log-in-outline" size={16} color={Colors.success} />
                    <Text style={{ fontSize: 13, color: Colors.text, fontWeight: '600' }}>Checked in at {attRec.check_in}</Text>
                  </View>
                  {attRec.check_out && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="log-out-outline" size={16} color={Colors.danger} />
                      <Text style={{ fontSize: 13, color: Colors.text, fontWeight: '600' }}>Checked out at {attRec.check_out}</Text>
                    </View>
                  )}
                  {attRec.address && attRec.address !== 'Admin override' && (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Ionicons name="location-outline" size={16} color={Colors.primary} />
                      <Text style={{ fontSize: 12, color: Colors.textLight, flex: 1 }}>{attRec.address}</Text>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <Text style={tm.emptySubtitle}>
                {isToday ? 'Location is recorded when the user checks in.' : `No data for ${dayjs(date).format('DD MMM YYYY')}.`}
              </Text>
            )}
            {!isToday && (
              <TouchableOpacity style={tm.goTodayBtn} onPress={() => setDate(today)}>
                <Text style={tm.goTodayTxt}>Go to Today</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {/* MAP — resizable via drag handle */}
            {hasMap && (
              <>
                <View style={[tm.mapWrap, { height: mapHeight }]}>
                  <iframe srcDoc={mapHtml} style={{ width: '100%', height: '100%', border: 'none' }} title="location-map" />
                </View>
                {/* Drag handle */}
                <View
                  style={tm.dragHandle}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={(e) => { dragRef.current = e.nativeEvent.pageY; }}
                  onResponderMove={(e) => {
                    if (dragRef.current == null) return;
                    const dy = e.nativeEvent.pageY - dragRef.current;
                    dragRef.current = e.nativeEvent.pageY;
                    setMapHeight(h => Math.min(520, Math.max(120, h + dy)));
                  }}
                  onResponderRelease={() => { dragRef.current = null; }}
                >
                  <View style={tm.dragPill} />
                </View>
              </>
            )}

            {/* Compact summary strip */}
            <View style={tm.strip}>
              <View style={tm.stripItem}>
                <Text style={tm.stripVal}>{fmt(timeline[0]?.from)}</Text>
                <Text style={tm.stripLbl}>First</Text>
              </View>
              <View style={tm.stripDiv} />
              <View style={tm.stripItem}>
                <Text style={[tm.stripVal, isToday && !attRec?.check_out && { color: '#22c55e' }]}>
                  {isToday && !attRec?.check_out ? liveTime : attRec?.check_out ? fmt(`${date}T${attRec.check_out}`) : fmt(timeline[timeline.length - 1]?.to)}
                </Text>
                <Text style={tm.stripLbl}>{isToday && !attRec?.check_out ? 'Live' : 'Last'}</Text>
              </View>
              <View style={tm.stripDiv} />
              <View style={tm.stripItem}>
                <Text style={tm.stripVal}>{timeline.length}</Text>
                <Text style={tm.stripLbl}>Stops</Text>
              </View>
              <View style={tm.stripDiv} />
              <View style={tm.stripItem}>
                <Text style={tm.stripVal}>{dayjs(date).format('DD MMM')}</Text>
                <Text style={tm.stripLbl}>Date</Text>
              </View>
            </View>

            {/* Timeline list */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 32 }}>
              {/* Legend */}
              <View style={tm.legend}>
                {[{ color: '#22c55e', label: 'First' }, { color: '#3b82f6', label: 'In between' }, { color: '#f59e0b', label: 'Last' }].map(l => (
                  <View key={l.label} style={tm.legendItem}>
                    <View style={[tm.legendDot, { backgroundColor: l.color }]} />
                    <Text style={tm.legendTxt}>{l.label}</Text>
                  </View>
                ))}
              </View>

              {timeline.map((stop, idx) => {
                const isLast   = idx === timeline.length - 1;
                const isFirst  = idx === 0;
                const dotColor = isFirst ? '#22c55e' : isLast ? '#f59e0b' : '#3b82f6';
                const sameTime = stop.from === stop.to;
                return (
                  <View key={idx} style={tm.stopRow}>
                    <View style={tm.spine}>
                      <View style={[tm.dot, { backgroundColor: dotColor }]} />
                      {!isLast && <View style={tm.line} />}
                    </View>
                    <View style={tm.stopCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <Text style={tm.timeRange}>
                          {fmt(stop.from)}
                          {isLast && isToday && !attRec?.check_out
                            ? <Text style={{ color: '#22c55e' }}>{` → ${liveTime}`}</Text>
                            : !sameTime ? ` → ${fmt(stop.to)}` : ''}
                        </Text>
                        {(!isLast || !isToday || attRec?.check_out) && !sameTime && (
                          <Text style={tm.durTxt}>{durLabel(stop.from, stop.to)}</Text>
                        )}
                        {isLast && isToday && !attRec?.check_out && (
                          <Text style={[tm.durTxt, { color: '#22c55e' }]}>Live</Text>
                        )}
                        {stop.pings > 1 && (
                          <Text style={[tm.durTxt, { marginLeft: 'auto' }]}>{stop.pings} pings</Text>
                        )}
                      </View>
                      <Text style={tm.addrTxt} numberOfLines={2}>
                        {stop.address || (stop.latitude != null ? `${stop.latitude.toFixed(5)}, ${stop.longitude.toFixed(5)}` : 'No location')}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
}

const tm = StyleSheet.create({
  screen:        { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },

  header:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', gap: 8 },
  backBtn:       { padding: 4, marginRight: 2 },
  avatar:        { width: 34, height: 34, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  avatarTxt:     { color: '#374151', fontWeight: '700', fontSize: 14 },
  userName:      { fontSize: 14, fontWeight: '700', color: Colors.text },
  userSub:       { fontSize: 11, color: Colors.textLight },
  navBtn:        { padding: 6 },
  dateLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateLabel:     { fontSize: 13, fontWeight: '700', color: Colors.text },
  todayBadge:    { backgroundColor: '#C0392B', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  todayTxt:      { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  mapWrap:       { width: '100%', backgroundColor: '#e2e8f0' },
  dragHandle:    { width: '100%', height: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E5E7EB', cursor: 'row-resize' },
  dragPill:      { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1' },

  strip:         { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingVertical: 10 },
  stripItem:     { flex: 1, alignItems: 'center' },
  stripDiv:      { width: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  stripVal:      { fontSize: 13, fontWeight: '700', color: Colors.text },
  stripLbl:      { fontSize: 10, color: Colors.textLight, marginTop: 1 },

  legend:        { flexDirection: 'row', gap: 14, marginBottom: 10 },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:     { width: 8, height: 8, borderRadius: 4 },
  legendTxt:     { fontSize: 11, color: Colors.textLight },

  stopRow:       { flexDirection: 'row', marginBottom: 2 },
  spine:         { width: 24, alignItems: 'center' },
  dot:           { width: 10, height: 10, borderRadius: 5, marginTop: 4, zIndex: 1 },
  line:          { width: 1, flex: 1, backgroundColor: '#E5E7EB', marginTop: 2 },
  stopCard:      { flex: 1, paddingLeft: 8, paddingBottom: 14 },
  timeRange:     { fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1 },
  durTxt:        { fontSize: 11, color: Colors.textMuted, backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  addrTxt:       { fontSize: 12, color: Colors.textLight },

  empty:         { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  emptyTitle:    { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptySubtitle: { fontSize: 13, color: Colors.textLight, textAlign: 'center', lineHeight: 20 },
  goTodayBtn:    { paddingHorizontal: 20, paddingVertical: 9, backgroundColor: '#C0392B', borderRadius: 10 },
  goTodayTxt:    { color: '#fff', fontWeight: '700', fontSize: 13 },
});

// ── Agent row ─────────────────────────────────────────────────────────────────
function AgentRow({ agent, onTrack }) {
  const hasLocation = agent.check_in != null;

  return (
    <View style={row.wrap}>
      <View style={row.avatar}>
        <Text style={row.avatarTxt}>{(agent.name || '?')[0].toUpperCase()}</Text>
      </View>

      <View style={row.info}>
        <Text style={row.name}>{agent.name}</Text>
        <View style={row.statusRow}>
          <View style={[row.dot, { backgroundColor: hasLocation ? Colors.success : '#D1D5DB' }]} />
          <Text style={[row.statusTxt, { color: hasLocation ? Colors.success : Colors.textMuted }]}>
            {hasLocation ? 'Checked in' : 'Not checked in'}
          </Text>
          {hasLocation && <Text style={row.checkinTime}> · {agent.check_in}</Text>}
        </View>
      </View>

      <TouchableOpacity style={row.trackBtn} onPress={() => onTrack(agent)}>
        <Ionicons name="navigate-outline" size={14} color={Colors.textLight} />
        <Text style={row.trackTxt}>Track</Text>
      </TouchableOpacity>
    </View>
  );
}

const row = StyleSheet.create({
  wrap:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#fff', gap: 12 },
  avatar:      { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarTxt:   { color: '#374151', fontWeight: '700', fontSize: 15 },
  info:        { flex: 1, minWidth: 0 },
  name:        { fontSize: 14, fontWeight: '600', color: Colors.text },
  statusRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 },
  dot:         { width: 7, height: 7, borderRadius: 4 },
  statusTxt:   { fontSize: 12, fontWeight: '500' },
  checkinTime: { fontSize: 12, color: Colors.textLight },
  trackBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F7F8FA', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  trackTxt:    { fontSize: 12, fontWeight: '600', color: Colors.textLight },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function LocationTrackingScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isMobile  = width < 768;
  const { user, users: localUsers, loadUsers } = useAuthStore();
  const today = dayjs().format('YYYY-MM-DD');

  const [selectedDate, setSelectedDate] = useState(today);
  const [agents, setAgents]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState('');
  const [trackUser, setTrackUser]       = useState(null);
  const [trackModal, setTrackModal]     = useState(false);
  const intervalRef                     = useRef(null);

  const changeDay = (d) => {
    const next = dayjs(selectedDate).add(d, 'day');
    if (next.isAfter(dayjs(today))) return;
    setSelectedDate(next.format('YYYY-MM-DD'));
  };

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      // Load staff list and attendance in parallel
      const [staffData, apiData] = await Promise.all([
        api.get('/staff').catch(() => null),
        api.get(`/attendance/report?date=${selectedDate}`).catch(() => null),
      ]);

      const allUsers = Array.isArray(staffData) ? staffData : (localUsers || []);
      const attRecords = Array.isArray(apiData) ? apiData : [];
      useAttendanceStore.getState().setRecords(attRecords.map(r => ({ ...r, userId: r.staff_id, date: r.date || selectedDate })));

      const attMap = {};
      attRecords.forEach(r => { attMap[r.staff_id] = r; });

      setAgents(allUsers.map(u => {
        const att = attMap[u.id];
        return att
          ? { ...att, id: u.id, name: u.name || u.username }
          : { id: u.id, staff_id: u.id, name: u.name || u.username, check_in: null, check_out: null, status: 'absent' };
      }));
    } catch (e) {
      console.error('Network load error:', e);
      setAgents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, localUsers]);

  useFocusEffect(
    useCallback(() => {
      load();
      // Only auto-refresh when viewing today
      if (selectedDate === today) {
        intervalRef.current = setInterval(() => load(), 30000);
      }
      return () => clearInterval(intervalRef.current);
    }, [load, selectedDate])
  );

  const filtered = agents.filter(a =>
    a.name?.toLowerCase().includes(search.toLowerCase())
  );

  const isToday   = selectedDate === today;
  const checkedIn = agents.filter(a => a.check_in).length;

  const handleTrack = (agent) => {
    setTrackUser(agent);
    setTrackModal(true);
  };

  return (
    <View style={s.screen}>
      <Navbar navigation={navigation} activeTab="Network" />

      {/* Combined header row */}
      <View style={s.topBar}>
        {!isMobile && <Text style={s.pageTitle}>Network</Text>}

        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search staff..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={Colors.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.dateNav}>
          <TouchableOpacity style={s.dateArrow} onPress={() => changeDay(-1)}>
            <Ionicons name="chevron-back" size={15} color={Colors.text} />
          </TouchableOpacity>
          <View style={s.dateLabelWrap}>
            <Text style={s.dateLabel}>
              {isToday ? 'Today' : dayjs(selectedDate).format('DD MMM YYYY')}
            </Text>
            {isToday && <View style={s.liveBadge}><Text style={s.liveTxt}>LIVE</Text></View>}
          </View>
          <TouchableOpacity style={[s.dateArrow, isToday && { opacity: 0.3 }]} onPress={() => changeDay(1)} disabled={isToday}>
            <Ionicons name="chevron-forward" size={15} color={Colors.text} />
          </TouchableOpacity>
        </View>



        <TouchableOpacity style={s.refreshBtn} onPress={() => load(true)}>
          {refreshing
            ? <ActivityIndicator size="small" color={Colors.textLight} />
            : <Ionicons name="refresh-outline" size={15} color={Colors.textLight} />
          }
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          style={{ flex: 1, width: '100%' }}
          data={filtered}
          keyExtractor={(_, i) => String(i)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.primary]} />
          }
          ItemSeparatorComponent={() => <View style={s.sep} />}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="people-outline" size={44} color={Colors.textMuted} />
              <Text style={s.emptyTxt}>No staff found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <AgentRow agent={item} onTrack={handleTrack} />
          )}
        />
      )}

      <TrackModal
        visible={trackModal}
        user={trackUser}
        initialDate={selectedDate}
        onClose={() => setTrackModal(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen:     { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },
  topBar:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  pageTitle:     { fontSize: 16, fontWeight: '700', color: Colors.text },
  pageSub:       { fontSize: 12, color: Colors.textLight, fontWeight: '500' },
  refreshBtn:    { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F7F8FA', justifyContent: 'center', alignItems: 'center' },
  dateNav:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateArrow:     { padding: 5, borderRadius: 6, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#E5E7EB' },
  dateLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateLabel:     { fontSize: 13, fontWeight: '600', color: Colors.text },
  liveBadge:     { backgroundColor: '#C0392B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  liveTxt:       { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  searchWrap:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F7F8FA', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 10, paddingVertical: 6 },
  searchInput:   { flex: 1, fontSize: 13, color: Colors.text, padding: 0, outlineStyle: 'none' },
  sep:        { height: 1, backgroundColor: Colors.divider },
  center:     { paddingVertical: 60, alignItems: 'center', gap: 10 },
  emptyTxt:   { fontSize: 14, color: Colors.textMuted },
});
