const express = require('express');
const { supabase } = require('../db');
const router = express.Router();

// Route publique — FAQ active pour la page Questions fréquentes
router.get('/', async (req, res) => {
  try {
    const { data: faqs } = await supabase
      .from('faq')
      .select('id,question,reponse,image,ordre')
      .eq('actif', true)
      .order('ordre', { ascending: true })
      .order('id', { ascending: true });

    // Lien du support Telegram, configurable côté admin (settings.support_telegram).
    let support_telegram = 'https://t.me/gifetalpro';
    try {
      const { data: s } = await supabase
        .from('settings')
        .select('valeur')
        .eq('cle', 'support_telegram')
        .maybeSingle();
      if (s?.valeur) support_telegram = s.valeur;
    } catch { /* table settings absente : on renvoie un lien vide */ }

    res.json({ faqs: faqs || [], support_telegram });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
