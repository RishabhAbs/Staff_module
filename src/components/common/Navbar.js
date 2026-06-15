import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, Modal, Pressable, useWindowDimensions, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import ABSLogo from './ABSLogo';
import { useAuthStore } from '@store/authStore';
import api from '@services/api';

const MOBILE_BREAKPOINT = 768;

// ── Bottom tab bar for mobile web ─────────────────────────────────────────────
function BottomTabBar({ navigation, activeTab, user, onLogout }) {
  const [usersSheetOpen, setUsersSheetOpen]   = useState(false);
  const [masterSheetOpen, setMasterSheetOpen] = useState(false);

  const USER_GROUP_SCREENS   = ['Users', 'Network', 'Attendance'];
  const MASTER_GROUP_SCREENS = ['Shift Master', 'Departments', 'Ledger Master', 'Item Master', 'Documents', 'Leave', 'Orders'];
  const isInUserGroup   = USER_GROUP_SCREENS.includes(activeTab);
  const isInMasterGroup = MASTER_GROUP_SCREENS.includes(activeTab);

  const adminTabs = [
    { label: 'Home',      icon: 'home',                   screen: 'Home' },
    { label: 'Users',     icon: 'people-outline',         screen: null,   sheet: 'users' },
    { label: 'Tasks',     icon: 'checkmark-done-outline', screen: 'Tasks' },
    { label: 'Reminders', icon: 'alarm-outline',          screen: 'Reminders' },
    { label: 'Master',    icon: 'grid-outline',            screen: null,   sheet: 'master' },
    { label: 'Profile',   icon: 'person-outline',         screen: 'Profile' },
  ];
  const userTabs = [
    { label: 'Home',       icon: 'home',                     screen: 'Home' },
    { label: 'Attendance', icon: 'calendar-outline',         screen: 'Attendance' },
    { label: 'Leave',      icon: 'document-text-outline',    screen: 'Leave' },
    { label: 'Tasks',      icon: 'checkmark-done-outline',   screen: 'Tasks' },
    { label: 'Reminders',  icon: 'alarm-outline',            screen: 'Reminders' },
    { label: 'Profile',    icon: 'person-outline',           screen: 'Profile' },
  ];
  const tabs = user?.role === 'admin' ? adminTabs : userTabs;

  const userGroupItems = [
    { label: 'Users',      icon: 'people-outline',   screen: 'Users',      desc: 'Manage staff' },
    { label: 'Network',    icon: 'location-outline', screen: 'Tracking',   desc: 'Track locations' },
    { label: 'Attendance', icon: 'calendar-outline', screen: 'Attendance', desc: 'Attendance records' },
  ];

  const masterGroupItems = [
    { label: 'Leave',       icon: 'document-text-outline', screen: 'Leave',       color: '#7C3AED' },
    { label: 'Documents',   icon: 'folder-open-outline',   screen: 'Documents',   color: '#0369A1' },
    { label: 'Departments', icon: 'business-outline',      screen: 'Departments', color: '#C2410C' },
    { label: 'Shifts',      icon: 'time-outline',          screen: 'Shifts',      color: '#B45309' },
    { label: 'Ledgers',     icon: 'book-outline',          screen: 'Ledgers',     color: '#1D4ED8' },
    { label: 'Items',       icon: 'cube-outline',          screen: 'Items',       color: '#6D28D9' },
    { label: 'Orders',      icon: 'cart-outline',          screen: 'Orders',      color: '#DC2626' },
  ];

  return (
    <>
      <View style={bt.bar}>
        {tabs.map(tab => {
          const isActive = tab.sheet === 'users'
            ? isInUserGroup
            : tab.sheet === 'master'
            ? isInMasterGroup
            : activeTab === tab.label ||
              (tab.screen === 'Tracking' && activeTab === 'Network');
          return (
            <TouchableOpacity
              key={tab.label}
              style={bt.tab}
              onPress={() => {
                if (tab.sheet === 'users')  { setUsersSheetOpen(true); }
                else if (tab.sheet === 'master') { setMasterSheetOpen(true); }
                else { navigation?.navigate(tab.screen); }
              }}
            >
              <Ionicons name={tab.icon} size={22} color={isActive ? Colors.brandRed : '#9CA3AF'} />
              <Text style={[bt.label, isActive && bt.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Users group bottom sheet */}
      <Modal visible={usersSheetOpen} transparent animationType="slide" onRequestClose={() => setUsersSheetOpen(false)}>
        <Pressable style={bt.sheetBackdrop} onPress={() => setUsersSheetOpen(false)}>
          <Pressable style={bt.sheet} onPress={e => e.stopPropagation?.()}>
            <View style={bt.sheetHandle} />
            <Text style={bt.sheetTitle}>People & Attendance</Text>
            <View style={bt.sheetCards}>
              {userGroupItems.map(item => {
                const isActive = activeTab === item.label || (item.screen === 'Tracking' && activeTab === 'Network');
                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[bt.sheetCard, isActive && bt.sheetCardActive]}
                    onPress={() => { setUsersSheetOpen(false); navigation?.navigate(item.screen); }}
                  >
                    <View style={[bt.sheetCardIcon, isActive && { backgroundColor: '#FFF0EF' }]}>
                      <Ionicons name={item.icon} size={22} color={isActive ? Colors.brandRed : '#6B7280'} />
                    </View>
                    <Text style={[bt.sheetCardLabel, isActive && { color: Colors.brandRed }]}>{item.label}</Text>
                    <Text style={bt.sheetCardDesc}>{item.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Master group bottom sheet */}
      <Modal visible={masterSheetOpen} transparent animationType="slide" onRequestClose={() => setMasterSheetOpen(false)}>
        <Pressable style={bt.sheetBackdrop} onPress={() => setMasterSheetOpen(false)}>
          <Pressable style={bt.sheet} onPress={e => e.stopPropagation?.()}>
            <View style={bt.sheetHandle} />
            <Text style={bt.sheetTitle}>Master & Settings</Text>
            <View style={bt.masterGrid}>
              {masterGroupItems.map(item => {
                const isActive = activeTab === item.label || activeTab === item.screen;
                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[bt.masterTile, isActive && { borderColor: item.color, backgroundColor: item.color + '08' }]}
                    onPress={() => { setMasterSheetOpen(false); navigation?.navigate(item.screen); }}
                  >
                    <View style={[bt.masterTileIcon, { backgroundColor: item.color + '18' }]}>
                      <Ionicons name={item.icon} size={22} color={item.color} />
                    </View>
                    <Text style={[bt.masterTileLabel, isActive && { color: item.color }]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const bt = StyleSheet.create({
  bar:           { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingBottom: 8, paddingTop: 6, position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 },
  tab:           { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  label:         { fontSize: 10, fontWeight: '500', color: '#9CA3AF' },
  labelActive:   { color: Colors.brandRed, fontWeight: '700' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 32 },
  sheetHandle:   { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetTitle:    { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 16, textAlign: 'center' },
  sheetCards:    { flexDirection: 'row', gap: 10 },
  sheetCard:     { flex: 1, alignItems: 'center', gap: 6, backgroundColor: '#F9FAFB', borderRadius: 14, paddingVertical: 18, paddingHorizontal: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  sheetCardActive: { backgroundColor: '#FFF8F8', borderColor: Colors.brandRed },
  sheetCardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  sheetCardLabel:{ fontSize: 13, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  sheetCardDesc: { fontSize: 10, color: '#64748B', textAlign: 'center', lineHeight: 14 },

  masterGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  masterTile:      { width: '30%', alignItems: 'center', gap: 8, backgroundColor: '#F9FAFB', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  masterTileIcon:  { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  masterTileLabel: { fontSize: 11, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
});

// ── Main Navbar ───────────────────────────────────────────────────────────────
export default function Navbar({ navigation, activeTab = 'Home' }) {
  const { user, logout } = useAuthStore();
  const [userDropdown, setUserDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 52, left: 0 });
  const [masterDropdown, setMasterDropdown] = useState(false);
  const [masterDropdownPos, setMasterDropdownPos] = useState({ top: 52, left: 0 });
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifPos, setNotifPos] = useState({ top: 52, right: 60 });
  const [notifCount, setNotifCount] = useState(0);
  const [notifList, setNotifList] = useState([]);
  const usersButtonRef = useRef(null);
  const masterButtonRef = useRef(null);
  const notifButtonRef = useRef(null);
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;

  const fetchNotifCount = useCallback(() => {
    api.get('/notifications/count').then(r => setNotifCount(r?.count || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchNotifCount();
    const t = setInterval(fetchNotifCount, 60000);
    return () => clearInterval(t);
  }, [fetchNotifCount]);

  const openNotifPanel = () => {
    notifButtonRef.current?.measure((x, y, w, h, pageX, pageY) => {
      setNotifPos({ top: pageY + h + 4, right: window?.innerWidth - pageX - w });
    });
    api.get('/notifications').then(r => setNotifList(r || [])).catch(() => {});
    setNotifOpen(true);
  };

  const markAllRead = () => {
    api.put('/notifications/read-all').then(() => {
      setNotifCount(0);
      setNotifList(prev => prev.map(n => ({ ...n, is_read: 1 })));
    }).catch(() => {});
  };

  if (Platform.OS !== 'web') return null;

  const handleLogoutPress = () => setShowLogoutModal(true);

  const logoutModal = (
    <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
      <Pressable style={styles.modalBackdrop} onPress={() => setShowLogoutModal(false)}>
        <View style={styles.logoutModal}>
          <View style={styles.logoutIconBox}>
            <Ionicons name="log-out-outline" size={28} color="#C0392B" />
          </View>
          <Text style={styles.logoutTitle}>Logout</Text>
          <Text style={styles.logoutSub}>Are you sure you want to logout?</Text>
          <View style={styles.logoutBtns}>
            <TouchableOpacity style={styles.logoutCancel} onPress={() => setShowLogoutModal(false)}>
              <Text style={styles.logoutCancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutConfirm} onPress={() => { setShowLogoutModal(false); logout(); }}>
              <Text style={styles.logoutConfirmTxt}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );

  // ── Mobile: bottom tab bar ─────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <View style={styles.mobileTopBar}>
          <View style={styles.mobileLeftContainer}>
            <ABSLogo size="sm" />
          </View>
          <Text style={styles.mobilePageTitle}>{activeTab}</Text>
          <View style={styles.mobileRightContainer}>
            <TouchableOpacity ref={notifButtonRef} style={styles.mobileIconButton} onPress={openNotifPanel}>
              <Ionicons name="notifications-outline" size={22} color={Colors.textLight} />
              {notifCount > 0 && (
                <View style={[styles.notifBadge, { top: -2, right: -2 }]}>
                  <Text style={styles.notifBadgeTxt}>{notifCount > 9 ? '9+' : notifCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogoutPress} style={styles.mobileIconButton}>
              <Ionicons name="log-out-outline" size={22} color={Colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>
        <BottomTabBar
          navigation={navigation}
          activeTab={activeTab}
          user={user}
          onLogout={handleLogoutPress}
        />
        {logoutModal}
      </>
    );
  }

  // ── Desktop: top navbar ────────────────────────────────────────────────────
  return (
    <View style={styles.navbar}>
      <TouchableOpacity onPress={() => navigation?.navigate('Home')} activeOpacity={0.8}>
        <ABSLogo size="sm" />
      </TouchableOpacity>

      <View style={styles.navItems}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'Home' && styles.navItemActive]}
          onPress={() => navigation?.navigate('Home')}
        >
          <Ionicons name="home" size={16} color={activeTab === 'Home' ? Colors.brandRed : Colors.textLight} />
          <Text style={[styles.navLabel, activeTab === 'Home' && styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>

        <View ref={usersButtonRef}>
          <TouchableOpacity
            style={[styles.navItem, (activeTab === 'Users' || activeTab === 'Network' || activeTab === 'Attendance') && styles.navItemActive]}
            onPress={() => {
              usersButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
                setDropdownPos({ top: pageY + height + 4, left: pageX });
              });
              setUserDropdown(!userDropdown);
            }}
          >
            <Ionicons name="people-outline" size={16} color={(activeTab === 'Users' || activeTab === 'Network' || activeTab === 'Attendance') ? Colors.brandRed : Colors.textLight} />
            <Text style={[styles.navLabel, (activeTab === 'Users' || activeTab === 'Network' || activeTab === 'Attendance') && styles.navLabelActive]}>Users</Text>
            <Ionicons name={userDropdown ? 'chevron-up' : 'chevron-down'} size={12} color={(activeTab === 'Users' || activeTab === 'Network' || activeTab === 'Attendance') ? Colors.brandRed : Colors.textLight} />
          </TouchableOpacity>

          <Modal visible={userDropdown} transparent animationType="none" onRequestClose={() => setUserDropdown(false)}>
            <Pressable style={styles.modalBackdropClear} onPress={() => setUserDropdown(false)}>
              <View style={[styles.dropdown, { top: dropdownPos.top, left: dropdownPos.left }]}>
                {[
                  { label: 'Users',      icon: 'people-outline',   screen: 'Users',    adminOnly: true },
                  { label: 'Network',    icon: 'location-outline', screen: 'Tracking', adminOnly: true },
                  { label: 'Attendance', icon: 'calendar-outline', screen: 'Attendance', adminOnly: false },
                ].filter(item => !item.adminOnly || user?.role === 'admin').map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.dropdownItem, activeTab === item.label && styles.dropdownItemActive]}
                    onPress={() => { setUserDropdown(false); navigation?.navigate(item.screen); }}
                  >
                    <Ionicons name={item.icon} size={16} color={activeTab === item.label ? Colors.brandRed : Colors.text} />
                    <Text style={[styles.dropdownLabel, activeTab === item.label && styles.dropdownLabelActive]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Pressable>
          </Modal>
        </View>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'Leave' && styles.navItemActive]}
          onPress={() => navigation?.navigate('Leave')}
        >
          <Ionicons name="document-text-outline" size={16} color={activeTab === 'Leave' ? Colors.brandRed : Colors.textLight} />
          <Text style={[styles.navLabel, activeTab === 'Leave' && styles.navLabelActive]}>Leave</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'Tasks' && styles.navItemActive]}
          onPress={() => navigation?.navigate('Tasks')}
        >
          <Ionicons name="checkmark-done-outline" size={16} color={activeTab === 'Tasks' ? Colors.brandRed : Colors.textLight} />
          <Text style={[styles.navLabel, activeTab === 'Tasks' && styles.navLabelActive]}>Tasks</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'Reminders' && styles.navItemActive]}
          onPress={() => navigation?.navigate('Reminders')}
        >
          <Ionicons name="alarm-outline" size={16} color={activeTab === 'Reminders' ? Colors.brandRed : Colors.textLight} />
          <Text style={[styles.navLabel, activeTab === 'Reminders' && styles.navLabelActive]}>Reminders</Text>
        </TouchableOpacity>

        {user?.role === 'admin' && (
          <TouchableOpacity
            style={[styles.navItem, activeTab === 'Orders' && styles.navItemActive]}
            onPress={() => navigation?.navigate('Orders')}
          >
            <Ionicons name="receipt-outline" size={16} color={activeTab === 'Orders' ? Colors.brandRed : Colors.textLight} />
            <Text style={[styles.navLabel, activeTab === 'Orders' && styles.navLabelActive]}>Orders</Text>
          </TouchableOpacity>
        )}

        {user?.role === 'admin' && (
          <View ref={masterButtonRef}>
            <TouchableOpacity
              style={[styles.navItem, (activeTab === 'Shift Master' || activeTab === 'Departments' || activeTab === 'Ledger Master' || activeTab === 'Item Master' || activeTab === 'Documents') && styles.navItemActive]}
              onPress={() => {
                masterButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
                  setMasterDropdownPos({ top: pageY + height + 4, left: pageX });
                });
                setMasterDropdown(!masterDropdown);
              }}
            >
              <Ionicons name="settings-outline" size={16} color={(activeTab === 'Shift Master' || activeTab === 'Departments' || activeTab === 'Ledger Master' || activeTab === 'Item Master' || activeTab === 'Documents') ? Colors.brandRed : Colors.textLight} />
              <Text style={[styles.navLabel, (activeTab === 'Shift Master' || activeTab === 'Departments' || activeTab === 'Ledger Master' || activeTab === 'Item Master' || activeTab === 'Documents') && styles.navLabelActive]}>Master</Text>
              <Ionicons name={masterDropdown ? 'chevron-up' : 'chevron-down'} size={12} color={(activeTab === 'Shift Master' || activeTab === 'Departments' || activeTab === 'Ledger Master' || activeTab === 'Item Master' || activeTab === 'Documents') ? Colors.brandRed : Colors.textLight} />
            </TouchableOpacity>

            <Modal visible={masterDropdown} transparent animationType="none" onRequestClose={() => setMasterDropdown(false)}>
              <Pressable style={styles.modalBackdropClear} onPress={() => setMasterDropdown(false)}>
                <View style={[styles.dropdown, { top: masterDropdownPos.top, left: masterDropdownPos.left }]}>
                  <TouchableOpacity
                    style={[styles.dropdownItem, activeTab === 'Shift Master' && styles.dropdownItemActive]}
                    onPress={() => { setMasterDropdown(false); navigation?.navigate('Shifts'); }}
                  >
                    <Ionicons name="time-outline" size={16} color={activeTab === 'Shift Master' ? Colors.brandRed : Colors.text} />
                    <Text style={[styles.dropdownLabel, activeTab === 'Shift Master' && styles.dropdownLabelActive]}>Shift Master</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dropdownItem, activeTab === 'Departments' && styles.dropdownItemActive]}
                    onPress={() => { setMasterDropdown(false); navigation?.navigate('Departments'); }}
                  >
                    <Ionicons name="business-outline" size={16} color={activeTab === 'Departments' ? Colors.brandRed : Colors.text} />
                    <Text style={[styles.dropdownLabel, activeTab === 'Departments' && styles.dropdownLabelActive]}>Department Master</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dropdownItem, activeTab === 'Ledger Master' && styles.dropdownItemActive]}
                    onPress={() => { setMasterDropdown(false); navigation?.navigate('Ledgers'); }}
                  >
                    <Ionicons name="book-outline" size={16} color={activeTab === 'Ledger Master' ? Colors.brandRed : Colors.text} />
                    <Text style={[styles.dropdownLabel, activeTab === 'Ledger Master' && styles.dropdownLabelActive]}>Ledger Master</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dropdownItem, activeTab === 'Item Master' && styles.dropdownItemActive]}
                    onPress={() => { setMasterDropdown(false); navigation?.navigate('Items'); }}
                  >
                    <Ionicons name="cube-outline" size={16} color={activeTab === 'Item Master' ? Colors.brandRed : Colors.text} />
                    <Text style={[styles.dropdownLabel, activeTab === 'Item Master' && styles.dropdownLabelActive]}>Item Master</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dropdownItem, activeTab === 'Documents' && styles.dropdownItemActive, { borderBottomWidth: 0 }]}
                    onPress={() => { setMasterDropdown(false); navigation?.navigate('Documents'); }}
                  >
                    <Ionicons name="folder-outline" size={16} color={activeTab === 'Documents' ? Colors.brandRed : Colors.text} />
                    <Text style={[styles.dropdownLabel, activeTab === 'Documents' && styles.dropdownLabelActive]}>Documents</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Modal>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <View ref={notifButtonRef}>
          <TouchableOpacity style={styles.iconBtn} onPress={openNotifPanel}>
            <View>
              <Ionicons name="notifications-outline" size={20} color={Colors.textLight} />
              {notifCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeTxt}>{notifCount > 99 ? '99+' : notifCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <Modal visible={notifOpen} transparent animationType="none" onRequestClose={() => setNotifOpen(false)}>
            <Pressable style={styles.modalBackdropClear} onPress={() => setNotifOpen(false)}>
              <View style={[styles.notifPanel, { top: notifPos.top, right: notifPos.right }]}>
                <View style={styles.notifHeader}>
                  <Text style={styles.notifTitle}>Notifications</Text>
                  {notifCount > 0 && (
                    <TouchableOpacity onPress={markAllRead}>
                      <Text style={styles.notifMarkAll}>Mark all read</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView style={{ maxHeight: 340 }}>
                  {notifList.length === 0 ? (
                    <Text style={styles.notifEmpty}>No notifications</Text>
                  ) : notifList.map(n => (
                    <TouchableOpacity
                      key={n.id}
                      style={[styles.notifItem, !n.is_read && styles.notifItemUnread]}
                      onPress={() => {
                        api.put(`/notifications/${n.id}/read`).catch(() => {});
                        setNotifCount(c => Math.max(0, c - (n.is_read ? 0 : 1)));
                        setNotifList(prev => prev.map(x => x.id === n.id ? { ...x, is_read: 1 } : x));
                        setNotifOpen(false);
                        if (n.type === 'task_assigned') {
                          navigation?.navigate('Tasks');
                        }
                      }}
                    >
                      <View style={styles.notifDot} pointerEvents="none">
                        {!n.is_read && <View style={styles.notifDotInner} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.notifMsg}>{n.message}</Text>
                        <Text style={styles.notifTime}>{n.staff_name ? `${n.staff_name} · ` : ''}{new Date(n.created_at).toLocaleString()}</Text>
                      </View>
                      {n.type === 'task_assigned' && (
                        <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => navigation?.navigate('Profile')}>
          <Ionicons name="person-circle-outline" size={18} color={Colors.textLight} />
          <Text style={styles.profileText}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={handleLogoutPress}>
          <Ionicons name="log-out-outline" size={20} color={Colors.textLight} />
        </TouchableOpacity>
      </View>

      {logoutModal}
    </View>
  );
}

const styles = StyleSheet.create({
  navbar:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingLeft: 8, paddingRight: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', zIndex: 100 },
  mobileTopBar:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingLeft: 4, paddingRight: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  mobilePageTitle:      { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  mobileLeftContainer:  { width: 80, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 8 },
  mobileRightContainer: { width: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, paddingRight: 8 },
  mobileIconButton:     { padding: 4, position: 'relative' },
  navItems:         { flexDirection: 'row', flex: 1, marginLeft: 24, gap: 4 },
  navItem:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 5 },
  navItemActive:    { backgroundColor: '#FFF0EF' },
  navLabel:         { fontSize: 13, color: Colors.textLight, fontWeight: '500' },
  navLabelActive:   { color: Colors.brandRed, fontWeight: '600' },
  actions:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn:          { padding: 8, marginRight: 8 },
  profileBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6 },
  profileText:      { fontSize: 13, color: Colors.textLight, fontWeight: '500' },
  modalBackdrop:    { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBackdropClear: { flex: 1 },
  logoutModal:      { backgroundColor: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 320, alignItems: 'center' },
  logoutIconBox:    { width: 56, height: 56, borderRadius: 16, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  logoutTitle:      { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 6 },
  logoutSub:        { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 20 },
  logoutBtns:       { flexDirection: 'row', gap: 10, width: '100%' },
  logoutCancel:     { flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  logoutCancelTxt:  { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  logoutConfirm:    { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#C0392B', alignItems: 'center' },
  logoutConfirmTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  dropdown:         { position: 'absolute', backgroundColor: '#fff', borderRadius: 10, elevation: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, minWidth: 160, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  dropdownItem:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', gap: 10 },
  dropdownItemActive: { backgroundColor: '#FFF0EF' },
  dropdownLabel:    { fontSize: 13, color: Colors.text, fontWeight: '500' },
  dropdownLabelActive: { color: Colors.brandRed, fontWeight: '700' },
  notifBadge:       { position: 'absolute', top: -5, right: -5, backgroundColor: Colors.brandRed, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  notifBadgeTxt:    { color: '#fff', fontSize: 9, fontWeight: '700' },
  notifPanel:       { position: 'absolute', backgroundColor: '#fff', borderRadius: 12, elevation: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, width: 340, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  notifHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  notifTitle:       { fontSize: 14, fontWeight: '700', color: Colors.text },
  notifMarkAll:     { fontSize: 12, color: Colors.brandRed, fontWeight: '600' },
  notifEmpty:       { padding: 20, textAlign: 'center', color: Colors.textMuted, fontSize: 13 },
  notifItem:        { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 10 },
  notifItemUnread:  { backgroundColor: '#FFF5F5' },
  notifDot:         { width: 8, marginTop: 5 },
  notifDotInner:    { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.brandRed },
  notifMsg:         { fontSize: 12, color: Colors.text, lineHeight: 17 },
  notifTime:        { fontSize: 10, color: Colors.textMuted, marginTop: 3 },
});
