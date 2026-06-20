const express = require('express');
const { supabase } = require('../db');
const router = express.Router();

const MAX_LEN = 2000;

// Clé de conversation = indicatif + numéro (même format que utilisateurs.telephone)
const normalizeTel = (indicatif, telephone) =>
  `${indicatif || ''}${(telephone || '').replace(/\D/g, '')}`;

// ── Envoyer un message au support (PUBLIC — ex: "mot de passe oublié") ──
router.post('/', async (req, res) => {
  try {
    const { indicatif, telephone, nom, message } = req.body;
    const tel = normalizeTel(indicatif, telephone);
    if (!tel || tel.length < 6) return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    if (!message || !message.trim()) return res.status(400).json({ error: 'Le message est vide' });
    const texte = message.trim().slice(0, MAX_LEN);

    // Si le numéro correspond à un compte, on récupère le nom enregistré.
    let nomFinal = (nom || '').trim().slice(0, 120) || null;
    const { data: u } = await supabase
      .from('utilisateurs').select('nom').eq('telephone', tel).maybeSingle();
    if (u && u.nom) nomFinal = u.nom;

    const { data, error } = await supabase
      .from('support_messages')
      .insert({ telephone: tel, nom: nomFinal, expediteur: 'user', message: texte, lu: false })
      .select()
      .single();
    if (error) throw error;

    res.json({ message: data });
  } catch (err) {
    console.error('support post error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Voir sa conversation (PUBLIC — par numéro) ──
router.get('/thread', async (req, res) => {
  try {
    const tel = normalizeTel(req.query.indicatif, req.query.telephone);
    if (!tel || tel.length < 6) return res.status(400).json({ error: 'Numéro requis' });

    const { data, error } = await supabase
      .from('support_messages')
      .select('id, expediteur, message, date_creation')
      .eq('telephone', tel)
      .order('date_creation', { ascending: true })
      .range(0, 9999);
    if (error) throw error;

    res.json({ telephone: tel, messages: data || [] });
  } catch (err) {
    console.error('support thread error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
