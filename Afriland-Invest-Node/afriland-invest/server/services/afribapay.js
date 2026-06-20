// Service d'intégration Afribapay (environnement PRODUCTION).
// Doc : https://docs.afribapay.com/
//
// Flux :
//  1) POST /v1/token (Basic base64(api_user:api_key)) -> access_token (~24h)
//  2) GET  /v1/countries (Bearer) -> pays + opérateurs + devises + ussd/otp
//  3) POST /v1/pay/payin (Bearer) -> initie un dépôt mobile money
//  4) GET  /v1/status?transaction_id= (Bearer) -> statut (PENDING/SUCCESS/FAILED)

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://api.afribapay.com';

// Cache disque persistant des pays (survit aux redémarrages).
// Permet de toujours servir la dernière liste connue même si l'API est momentanément indisponible.
const CACHE_DIR = path.join(__dirname, '..', '.cache');
const COUNTRIES_CACHE_FILE = path.join(CACHE_DIR, 'countries.json');

// Instantané de secours VERSIONNÉ dans git (déployé avec le code).
// Dernier recours si l'API est injoignable ET qu'aucun cache disque n'existe encore
// (cas typique d'un cPanel fraîchement déployé qui n'a jamais joint Afribapay).
const COUNTRIES_SEED_FILE = path.join(__dirname, '..', 'data', 'countries-seed.json');

function readDiskCountries() {
  try {
    const raw = fs.readFileSync(COUNTRIES_CACHE_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length ? arr : null;
  } catch {
    return null;
  }
}

function readSeedCountries() {
  try {
    const raw = fs.readFileSync(COUNTRIES_SEED_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length ? arr : null;
  } catch {
    return null;
  }
}

function writeDiskCountries(arr) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(COUNTRIES_CACHE_FILE, JSON.stringify(arr), 'utf8');
  } catch {
    /* écriture best-effort — on ignore les erreurs disque */
  }
}

// Seules les devises XOF et XAF sont autorisées (exclut RDC=CDF, Guinée=GNF, Gambie=GMD).
const DEVISES_AUTORISEES = ['XOF', 'XAF'];

const API_USER = process.env.AFRIBAPAY_API_USER;
const API_KEY = process.env.AFRIBAPAY_API_KEY;
const MERCHANT_KEY = process.env.AFRIBAPAY_MERCHANT_KEY;

let _token = null;
let _tokenExpiry = 0; // timestamp ms
let _countriesCache = null;
let _countriesExpiry = 0;

function assertConfig() {
  if (!API_USER || !API_KEY || !MERCHANT_KEY) {
    throw new Error('Configuration Afribapay manquante (AFRIBAPAY_API_USER / AFRIBAPAY_API_KEY / AFRIBAPAY_MERCHANT_KEY).');
  }
}

async function getToken() {
  assertConfig();
  const now = Date.now();
  if (_token && now < _tokenExpiry) return _token;

  const basic = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');
  const r = await fetch(`${BASE_URL}/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${basic}` },
    body: '',
  });
  const j = await r.json().catch(() => ({}));
  const token = j?.data?.access_token;
  if (!r.ok || !token) {
    const msg = j?.data?.message || j?.message || `HTTP ${r.status}`;
    throw new Error(`Échec authentification Afribapay : ${msg}`);
  }
  const expiresIn = parseInt(j.data.expires_in, 10) || 90000; // secondes
  _token = token;
  // Marge de sécurité de 5 min avant expiration.
  _tokenExpiry = now + (expiresIn - 300) * 1000;
  return _token;
}

// Récupère les pays Afribapay filtrés sur XOF/XAF, mis en forme pour le client.
// Cache 1h.
async function getCountries() {
  const now = Date.now();
  if (_countriesCache && now < _countriesExpiry) return _countriesCache;

  try {
    const token = await getToken();
    const r = await fetch(`${BASE_URL}/v1/countries`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.data) {
      throw new Error(`Impossible de récupérer les pays Afribapay (HTTP ${r.status}).`);
    }

    const out = [];
    for (const [code, c] of Object.entries(j.data)) {
      const curEntry = Object.entries(c.currencies || {}).find(([cur]) => DEVISES_AUTORISEES.includes(cur));
      if (!curEntry) continue; // ignore les pays sans XOF/XAF
      const [currency, curData] = curEntry;
      const operators = (curData.operators || []).map((o) => ({
        operator_code: o.operator_code,
        operator_name: o.operator_name,
        otp_required: Number(o.otp_required) === 1,
        ussd_code: o.ussd_code || '',
        wallet: Number(o.wallet) === 1,
      }));
      out.push({
        country_code: code,
        country_name: c.country_name,
        country_flag: c.country_flag,
        prefix: c.prefix,
        currency,
        operators,
      });
    }
    out.sort((a, b) => a.country_name.localeCompare(b.country_name, 'fr'));

    _countriesCache = out;
    _countriesExpiry = now + 60 * 60 * 1000;
    writeDiskCountries(out); // persiste pour servir hors-ligne en cas de panne API
    return out;
  } catch (err) {
    // L'API a échoué : on sert la dernière liste connue pour rester stable.
    // Ordre de repli : cache mémoire → cache disque → instantané versionné (seed).
    if (_countriesCache) return _countriesCache;
    const disk = readDiskCountries();
    if (disk) {
      _countriesCache = disk;
      _countriesExpiry = now + 5 * 60 * 1000; // courte durée : on retentera l'API bientôt
      return disk;
    }
    const seed = readSeedCountries();
    if (seed) {
      _countriesCache = seed;
      _countriesExpiry = now + 5 * 60 * 1000; // courte durée : on retentera l'API bientôt
      return seed;
    }
    throw err;
  }
}

// Retrouve un opérateur précis (pour valider la demande et lire otp/ussd).
async function findOperator(countryCode, operatorCode) {
  const countries = await getCountries();
  const country = countries.find((c) => c.country_code === countryCode);
  if (!country) return null;
  const operator = country.operators.find((o) => o.operator_code === operatorCode);
  if (!operator) return null;
  return { country, operator };
}

// Initie un PAYIN (encaissement mobile money).
async function payin(params) {
  assertConfig();
  const token = await getToken();
  const body = {
    operator: params.operator,
    country: params.country,
    phone_number: params.phone_number,
    amount: params.amount,
    currency: params.currency,
    order_id: params.order_id,
    merchant_key: MERCHANT_KEY,
    reference_id: params.reference_id || params.order_id,
    lang: 'fr',
  };
  if (params.otp_code) body.otp_code = params.otp_code;
  if (params.notify_url) body.notify_url = params.notify_url;
  if (params.return_url) body.return_url = params.return_url;
  if (params.cancel_url) body.cancel_url = params.cancel_url;

  const r = await fetch(`${BASE_URL}/v1/pay/payin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: j };
}

// Vérifie le statut d'une transaction.
async function getStatus(transactionId) {
  assertConfig();
  const token = await getToken();
  const r = await fetch(`${BASE_URL}/v1/status?transaction_id=${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: j };
}

module.exports = {
  getToken,
  getCountries,
  findOperator,
  payin,
  getStatus,
  DEVISES_AUTORISEES,
};
