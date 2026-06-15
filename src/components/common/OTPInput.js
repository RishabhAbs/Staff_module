import React, { useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { Colors } from '@constants/colors';

const OTP_LENGTH = 6;

export default function OTPInput({ value = '', onChange }) {
  const inputs = useRef([]);
  const digits = value.split('').concat(Array(OTP_LENGTH).fill('')).slice(0, OTP_LENGTH);

  const handleChange = (text, index) => {
    const sanitized = text.replace(/[^0-9]/g, '').slice(-1);
    const arr = [...digits];
    arr[index] = sanitized;
    onChange(arr.join(''));
    if (sanitized && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {digits.map((digit, i) => (
        <TextInput
          key={i}
          ref={(r) => (inputs.current[i] = r)}
          style={[styles.box, digit ? styles.boxFilled : styles.boxEmpty]}
          value={digit}
          onChangeText={(t) => handleChange(t, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={1}
          textAlign="center"
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row:       { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  box:       { width: 46, height: 56, borderRadius: 10, fontSize: 22, fontWeight: '700', color: Colors.text },
  boxEmpty:  { borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  boxFilled: { borderWidth: 2, borderColor: '#16a34a', backgroundColor: '#F0FDF4' },
});
