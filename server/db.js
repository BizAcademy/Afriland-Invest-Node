const { createClient } = require('@supabase/supabase-js');

// ─── WebSocket pour Supabase ────────────────────────────────────────────────
// Node 22+ a un WebSocket natif. Les Node plus anciens (ex. Plesk en Node 21)
// n'en ont pas : @supabase/supabase-js REFUSE alors de se construire (il lève
// "Node.js X detected without native WebSocket support") — ce qui faisait
// planter TOUT le serveur au démarrage, donc échouer connexion/inscription.
// On garantit qu'un constructeur WebSocket est TOUJOURS présent sur globalThis
// AVANT de créer le client, dans cet ordre :
//   1) WebSocket natif s'il existe (Node 22+) ;
//   2) sinon le module "ws" s'il est installé ;
//   3) sinon un stub inoffensif — l'app n'utilise PAS le temps réel (Realtime),
//      donc ce stub n'est jamais instancié ; il sert juste à laisser Supabase
//      se construire pour que les routes REST/Auth fonctionnent.
if (typeof globalThis.WebSocket === 'undefined') {
  let WS;
  try {
    WS = require('ws');
  } catch (_) {
    WS = class StubWebSocket {
      constructor() {
        throw new Error('WebSocket indisponible (module "ws" absent) — Realtime non supporté ; sans impact sur les routes REST/Auth.');
      }
    };
    console.warn('[db] Module "ws" absent : Realtime désactivé (REST/Auth fonctionnent normalement).');
  }
  globalThis.WebSocket = WS;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  SUPABASE_URL et SUPABASE_SERVICE_KEY manquants — les routes API ne fonctionneront pas sans ces variables.');
}

const DUMMY_URL = 'https://placeholder.supabase.co';
const DUMMY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder';

const supabase = createClient(supabaseUrl || DUMMY_URL, supabaseServiceKey || DUMMY_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const supabasePublic = createClient(supabaseUrl || DUMMY_URL, supabaseAnonKey || supabaseServiceKey || DUMMY_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Note : le test de connexion Supabase au démarrage est fait UNE seule fois
// dans server/index.js (différé après le boot, écrit dans _env-check.txt). On
// évite ici un 2e appel réseau redondant qui ralentissait le démarrage.

// ─── Pagination Supabase ────────────────────────────────────────────────────
// Supabase (PostgREST) plafonne CHAQUE requête à 1000 lignes, MÊME avec
// .range(0, 9999) : la plage demandée est tronquée à max-rows (1000). Dès
// qu'une table dépasse 1000 lignes, les requêtes "simples" perdent
// silencieusement des lignes (ex. transactions récentes invisibles).
// Ce helper récupère TOUTES les lignes en paginant par pages de 1000.
//   buildQuery : fabrique retournant une NOUVELLE requête à chaque appel
//                (ex. () => supabase.from('depots').select('*').eq(...)).
//   Un tri stable par `id` est ajouté en dernier critère pour que la
//   pagination soit déterministe ; toute erreur est PROPAGÉE (pas de silence).
//   Option { orderById: false } pour les tables SANS colonne `id`
//   (ex. `soldes`, clé = user_id) : la fabrique doit alors fournir son
//   propre tri stable via .order(...).
async function fetchAllRows(buildQuery, pageSize = 1000, { orderById = true } = {}) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    let query = buildQuery();
    if (orderById) query = query.order('id', { ascending: true });
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

module.exports = { supabase, supabasePublic, fetchAllRows };
