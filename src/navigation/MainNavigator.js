import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';

import DashboardScreen  from '@screens/dashboard/DashboardScreen';
import StaffScreen      from '@screens/staff/StaffScreen';
import AttendanceScreen from '@screens/attendance/AttendanceScreen';
import LeaveScreen      from '@screens/leave/LeaveScreen';
import ProfileScreen    from '@screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Dashboard:  ['grid',        'grid-outline'],
  Staff:      ['people',      'people-outline'],
  Attendance: ['calendar',    'calendar-outline'],
  Leave:      ['document',    'document-outline'],
  Profile:    ['person',      'person-outline'],
};

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = TAB_ICONS[route.name] || ['ellipse', 'ellipse-outline'];
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
        },
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarStyle: { paddingBottom: 4, height: 58 },
        headerStyle:      { backgroundColor: Colors.primary },
        headerTintColor:  Colors.white,
        headerTitleStyle: { fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Dashboard"  component={DashboardScreen} />
      <Tab.Screen name="Staff"      component={StaffScreen} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} />
      <Tab.Screen name="Leave"      component={LeaveScreen} />
      <Tab.Screen name="Profile"    component={ProfileScreen} />
    </Tab.Navigator>
  );
}
