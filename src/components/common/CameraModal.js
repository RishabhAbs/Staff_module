import React, { useRef, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@constants/colors';

export default function CameraModal({ visible, onCapture, onClose }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => onClose());
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [visible]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      onClose();
    }, 'image/jpeg', 0.92);
  };

  if (!visible || Platform.OS !== 'web') return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: '90%', maxWidth: 480, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
          <video ref={videoRef} autoPlay playsInline style={{ width: '100%', display: 'block', maxHeight: 340, objectFit: 'cover' }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#111' }}>
            <TouchableOpacity
              onPress={() => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); onClose(); }}
              style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#444' }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={capture}
              style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: Colors.brandRed }}
            >
              <Feather name="camera" size={26} color={Colors.brandRed} />
            </TouchableOpacity>
            <View style={{ width: 64 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
