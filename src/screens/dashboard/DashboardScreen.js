import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import { useAuthStore } from '@store/authStore';

const STATS = [
  { label: 'Total Staff',    value: '0', icon: 'people',      color: Colors.primary },
  { label: 'Present Today',  value: '0', icon: 'checkmark-circle', color: Colors.success },
  { label: 'On Leave',       value: '0', icon: 'calendar',    color: Colors.warning },
  { label: 'Pending Leave',  value: '0', icon: 'time',        color: Colors.danger },
];

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Good Morning, {user?.name || 'Admin'} 👋</Text>

      <View style={styles.grid}>
        {STATS.map((stat) => (
          <View key={stat.label} style={styles.card}>
            <View style={[styles.iconBox, { backgroundColor: stat.color + '20' }]}>
              <Ionicons name={stat.icon} size={24} color={stat.color} />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content:   { padding: 16 },
  greeting:  { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 20 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card:      { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, width: '47%', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8 },
  iconBox:   { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValue: { fontSize: 28, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textLight, marginTop: 2 },
});
