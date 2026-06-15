import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import ABSLogo from '@components/common/ABSLogo';
import api from '@services/api';
import { ENDPOINTS } from '@constants/api';

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const passwordRef = React.useRef(null);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post(ENDPOINTS.LOGIN, { username: username.trim(), password });

      if (res.token) {
        const { useAuthStore } = require('@store/authStore');
        await useAuthStore.getState().login(res.token, res.user);
      } else if (res.tempToken) {
        // 2FA required but disabled for now — try to get token via temp flow
        setError('Login failed. Please contact admin.');
      }
    } catch (err) {
      setError(err?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.bg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {Platform.OS === 'web' && (
        <style type="text/css">{`
          input[type="password"]::-ms-reveal,
          input[type="password"]::-ms-clear { display: none; }
        `}</style>
      )}
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.logoWrap}><ABSLogo size="lg" /></View>
          <Text style={styles.title}>Welcome Back</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.brandRed} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={[styles.input, { flex: 1 }]}
                placeholder="Enter your password"
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4 }}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textLight} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.btnText}>Continue</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg:        { flex: 1, backgroundColor: '#F7F8FA' },
  scroll:    { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card:      { backgroundColor: '#fff', borderRadius: 20, padding: 28, elevation: 5, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, maxWidth: 440, width: '100%', alignSelf: 'center' },
  logoWrap:  { alignItems: 'center', marginBottom: 20 },
  title:     { fontSize: 24, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 24 },
  errorBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF0F0', borderRadius: 8, padding: 10, marginBottom: 16 },
  errorText: { fontSize: 13, color: Colors.brandRed, flex: 1 },
  field:     { marginBottom: 16 },
  label:     { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  inputRow:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#fff' },
  inputIcon: { marginRight: 8 },
  input:     { paddingVertical: 12, fontSize: 14, color: Colors.text, flex: 1, outlineStyle: 'none' },
  btn:       { backgroundColor: '#C0392B', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnText:   { color: Colors.white, fontWeight: '700', fontSize: 16 },
});
