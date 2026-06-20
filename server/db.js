const { createClient } = require('@supabase/supabase-js');

// Polyfill WebSocket pour les environnements Node anciens (< 22) au cas où
// Supabase Realtime serait sollicité. Le require est protégé : si le module
// "ws" n'est pas installé sur l'hébergeur (ex. Plesk), on continue SANS planter.
// Les routes REST/Auth de Supabase utilisent fetch, pas WebSocket — aucun impact.
if (typeof globalThis.WebSocket === 'undefined') {
  try {
    globalThis.WebSocket = require('ws');
  } catch (e) {
    console.warn('[db] Module "ws" indisponible, WebSocket non polyfillé (sans impact sur les routes REST/Auth) :', e.message);
  }
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
