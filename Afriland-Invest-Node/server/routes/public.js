const express = require('express');
const afribapay = require('../services/afribapay');
const { supabase } = require('../db');
const router = express.Router();

// Liens de la communauté (Telegram / WhatsApp), configurables côté admin.
router.get('/community', async (req, res) => {
  let telegram = '';
  let whatsapp = '';
  try {
    const { data } = await supabase
      .from('settings')
      .select('cle,valeur')
      .in('cle', ['communaute_telegram', 'communaute_whatsapp']);
    (data || []).forEach((s) => {
      if (s.cle === 'communaute_telegram' && s.valeur) telegram = s.valeur;
      if (s.cle === 'communaute_whatsapp' && s.valeur) whatsapp = s.valeur;
    });
  } catch { /* table settings absente : on renvoie des liens vides */ }
  res.json({ telegram, whatsapp });
});

// Musique de fond de la Roue, configurée côté admin. Renvoie une URL vide si non définie.
router.get('/roue-music', async (req, res) => {
  let url = '';
  try {
    const { data } = await supabase
      .from('settings').select('valeur').eq('cle', 'roue_music_url').maybeSingle();
    if (data?.valeur) url = data.valeur;
  } catch { /* table settings absente : on renvoie une URL vide */ }
  res.json({ url });
});

// Liste publique des pays Afribapay (XOF/XAF) — utilisée par l'inscription.
// Ne renvoie pas les opérateurs (non nécessaires avant connexion).
router.get('/countries', async (req, res) => {
  try {
    const countries = await afribapay.getCountries();
    res.json({
      countries: countries.map((c) => ({
        country_code: c.country_code,
        country_name: c.country_name,
        country_flag: c.country_flag,
        prefix: c.prefix,
        currency: c.currency,
      })),
    });
  } catch (err) {
    res.status(502).json({ error: 'Impossible de charger la liste des pays.' });
  }
});

module.exports = router;
