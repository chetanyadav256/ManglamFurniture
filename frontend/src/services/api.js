import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
});

export async function getHealth({ signal } = {}) {
  const { data } = await api.get('/health', { signal });
  return data;
}
