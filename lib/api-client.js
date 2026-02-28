// lib/api-client.js — handles auth, sync, and PERSISTENCE

const STORAGE_KEY = "marketsup_api";

export function saveConfig(config) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch {}
}

export function loadConfig() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function clearConfig() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export async function authenticate(url, user, pass) {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, user, pass }),
  });
  return res.json();
}

export async function syncAll(baseUrl, token) {
  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl, token }),
  });
  return res.json();
}

export async function proxyCall(baseUrl, token, endpoint, params) {
  const res = await fetch("/api/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl, token, endpoint, params }),
  });
  return res.json();
}
