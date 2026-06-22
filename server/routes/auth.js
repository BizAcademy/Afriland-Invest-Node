const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db');
const afribapay = require('../services/afribapay');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'afriland_secret_2024';

// Liste de secours (dernier recours) si la liste des pays Afribapay est
// momentanément indisponible. La SOURCE DE VÉRITÉ reste afribapay.getCountries()
// — la même liste que celle affichée dans le menu déroulant de l'inscription —
// pour que TOUT pays proposé à l'utilisateur puisse réellement s'inscrire.
const PAYS_ELIGIBLES = {
  '+229': 'Bénin',
  '+226': 'Burkina Faso',
  '+237': 'Cameroun',
  '+221': 'Sénégal',
  '+225': "Côte d'Ivoire",
  '+223': 'Mali',
  '+228': 'Togo',
};

// Retourne le nom du pays correspondant à un indicatif (+242, +229 …) s'il fait
// partie des pays proposés à l'inscription, sinon null. On valide contre la
// liste Afribapay (XOF/XAF) afin que le contrôle d'éligibilité et le menu
// déroulant restent TOUJOURS synchronisés (plus de « Pays non éligible » pour
// un pays affiché). En cas d'échec du service, on retombe sur la liste statique.
async function paysPourIndicatif(indicatif) {
  if (!indicatif) return null;
  const prefix = String(indicatif).replace(/\D/g, ''); // "+242" -> "242"
  if (!prefix) return null;
  try {
    const countries = await afribapay.getCountries();
    const c = (countries || []).find((x) => String(x.prefix) === prefix);
    if (c && c.country_name) return c.country_name;
  } catch { /* service pays indisponible : on bascule sur le repli statique */ }
  return PAYS_ELIGIBLES[`+${prefix}`] || null;
}

router.post('/login', async (req, res) => {
  try {
    const { indicatif, telephone, mot_de_passe } = req.body;

    if (!indicatif || !telephone || !mot_de_passe) {
      return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
    }
    if (!(await paysPourIndicatif(indicatif))) {
      return res.status(400).json({ error: 'Code pays non valide' });
    }

    const full_tel = indicatif + telephone.replace(/\D/g, '');

    const { data: user, error } = await supabase
      .from('utilisateurs')
      .select('id,nom,telephone,pays,role,code_parrainage,lien_parrainage,mot_de_passe')
      .eq('telephone', full_tel)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Aucun compte trouvé avec ce numéro' });
    }

    const validPassword = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    if (!validPassword) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    const token = jwt.sign(
      { id: user.id, nom: user.nom, telephone: user.telephone, role: user.role || 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        nom: user.nom,
        telephone: user.telephone,
        pays: user.pays,
        role: user.role || 'user',
        code_parrainage: user.code_parrainage,
        lien_parrainage: user.lien_parrainage,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { nom, indicatif, telephone, pays, mot_de_passe, code_parrain } = req.body;

    if (!nom || !indicatif || !telephone || !mot_de_passe) {
      return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
    }
    const paysNom = await paysPourIndicatif(indicatif);
    if (!paysNom) {
      return res.status(400).json({ error: 'Pays non éligible' });
    }

    const full_tel = indicatif + telephone.replace(/\D/g, '');

    const { data: existing } = await supabase
      .from('utilisateurs')
      .select('id')
      .eq('telephone', full_tel)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Ce numéro est déjà enregistré' });
    }

    const hashedPassword = await bcrypt.hash(mot_de_passe, 10);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    let parrain_id = null;
    if (code_parrain) {
      const { data: parrain } = await supabase
        .from('utilisateurs')
        .select('id')
        .eq('code_parrainage', code_parrain.toUpperCase())
        .maybeSingle();
      if (parrain) parrain_id = parrain.id;
    }

    const { data: newUser, error: insertError } = await supabase
      .from('utilisateurs')
      .insert({
        nom,
        telephone: full_tel,
        // Le pays est TOUJOURS déduit de l'indicatif (source fiable), jamais du
        // libellé envoyé par le client — pour éviter toute incohérence.
        pays: paysNom,
        mot_de_passe: hashedPassword,
        solde: 0,
        revenus_totaux: 0,
        nombre_filleuls: 0,
        code_parrainage: code,
        parrain_id,
        lien_parrainage: `${appUrl}?p=${code}`,
        role: 'user',
      })
      .select('id,nom,telephone,pays,lien_parrainage')
      .single();

    if (insertError) throw insertError;

    // Initialiser les tables liées
    await Promise.all([
      supabase.from('soldes').upsert({ user_id: newUser.id, solde: 0 }, { onConflict: 'user_id' }),
      supabase.from('vip').upsert({ user_id: newUser.id, niveau: 0, pourcentage: 0, invitations_requises: 3, invitations_actuelles: 0 }, { onConflict: 'user_id' }),
      supabase.from('filleuls').upsert({ user_id: newUser.id, gains_totaux: 0 }, { onConflict: 'user_id' }),
      supabase.from('roue').upsert({ user_id: newUser.id, nombre_tours: 0 }, { onConflict: 'user_id' }),
    ]);

    if (parrain_id) {
      await supabase.rpc('increment_filleuls', { p_user_id: parrain_id });
    }

    const token = jwt.sign(
      { id: newUser.id, nom: newUser.nom, telephone: newUser.telephone, role: 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        nom: newUser.nom,
        telephone: newUser.telephone,
        pays: newUser.pays,
        role: 'user',
        code_parrainage: code,
        lien_parrainage: newUser.lien_parrainage,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

module.exports = router;
