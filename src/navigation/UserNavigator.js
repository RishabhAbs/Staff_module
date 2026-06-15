import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';

import UserDashboardScreen  from '@screens/user/DashboardScreen';
import UserAttendanceScreen from '@screens/user/AttendanceScreen';
import LeaveScreen          from '@screens/leave/LeaveScreen';
import MyTasksScreen        from '@screens/user/MyTasksScreen';
import ProfileScreen        from '@screens/profile/ProfileScreen';
import UserDetailScreen     from '@screens/admin/UserDetailScreen';
import RemindersScreen      from '@screens/reminders/RemindersScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function UserTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   Colors.brandRed,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#E5E7EB',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Home:       'home',
            Attendance: 'calendar-outline',
            Leave:      'document-text-outline',
            Tasks:      'checkmark-done-outline',
            Reminders:  'alarm-outline',
            Profile:    'person-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"       component={UserDashboardScreen} />
      <Tab.Screen name="Attendance" component={UserAttendanceScreen} />
      <Tab.Screen name="Leave"      component={LeaveScreen} />
      <Tab.Screen name="Tasks"      component={MyTasksScreen} />
      <Tab.Screen name="Reminders"  component={RemindersScreen} />
      <Tab.Screen name="Profile"    component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function UserNavigator() {
  if (Platform.OS !== 'web') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="UserTabs"   component={UserTabs} />
        <Stack.Screen name="UserDetail" component={UserDetailScreen} />
      </Stack.Navigator>
    );
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F7F8FA', flex: 1, width: '100%', height: '100%' } }}>
      <Stack.Screen name="Home"       component={UserDashboardScreen} />
      <Stack.Screen name="Attendance" component={UserAttendanceScreen} />
      <Stack.Screen name="Leave"      component={LeaveScreen} />
      <Stack.Screen name="Tasks"      component={MyTasksScreen} />
      <Stack.Screen name="Reminders"  component={RemindersScreen} />
      <Stack.Screen name="Profile"    component={ProfileScreen} />
      <Stack.Screen name="UserDetail" component={UserDetailScreen} />
    </Stack.Navigator>
  );
}

