import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@constants/colors';
import Navbar from '@components/common/Navbar';

export default function AttendanceScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Navbar navigation={navigation} activeTab="Attendance" />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={styles.text}>Attendance — Coming Soon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  text:      { fontSize: 16, color: Colors.textLight },
});
