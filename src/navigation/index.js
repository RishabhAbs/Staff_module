import React, { lazy, Suspense } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { useAuthStore } from '@store/authStore';
import AuthNavigator from './AuthNavigator';

// Shared ref so components outside the navigator tree (e.g. the global Sidebar) can navigate.
export const navigationRef = createNavigationContainerRef();
export function navigate(name, params) {
  if (navigationRef.isReady()) navigationRef.navigate(name, params);
}

// Lazy load role-based navigators so locationService only loads when needed
const AdminNavigator = lazy(() => import('./AdminNavigator'));
const UserNavigator  = lazy(() => import('./UserNavigator'));

function Loader() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#C0392B" />
    </View>
  );
}

export default function RootNavigator() {
  const { isLoggedIn, role } = useAuthStore();

  return (
    <NavigationContainer ref={navigationRef} theme={{ dark: false, colors: { background: '#F8FAFC', card: '#fff', text: '#000', border: 'transparent', notification: '#C0392B', primary: '#C0392B' } }}>
      {!isLoggedIn ? (
        <AuthNavigator />
      ) : (
        <Suspense fallback={<Loader />}>
          {role === 'admin' ? <AdminNavigator /> : <UserNavigator />}
        </Suspense>
      )}
    </NavigationContainer>
  );
}
