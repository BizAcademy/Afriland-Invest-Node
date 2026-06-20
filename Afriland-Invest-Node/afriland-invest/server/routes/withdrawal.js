const express = require('express');
const { supabase } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

const FRAIS_TAUX = 0.10;       // 10% de frais de retrait
const MIN_RETRAIT = 2000;      // retrait minimum (montant brut)
const MAX_PAR_24H = 2;         // 2 retraits maximum par 24h

// Types de revenus RETIRABLES :
//   • revenu_journalier : gains des investissements
//   • bonus / gain_roue : gains à la roue (tour gratuit + tour payant)
//   • parrainage        : commissions d'affiliation (sous condition d'avoir investi)
// L'argent issu des dépôts (réels ou crédités par l'admin) n'est PAS retirable.
const SOURCES_INVEST_ROUE = ['revenu_journalier', 'bonus', 'gain_roue'];

// Calcule le solde retirable réel d'un utilisateur.
async function computeRetirable(userId) {
  const [{ count: nbCommandes }, { data: revenus }, { data: retraits }, { data: soldeRow }] = await Promise.all([
    supabase.from('commandes').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('historique_revenus').select('montant, type').eq('user_id', userId)
      .in('type', [...SOURCES_INVEST_ROUE, 'parrainage']),
    // Retraits qui « consomment » du retirable : en attente + validés (les rejetés sont remboursés).
    supabase.from('retraits').select('montant, statut').eq('user_id', userId)
      .in('statut', ['en_attente', 'valide']),
    supabase.from('soldes').select('solde').eq('user_id', userId).maybeSingle(),
  ]);

  const hasInvestment = (nbCommandes || 0) > 0;
  const solde = parseFloat(soldeRow?.solde || 0);

  let gainsInvestRoue = 0;
  let commissionsParrainage = 0;
  for (const r of revenus || []) {
    const m = Math.abs(parseFloat(r.montant || 0));
    if (r.type === 'parrainage') commissionsParrainage += m;
    else gainsInvestRoue += m;
  }

  // Le parrainage n'est retirable que si l'utilisateur a souscrit à >= 1 investissement.
  const eligible = gainsInvestRoue + (hasInvestment ? commissionsParrainage : 0);
  const dejaRetire = (retraits || []).reduce((s, r) => s + parseFloat(r.montant || 0), 0);
  // Le retirable ne peut jamais dépasser le solde réellement disponible
  // (les mises de la roue ont pu consommer une partie des gains).
  const retirable = Math.max(0, Math.min(eligible - dejaRetire, solde));

  return { retirable, hasInvestment, commissionsParrainage, eligible, dejaRetire, solde };
}

router.get('/list', authMiddleware, async (req, res) => {
  try {
    const [{ data: retraits }, info] = await Promise.all([
      supabase.from('retraits').select('*').eq('user_id', req.user.id)
        .order('date_demande', { ascending: false }).limit(20),
      computeRetirable(req.user.id),
    ]);
    const result = (retraits || []).map(r => ({
      ...r,
      frais: r.frais != null ? parseFloat(r.frais) : 0,
      montant_net: r.montant_net != null ? parseFloat(r.montant_net) : parseFloat(r.montant),
    }));
    res.json({ retraits: result, retirable: info.retirable, taux_frais: FRAIS_TAUX });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { montant, transaction_password } = req.body;
    const userId = req.user.id;

    if (!montant || !transaction_password) {
      return res.status(400).json({ error: 'Montant et mot de passe requis' });
    }

    // ── Horaires : lundi au samedi, de 7h à 20h GMT
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDay(); // 0 = dimanche
    if (day === 0 || hour < 7 || hour >= 20) {
      return res.status(400).json({ error: 'Les retraits sont disponibles du lundi au samedi de 7h à 20h (GMT)' });
    }

    // ── Mot de passe de transaction
    const { data: tp } = await supabase
      .from('transaction_passwords')
      .select('password')
      .eq('user_id', userId)
      .maybeSingle();
    if (!tp) return res.status(400).json({ error: 'Veuillez configurer votre mot de passe de transaction' });
    if (tp.password !== transaction_password) return res.status(400).json({ error: 'Mot de passe de transaction incorrect' });

    // ── Portefeuille de retrait obligatoire
    const { data: wallet } = await supabase
      .from('portefeuilles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (!wallet) return res.status(400).json({ error: 'Veuillez ajouter un portefeuille de retrait' });

    const montantNum = Math.round(parseFloat(montant));
    if (isNaN(montantNum) || montantNum < MIN_RETRAIT) {
      return res.status(400).json({ error: `Retrait minimum: ${MIN_RETRAIT} FCFA` });
    }

    // ── Maximum 2 retraits par 24h (en attente ou validés)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from('retraits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('statut', ['en_attente', 'valide'])
      .gte('date_demande', since);
    if ((recentCount || 0) >= MAX_PAR_24H) {
      return res.status(400).json({ error: 'Maximum 2 retraits autorisés par 24h' });
    }

    // ── Solde retirable : uniquement gains d'investissement, gains de la roue
    //    et commissions de parrainage (parrainage sous condition d'investissement).
    const { retirable, hasInvestment, commissionsParrainage } = await computeRetirable(userId);

    if (retirable < MIN_RETRAIT) {
      let error = "Vous n'avez pas de gains retirables suffisants. Seuls les gains d'investissement, les gains de la roue et les commissions de parrainage sont retirables.";
      if (!hasInvestment && commissionsParrainage > 0) {
        error = "Vous devez souscrire à au moins un plan d'investissement pour retirer vos commissions de parrainage.";
      }
      return res.status(400).json({ error, code: 'NOT_WITHDRAWABLE' });
    }

    if (montantNum > retirable) {
      return res.status(400).json({ error: `Montant supérieur à votre solde retirable (${Math.round(retirable)} FCFA)` });
    }

    // ── Frais de 10% : le montant BRUT saisi est déduit du solde, l'utilisateur
    //    reçoit le montant net (brut - frais).
    const frais = Math.round(montantNum * FRAIS_TAUX);
    const montantNet = montantNum - frais;

    // Appel RPC atomique (déduit le brut, enregistre frais + net)
    const { data: result, error } = await supabase.rpc('request_withdrawal', {
      p_user_id: userId,
      p_montant: montantNum,
      p_frais: frais,
      p_montant_net: montantNet,
      p_methode: wallet.methode_paiement,
      p_numero: wallet.numero_telephone,
    });

    if (error) throw error;
    if (result?.error) return res.status(400).json({ error: result.error });

    res.json({
      success: true,
      message: 'Demande de retrait soumise avec succès',
      montant: montantNum, frais, montant_net: montantNet,
    });
  } catch (err) {
    console.error('Withdrawal error:', err);
    res.status(500).json({ error: 'Erreur lors du retrait' });
  }
});

module.exports = router;
