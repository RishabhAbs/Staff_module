import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '@screens/auth/LoginScreen';
import TwoFAScreen from '@screens/auth/TwoFAScreen';

const Stack = createNativeStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login"  component={LoginScreen} />
      <Stack.Screen name="TwoFA" component={TwoFAScreen} />
    </Stack.Navigator>
  );
}
