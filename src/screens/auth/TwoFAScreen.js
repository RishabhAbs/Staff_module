import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, KeyboardAvoidingView,
  TextInput, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import ABSLogo from '@components/common/ABSLogo';
import { useAuthStore } from '@store/authStore';
import api from '@services/api';
import { ENDPOINTS } from '@constants/api';

// ── 6-box OTP input ───────────────────────────────────────────────────────────
function OTPBoxes({ value, onChange, hasError, onComplete }) {
  const r0 = useRef(null), r1 = useRef(null), r2 = useRef(null);
  const r3 = useRef(null), r4 = useRef(null), r5 = useRef(null);
  const inputs = [r0, r1, r2, r3, r4, r5];

  const handleKey = (i, key) => {
    if (key === 'Backspace' && (!value[i] || value[i] === ' ') && i > 0) {
      inputs[i - 1].current?.focus();
    }
    if (key === 'Enter') onComplete?.();
  };

  const handleChange = (i, char) => {
    const digit = char.replace(/\D/g, '').slice(-1);
    const arr = (value || '').padEnd(6, ' ').split('');
    arr[i] = digit || ' ';
    const next = arr.join('').replace(/\s+$/, '');
    onChange(next);
    if (digit && i < 5) setTimeout(() => inputs[i + 1].current?.focus(), 0);
  };

  return (
    <View style={ob.row}>
      {inputs.map((ref, i) => (
        <TextInput
          key={i} ref={ref}
          style={[ob.box, value[i] && value[i] !== ' ' ? (hasError ? ob.boxError : ob.boxFilled) : (hasError ? ob.boxError : null)]}
          maxLength={1} keyboardType="number-pad"
          value={value[i] && value[i] !== ' ' ? value[i] : ''}
          onChangeText={(c) => handleChange(i, c)}
          onKeyPress={({ nativeEvent }) => handleKey(i, nativeEvent.key)}
          returnKeyType="go"
          onSubmitEditing={onComplete}
          selectTextOnFocus
        />
      ))}
    </View>
  );
}
const ob = StyleSheet.create({
  row:       { flexDirection: 'row', gap: 8, justifyContent: 'center', marginVertical: 6 },
  box:       { width: 40, height: 46, borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F7F8FA', textAlign: 'center', fontSize: 20, fontWeight: '700', color: Colors.text },
  boxFilled: { borderColor: '#16a34a', backgroundColor: '#F0FDF4', shadowColor: '#16a34a', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  boxError:  { borderColor: '#EF4444', backgroundColor: '#FFF5F5', shadowColor: '#EF4444', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
});

// ── Countdown ring ────────────────────────────────────────────────────────────
function CountdownRing() {
  const [seconds, setSeconds] = useState(() => 30 - (Math.floor(Date.now() / 1000) % 30));
  useEffect(() => {
    const t = setInterval(() => setSeconds(30 - (Math.floor(Date.now() / 1000) % 30)), 1000);
    return () => clearInterval(t);
  }, []);
  const color = seconds <= 8 ? '#EF4444' : seconds <= 15 ? '#F59E0B' : '#16a34a';
  return (
    <View style={{ alignItems: 'center', marginBottom: 6 }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 2.5, borderColor: color, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color }}>{seconds}</Text>
      </View>
      <Text style={{ fontSize: 9, color: Colors.textMuted, marginTop: 2 }}>seconds left</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function TwoFAScreen({ navigation, route }) {
  const { mode = 'verify', qrCode, tempToken, userId } = route.params || {};

  const [otp, setOtp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const login = useAuthStore(s => s.login);

  const handleVerify = async (prefilled) => {
    const code = (typeof prefilled === 'string' ? prefilled : otp).replace(/\s/g, '');
    if (code.length < 6) { setError('Enter the full 6-digit code'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await api.post(ENDPOINTS.VERIFY_2FA, { tempToken, userId, code });
      await login(res.token, res.user);
    } catch (err) {
      setError(err?.message || 'Invalid code. Please try again.');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  // ── QR Setup mode (first-time admin login) ────────────────────────────────
  if (mode === 'qr_setup') {
    return (
      <KeyboardAvoidingView style={s.bg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.center}>
          <View style={s.card}>
            <ABSLogo size="sm" />

            <View style={s.stepBadge}>
              <Ionicons name="shield-checkmark-outline" size={16} color={Colors.brandRed} />
              <Text style={s.stepBadgeTxt}>Set Up Two-Factor Authentication</Text>
            </View>

            <Text style={s.subtitle}>
              Scan with <Text style={{ fontWeight: '700' }}>Google Authenticator</Text> or <Text style={{ fontWeight: '700' }}>Authy</Text>, then enter the 6-digit code below.
            </Text>

            {/* QR Code from backend */}
            <View style={s.qrWrap}>
              {qrCode
                ? (Platform.OS === 'web'
                    ? <img src={qrCode} width={160} height={160} alt="QR Code" style={{ display: 'block' }} />
                    : <Image source={{ uri: qrCode }} style={{ width: 160, height: 160 }} />)
                : <View style={{ width: 160, height: 160, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={Colors.primary} />
                  </View>
              }
            </View>

            <View style={s.dividerRow}>
              <View style={s.divider} />
              <Text style={s.dividerTxt}>Enter code after scanning</Text>
              <View style={s.divider} />
            </View>

            <CountdownRing />
            <OTPBoxes value={otp} onChange={setOtp} hasError={!!error} onComplete={handleVerify} />

            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle-outline" size={13} color="#EF4444" />
                <Text style={s.errorTxt}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.verifyBtn, (otp.replace(/\s/g, '').length < 6 || loading) && s.verifyBtnDisabled]}
              onPress={handleVerify}
              disabled={otp.replace(/\s/g, '').length < 6 || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <><Ionicons name="checkmark-circle-outline" size={18} color="#fff" /><Text style={s.verifyTxt}>Activate & Login</Text></>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()} style={s.cancelBtn}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Verify mode (daily OTP) ───────────────────────────────────────────────
  return (
    <View style={s.bg}>
      <View style={s.center}>
        <View style={s.card}>
          <ABSLogo size="sm" />
          <View style={s.iconCircle}>
            <Ionicons name="lock-closed" size={24} color={Colors.brandRed} />
          </View>
          <Text style={s.title}>Security Check</Text>
          <Text style={s.subtitle}>Enter the 6-digit code from your authenticator app</Text>

          <CountdownRing />
          <OTPBoxes value={otp} onChange={setOtp} hasError={!!error} onComplete={handleVerify} />

          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={13} color="#EF4444" />
              <Text style={s.errorTxt}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[s.verifyBtn, (otp.replace(/\s/g, '').length < 6 || loading) && s.verifyBtnDisabled]}
            onPress={handleVerify}
            disabled={otp.replace(/\s/g, '').length < 6 || loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.verifyTxt}>Verify Login</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={s.cancelBtn}>
            <Text style={s.cancelTxt}>Cancel Verification</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bg:               { flex: 1, backgroundColor: '#F7F8FA' },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:             { backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 5, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, maxWidth: 420, width: '100%', alignItems: 'center' },
  stepBadge:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF0EF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginTop: 10, marginBottom: 8 },
  stepBadgeTxt:     { fontSize: 12, fontWeight: '700', color: Colors.brandRed },
  subtitle:         { fontSize: 11, color: Colors.textLight, textAlign: 'center', lineHeight: 17, marginBottom: 10 },
  qrWrap:           { backgroundColor: '#fff', borderRadius: 14, padding: 10, borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 10 },
  dividerRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginBottom: 8 },
  divider:          { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerTxt:       { fontSize: 9, fontWeight: '600', color: Colors.textMuted },
  iconCircle:       { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F4F4F6', justifyContent: 'center', alignItems: 'center', marginTop: 12, marginBottom: 10 },
  title:            { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 4, textAlign: 'center' },
  errorBox:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF5F5', borderRadius: 8, padding: 8, marginTop: 6, width: '100%' },
  errorTxt:         { fontSize: 12, color: '#EF4444', flex: 1 },
  verifyBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.brandRed, borderRadius: 12, paddingVertical: 13, width: '100%', marginTop: 14 },
  verifyBtnDisabled:{ opacity: 0.45 },
  verifyTxt:        { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn:        { marginTop: 10, paddingVertical: 6 },
  cancelTxt:        { fontSize: 12, color: Colors.textMuted },
});
