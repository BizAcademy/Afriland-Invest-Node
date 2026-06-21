const express = require('express');
const { supabase } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const router = express.Router();

const REVENU_MAP = {
  parrainage: { kind: 'parrainage', label: 'Commission parrainage' },
  bonus: { kind: 'bonus', label: 'Bonus roue de la fortune' },
  credit_admin: { kind: 'credit_admin', label: 'Crédit administrateur' },
  debit_admin: { kind: 'debit_admin', label: 'Retrait Administrateur', sens: '-' },
  cadeau_vip: { kind: 'cadeau_vip', label: 'Cadeau VIP' },
  mise_roue: { kind: 'mise_roue', label: 'Mise roue', sens: '-' },
  gain_roue: { kind: 'gain_roue', label: 'Gain roue', sens: '+' },
  revenu: { kind: 'revenu', label: 'Revenu investissement' },
};

function mapRevenu(r) {
  const m = REVENU_MAP[r.type] || { kind: 'revenu', label: 'Revenu investissement' };
  const montant = parseFloat(r.montant || 0);
  // Pour le parrainage, on précise le niveau (1/2/3) quand il est connu.
  // Les anciennes lignes sans niveau gardent le libellé générique.
  const niveau = r.niveau || null;
  const label = (r.type === 'parrainage' && niveau)
    ? `Commission de parrainage niveau ${niveau}`
    : m.label;
  return {
    id: `revenu-${r.id}`,
    kind: m.kind,
    label,
    montant: Math.abs(montant),
    sens: m.sens || (montant < 0 ? '-' : '+'),
    statut: 'valide',
    date: r.date_paiement,
    details: { type_revenu: r.type, niveau, commande_id: r.commande_id || null },
  };
}

function mapDepot(d) {
  return {
    id: `depot-${d.id}`,
    kind: 'depot',
    label: 'Dépôt',
    montant: parseFloat(d.montant || 0),
    sens: '+',
    statut: d.statut,
    date: d.date_depot,
    details: { pays: d.pays, operateur: d.operateur, numero_payeur: d.numero_payeur },
  };
}

function mapRetrait(r) {
  return {
    id: `retrait-${r.id}`,
    kind: 'retrait',
    label: 'Retrait',
    montant: parseFloat(r.montant || 0),
    sens: '-',
    statut: r.statut,
    date: r.date_demande,
    details: { methode: r.methode, numero_compte: r.numero_compte },
  };
}

function mapCommande(c) {
  return {
    id: `commande-${c.id}`,
    kind: 'investissement',
    label: 'Investissement',
    montant: parseFloat(c.montant || 0),
    sens: '-',
    statut: c.statut,
    date: c.date_debut,
    details: {
      plan_nom: c.planinvestissement?.nom || null,
      revenu_journalier: parseFloat(c.revenu_journalier || 0),
      date_fin: c.date_fin,
    },
  };
}

// ── Transactions de l'utilisateur connecté ──
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const [depotsRes, retraitsRes, commandesRes, revenusRes] = await Promise.all([
      supabase.from('depots').select('*').eq('user_id', userId),
      supabase.from('retraits').select('*').eq('user_id', userId),
      supabase.from('commandes').select('*, planinvestissement(nom)').eq('user_id', userId),
      supabase.from('historique_revenus').select('*').eq('user_id', userId),
    ]);

    const transactions = [
      ...(depotsRes.data || []).map(mapDepot),
      ...(retraitsRes.data || []).map(mapRetrait),
      ...(commandesRes.data || []).map(mapCommande),
      ...(revenusRes.data || []).map(mapRevenu),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Toutes les transactions (admin) ──
router.get('/admin', adminMiddleware, async (req, res) => {
  try {
    const [depotsRes, retraitsRes, commandesRes, revenusRes, usersRes] = await Promise.all([
      supabase.from('depots').select('*'),
      supabase.from('retraits').select('*'),
      supabase.from('commandes').select('*, planinvestissement(nom)'),
      supabase.from('historique_revenus').select('*'),
      supabase.from('utilisateurs').select('id, nom, telephone'),
    ]);

    const userMap = {};
    for (const u of usersRes.data || []) userMap[u.id] = u;

    const attach = (tx, userId) => ({
      ...tx,
      user: userMap[userId] ? { nom: userMap[userId].nom, telephone: userMap[userId].telephone } : null,
    });

    const transactions = [
      ...(depotsRes.data || []).map((d) => attach(mapDepot(d), d.user_id)),
      ...(retraitsRes.data || []).map((r) => attach(mapRetrait(r), r.user_id)),
      ...(commandesRes.data || []).map((c) => attach(mapCommande(c), c.user_id)),
      ...(revenusRes.data || []).map((r) => attach(mapRevenu(r), r.user_id)),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
