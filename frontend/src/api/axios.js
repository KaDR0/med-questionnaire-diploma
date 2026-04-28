import axios from "axios";

const raw = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/";
const baseURL = raw.endsWith("/") ? raw : `${raw}/`;
const ACCESS_TOKEN_KEY = "mq_access_token";
const REFRESH_TOKEN_KEY = "mq_refresh_token";

const api = axios.create({
  baseURL,
});

let onLogout = null;
let onTokenRefresh = null;
let refreshPromise = null;

export function setAuthHandlers({ handleLogout, handleTokenRefresh }) {
  onLogout = handleLogout || null;
  onTokenRefresh = handleTokenRefresh || null;
}

export function getStoredTokens() {
  return {
    access: localStorage.getItem(ACCESS_TOKEN_KEY) || "",
    refresh: localStorage.getItem(REFRESH_TOKEN_KEY) || "",
  };
}

export function storeTokens({ access, refresh }) {
  if (access) localStorage.setItem(ACCESS_TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearStoredTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const { access } = getStoredTokens();
  if (access) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config || {};
    const status = error?.response?.status;
    const isRefreshRequest = String(originalRequest.url || "").includes("auth/token/refresh/");

    if (status !== 401 || originalRequest._retry || isRefreshRequest) {
      return Promise.reject(error);
    }

    const { refresh } = getStoredTokens();
    if (!refresh) {
      if (onLogout) onLogout();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = axios.post(`${baseURL}auth/token/refresh/`, { refresh }).finally(() => {
          refreshPromise = null;
        });
      }
      const refreshResponse = await refreshPromise;
      const newAccess = refreshResponse?.data?.access;
      if (!newAccess) throw new Error("Token refresh failed");

      storeTokens({ access: newAccess });
      if (onTokenRefresh) onTokenRefresh(newAccess);
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return api(originalRequest);
    } catch (refreshError) {
      clearStoredTokens();
      if (onLogout) onLogout();
      return Promise.reject(refreshError);
    }
  }
);

export default api;