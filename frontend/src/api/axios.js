import axios from "axios";

const raw = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/";
const baseURL = raw.endsWith("/") ? raw : `${raw}/`;

const api = axios.create({
  baseURL,
});

export default api;