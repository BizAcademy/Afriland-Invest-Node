const express = require('express');
const { supabase } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.get('/data', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Niveau 1 — filleuls directs
    const { data: lvl1 } = await supabase
      .from('utilisateurs')
      .select('id,nom,telephone,pays,date_inscription')
      .eq('parrain_id', userId);

    const ids1 = (lvl1 || []).map(u => u.id);

    // Niveau 2
    let lvl2 = [];
    if (ids1.length > 0) {
      const { data } = await supabase
        .from('utilisateurs')
        .select('id,nom,telephone,pays,date_inscription')
        .in('parrain_id', ids1);
      lvl2 = data || [];
    }

    const ids2 = lvl2.map(u => u.id);

    // Niveau 3
    let lvl3 = [];
    if (ids2.length > 0) {
      const { data } = await supabase
        .from('utilisateurs')
        .select('id,nom,telephone,pays,date_inscription')
        .in('parrain_id', ids2);
      lvl3 = data || [];
    }

    // Gains parrainage
    const { data: revenus } = await supabase
      .from('historique_revenus')
      .select('montant')
      .eq('user_id', userId)
      .eq('type', 'parrainage');
    const gains_parrainage = (revenus || []).reduce((sum, r) => sum + parseFloat(r.montant || 0), 0);

    // Code parrainage
    const { data: userInfo } = await supabase
      .from('utilisateurs')
      .select('code_parrainage,lien_parrainage')
      .eq('id', userId)
      .single();

    // Pourcentages de commission (configurés par l'admin)
    const { data: settingsRows } = await supabase
      .from('settings')
      .select('cle,valeur')
      .in('cle', ['commission_niveau1', 'commission_niveau2', 'commission_niveau3']);
    const cmap = {};
    (settingsRows || []).forEach(s => { cmap[s.cle] = s.valeur; });
    const commissions = {
      niveau1: cmap.commission_niveau1 || '10',
      niveau2: cmap.commission_niveau2 || '5',
      niveau3: cmap.commission_niveau3 || '2',
    };

    res.json({
      niveau1: { count: (lvl1 || []).length, filleuls: lvl1 || [] },
      niveau2: { count: lvl2.length, filleuls: lvl2 },
      niveau3: { count: lvl3.length, filleuls: lvl3 },
      gains_parrainage,
      commissions,
      code_parrainage: userInfo?.code_parrainage,
      lien_parrainage: userInfo?.lien_parrainage,
    });
  } catch (err) {
    console.error('Referral error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
