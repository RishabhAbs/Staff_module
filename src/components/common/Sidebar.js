import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import { useSidebarStore } from '@store/sidebarStore';
import { useAuthStore } from '@store/authStore';
import { navigate, navigationRef } from '@navigation';
import ABSLogo from './ABSLogo';

const SIDEBAR_WIDTH = 250;

const ADMIN_ITEMS = [
  { label: 'Dashboard',   icon: 'home-outline',           screen: 'Home' },
  { label: 'Users',       icon: 'people-outline',         screen: 'Users' },
  { label: 'Network',     icon: 'location-outline',       screen: 'Tracking' },
  { label: 'Attendance',  icon: 'calendar-outline',       screen: 'Attendance' },
  { label: 'Visits',      icon: 'navigate-outline',       screen: 'New' },
  { label: 'Leads',       icon: 'megaphone-outline',      screen: 'Leads' },
  { label: 'Tasks',       icon: 'checkmark-done-outline', screen: 'Tasks' },
  { label: 'Leave',       icon: 'document-text-outline',  screen: 'Leave' },
  { label: 'Reminders',   icon: 'alarm-outline',          screen: 'Reminders' },
  { label: 'Orders',      icon: 'receipt-outline',        screen: 'Orders' },
  { label: 'Documents',   icon: 'folder-outline',         screen: 'Documents' },
  { label: 'Departments', icon: 'business-outline',       screen: 'Departments' },
  { label: 'Shifts',      icon: 'time-outline',           screen: 'Shifts' },
  { label: 'Ledgers',     icon: 'book-outline',           screen: 'Ledgers' },
  { label: 'Items',       icon: 'cube-outline',           screen: 'Items' },
  { label: 'Assets',      icon: 'hardware-chip-outline',  screen: 'Assets' },
  { label: 'Profile',     icon: 'person-outline',         screen: 'Profile' },
];

const USER_ITEMS = [
  { label: 'Dashboard', icon: 'home-outline',           screen: 'Home' },
  { label: 'Visits',    icon: 'navigate-outline',       screen: 'New' },
  { label: 'Leads',     icon: 'megaphone-outline',      screen: 'Leads' },
  { label: 'Leave',     icon: 'document-text-outline',  screen: 'Leave' },
  { label: 'Tasks',     icon: 'checkmark-done-outline', screen: 'Tasks' },
  { label: 'Assets',    icon: 'hardware-chip-outline',  screen: 'Assets' },
  { label: 'Profile',   icon: 'person-outline',         screen: 'Profile' },
];

export default function Sidebar() {
  const open  = useSidebarStore(s => s.open);
  const close = useSidebarStore(s => s.close);
  const { user } = useAuthStore();

  if (!open) return null;

  const items = user?.role === 'admin' ? ADMIN_ITEMS : USER_ITEMS;
  const current = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : null;

  const go = (screen) => { navigate(screen); close(); };

  return (
    <View style={s.panel}>
      <View style={s.header}>
        <ABSLogo size="sm" />
        <TouchableOpacity onPress={close} style={s.closeBtn}>
          <Ionicons name="close" size={22} color="#64748B" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
        {items.map(it => {
          const active = current === it.screen;
          return (
            <TouchableOpacity key={it.label} style={[s.item, active && s.itemActive]} onPress={() => go(it.screen)}>
              <Ionicons name={it.icon} size={18} color={active ? Colors.brandRed : '#64748B'} />
              <Text style={[s.itemTxt, active && s.itemTxtActive]}>{it.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export { SIDEBAR_WIDTH };

const s = StyleSheet.create({
  panel:        { width: SIDEBAR_WIDTH, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#E5E7EB', height: '100%' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 57, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  closeBtn:     { padding: 6 },
  item:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 13, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  itemActive:   { backgroundColor: '#FFF0EF', borderLeftColor: Colors.brandRed },
  itemTxt:      { fontSize: 14, color: '#334155', fontWeight: '600' },
  itemTxtActive:{ color: Colors.brandRed, fontWeight: '700' },
});
