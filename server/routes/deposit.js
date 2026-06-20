const express = require('express');
const { supabase } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const afribapay = require('../services/afribapay');
const router = express.Router();

const MIN_DEPOT_DEFAUT = 500;

function publicBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

async function getMinDepot() {
  try {
    const { data } = await supabase.from('settings').select('valeur').eq('cle', 'min_depot').maybeSingle();
    const v = parseFloat(data?.valeur);
    return Number.isFinite(v) && v > 0 ? v : MIN_DEPOT_DEFAUT;
  } catch {
    return MIN_DEPOT_DEFAUT;
  }
}

async function getLogosMap() {
  try {
    const { data } = await supabase.from('operateur_logos').select('operator_code, logo_url, label');
    const map = {};
    for (const row of data || []) map[row.operator_code] = { logo_url: row.logo_url, label: row.label };
    return map;
  } catch {
    return {};
  }
}

// Remplace le mot-clé "montant" dans un code USSD par le montant réel.
function buildUssd(ussdCode, montant) {
  if (!ussdCode) return '';
  return ussdCode.replace(/montant/gi, String(montant));
}

// Liste des pays/opérateurs Afribapay (XOF/XAF) + logos configurés par l'admin.
router.get('/countries', authMiddleware, async (req, res) => {
  try {
    const [countries, logos] = await Promise.all([afribapay.getCountries(), getLogosMap()]);
    const withLogos = countries.map((c) => ({
      ...c,
      operators: c.operators.map((o) => ({
        ...o,
        logo_url: logos[o.operator_code]?.logo_url || null,
      })),
    }));
    res.json({ countries: withLogos });
  } catch (err) {
    req.log?.error?.({ err: err.message }, 'Afribapay countries error');
    res.status(502).json({ error: "Impossible de charger les moyens de paiement pour le moment." });
  }
});

// Configuration côté dépôt (montant minimum).
router.get('/config', authMiddleware, async (req, res) => {
  const min_depot = await getMinDepot();
  res.json({ min_depot });
});

