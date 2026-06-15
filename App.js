import 'react-native-gesture-handler';
import React, { useEffect, Component } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from './src/store/authStore';
import { useAttendanceStore } from './src/store/attendanceStore';
import { useLocationStore } from './src/store/locationStore';
import RootNavigator from './src/navigation';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <View style={eb.container}>
          <Text style={eb.title}>Something went wrong</Text>
          <Text style={eb.msg}>{this.state.error.message}</Text>
          <TouchableOpacity style={eb.btn} onPress={() => this.setState({ error: null })}>
            <Text style={eb.btnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F0F2F5' },
  title:     { fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 10 },
  msg:       { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 24 },
  btn:       { backgroundColor: '#C0392B', borderRadius: 10, paddingHorizontal: 32, paddingVertical: 12 },
  btnText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
});

function AppInner() {
  const { isLoading, initAuth } = useAuthStore();
  const initAttendance = useAttendanceStore(s => s.init);
  const initLocation   = useLocationStore(s => s.init);

  useEffect(() => {
    initAuth();
    initAttendance();
    initLocation();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F2F5' }}>
        <ActivityIndicator size="large" color="#C0392B" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <View style={{ flex: 1, width: '100%', height: '100%', backgroundColor: '#F8FAFC' }}>
        <RootNavigator />
      </View>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
