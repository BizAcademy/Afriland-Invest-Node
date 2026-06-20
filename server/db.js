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

if (supabaseUrl && supabaseServiceKey) {
  supabase.from('utilisateurs').select('id', { count: 'exact', head: true })
    .then(({ count, error }) => {
      if (error) {
        console.error('❌ Erreur connexion Supabase:', error.message);
      } else {
        console.log(`✅ Supabase connecté — ${count ?? 0} utilisateur(s) en base`);
      }
    });
}

module.exports = { supabase, supabasePublic };
