import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export default function ABSLogo({ size = 'md' }) {
  // Define image dimensions based on size
  const width = size === 'lg' ? 240 : size === 'sm' ? 120 : 160;
  const height = width * 0.4; // Assuming approx 2.5:1 aspect ratio based on the image provided

  return (
    <View style={styles.wrapper}>
      {/* We require the image from the project root assets folder */}
      <Image 
        source={require('../../../assets/abs-logo.png')}
        style={{ width, height, resizeMode: 'contain' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'flex-start', justifyContent: 'center' },
});
