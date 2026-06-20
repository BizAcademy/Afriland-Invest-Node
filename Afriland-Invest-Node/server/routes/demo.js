// ═══════════════════════════════════════════════════════════════════════════
// ROUE DE LA FORTUNE — MODE DÉMO (isolé du système réel)
//
// Aucune interaction avec les soldes réels (`soldes`) ni l'historique réel.
// Solde démo = 100 000 FCFA pour tous, stocké dans `roue_demo`.
// Cycle de 10 tours, ordre mélangé à chaque nouveau cycle.
// Les mises / gains démo ne sont jamais exposés au panneau admin.
// ═══════════════════════════════════════════════════════════════════════════
const express = require('express');
const { supabase } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

const SOLDE_DEMO_INITIAL = 100000;

// ── Tables des 10 tours par tranche de mise ──────────────────────────────────
// Chaque tour propose une liste de résultats possibles (tirage aléatoire parmi eux).
// Valeur numérique = gain en FCFA ; 'x2' = mise×2 ; 'x05' = mise×0.5 ; 0 = perdu.
const DEMO_TOURS = {
  // tranche 1 : mise 100–500 FCFA
  1: [
    ['x2', 200, 100, 50], // tour 1
    [100],                // tour 2
    [0],                  // tour 3
    [1000, 100, 'x05'],   // tour 4
    [0],                  // tour 5
    [1000],               // tour 6 (gain max 1000)
    [0],                  // tour 7
    [500],                // tour 8
    [0],                  // tour 9
    [100, 2000, 'x2'],    // tour 10
  ],
  // tranche 2 : mise 500–1000 FCFA
  2: [
    [500, 'x2', 1000, 'x05'], // tour 1
    ['x05'],                  // tour 2
    [0],                      // tour 3
    [2000, 500, 5000],        // tour 4
    [0],                      // tour 5
    [1000],                   // tour 6 (gain max 1000)
    [0, 'x05'],               // tour 7
    [0, 200],                 // tour 8
    [0],                      // tour 9
    [2000, 5000, 'x2'],       // tour 10
  ],
  // tranche 3 : mise 1000+ FCFA
  3: [
    [10000, 5000, 'x2'],  // tour 1
    ['x05'],              // tour 2
    [0],                  // tour 3
    [1000, 5000, 2000],   // tour 4
    [0],                  // tour 5
    [1000],               // tour 6 (gain max 1000)
    [100],                // tour 7
    [0, 'x05'],           // tour 8
    [0, 500],             // tour 9
    [1000, 5000, 'x2'],   // tour 10
  ],
};

