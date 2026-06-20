const express = require('express');
const { supabase } = require('../db');
const router = express.Router();

// Route publique — annonces actives pour le dashboard
router.get('/', async (req, res) => {
  try {
    const { data: annonces } = await supabase
      .from('annonces')
      .select('id,titre,contenu,image,couleur,date_creation')
      .eq('actif', true)
      .order('date_creation', { ascending: false })
      .limit(10);
    res.json({ annonces: annonces || [] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
