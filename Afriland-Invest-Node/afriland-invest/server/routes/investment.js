const express = require('express');
const { supabase } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.get('/plans', authMiddleware, async (req, res) => {
  try {
    const { data: plans, error } = await supabase
      .from('planinvestissement')
      .select('*')
      .order('prix', { ascending: true });
    if (error) throw error;
    const result = (plans || []).map((p) => ({
      ...p,
      revenu_journalier: (parseFloat(p.prix) * parseFloat(p.rendement_journalier)) / 100,
      revenu_total: ((parseFloat(p.prix) * parseFloat(p.rendement_journalier)) / 100) * p.duree_jours,
    }));
    res.json({ plans: result });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/my-orders', authMiddleware, async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from('commandes')
      .select('*, planinvestissement(nom, rendement_journalier, duree_jours, serie)')
      .eq('user_id', req.user.id)
      .order('date_debut', { ascending: false });
    if (error) throw error;
    const result = (orders || []).map(c => ({
      ...c,
      plan_nom: c.planinvestissement?.nom,
      rendement_journalier: c.planinvestissement?.rendement_journalier,
      duree_jours: c.planinvestissement?.duree_jours,
      serie: c.planinvestissement?.serie,
      planinvestissement: undefined,
      // last_revenue_date inclus via ...c (colonne ajoutée par SQL)
    }));

    // Prochain crédit = échéance 24h la plus proche parmi les commandes actives
    // (modèle « 1 versement par tranche de 24h » : last_revenue_at + 24h).
    const DAY_MS = 24 * 60 * 60 * 1000;
    const dueTimes = result
      .filter(c => c.statut === 'actif' && c.last_revenue_at)
      .map(c => new Date(c.last_revenue_at).getTime() + DAY_MS);
    const nextCreditAt = dueTimes.length
      ? new Date(Math.min(...dueTimes)).toISOString()
      : null;

    res.json({ orders: result, nextCreditAt });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/buy', authMiddleware, async (req, res) => {
  try {
    const { plan_id, transaction_password } = req.body;
    const userId = req.user.id;

    if (!plan_id) return res.status(400).json({ error: 'Plan requis' });

    // Vérifier mot de passe de transaction
    const { data: tp } = await supabase
      .from('transaction_passwords')
      .select('password')
      .eq('user_id', userId)
      .maybeSingle();

    if (!tp) return res.status(400).json({ error: 'Veuillez configurer votre mot de passe de transaction' });
    if (tp.password !== transaction_password) return res.status(400).json({ error: 'Mot de passe de transaction incorrect' });

    // Récupérer le plan
    const { data: plan } = await supabase
      .from('planinvestissement')
      .select('*')
      .eq('id', plan_id)
      .single();
    if (!plan) return res.status(404).json({ error: 'Plan introuvable' });

    // ── Règle : l'argent de parrainage seul ne suffit pas pour investir.
    //    L'utilisateur doit avoir au moins un dépôt validé. Le crédit admin est
    //    enregistré comme un dépôt validé (cf. fonction SQL credit_user), donc
    //    il rend l'utilisateur éligible exactement comme un vrai dépôt.
    const { count: depotsValides } = await supabase
      .from('depots').select('*', { count: 'exact', head: true })
      .eq('user_id', userId).eq('statut', 'valide');
    if (!depotsValides) {
      return res.status(400).json({
        error: "Vous devez effectuer un dépôt avant d'investir. Les gains de parrainage ne peuvent pas être utilisés directement pour souscrire à un plan.",
        code: 'NO_DEPOSIT',
      });
    }

    // Vérifier le solde
    const { data: soldeRow } = await supabase
      .from('soldes')
      .select('solde')
      .eq('user_id', userId)
      .maybeSingle();
    const solde = parseFloat(soldeRow?.solde || 0);

    if (solde < parseFloat(plan.prix)) {
      return res.status(400).json({ error: 'Solde insuffisant' });
    }

    // Appel RPC atomique pour buy
    const { data: result, error } = await supabase.rpc('buy_plan', {
      p_user_id: userId,
      p_plan_id: plan_id,
      p_tx_password: transaction_password,
    });

    if (error) throw error;
    if (result?.error) return res.status(400).json({ error: result.error });

    res.json({ success: true, message: `Plan "${plan.nom}" activé avec succès` });
  } catch (err) {
    console.error('Buy error:', err);
    res.status(500).json({ error: "Erreur lors de l'achat du plan" });
  }
});

// ─── VIP / CADEAUX ────────────────────────────────────────────────────────────
const VIP_LEVELS = [
  { niveau: 1, requis: 70, cadeau: 5000 },
  { niveau: 2, requis: 100, cadeau: 8000 },
  { niveau: 3, requis: 200, cadeau: 10000 },
];

// Compte les filleuls directs ayant effectué au moins un investissement
async function countFilleulsInvestisseurs(userId) {
  const { data: filleuls } = await supabase
    .from('utilisateurs')
    .select('id')
    .eq('parrain_id', userId);
  const ids = (filleuls || []).map((f) => f.id);
  if (ids.length === 0) return 0;
  const { data: commandes } = await supabase
    .from('commandes')
    .select('user_id')
    .in('user_id', ids);
  return new Set((commandes || []).map((c) => c.user_id)).size;
}

router.get('/salary', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await countFilleulsInvestisseurs(userId);

    const { data: claims } = await supabase
      .from('cadeaux_vip')
      .select('niveau,statut')
      .eq('user_id', userId);
    const claimMap = {};
    (claims || []).forEach((c) => { claimMap[c.niveau] = c.statut; });

    let niveauActuel = 0;
    VIP_LEVELS.forEach((l) => { if (count >= l.requis) niveauActuel = l.niveau; });

    const niveaux = VIP_LEVELS.map((l) => ({
      niveau: l.niveau,
      requis: l.requis,
      cadeau: l.cadeau,
      atteint: count >= l.requis,
      statut: claimMap[l.niveau] || 'none', // none / en_attente / valide / rejete
    }));

    const prochain = VIP_LEVELS.find((l) => count < l.requis);

    res.json({
      filleuls_investisseurs: count,
      niveau: niveauActuel,
      niveaux,
      prochain: prochain
        ? { niveau: prochain.niveau, requis: prochain.requis, restant: Math.max(0, prochain.requis - count) }
        : null,
    });
  } catch (err) {
    console.error('Salary error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/claim-gift', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const niveau = parseInt(req.body.niveau);
    const level = VIP_LEVELS.find((l) => l.niveau === niveau);
    if (!level) return res.status(400).json({ error: 'Niveau VIP invalide' });

    const count = await countFilleulsInvestisseurs(userId);
    if (count < level.requis) {
      return res.status(400).json({ error: `Il faut ${level.requis} filleuls ayant investi pour réclamer ce cadeau` });
    }

    const { data: existing } = await supabase
      .from('cadeaux_vip')
      .select('id,statut')
      .eq('user_id', userId)
      .eq('niveau', niveau)
      .maybeSingle();

    if (existing && existing.statut === 'valide') {
      return res.status(400).json({ error: 'Cadeau déjà reçu' });
    }
    if (existing && existing.statut === 'en_attente') {
      return res.status(400).json({ error: 'Cadeau déjà réclamé, en attente de confirmation' });
    }

    if (existing) {
      const { error } = await supabase
        .from('cadeaux_vip')
        .update({ statut: 'en_attente', montant: level.cadeau, date_demande: new Date().toISOString(), date_traitement: null })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('cadeaux_vip')
        .insert({ user_id: userId, niveau, montant: level.cadeau, statut: 'en_attente' });
      if (error) {
        // Course : une réclamation parallèle a déjà créé la ligne (contrainte unique)
        if (error.code === '23505') {
          return res.status(400).json({ error: 'Cadeau déjà réclamé' });
        }
        throw error;
      }
    }

    res.json({ success: true, message: "Cadeau réclamé ! En attente de confirmation de l'administrateur." });
  } catch (err) {
    console.error('Claim gift error:', err);
    res.status(500).json({ error: 'Erreur lors de la réclamation du cadeau' });
  }
});

router.get('/revenue-history', authMiddleware, async (req, res) => {
  try {
    const { data: history } = await supabase
      .from('historique_revenus')
      .select('*')
      .eq('user_id', req.user.id)
      .order('date_paiement', { ascending: false })
      .limit(50);
    res.json({ history: history || [] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
