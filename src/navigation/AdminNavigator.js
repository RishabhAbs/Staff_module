import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';


import AdminDashboardScreen   from '@screens/admin/DashboardScreen';
import UsersScreen            from '@screens/admin/UsersScreen';
import LocationTrackingScreen from '@screens/admin/LocationTrackingScreen';
import AdminAttendanceScreen  from '@screens/admin/AttendanceScreen';
import LeaveScreen            from '@screens/leave/LeaveScreen';
import UserDetailScreen       from '@screens/admin/UserDetailScreen';
import ProfileScreen          from '@screens/profile/ProfileScreen';
import ShiftMasterScreen      from '@screens/admin/ShiftMasterScreen';
import DepartmentMasterScreen from '@screens/admin/DepartmentMasterScreen';
import LedgerMasterScreen     from '@screens/admin/LedgerMasterScreen';
import ItemMasterScreen       from '@screens/admin/ItemMasterScreen';
import OrdersScreen           from '@screens/admin/OrdersScreen';
import TaskManagementScreen   from '@screens/admin/TaskManagementScreen';
import RemindersScreen        from '@screens/reminders/RemindersScreen';
import DocumentsScreen        from '@screens/admin/DocumentsScreen';
import MoreScreen             from '@screens/admin/MoreScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function AdminTabs() {
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
            Users:      'people-outline',
            Tasks:      'checkmark-done-outline',
            Reminders:  'alarm-outline',
            Profile:    'person-outline',
            More:       'grid-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"      component={AdminDashboardScreen} />
      <Tab.Screen name="Users"     component={UsersScreen} />
      <Tab.Screen name="Tasks"     component={TaskManagementScreen} />
      <Tab.Screen name="Reminders" component={RemindersScreen} />
      <Tab.Screen name="Profile"   component={ProfileScreen} />
      <Tab.Screen name="More"      component={MoreScreen} />
    </Tab.Navigator>
  );
}

export default function AdminNavigator() {
  if (Platform.OS !== 'web') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="AdminTabs"  component={AdminTabs} />
        <Stack.Screen name="UserDetail"  component={UserDetailScreen} />
        <Stack.Screen name="Shifts"      component={ShiftMasterScreen} />
        <Stack.Screen name="Ledgers"     component={LedgerMasterScreen} />
        <Stack.Screen name="Items"       component={ItemMasterScreen} />
        <Stack.Screen name="Orders"      component={OrdersScreen} />
        <Stack.Screen name="Documents"   component={DocumentsScreen} />
        <Stack.Screen name="Leave"       component={LeaveScreen} />
        <Stack.Screen name="Attendance"  component={AdminAttendanceScreen} />
        <Stack.Screen name="Departments" component={DepartmentMasterScreen} />
      </Stack.Navigator>
    );
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F8FAFC', flex: 1, width: '100%', height: '100%' } }}>
      <Stack.Screen name="Home"        component={AdminDashboardScreen} />
      <Stack.Screen name="Users"       component={UsersScreen} />
      <Stack.Screen name="Departments" component={DepartmentMasterScreen} />
      <Stack.Screen name="Tracking"    component={LocationTrackingScreen} />
      <Stack.Screen name="Attendance"  component={AdminAttendanceScreen} />
      <Stack.Screen name="Leave"       component={LeaveScreen} />
      <Stack.Screen name="Tasks"       component={TaskManagementScreen} />
      <Stack.Screen name="Reminders"   component={RemindersScreen} />
      <Stack.Screen name="Profile"     component={ProfileScreen} />
      <Stack.Screen name="UserDetail"  component={UserDetailScreen} />
      <Stack.Screen name="Shifts"      component={ShiftMasterScreen} />
      <Stack.Screen name="Ledgers"     component={LedgerMasterScreen} />
      <Stack.Screen name="Items"       component={ItemMasterScreen} />
      <Stack.Screen name="Orders"      component={OrdersScreen} />
      <Stack.Screen name="Documents"   component={DocumentsScreen} />
    </Stack.Navigator>
  );
}

