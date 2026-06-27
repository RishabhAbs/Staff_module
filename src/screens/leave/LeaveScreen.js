import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, FlatList, Modal, ActivityIndicator, RefreshControl, Alert,
  useWindowDimensions, Switch, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';
import api from '@services/api';
import { useAuthStore } from '@store/authStore';

// Custom Type Badges
const TYPE_COLORS = {
  'Casual Leave': { bg: '#FFF7ED', text: '#C2410C', icon: 'cafe-outline' },
  'Sick Leave':   { bg: '#FEF2F2', text: '#B91C1C', icon: 'medkit-outline' },
  'Earned Leave': { bg: '#F0FDF4', text: '#15803D', icon: 'ribbon-outline' },
  'Maternity':    { bg: '#F5F3FF', text: '#6D28D9', icon: 'heart-outline' },
  'Paternity':    { bg: '#F0F9FF', text: '#0369A1', icon: 'person-outline' },
  'Other':        { bg: '#F3F4F6', text: '#374151', icon: 'document-text-outline' },
};

const STATUS_CONFIG = {
  pending:  { label: 'PENDING',  bg: '#FEF3C7', color: '#B45309', icon: 'hourglass-outline' },
  approved: { label: 'APPROVED', bg: '#D1FAE5', color: '#047857', icon: 'checkmark-circle-outline' },
  rejected: { label: 'REJECTED', bg: '#FEE2E2', color: '#B91C1C', icon: 'close-circle-outline' },
};

// Beautiful Date Input Component for Cross-Platform
function DateInput({ value, onChange, label, placeholder }) {
  if (Platform.OS === 'web') {
    return (
      <View style={form.field}>
        <Text style={form.label}>{label}</Text>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            border: '1px solid #E5E7EB',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '14px',
            color: '#111827',
            backgroundColor: '#F9FAFB',
            fontFamily: 'inherit',
            width: '100%',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </View>
    );
  }
  return (
    <View style={form.field}>
      <Text style={form.label}>{label}</Text>
      <TextInput
        style={form.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || 'YYYY-MM-DD'}
        placeholderTextColor={Colors.textMuted}
      />
    </View>
  );
}

