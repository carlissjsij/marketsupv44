// API client for MarketSUP — calls Vercel API Routes

export async function authenticate(url, user, pass) {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, user, pass }),
  });
  return res.json();
}

export async function syncAll(url, token, filial = "1", dataInicial, dataFinal) {
  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl: url, token, filial, dataInicial, dataFinal }),
  });
  return res.json();
}

export function saveConfig(cfg) {
  try { localStorage.setItem("msup_cfg", JSON.stringify(cfg)); } catch {}
}
export function loadConfig() {
  try { return JSON.parse(localStorage.getItem("msup_cfg")); } catch { return null; }
}
export function clearConfig() {
  try { localStorage.removeItem("msup_cfg"); } catch {}
}
