const { createClient } = require('@supabase/supabase-js');

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = require('ws');
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
