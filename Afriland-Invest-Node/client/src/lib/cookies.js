export function setCookie(name, value, days) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

export function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : '';
}

export const REF_COOKIE = 'giftal_ref';
export const LEGACY_REF_COOKIE = 'afriland_ref';

const REF_STORAGE_KEY = 'giftal_ref_v2';
const REF_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

// Enregistre le code de parrainage pour 7 jours sur ce navigateur.
// On stocke à la fois dans localStorage (avec expiration explicite — plus fiable
// sur mobile et dans les navigateurs intégrés WhatsApp/Facebook) ET dans un cookie
// (redondance) afin que le code survive même si l'un des deux est bloqué/effacé.
export function saveRefCode(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return;
  setCookie(REF_COOKIE, clean, 7);
  try {
    localStorage.setItem(REF_STORAGE_KEY, JSON.stringify({ code: clean, exp: Date.now() + REF_TTL_MS }));
  } catch { /* localStorage indisponible — le cookie sert de secours */ }
}

// Récupère le code de parrainage actif (non expiré), en privilégiant localStorage.
export function getRefCode() {
  try {
    const raw = localStorage.getItem(REF_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.code && parsed.exp && Date.now() < parsed.exp) {
        return parsed.code;
      }
      // Expiré → on nettoie.
      localStorage.removeItem(REF_STORAGE_KEY);
    }
  } catch { /* ignore */ }
  return getCookie(REF_COOKIE) || getCookie(LEGACY_REF_COOKIE);
}
