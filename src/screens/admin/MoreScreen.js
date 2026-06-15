import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';

const ITEMS = [
  { label: 'Leave',       icon: 'document-text-outline', color: '#7C3AED', screen: 'Leave' },
  { label: 'Documents',   icon: 'folder-open-outline',   color: '#0369A1', screen: 'Documents' },
  { label: 'Attendance',  icon: 'calendar-outline',      color: '#15803D', screen: 'Attendance' },
  { label: 'Departments', icon: 'business-outline',      color: '#C2410C', screen: 'Departments' },
  { label: 'Shifts',      icon: 'time-outline',          color: '#B45309', screen: 'Shifts' },
  { label: 'Ledgers',     icon: 'book-outline',          color: '#1D4ED8', screen: 'Ledgers' },
  { label: 'Items',       icon: 'cube-outline',          color: '#6D28D9', screen: 'Items' },
  { label: 'Orders',      icon: 'cart-outline',          color: '#DC2626', screen: 'Orders' },
];

export default function MoreScreen({ navigation }) {
  return (
    <View style={s.screen}>
      <Navbar navigation={navigation} activeTab="More" />
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={s.content}>
        <Text style={s.heading}>More</Text>
        <View style={s.grid}>
          {ITEMS.map(item => (
            <TouchableOpacity
              key={item.screen}
              style={s.tile}
              onPress={() => navigation.navigate(item.screen)}
            >
              <View style={[s.tileIcon, { backgroundColor: item.color + '18' }]}>
                <Ionicons name={item.icon} size={26} color={item.color} />
              </View>
              <Text style={s.tileLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:   { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: '#F7F8FA' },
  content:  { padding: 16, paddingBottom: 80 },
  heading:  { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 16 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile:     { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  tileIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  tileLabel:{ fontSize: 13, fontWeight: '700', color: '#1E293B' },
});