// Valeur de gain → index du segment de la roue (doit matcher Wheel.jsx).
// 0=0 1=×2 2=100 3=0 4=5000 5=×0.5 6=200 7=0 8=10000 9=50 10=×10 11=0
// 12=500 13=1000 14=10 15=2000
const VALUE_TO_IDX = {
  10: 14, 50: 9, 100: 2, 200: 6, 500: 12, 1000: 13,
  2000: 15, 5000: 4, 10000: 8,
};
const ZERO_IDX = [0, 3, 7, 11];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleCycle() {
  const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function tierForMise(mise) {
  if (mise < 500) return 1;
  if (mise < 1000) return 2;
  return 3;
}

// Récupère (ou crée) la ligne démo de l'utilisateur.
async function getOrCreateDemo(userId) {
  const { data } = await supabase
    .from('roue_demo')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (data) return data;
  const { data: created } = await supabase
    .from('roue_demo')
    .insert({ user_id: userId, solde: SOLDE_DEMO_INITIAL, cycle_pos: 0, cycle_seq: null })
    .select('*')
    .single();
  if (created) return created;
  // Course possible sur l'insertion initiale (même user_id PK) → on relit.
  const { data: again } = await supabase
    .from('roue_demo')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return again;
}

// ── État du compte démo ──────────────────────────────────────────────────────
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const demo = await getOrCreateDemo(req.user.id);
    const { data: pending } = await supabase
      .from('roue_demo_recharges')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('statut', 'en_attente')
      .maybeSingle();
    res.json({
      solde: parseFloat(demo?.solde || 0),
      cyclePos: demo?.cycle_pos || 0,
      pendingRecharge: !!pending,
    });
  } catch (err) {
    req.log?.error?.({ err: err.message }, 'Demo status error');
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Spin payant DÉMO ──────────────────────────────────────────────────────────
router.post('/spin-bet', authMiddleware, async (req, res) => {
  try {
    const mise = parseInt(req.body.mise);
    if (!mise || mise < 100) {
      return res.status(400).json({ error: 'La mise minimum est de 100 FCFA' });
    }

    const demo = await getOrCreateDemo(req.user.id);
    const solde = parseFloat(demo.solde || 0);
    if (solde < mise) {
      return res.status(400).json({ error: 'Solde démo insuffisant' });
    }

    // (Re)génération du cycle si terminé / absent
    let pos = demo.cycle_pos || 0;
    let seq = Array.isArray(demo.cycle_seq) ? demo.cycle_seq : null;
    if (!seq || seq.length < 10 || pos >= 10) {
      seq = shuffleCycle();
      pos = 0;
    }

    const tier = tierForMise(mise);
    const tourSlot = seq[pos];               // 0..9 (numéro de tour dans la table)
    const outcome = pick(DEMO_TOURS[tier][tourSlot]);

    let gain = 0;
    let index;
    let outcomeType;
    if (outcome === 'x2') {
      gain = mise * 2;
      index = 1;
      outcomeType = 'x2';
    } else if (outcome === 'x05') {
      gain = Math.floor(mise * 0.5);
      index = 5;
      outcomeType = 'x05';
    } else if (outcome === 0) {
      gain = 0;
      index = pick(ZERO_IDX);
      outcomeType = 'zero';
    } else {
      gain = outcome;
      index = VALUE_TO_IDX[outcome] ?? pick(ZERO_IDX);
      outcomeType = 'win';
    }

    const newSolde = solde - mise + gain;
    const newPos = pos + 1;

    // Verrou optimiste : on n'écrit que si l'état n'a pas changé depuis la lecture
    // (cycle_pos identique + solde toujours suffisant) → bloque le double-spin concurrent.
    const { data: updated } = await supabase
      .from('roue_demo')
      .update({
        solde: newSolde,
        cycle_pos: newPos,
        cycle_seq: seq,
        date_maj: new Date().toISOString(),
      })
      .eq('user_id', req.user.id)
      .eq('cycle_pos', demo.cycle_pos || 0)
      .gte('solde', mise)
      .select('user_id');

    if (!updated || updated.length === 0) {
      return res.status(409).json({ error: 'Veuillez patienter avant de relancer.' });
    }

    res.json({
      success: true,
      gain,
      index,
      mise,
      outcomeType,
      newSolde,
      cyclePos: newPos % 10,
    });
  } catch (err) {
    req.log?.error?.({ err: err.message }, 'Demo spin error');
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Demande de rechargement du solde démo ─────────────────────────────────────
router.post('/recharge', authMiddleware, async (req, res) => {
  try {
    const { data: pending } = await supabase
      .from('roue_demo_recharges')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('statut', 'en_attente')
      .maybeSingle();
    if (pending) {
      return res.status(400).json({ error: 'Une demande de rechargement est déjà en attente.' });
    }
    const { error } = await supabase
      .from('roue_demo_recharges')
      .insert({ user_id: req.user.id, statut: 'en_attente' });
    if (error) {
      // 23505 = violation de l'index unique partiel (demande déjà en attente).
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Une demande de rechargement est déjà en attente.' });
      }
      throw error;
    }
    res.json({ success: true, message: 'Demande de rechargement envoyée. En attente de validation.' });
  } catch (err) {
    req.log?.error?.({ err: err.message }, 'Demo recharge error');
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