export default function LeaveScreen({ navigation }) {
  const { user } = useAuthStore();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, pending, approved, rejected
  const [search, setSearch] = useState('');
  const [showApplyModal, setShowApplyModal] = useState(false);
  
  // Apply Form State
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [reason, setReason] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Leaves
  const fetchLeaves = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api.get('/leave');
      setLeaves(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching leaves:', err);
      Alert.alert('Error', 'Failed to fetch leave requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchLeaves();
    }, [])
  );

  // Submit Leave Request
  const handleApply = async () => {
    if (!fromDate || !toDate) {
      Alert.alert('Error', 'Please select both from and to dates');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for the leave');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/leave/apply', {
        from_date: fromDate,
        to_date: toDate,
        type: leaveType,
        reason: reason.trim(),
        notify_email: notifyEmail
      });

      Alert.alert('Success', 'Leave request submitted successfully');
      setShowApplyModal(false);
      // Reset form
      setFromDate('');
      setToDate('');
      setLeaveType('Casual Leave');
      setReason('');
      setNotifyEmail(true);
      fetchLeaves();
    } catch (err) {
      Alert.alert('Error', err?.error || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  // Review (Approve/Reject) Leave Request
  const handleReview = async (id, status) => {
    const actionText = status === 'approved' ? 'approve' : 'reject';
    
    const executeReview = async () => {
      try {
        await api.put(`/leave/${id}`, { status });
        if (Platform.OS === 'web') {
          window.alert(`Leave request ${status} successfully`);
        } else {
          Alert.alert('Success', `Leave request ${status} successfully`);
        }
        fetchLeaves();
      } catch (err) {
        if (Platform.OS === 'web') {
          window.alert(err?.error || 'Failed to update leave request');
        } else {
          Alert.alert('Error', err?.error || 'Failed to update leave request');
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Are you sure you want to ${actionText} this leave request?`);
      if (confirmed) {
        executeReview();
      }
    } else {
      Alert.alert(
        `Confirm Action`,
        `Are you sure you want to ${actionText} this leave request?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: status === 'approved' ? 'Approve' : 'Reject',
            style: status === 'approved' ? 'default' : 'destructive',
            onPress: executeReview
          }
        ]
      );
    }
  };

  // Filter and Search leaves
  const filteredLeaves = leaves.filter(item => {
    const matchFilter = filter === 'all' || item.status === filter;
    
    let matchSearch = true;
    if (user?.role === 'admin' && search.trim() !== '') {
      matchSearch = item.staff_name?.toLowerCase().includes(search.toLowerCase()) ||
                    item.reason?.toLowerCase().includes(search.toLowerCase());
    } else if (search.trim() !== '') {
      matchSearch = item.reason?.toLowerCase().includes(search.toLowerCase()) ||
                    item.type?.toLowerCase().includes(search.toLowerCase());
    }

    return matchFilter && matchSearch;
  });

  // Count metrics for Statistics
  const pendingCount = leaves.filter(l => l.status === 'pending').length;
  const approvedCount = leaves.filter(l => l.status === 'approved').length;
  const rejectedCount = leaves.filter(l => l.status === 'rejected').length;

  const renderHeader = () => (
    <View style={isMobile ? styles.pageHeaderMobile : styles.pageHeader}>
      {!isMobile && (
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>
            {user?.role === 'admin' ? 'Leave Approvals' : 'Leave Requests'}
          </Text>
        </View>
      )}
      {user?.role !== 'admin' && !isMobile && (
        <TouchableOpacity style={styles.applyBtn} onPress={() => setShowApplyModal(true)}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.applyBtnTxt}>Apply Leave</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStats = () => {
    const statsList = user?.role === 'admin' 
      ? [
          { label: 'Pending Approval', val: pendingCount, color: '#B45309', bg: '#FFFBEB', icon: 'hourglass' },
          { label: 'Approved Leaves', val: approvedCount, color: '#047857', bg: '#F0FDF4', icon: 'checkmark-circle' },
          { label: 'Rejected/Cancelled', val: rejectedCount, color: '#B91C1C', bg: '#FEF2F2', icon: 'close-circle' },
        ]
      : [
          { label: 'My Approved', val: approvedCount, color: '#047857', bg: '#F0FDF4', icon: 'checkmark-circle' },
          { label: 'My Pending', val: pendingCount, color: '#B45309', bg: '#FFFBEB', icon: 'hourglass' },
          { label: 'My Rejected', val: rejectedCount, color: '#B91C1C', bg: '#FEF2F2', icon: 'close-circle' },
        ];

    return (
      <View style={[styles.statsGrid, isMobile && styles.statsGridMobile]}>
        {statsList.map((stat, i) => isMobile ? (
          <View key={i} style={[styles.statCardMobile, { backgroundColor: stat.bg }]}>
            <Text style={[styles.statValueMobile, { color: stat.color }]}>{stat.val}</Text>
            <Text style={styles.statLabelMobile}>{stat.label}</Text>
          </View>
        ) : (
          <View key={i} style={[styles.statCard, { backgroundColor: stat.bg }]}>
            <View style={styles.statIconBox}>
              <Ionicons name={stat.icon} size={24} color={stat.color} />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.val}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const [filterModal, setFilterModal] = useState(false);

  const renderFilters = () => (
    <View style={styles.filterSection}>
      <View style={styles.filterRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={Colors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder={user?.role === 'admin' ? "Search by employee or reason..." : "Search by reason or type..."}
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {isMobile ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              style={[styles.filterBtn, filter !== 'all' && styles.filterBtnActive]}
              onPress={() => setFilterModal(true)}
            >
              <Ionicons name="filter-outline" size={18} color={filter !== 'all' ? Colors.brandRed : Colors.textLight} />
            </TouchableOpacity>
            {user?.role !== 'admin' && (
              <TouchableOpacity style={styles.applyBtnMobile} onPress={() => setShowApplyModal(true)}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.applyBtnTxtMobile}>Apply</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {[
              { key: 'all', label: 'All Requests' },
              { key: 'pending', label: 'Pending' },
              { key: 'approved', label: 'Approved' },
              { key: 'rejected', label: 'Rejected' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
                onPress={() => setFilter(tab.key)}
              >
                <Text style={[styles.filterTabTxt, filter === tab.key && styles.filterTabTxtActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Filter Modal for mobile */}
      <Modal visible={filterModal} transparent animationType="fade" onRequestClose={() => setFilterModal(false)}>
        <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={() => setFilterModal(false)}>
          <View style={styles.filterPanel}>
            <Text style={styles.filterPanelTitle}>Filter by Status</Text>
            {[
              { key: 'all', label: 'All Requests' },
              { key: 'pending', label: 'Pending' },
              { key: 'approved', label: 'Approved' },
              { key: 'rejected', label: 'Rejected' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterPanelItem, filter === tab.key && styles.filterPanelItemActive]}
                onPress={() => { setFilter(tab.key); setFilterModal(false); }}
              >
                <Text style={[styles.filterPanelTxt, filter === tab.key && { color: Colors.brandRed, fontWeight: '700' }]}>
                  {tab.label}
                </Text>
                {filter === tab.key && <Ionicons name="checkmark" size={16} color={Colors.brandRed} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );

  const renderLeaveRow = ({ item }) => {
    const typeMeta = TYPE_COLORS[item.type] || TYPE_COLORS.Other;
    const statusMeta = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const isPending = item.status === 'pending';
    const formatD = (d) => dayjs(d).format('DD MMM YYYY');
    const totalDays = dayjs(item.to_date).diff(dayjs(item.from_date), 'day') + 1;

    if (isMobile) {
      return (
        <View style={styles.leaveCard}>
          {/* Row 1: Name/Type on left, Status badge on right */}
          <View style={styles.mCardHeader}>
            <View style={{ flex: 1 }}>
              {user?.role === 'admin' ? (
                <View style={styles.staffMeta}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarTxt}>{(item.staff_name || '?')[0].toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.staffName}>{item.staff_name?.toUpperCase()}</Text>
                    <Text style={styles.staffEmail}>{item.staff_email || ''}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.mLeaveType}>{item.type}</Text>
              )}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
              <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
          </View>

          {/* Row 2: Left = dates+days, Right = type (admin) */}
          <View style={styles.mCardBody}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mDateTxt}>
                {formatD(item.from_date)}{item.from_date !== item.to_date ? ` → ${formatD(item.to_date)}` : ''}
              </Text>
              <Text style={styles.mDays}>{totalDays} {totalDays === 1 ? 'Day' : 'Days'}</Text>
            </View>
            {user?.role === 'admin' && (
              <Text style={styles.mTypeTxt}>{item.type}</Text>
            )}
          </View>

          {/* Row 3: Reason */}
          <View style={styles.mCardReason}>
            <Text style={styles.mReasonTxt} numberOfLines={2}>
              <Text style={{ color: '#64748B' }}>Reason: </Text>{item.reason || '—'}
            </Text>
          </View>

          {/* Admin actions */}
          {user?.role === 'admin' && isPending && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleReview(item.id, 'rejected')}>
                <Ionicons name="close" size={14} color={Colors.brandRed} />
                <Text style={styles.rejectBtnTxt}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleReview(item.id, 'approved')}>
                <Ionicons name="checkmark" size={14} color="#fff" />
                <Text style={styles.approveBtnTxt}>Approve</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.leaveCard}>
        <View style={styles.cardHeader}>
          {user?.role === 'admin' ? (
            <View style={styles.staffMeta}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{(item.staff_name || '?')[0].toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.staffName}>{item.staff_name?.toUpperCase()}</Text>
                <Text style={styles.staffEmail}>{item.staff_email || 'No email registered'}</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.typeBadge, { backgroundColor: typeMeta.bg }]}>
              <Ionicons name={typeMeta.icon} size={13} color={typeMeta.text} />
              <Text style={[styles.typeText, { color: typeMeta.text }]}>{item.type}</Text>
            </View>
          )}

          <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
            <Ionicons name={statusMeta.icon} size={11} color={statusMeta.color} style={{ marginRight: 3 }} />
            <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={14} color={Colors.textLight} />
              <Text style={styles.infoText}>
                <Text style={{ fontWeight: '700', color: Colors.text }}>{formatD(item.from_date)}</Text>
                {item.from_date !== item.to_date && (
                  <>
                    <Text style={{ color: Colors.textMuted }}> to </Text>
                    <Text style={{ fontWeight: '700', color: Colors.text }}>{formatD(item.to_date)}</Text>
                  </>
                )}
              </Text>
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{totalDays} {totalDays === 1 ? 'Day' : 'Days'}</Text>
              </View>
            </View>

            {user?.role === 'admin' && (
              <View style={styles.infoRow}>
                <Ionicons name="bookmark-outline" size={14} color={Colors.textLight} />
                <View style={[styles.typeBadgeCompact, { backgroundColor: typeMeta.bg }]}>
                  <Ionicons name={typeMeta.icon} size={11} color={typeMeta.text} style={{ marginRight: 3 }} />
                  <Text style={[styles.typeTxtCompact, { color: typeMeta.text }]}>{item.type}</Text>
                </View>
              </View>
            )}

            <View style={[styles.infoRow, { alignItems: 'flex-start' }]}>
              <Ionicons name="chatbox-ellipses-outline" size={14} color={Colors.textLight} style={{ marginTop: 2 }} />
              <Text style={styles.reasonText}>
                <Text style={{ fontWeight: '600', color: Colors.textLight }}>Reason: </Text>
                {item.reason || 'No reason provided.'}
              </Text>
            </View>
          </View>
        </View>

        {user?.role === 'admin' && isPending && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleReview(item.id, 'rejected')}>
              <Ionicons name="close" size={14} color={Colors.brandRed} />
              <Text style={styles.rejectBtnTxt}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleReview(item.id, 'approved')}>
              <Ionicons name="checkmark" size={14} color="#fff" />
              <Text style={styles.approveBtnTxt}>Approve</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.requestedAt}>
            Requested on {dayjs(item.created_at).format('DD MMM YYYY [at] hh:mm A')}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Navbar activeTab="Leave" navigation={navigation} />

      <ScrollView 
        style={styles.mainScroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchLeaves(true)} colors={[Colors.brandRed]} />
        }
      >
        <View style={isMobile ? styles.contentCardMobile : styles.contentCard}>
          {renderHeader()}
          {renderStats()}
          {renderFilters()}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.brandRed} />
              <Text style={styles.loadingText}>Fetching leave requests...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredLeaves}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderLeaveRow}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No leave requests found</Text>
                  <Text style={styles.emptySub}>
                    {filter === 'all' 
                      ? 'No leave requests have been filed yet.' 
                      : `No leave requests matching filter "${filter}" were found.`}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </ScrollView>

      {/* Apply Leave Modal */}
      <Modal
        visible={showApplyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowApplyModal(false)}
      >
        <View style={form.overlay}>
          <View style={form.card}>
            <View style={form.header}>
              <View style={form.iconBox}>
                <Ionicons name="calendar" size={20} color={Colors.brandRed} />
              </View>
              <Text style={form.title}>Request Leave</Text>
              <TouchableOpacity onPress={() => setShowApplyModal(false)} style={form.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textLight} />
              </TouchableOpacity>
            </View>

            <ScrollView style={form.scroll} showsVerticalScrollIndicator={false}>
              <View style={form.row}>
                <DateInput
                  label="From Date"
                  value={fromDate}
                  onChange={setFromDate}
                  placeholder="YYYY-MM-DD"
                />
                <DateInput
                  label="To Date"
                  value={toDate}
                  onChange={setToDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <Text style={form.label}>Leave Type</Text>
              <View style={form.typeGrid}>
                {Object.keys(TYPE_COLORS).map((type) => {
                  const meta = TYPE_COLORS[type];
                  const isSelected = leaveType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        form.typeBtn,
                        isSelected && { borderColor: Colors.brandRed, backgroundColor: Colors.primaryLight }
                      ]}
                      onPress={() => setLeaveType(type)}
                    >
                      <Ionicons 
                        name={meta.icon} 
                        size={16} 
                        color={isSelected ? Colors.brandRed : Colors.textLight} 
                      />
                      <Text style={[form.typeBtnTxt, isSelected && { color: Colors.brandRed, fontWeight: '700' }]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={form.label}>Reason for Leave</Text>
              <TextInput
                style={form.textarea}
                value={reason}
                onChangeText={setReason}
                placeholder="Please describe the reason for your leave request..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={4}
              />

              <View style={form.toggleRow}>
                <View style={form.toggleText}>
                  <Text style={form.toggleTitle}>Notify Admin via Email</Text>
                  <Text style={form.toggleSub}>Send an email copy of this request immediately</Text>
                </View>
                <Switch
                  value={notifyEmail}
                  onValueChange={setNotifyEmail}
                  trackColor={{ false: '#E5E7EB', true: Colors.primaryLight }}
                  thumbColor={notifyEmail ? Colors.brandRed : '#9CA3AF'}
                />
              </View>

              <View style={form.btnRow}>
                <TouchableOpacity 
                  style={form.cancelBtn} 
                  onPress={() => setShowApplyModal(false)}
                  disabled={submitting}
                >
                  <Text style={form.cancelBtnTxt}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={form.submitBtn} 
                  onPress={handleApply}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={form.submitBtnTxt}>Submit Request</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: Colors.background },
  mainScroll:      { flex: 1 },
  scrollContent:   { padding: 16, paddingBottom: 60 },
  contentCard:     { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 20, minHeight: 400 },
  contentCardMobile: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 12, minHeight: 400 },

  pageHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pageHeaderMobile:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pageTitle:       { fontSize: 20, fontWeight: '800', color: Colors.text },
  pageTitleMobile: { fontSize: 16, fontWeight: '800', color: Colors.text },
  pageSubtitle:    { fontSize: 13, color: Colors.textLight, marginTop: 2 },
  applyBtn:        { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.brandRed, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, gap: 5 },
  applyBtnMobile:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.brandRed, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, gap: 4 },
  applyBtnTxt:     { color: '#fff', fontSize: 13, fontWeight: '700' },
  applyBtnTxtMobile: { color: '#fff', fontSize: 12, fontWeight: '700' },

  statsGrid:       { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statsGridMobile: { flexDirection: 'row', gap: 8 },
  statCard:        { flex: 1, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  statCardMobile:  { flex: 1, padding: 10, borderRadius: 12, alignItems: 'center' },
  statIconBox:     { width: 44, height: 44, borderRadius: 10, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  statContent:     { flex: 1 },
  statValue:       { fontSize: 20, fontWeight: '800' },
  statValueMobile: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  statLabel:       { fontSize: 11, fontWeight: '600', color: Colors.textLight, marginTop: 2 },
  statLabelMobile: { fontSize: 10, fontWeight: '600', color: Colors.textLight, marginTop: 2, textAlign: 'center' },

  filterSection:      { marginBottom: 16 },
  filterRow:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBar:          { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput:        { flex: 1, marginLeft: 8, fontSize: 13, color: Colors.text, height: 28, padding: 0 },
  filterBtn:          { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  filterBtnActive:    { borderColor: Colors.brandRed, backgroundColor: Colors.primaryLight },
  filterBtnTxt:       { fontSize: 12, color: Colors.textLight, fontWeight: '600' },
  filterTab:          { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  filterTabActive:    { backgroundColor: Colors.primaryLight, borderColor: Colors.brandRed },
  filterTabTxt:       { fontSize: 12, fontWeight: '600', color: Colors.textLight },
  filterTabTxtActive: { color: Colors.brandRed, fontWeight: '700' },
  filterOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  filterPanel:        { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 360, overflow: 'hidden' },
  filterPanelTitle:   { fontSize: 14, fontWeight: '700', color: Colors.text, padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filterPanelItem:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  filterPanelItemActive: { backgroundColor: '#FFF8F8' },
  filterPanelTxt:     { fontSize: 14, color: Colors.text },

  loadingContainer:{ paddingVertical: 60, alignItems: 'center', gap: 10 },
  loadingText:     { fontSize: 13, color: Colors.textLight, fontWeight: '500' },

  emptyContainer:  { paddingVertical: 60, alignItems: 'center', textAlign: 'center' },
  emptyTitle:      { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: 12 },
  emptySub:        { fontSize: 13, color: Colors.textLight, marginTop: 4, textAlign: 'center', maxWidth: 280 },

  leaveCard:       { backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 10 },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.divider, backgroundColor: '#FAFAFA' },
  staffMeta:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar:          { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFD1CE' },
  avatarTxt:       { fontSize: 11, fontWeight: '800', color: Colors.brandRed },
  staffName:       { fontSize: 12, fontWeight: '800', color: Colors.text },
  staffEmail:      { fontSize: 10, color: Colors.textLight, marginTop: 1 },

  typeBadge:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, gap: 4 },
  typeText:        { fontSize: 10, fontWeight: '700' },
  statusBadge:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  statusText:      { fontSize: 9, fontWeight: '800', letterSpacing: 0.2 },

  cardBody:        { padding: 12, gap: 8 },
  infoGrid:        { gap: 8 },
  infoRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  infoText:        { fontSize: 12, color: Colors.text },
  durationBadge:   { backgroundColor: Colors.primaryLight, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 10, marginLeft: 4 },
  durationText:    { fontSize: 10, fontWeight: '700', color: Colors.brandRed },
  
  typeBadgeCompact:{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeTxtCompact:  { fontSize: 9, fontWeight: '700' },
  
  reasonText:      { fontSize: 12, color: Colors.text, flex: 1, lineHeight: 16 },

  actionRow:       { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.divider, paddingHorizontal: 12, paddingVertical: 8, gap: 8, backgroundColor: '#FCFCFC' },
  actionBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 6, gap: 4, borderWidth: 1 },
  rejectBtn:       { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  rejectBtnTxt:    { color: Colors.brandRed, fontWeight: '700', fontSize: 11 },
  approveBtn:      { borderColor: Colors.brandRed, backgroundColor: Colors.brandRed },
  approveBtnTxt:   { color: '#fff', fontWeight: '700', fontSize: 11 },

  cardFooter:      { paddingHorizontal: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#FAFAFA', paddingTop: 6 },
  requestedAt:     { fontSize: 9, color: Colors.textMuted },

  // Mobile card
  mCardHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  mLeaveType:      { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  mCardBody:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  mDateTxt:        { fontSize: 12, fontWeight: '600', color: '#0F172A' },
  mDays:           { fontSize: 11, color: '#64748B', marginTop: 2 },
  mTypeTxt:        { fontSize: 11, color: '#64748B', textAlign: 'right', maxWidth: 100 },
  mCardReason:     { paddingHorizontal: 12, paddingVertical: 8 },
  mReasonTxt:      { fontSize: 12, color: '#374151', lineHeight: 17 },
});

const form = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  card:         { backgroundColor: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 460, maxHeight: '90%' },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  iconBox:      { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  title:        { fontSize: 16, fontWeight: '800', color: Colors.text, flex: 1 },
  closeBtn:     { padding: 2 },
  scroll:       { width: '100%' },
  
  row:          { flexDirection: 'row', gap: 12, marginBottom: 14 },
  field:        { flex: 1 },
  label:        { fontSize: 12, fontWeight: '700', color: Colors.textLight, marginBottom: 6 },
  input:        { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.text, backgroundColor: '#F9FAFB' },
  
  typeGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  typeBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FAFBFB' },
  typeBtnTxt:   { fontSize: 11, fontWeight: '600', color: Colors.textLight },
  
  textarea:     { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.text, backgroundColor: '#F9FAFB', textAlignVertical: 'top', minHeight: 80, marginBottom: 16 },
  
  toggleRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10, borderHorizontalWidth: 1, borderColor: '#F3F4F6', marginBottom: 20 },
  toggleText:   { flex: 1, paddingRight: 10 },
  toggleTitle:  { fontSize: 13, fontWeight: '700', color: Colors.text },
  toggleSub:    { fontSize: 11, color: Colors.textLight, marginTop: 1 },
  
  btnRow:       { flexDirection: 'row', gap: 12 },
  cancelBtn:    { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  cancelBtnTxt: { fontSize: 13, fontWeight: '700', color: Colors.textLight },
  submitBtn:    { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brandRed, borderRadius: 10, paddingVertical: 12 },
  submitBtnTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