router.get('/list', authMiddleware, async (req, res) => {
  try {
    const { data: depots } = await supabase
      .from('depots')
      .select('*')
      .eq('user_id', req.user.id)
      .order('date_depot', { ascending: false })
      .limit(20);
    res.json({ depots: depots || [] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Crédite un dépôt si la transaction Afribapay est réussie (idempotent via validate_depot).
async function crediterSiSucces(depot) {
  if (!depot || depot.statut === 'valide') return depot?.statut || 'inconnu';
  if (!depot.ab_transaction_id) return depot.statut;

  const result = await afribapay.getStatus(depot.ab_transaction_id);
  const abStatus = (result.body?.data?.status || '').toUpperCase();

  if (abStatus && abStatus !== depot.ab_status) {
    await supabase.from('depots').update({ ab_status: abStatus }).eq('id', depot.id);
  }

  if (abStatus === 'SUCCESS' || abStatus === 'SUCCESSFUL') {
    await supabase.rpc('validate_depot', { p_depot_id: depot.id });
    return 'valide';
  }
  if (abStatus === 'FAILED') {
    if (depot.statut === 'en_attente') {
      await supabase.from('depots').update({ statut: 'rejete', date_traitement: new Date().toISOString() }).eq('id', depot.id);
    }
    return 'rejete';
  }
  return depot.statut; // toujours en attente
}

// Initie un dépôt via Afribapay PAYIN.
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { montant, pays, operateur, numero_payeur, otp_code } = req.body;
    const userId = req.user.id;

    if (!montant || !pays || !operateur || !numero_payeur) {
      return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
    }

    const montantNum = Math.round(parseFloat(montant));
    const minDepot = await getMinDepot();
    if (!Number.isFinite(montantNum) || montantNum < minDepot) {
      return res.status(400).json({ error: `Le montant minimum de dépôt est de ${minDepot} FCFA` });
    }

    // Afribapay prélève ~1,5 % sur chaque encaissement. Pour que ce soit le CLIENT
    // qui supporte ces frais (et que l'utilisateur soit crédité du montant exact saisi),
    // on débite le client du montant brut = montant + 1,5 %, et on ne crédite que le
    // montant net. Ce pourcentage n'est jamais affiché côté utilisateur.
    const FRAIS_TAUX = 0.015;
    const montantTotal = Math.round(montantNum * (1 + FRAIS_TAUX));
    const frais = montantTotal - montantNum;

    const found = await afribapay.findOperator(pays, operateur);
    if (!found) {
      return res.status(400).json({ error: 'Pays ou opérateur non pris en charge' });
    }
    const { country, operator } = found;

    // Opérateur à OTP : si l'OTP n'est pas encore fourni, on renvoie les
    // instructions (code USSD à composer) sans déclencher le paiement.
    if (operator.otp_required && !otp_code) {
      const ussd = buildUssd(operator.ussd_code, montantTotal);
      return res.json({
        needs_otp: true,
        ussd_code: ussd,
        message: ussd
          ? `VEUILLEZ COMPOSER ${ussd} POUR OBTENIR LE CODE OTP ET CONFIRMER VOTRE PAIEMENT`
          : "Veuillez obtenir le code OTP auprès de votre opérateur puis le saisir pour confirmer.",
      });
    }

    const orderId = `GIFE-${userId}-${Date.now()}`;
    const base = publicBaseUrl(req);

    const result = await afribapay.payin({
      operator: operator.operator_code,
      country: country.country_code,
      phone_number: String(numero_payeur).replace(/\s+/g, ''),
      amount: montantTotal,
      currency: country.currency,
      order_id: orderId,
      otp_code: otp_code || undefined,
      notify_url: `${base}/api/deposit/notify`,
      return_url: `${base}/deposit?status=success`,
      cancel_url: `${base}/deposit?status=cancel`,
    });

    const passOperator = result.body?.data;
    if (!result.ok || !passOperator?.transaction_id) {
      const msg = passOperator?.message || result.body?.message || 'Échec de l\'initiation du paiement';
      req.log?.warn?.({ status: result.status, msg }, 'Afribapay payin failed');
      return res.status(400).json({ error: msg });
    }

    // URL de redirection éventuelle (Wave et autres redirections externes).
    const paymentUrl =
      passOperator.payment_url || passOperator.url || passOperator.checkout_url ||
      passOperator.redirect_url || passOperator.payment_link || null;

    const { data: depot, error } = await supabase
      .from('depots')
      .insert({
        user_id: userId,
        montant: montantNum, // montant net crédité
        pays,
        operateur,
        numero_payeur,
        statut: 'en_attente',
        devise: country.currency,
        frais,
        montant_total: montantTotal,
        ab_order_id: orderId,
        ab_transaction_id: passOperator.transaction_id,
        ab_status: (passOperator.status || 'PENDING').toUpperCase(),
      })
      .select('id')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      depot_id: depot.id,
      transaction_id: passOperator.transaction_id,
      status: (passOperator.status || 'PENDING').toUpperCase(),
      montant: montantNum,
      frais,
      montant_total: montantTotal,
      payment_url: paymentUrl,
      message: paymentUrl
        ? 'Vous allez être redirigé pour confirmer le paiement.'
        : 'Paiement initié. Confirmez sur votre téléphone.',
    });
  } catch (err) {
    req.log?.error?.({ err: err.message }, 'Deposit request error');
    res.status(500).json({ error: 'Erreur lors de la soumission du dépôt' });
  }
});

// Polling du statut d'un dépôt (déclenche le crédit si réussi).
router.post('/status', authMiddleware, async (req, res) => {
  try {
    const { depot_id } = req.body;
    const { data: depot } = await supabase
      .from('depots')
      .select('*')
      .eq('id', depot_id)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (!depot) return res.status(404).json({ error: 'Dépôt introuvable' });

    let statut = depot.statut;
    if (statut === 'en_attente') {
      statut = await crediterSiSucces(depot);
    }
    res.json({ statut });
  } catch (err) {
    req.log?.error?.({ err: err.message }, 'Deposit status error');
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Webhook IPN Afribapay (public, sans auth). Crédite à la confirmation.
router.post('/notify', async (req, res) => {
  try {
    const body = req.body || {};
    const data = body.data || body;
    const transactionId = data.transaction_id || data.transactionId;
    const orderId = data.order_id || data.orderId;

    let query = supabase.from('depots').select('*');
    if (transactionId) query = query.eq('ab_transaction_id', transactionId);
    else if (orderId) query = query.eq('ab_order_id', orderId);
    else return res.status(200).json({ ok: true });

    const { data: depot } = await query.maybeSingle();
    if (depot) await crediterSiSucces(depot);

    res.status(200).json({ ok: true });
  } catch (err) {
    req.log?.error?.({ err: err.message }, 'Deposit notify error');
    res.status(200).json({ ok: true });
  }
});

module.exports = router;
