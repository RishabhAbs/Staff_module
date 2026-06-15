import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_BASE_URL } from '@constants/api';

const getItem = async (key) => {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return await SecureStore.getItemAsync(key);
};

const deleteItem = async (key) => {
  if (Platform.OS === 'web') localStorage.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  async (config) => {
    const token = await getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const status = error.response?.status;
    const err = error?.response?.data || error;
    err._status = status;
    if (status === 401) {
      const token = await getItem('access_token');
      if (token && !token.startsWith('mock-')) {
        await deleteItem('access_token');
        const { useAuthStore } = require('@store/authStore');
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(err);
  }
);

api.putForm  = (url, formData) =>
  api.put(url, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
api.postForm = (url, formData) =>
  api.post(url, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export default api;
