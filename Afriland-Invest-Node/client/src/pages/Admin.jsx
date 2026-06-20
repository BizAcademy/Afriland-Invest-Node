import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import MiniLineChart from '../components/MiniLineChart';

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [depots, setDepots] = useState([]);
  const [retraits, setRetraits] = useState([]);
  const [cadeaux, setCadeaux] = useState([]);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [annonces, setAnnonces] = useState([]);
  const [settings, setSettings] = useState({ min_depot: '500' });
  const [transactions, setTransactions] = useState([]);
  const [demoRecharges, setDemoRecharges] = useState([]);
  const [txTypeFilter, setTxTypeFilter] = useState('all');
  const [txStatutFilter, setTxStatutFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Statistiques roue de la fortune
  const [wheelStats, setWheelStats] = useState(null);
  const [wheelPeriod, setWheelPeriod] = useState('today');
  const [wheelLoading, setWheelLoading] = useState(false);

  // Modals
  const [creditAmount, setCreditAmount] = useState('');
  const [planModal, setPlanModal] = useState(null);
  const [planForm, setPlanForm] = useState({ nom: '', prix: '', duree_jours: '', rendement_journalier: '' });
  const [planImageFile, setPlanImageFile] = useState(null);
  const [planImagePreview, setPlanImagePreview] = useState(null);
  const [musicFile, setMusicFile] = useState(null);
  const [musicUploading, setMusicUploading] = useState(false);
  const planFileRef = useRef();

  // Gestion utilisateur (vue détaillée + actions)
  const [userModal, setUserModal] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [debitAmount, setDebitAmount] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newTxPassword, setNewTxPassword] = useState('');
  const [actionPassword, setActionPassword] = useState('');

  // Recherche / filtre pays (onglet Utilisateurs uniquement)
  const [userSearch, setUserSearch] = useState('');
  const [userPays, setUserPays] = useState('');
  const [paysList, setPaysList] = useState([]);

  // Transactions de l'utilisateur (dans le modal Gérer)
  const [userTx, setUserTx] = useState([]);
  const [userTxLoading, setUserTxLoading] = useState(false);
  const [utxPeriod, setUtxPeriod] = useState('all');
  const [utxType, setUtxType] = useState('all');

  // Upload d'image pour annonces
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  // Gestion FAQ
  const [faqs, setFaqs] = useState([]);
  const [faqModal, setFaqModal] = useState(null);
  const [faqForm, setFaqForm] = useState({ question: '', reponse: '', ordre: '' });
  const [faqImageFile, setFaqImageFile] = useState(null);
  const [faqImagePreview, setFaqImagePreview] = useState(null);
  const [faqRemoveImage, setFaqRemoveImage] = useState(false);
  const faqFileRef = useRef();

  // Logos des opérateurs (tous les moyens de paiement disponibles)
  const [operators, setOperators] = useState([]);
  const [operatorsLoading, setOperatorsLoading] = useState(true);
  const [logoUploading, setLogoUploading] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    loadAll();
    loadOperators();
    const interval = setInterval(() => refreshStats(), 30000);
    return () => clearInterval(interval);
  }, []);

  const loadOperators = async () => {
    setOperatorsLoading(true);
    try {
      const res = await api.get('/admin/operators');
      setOperators(res.data.operators || []);
    } catch {
      setOperators([]);
    } finally {
      setOperatorsLoading(false);
    }
  };

  const uploadOperatorLogo = async (op, file) => {
    if (!file) return;
    setLogoUploading(op.operator_code);
    try {
      const fd = new FormData();
      fd.append('operator_code', op.operator_code);
      fd.append('label', op.operator_name);
      fd.append('image', file);
      await api.post('/admin/operator-logos', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Logo ${op.operator_name} enregistré ✅`);
      loadOperators();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'enregistrement du logo');
    } finally {
      setLogoUploading('');
    }
  };

  const refreshStats = async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
      setLastUpdated(new Date());
    } catch { /* silent */ }
    finally { setRefreshing(false); }
  };

  const loadAll = async () => {
    try {
      const [statsRes, depotsRes, retraitsRes, cadeauxRes, usersRes, postsRes, plansRes, annoncesRes, settingsRes, txRes, faqRes, demoRechargesRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/depots'),
        api.get('/admin/retraits'),
        api.get('/admin/cadeaux'),
        api.get('/admin/users'),
        api.get('/admin/posts'),
        api.get('/admin/plans'),
        api.get('/admin/annonces'),
        api.get('/admin/settings'),
        api.get('/transactions/admin'),
        api.get('/admin/faq'),
        api.get('/admin/demo-recharges'),
      ]);
      setStats(statsRes.data);
      setLastUpdated(new Date());
      setDepots(depotsRes.data.depots || []);
      setRetraits(retraitsRes.data.retraits || []);
      setCadeaux(cadeauxRes.data.cadeaux || []);
      setUsers(usersRes.data.users || []);
      if (usersRes.data.pays_list) setPaysList(usersRes.data.pays_list);
      setPosts(postsRes.data.posts || []);
      setPlans(plansRes.data.plans || []);
      setAnnonces(annoncesRes.data.annonces || []);
      setSettings(settingsRes.data.settings || { min_depot: '500' });
      setTransactions(txRes.data.transactions || []);
      setFaqs(faqRes.data.faqs || []);
      setDemoRecharges(demoRechargesRes.data.recharges || []);
    } catch { toast.error('Erreur de chargement admin'); }
    finally { setLoading(false); }
  };

  // ── Statistiques roue ──
  const loadWheelStats = async (period) => {
    setWheelLoading(true);
    try {
      const res = await api.get(`/admin/wheel-stats?period=${period}`);
      setWheelStats(res.data);
    } catch { toast.error('Erreur de chargement des statistiques'); }
    finally { setWheelLoading(false); }
  };

  useEffect(() => {
    if (tab === 'roue') loadWheelStats(wheelPeriod);
  }, [tab, wheelPeriod]);

  // ── Dépôts ──
  const validateDepot = async (id) => {
    try { await api.put(`/admin/depots/${id}/validate`); toast.success('Dépôt validé ✅'); loadAll(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };
  const rejectDepot = async (id) => {
    try { await api.put(`/admin/depots/${id}/reject`); toast.success('Dépôt rejeté'); loadAll(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  // ── Retraits ──
  const validateRetrait = async (id) => {
    try { await api.put(`/admin/retraits/${id}/validate`); toast.success('Retrait validé ✅'); loadAll(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };
  const rejectRetrait = async (id) => {
    try { await api.put(`/admin/retraits/${id}/reject`); toast.success('Retrait rejeté, remboursé'); loadAll(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  // ── Recharges démo (Roue) ──
  const validateDemoRecharge = async (id) => {
    try { await api.put(`/admin/demo-recharges/${id}/validate`); toast.success('Solde démo rechargé ✅'); loadAll(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };
  const rejectDemoRecharge = async (id) => {
    try { await api.put(`/admin/demo-recharges/${id}/reject`); toast.success('Demande rejetée'); loadAll(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  // ── Cadeaux VIP ──
  const validateCadeau = async (id) => {
    try { await api.put(`/admin/cadeaux/${id}/validate`); toast.success('Cadeau validé et crédité ✅'); loadAll(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };
  const rejectCadeau = async (id) => {
    try { await api.put(`/admin/cadeaux/${id}/reject`); toast.success('Cadeau rejeté'); loadAll(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  // ── Posts ──
  const validatePost = async (id) => {
    try { await api.put(`/admin/posts/${id}/validate`); toast.success('Post validé'); loadAll(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };
  const rejectPost = async (id) => {
    try { await api.put(`/admin/posts/${id}/reject`); toast.success('Post rejeté'); loadAll(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  // ── Gestion utilisateur ──
  // Recherche / filtre pays côté serveur (rapide même avec beaucoup d'utilisateurs)
  const loadUsers = async (q, pays) => {
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (pays) params.set('pays', pays);
      const qs = params.toString();
      const res = await api.get(`/admin/users${qs ? `?${qs}` : ''}`);
      setUsers(res.data.users || []);
      if (res.data.pays_list) setPaysList(res.data.pays_list);
    } catch { /* silent */ }
  };

  // Déclenche la recherche (avec léger debounce) quand on est sur l'onglet Utilisateurs
  useEffect(() => {
    if (tab !== 'users') return;
    const t = setTimeout(() => loadUsers(userSearch.trim(), userPays), 300);
    return () => clearTimeout(t);
  }, [userSearch, userPays, tab]);

  const loadUserTx = async (id) => {
    setUserTxLoading(true);
    try {
      const res = await api.get(`/admin/users/${id}/transactions`);
      setUserTx(res.data.transactions || []);
    } catch { setUserTx([]); }
    finally { setUserTxLoading(false); }
  };

  const openUserDetail = async (id) => {
    setUserModal(id); setUserDetail(null); setUserDetailLoading(true);
    setCreditAmount(''); setDebitAmount(''); setNewPassword(''); setNewTxPassword(''); setActionPassword('');
    setUserTx([]); setUtxPeriod('all'); setUtxType('all');
    try {
      const res = await api.get(`/admin/users/${id}`);
      setUserDetail(res.data);
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
    finally { setUserDetailLoading(false); }
    loadUserTx(id);
  };
  const refreshUserDetail = async (id) => {
    try { const res = await api.get(`/admin/users/${id}`); setUserDetail(res.data); } catch { /* ignore */ }
  };
  const handleCreditUser = async () => {
    if (!creditAmount || isNaN(creditAmount) || parseFloat(creditAmount) <= 0) return toast.error('Montant invalide');
    if (!actionPassword) return toast.error("Saisissez le mot de passe d'action");
    try {
      await api.put(`/admin/users/${userModal}/credit`, { montant: parseFloat(creditAmount), action_password: actionPassword });
      toast.success('Crédit effectué ✅'); setCreditAmount(''); setActionPassword(''); refreshUserDetail(userModal); loadAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };
  const handleDebitUser = async () => {
    if (!debitAmount || isNaN(debitAmount) || parseFloat(debitAmount) <= 0) return toast.error('Montant invalide');
    if (!actionPassword) return toast.error("Saisissez le mot de passe d'action");
    try {
      await api.put(`/admin/users/${userModal}/debit`, { montant: parseFloat(debitAmount), action_password: actionPassword });
      toast.success('Solde réduit ✅'); setDebitAmount(''); setActionPassword(''); refreshUserDetail(userModal); loadAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };
  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) return toast.error('Mot de passe : 6 caractères minimum');
    if (!actionPassword) return toast.error("Saisissez le mot de passe d'action");
    try {
      await api.put(`/admin/users/${userModal}/password`, { password: newPassword, action_password: actionPassword });
      toast.success('Mot de passe modifié ✅'); setNewPassword(''); setActionPassword('');
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };
  const handleChangeTxPassword = async () => {
    if (!/^\d{4}$/.test(newTxPassword)) return toast.error('Mot de passe de transaction : 4 chiffres');
    if (!actionPassword) return toast.error("Saisissez le mot de passe d'action");
    try {
      await api.put(`/admin/users/${userModal}/transaction-password`, { password: newTxPassword, action_password: actionPassword });
      toast.success('Mot de passe de transaction modifié ✅'); setNewTxPassword(''); setActionPassword(''); refreshUserDetail(userModal);
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  // ── Settings ──
  const saveSettings = async () => {
    try {
      await api.put('/admin/settings', { cle: 'min_depot', valeur: settings.min_depot });
      toast.success('Minimum de dépôt sauvegardé ✅');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur — exécutez fixes.sql dans Supabase');
    }
  };

  const uploadMusic = async () => {
    if (!musicFile) { toast.error('Choisissez un fichier audio'); return; }
    setMusicUploading(true);
    try {
      const fd = new FormData();
      fd.append('music', musicFile);
      const res = await api.post('/admin/roue-music', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      setSettings(s => ({ ...s, roue_music_url: res.data.url }));
      setMusicFile(null);
      toast.success('Musique de la Roue enregistrée ✅');
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error
        || (err.code === 'ECONNABORTED' ? 'Envoi trop long (fichier trop lourd ou connexion lente) — réessayez avec un fichier plus léger'
        : status === 404 ? 'Route introuvable — le serveur doit être redémarré après la mise à jour'
        : status === 413 ? 'Fichier trop volumineux (20 Mo maximum)'
        : status ? `Erreur ${status} lors de l'envoi`
        : 'Erreur réseau lors de l\'envoi');
      toast.error(msg);
    } finally {
      setMusicUploading(false);
    }
  };

  const removeMusic = async () => {
    try {
      await api.delete('/admin/roue-music');
      setSettings(s => ({ ...s, roue_music_url: '' }));
      toast.success('Musique supprimée');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur');
    }
  };

  const saveCommissions = async () => {
    try {
      await Promise.all([
        api.put('/admin/settings', { cle: 'commission_niveau1', valeur: settings.commission_niveau1 ?? '10' }),
        api.put('/admin/settings', { cle: 'commission_niveau2', valeur: settings.commission_niveau2 ?? '5' }),
        api.put('/admin/settings', { cle: 'commission_niveau3', valeur: settings.commission_niveau3 ?? '2' }),
      ]);
      toast.success('Commissions de parrainage sauvegardées ✅');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur — exécutez fixes.sql dans Supabase');
    }
  };

  const saveSupport = async () => {
    try {
      await api.put('/admin/settings', { cle: 'support_telegram', valeur: settings.support_telegram ?? '' });
      toast.success('Lien du support sauvegardé ✅');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur — exécutez fixes.sql dans Supabase');
    }
  };

  const saveCommunity = async () => {
    try {
      await Promise.all([
        api.put('/admin/settings', { cle: 'communaute_telegram', valeur: settings.communaute_telegram ?? '' }),
        api.put('/admin/settings', { cle: 'communaute_whatsapp', valeur: settings.communaute_whatsapp ?? '' }),
      ]);
      toast.success('Liens de la communauté sauvegardés ✅');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur — exécutez fixes.sql dans Supabase');
    }
  };

  // ── Plans ──
  const openPlanModal = (plan = null) => {
    setPlanImageFile(null);
    if (plan) {
      setPlanForm({ nom: plan.nom, prix: plan.prix, duree_jours: plan.duree_jours, rendement_journalier: plan.rendement_journalier });
      setPlanImagePreview(plan.image_url ? `/uploads/${plan.image_url}` : null);
      setPlanModal(plan.id);
    } else {
      setPlanForm({ nom: '', prix: '', duree_jours: '', rendement_journalier: '' });
      setPlanImagePreview(null);
      setPlanModal('new');
    }
  };
  const handlePlanFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Sélectionnez une image');
    setPlanImageFile(file);
    setPlanImagePreview(URL.createObjectURL(file));
  };
  const savePlan = async () => {
    try {
      const fd = new FormData();
      fd.append('nom', planForm.nom);
      fd.append('prix', planForm.prix);
      fd.append('duree_jours', planForm.duree_jours);
      fd.append('rendement_journalier', planForm.rendement_journalier);
      if (planImageFile) fd.append('image', planImageFile);
      const cfg = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (planModal === 'new') {
        await api.post('/admin/plans', fd, cfg); toast.success('Plan créé ✅');
      } else {
        await api.put(`/admin/plans/${planModal}`, fd, cfg); toast.success('Plan modifié ✅');
      }
      setPlanModal(null); setPlanImageFile(null); setPlanImagePreview(null); loadAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };
  const deletePlan = async (id) => {
    if (!confirm('Supprimer ce plan ?')) return;
    try { await api.delete(`/admin/plans/${id}`); toast.success('Plan supprimé'); loadAll(); }
    catch { toast.error('Erreur'); }
  };

  // ── Annonces images ──
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Sélectionnez une image');
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const uploadAnnonce = async () => {
    if (!imageFile) return toast.error('Sélectionnez une image');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      await api.post('/admin/annonces', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Affiche publiée ✅');
      setImageFile(null);
      setImagePreview(null);
      if (fileRef.current) fileRef.current.value = '';
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur — exécutez fixes.sql dans Supabase');
    } finally { setUploading(false); }
  };

  const toggleAnnonce = async (ann) => {
    try {
      await api.put(`/admin/annonces/${ann.id}`, { actif: !ann.actif });
      toast.success(ann.actif ? 'Affiche masquée' : 'Affiche visible ✅'); loadAll();
    } catch { toast.error('Erreur'); }
  };

  const deleteAnnonce = async (id) => {
    if (!confirm('Supprimer cette affiche ?')) return;
    try { await api.delete(`/admin/annonces/${id}`); toast.success('Affiche supprimée'); loadAll(); }
    catch { toast.error('Erreur'); }
  };

  // ── FAQ ──
  const openFaqModal = (faq = null) => {
    setFaqImageFile(null);
    setFaqRemoveImage(false);
    if (faq) {
      setFaqForm({ question: faq.question || '', reponse: faq.reponse || '', ordre: faq.ordre ?? '' });
      setFaqImagePreview(faq.image ? `/uploads/${faq.image}` : null);
      setFaqModal(faq.id);
    } else {
      setFaqForm({ question: '', reponse: '', ordre: '' });
      setFaqImagePreview(null);
      setFaqModal('new');
    }
  };
  const handleFaqFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Sélectionnez une image');
    setFaqImageFile(file);
    setFaqRemoveImage(false);
    setFaqImagePreview(URL.createObjectURL(file));
  };
  const saveFaq = async () => {
    if (!faqForm.question.trim()) return toast.error('La question est requise');
    try {
      const fd = new FormData();
      fd.append('question', faqForm.question);
      fd.append('reponse', faqForm.reponse);
      if (faqForm.ordre !== '') fd.append('ordre', faqForm.ordre);
      if (faqImageFile) fd.append('image', faqImageFile);
      if (faqRemoveImage) fd.append('remove_image', 'true');
      const cfg = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (faqModal === 'new') {
        await api.post('/admin/faq', fd, cfg); toast.success('Question ajoutée ✅');
      } else {
        await api.put(`/admin/faq/${faqModal}`, fd, cfg); toast.success('Question modifiée ✅');
      }
      setFaqModal(null); setFaqImageFile(null); setFaqImagePreview(null); setFaqRemoveImage(false); loadAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur — exécutez faq.sql dans Supabase'); }
  };
  const deleteFaq = async (id) => {
    if (!confirm('Supprimer cette question ?')) return;
    try { await api.delete(`/admin/faq/${id}`); toast.success('Question supprimée'); loadAll(); }
    catch { toast.error('Erreur'); }
  };

  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));
  const statusColor = { valide: 'green', en_attente: 'yellow', rejete: 'red' };

  const TABS = [
    { key: 'dashboard', label: 'Dashboard', icon: 'fa-tachometer-alt' },
    { key: 'depots', label: 'Dépôts', icon: 'fa-arrow-down', badge: depots.filter(d => d.statut === 'en_attente').length },
    { key: 'retraits', label: 'Retraits', icon: 'fa-hand-holding-usd', badge: retraits.filter(r => r.statut === 'en_attente').length },
    { key: 'demo', label: 'Recharges Démo', icon: 'fa-dice', badge: demoRecharges.filter(r => r.statut === 'en_attente').length },
    { key: 'cadeaux', label: 'Cadeaux VIP', icon: 'fa-gift', badge: cadeaux.filter(c => c.statut === 'en_attente').length },
    { key: 'transactions', label: 'Transactions', icon: 'fa-receipt' },
    { key: 'roue', label: 'Roue', icon: 'fa-dharmachakra' },
    { key: 'users', label: 'Utilisateurs', icon: 'fa-users' },
    { key: 'posts', label: 'Posts', icon: 'fa-newspaper', badge: posts.filter(p => p.statut === 'en_attente').length },
    { key: 'plans', label: 'Plans VIP', icon: 'fa-chart-line' },
    { key: 'annonces', label: 'Affiches', icon: 'fa-image' },
    { key: 'faq', label: 'FAQ', icon: 'fa-question-circle' },
    { key: 'settings', label: 'Paramètres', icon: 'fa-cog' },
  ];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-dark)' }}>
      <div className="loading-spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>

      {/* Modal Gestion utilisateur */}
      {userModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 460, margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700 }}>Gestion de l'utilisateur</h3>
              <button onClick={() => { setUserModal(null); setUserDetail(null); }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>
                <i className="fas fa-times" />
              </button>
            </div>

            {userDetailLoading && <div style={{ textAlign: 'center', padding: 30 }}><div className="loading-spinner" /></div>}

            {userDetail && (
              <>
                {/* Infos */}
                <div className="card" style={{ padding: 16, marginBottom: 14 }}>
                  <p style={{ fontWeight: 700, fontSize: 16 }}>{userDetail.user.nom} {userDetail.user.role === 'admin' && <span className="badge badge-blue" style={{ marginLeft: 6 }}>Admin</span>}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{userDetail.user.telephone} • {userDetail.user.pays}</p>
                  <p style={{ color: 'var(--green-primary)', fontWeight: 700, fontSize: 18, marginTop: 6 }}>{fmt(userDetail.user.solde)} FCFA</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Code parrainage : <strong>{userDetail.user.code_parrainage || '—'}</strong></p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Inscrit le {new Date(userDetail.user.date_inscription).toLocaleDateString('fr-FR')}</p>
                </div>

                {/* Statistiques */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  {[
                    { label: 'Parrain', value: userDetail.parrain ? userDetail.parrain.nom : 'Aucun', sub: userDetail.parrain?.telephone },
                    { label: 'Gains parrainage', value: `${fmt(userDetail.gains_parrainage)} FCFA` },
                    { label: 'Filleuls niv. 1', value: userDetail.filleuls.niveau1 },
                    { label: 'Filleuls niv. 2', value: userDetail.filleuls.niveau2 },
                    { label: 'Filleuls niv. 3', value: userDetail.filleuls.niveau3 },
                    { label: 'Total déposé', value: `${fmt(userDetail.total_depots)} FCFA` },
                    { label: 'Total retiré', value: `${fmt(userDetail.total_retraits)} FCFA` },
                    { label: 'MDP transaction', value: userDetail.transaction_password_set ? 'Défini' : 'Non défini' },
                  ].map((s) => (
                    <div key={s.label} style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: '10px 12px' }}>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</p>
                      <p style={{ fontSize: 14, fontWeight: 700 }}>{s.value}</p>
                      {s.sub && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.sub}</p>}
                    </div>
                  ))}
                </div>

                {/* Plans achetés */}
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Plans d'investissement ({userDetail.plans.length})</p>
                  {userDetail.plans.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucun plan acheté</p>}
                  {userDetail.plans.map((pl) => (
                    <div key={pl.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <span style={{ fontSize: 13 }}>{pl.nom} <span className={`badge badge-${statusColor[pl.statut] || 'yellow'}`} style={{ marginLeft: 4 }}>{pl.statut}</span></span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(pl.montant)} FCFA</span>
                    </div>
                  ))}
                </div>

                {/* Transactions de l'utilisateur (solde avant / après) */}
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Transactions</p>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <select value={utxPeriod} onChange={e => setUtxPeriod(e.target.value)} style={{ flex: 1, minWidth: 120, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12 }}>
                      <option value="all">Toute la période</option>
                      <option value="today">Aujourd'hui</option>
                      <option value="7">7 derniers jours</option>
                      <option value="30">30 derniers jours</option>
                    </select>
                    <select value={utxType} onChange={e => setUtxType(e.target.value)} style={{ flex: 1, minWidth: 120, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12 }}>
                      <option value="all">Tous les types</option>
                      <option value="depot">Dépôt</option>
                      <option value="retrait">Retrait</option>
                      <option value="investissement">Investissement</option>
                      <option value="revenu_journalier">Revenu investissement</option>
                      <option value="parrainage">Commission parrainage</option>
                      <option value="bonus">Bonus roue</option>
                      <option value="gain_roue">Gain roue</option>
                      <option value="mise_roue">Mise roue</option>
                    </select>
                  </div>
                  {userTxLoading && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chargement…</p>}
                  {!userTxLoading && (() => {
                    const now = new Date();
                    let start = null;
                    if (utxPeriod === 'today') { start = new Date(); start.setHours(0, 0, 0, 0); }
                    else if (utxPeriod === '7' || utxPeriod === '30') { start = new Date(now.getTime() - parseInt(utxPeriod) * 86400000); }
                    const list = userTx.filter(t =>
                      (utxType === 'all' || t.kind === utxType) &&
                      (!start || new Date(t.date) >= start)
                    );
                    if (list.length === 0) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucune transaction</p>;
                    return list.map(t => (
                      <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</span>
                            {t.statut && t.statut !== 'valide' && <span className={`badge badge-${statusColor[t.statut] || 'yellow'}`} style={{ marginLeft: 6 }}>{t.statut}</span>}
                            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.date ? new Date(t.date).toLocaleString('fr-FR') : '—'}</p>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: t.sens === '-' ? 'var(--red, #ef4444)' : 'var(--green-primary)' }}>
                            {t.sens}{fmt(t.montant)} FCFA
                          </span>
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          Solde : {fmt(t.solde_avant)} → <strong style={{ color: 'var(--text-primary)' }}>{fmt(t.solde_apres)} FCFA</strong>
                        </p>
                      </div>
                    ));
                  })()}
                </div>

                {/* Mot de passe d'action (requis pour toute action sensible) */}
                <div className="input-group" style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid var(--secondary, #F5C518)', background: 'rgba(245,197,24,0.08)' }}>
                  <label style={{ fontWeight: 700 }}><i className="fas fa-shield-alt" style={{ marginRight: 6 }} />Mot de passe d'action</label>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Requis pour créditer, réduire ou modifier les informations ci-dessous.</p>
                  <input type="password" autoComplete="new-password" placeholder="Mot de passe d'action" value={actionPassword} onChange={e => setActionPassword(e.target.value)} />
                </div>

                {/* Actions solde */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div className="input-group">
                    <label>Créditer (FCFA)</label>
                    <input type="number" placeholder="Montant" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} />
                    <button className="btn btn-primary" onClick={handleCreditUser} style={{ padding: '10px', marginTop: 8 }}><i className="fas fa-plus" /> Créditer</button>
                  </div>
                  <div className="input-group">
                    <label>Réduire (FCFA)</label>
                    <input type="number" placeholder="Montant" value={debitAmount} onChange={e => setDebitAmount(e.target.value)} />
                    <button className="btn btn-outline" onClick={handleDebitUser} style={{ padding: '10px', marginTop: 8 }}><i className="fas fa-minus" /> Réduire</button>
                  </div>
                </div>

                {/* Mot de passe connexion */}
                <div className="input-group" style={{ marginBottom: 12 }}>
                  <label>Nouveau mot de passe de connexion</label>
                  <input type="text" placeholder="6 caractères minimum" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                  <button className="btn btn-outline" onClick={handleChangePassword} style={{ padding: '10px', marginTop: 8 }}><i className="fas fa-key" /> Modifier le mot de passe</button>
                </div>

                {/* Mot de passe transaction */}
                <div className="input-group">
                  <label>Nouveau mot de passe de transaction (4 chiffres)</label>
                  <input type="text" inputMode="numeric" maxLength={4} placeholder="Ex: 1234" value={newTxPassword} onChange={e => setNewTxPassword(e.target.value.replace(/\D/g, ''))} />
                  <button className="btn btn-outline" onClick={handleChangeTxPassword} style={{ padding: '10px', marginTop: 8 }}><i className="fas fa-lock" /> Modifier le code transaction</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Plan */}
      {planModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420 }}>
            <h3 style={{ fontWeight: 700, marginBottom: 20 }}>{planModal === 'new' ? 'Nouveau plan' : 'Modifier le plan'}</h3>
            {[
              { key: 'nom', label: 'Nom du plan', type: 'text', placeholder: 'Ex: VIP 1' },
              { key: 'prix', label: 'Prix (FCFA)', type: 'number', placeholder: 'Ex: 1000' },
              { key: 'duree_jours', label: 'Durée (jours)', type: 'number', placeholder: 'Ex: 30' },
              { key: 'rendement_journalier', label: 'Rendement journalier (%)', type: 'number', placeholder: 'Ex: 1.5' },
            ].map(f => (
              <div className="input-group" key={f.key} style={{ marginBottom: 12 }}>
                <label>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={planForm[f.key]} onChange={e => setPlanForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="input-group" style={{ marginBottom: 12 }}>
              <label>Image du plan (logo / visuel)</label>
              <div
                onClick={() => planFileRef.current?.click()}
                style={{ borderRadius: 12, border: '1px dashed var(--border-color)', background: 'rgba(0,0,0,0.03)', minHeight: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
              >
                {planImagePreview ? (
                  <img src={planImagePreview} alt="Aperçu" style={{ width: '100%', maxHeight: 160, objectFit: 'cover' }} />
                ) : (
                  <>
                    <i className="fas fa-image" style={{ fontSize: 30, color: 'var(--text-muted)', marginBottom: 6 }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Cliquez pour choisir une image</p>
                  </>
                )}
              </div>
              <input ref={planFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePlanFileChange} />
              {planImagePreview && (
                <button type="button" onClick={() => { setPlanImageFile(null); setPlanImagePreview(null); if (planFileRef.current) planFileRef.current.value = ''; }} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 12 }}>
                  <i className="fas fa-times" /> Retirer l'image
                </button>
              )}
            </div>
            {planForm.prix && planForm.rendement_journalier && (
              <p style={{ fontSize: 12, color: 'var(--green-primary)', marginBottom: 12 }}>
                Revenu/j : {fmt(parseFloat(planForm.prix || 0) * parseFloat(planForm.rendement_journalier || 0) / 100)} FCFA
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setPlanModal(null)} style={{ flex: 1, padding: '12px' }}>Annuler</button>
              <button className="btn btn-primary" onClick={savePlan} style={{ flex: 1, padding: '12px' }}>
                {planModal === 'new' ? 'Créer' : 'Modifier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal FAQ */}
      {faqModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 20 }}>{faqModal === 'new' ? 'Nouvelle question' : 'Modifier la question'}</h3>
            <div className="input-group" style={{ marginBottom: 12 }}>
              <label>Question</label>
              <input type="text" placeholder="Ex: Comment déposer de l'argent ?" value={faqForm.question} onChange={e => setFaqForm(p => ({ ...p, question: e.target.value }))} />
            </div>
            <div className="input-group" style={{ marginBottom: 12 }}>
              <label>Réponse</label>
              <textarea rows={6} placeholder="Tapez le contenu de la réponse..." value={faqForm.reponse} onChange={e => setFaqForm(p => ({ ...p, reponse: e.target.value }))} style={{ resize: 'vertical', width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.03)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }} />
            </div>
            <div className="input-group" style={{ marginBottom: 12 }}>
              <label>Ordre d'affichage (plus petit = en haut)</label>
              <input type="number" placeholder="Ex: 1" value={faqForm.ordre} onChange={e => setFaqForm(p => ({ ...p, ordre: e.target.value }))} />
            </div>
            <div className="input-group" style={{ marginBottom: 12 }}>
              <label>Image dans la réponse (optionnel)</label>
              <div
                onClick={() => faqFileRef.current?.click()}
                style={{ borderRadius: 12, border: '1px dashed var(--border-color)', background: 'rgba(0,0,0,0.03)', minHeight: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
              >
                {faqImagePreview ? (
                  <img src={faqImagePreview} alt="Aperçu" style={{ width: '100%', maxHeight: 200, objectFit: 'contain' }} />
                ) : (
                  <>
                    <i className="fas fa-image" style={{ fontSize: 30, color: 'var(--text-muted)', marginBottom: 6 }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Cliquez pour choisir une image</p>
                  </>
                )}
              </div>
              <input ref={faqFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFaqFileChange} />
              {faqImagePreview && (
                <button type="button" onClick={() => { setFaqImageFile(null); setFaqImagePreview(null); setFaqRemoveImage(true); if (faqFileRef.current) faqFileRef.current.value = ''; }} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 12 }}>
                  <i className="fas fa-times" /> Retirer l'image
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setFaqModal(null)} style={{ flex: 1, padding: '12px' }}>Annuler</button>
              <button className="btn btn-primary" onClick={saveFaq} style={{ flex: 1, padding: '12px' }}>
                {faqModal === 'new' ? 'Ajouter' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 22 }}>
            <i className="fas fa-shield-alt" style={{ color: 'var(--blue-primary)', marginRight: 10 }} />Administration
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            GIFETAL PRO
            {lastUpdated && (
              <span style={{ marginLeft: 10, fontSize: 11, opacity: 0.7 }}>
                · Actualisé à {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refreshStats} disabled={refreshing} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--green-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <i className={`fas fa-sync-alt ${refreshing ? 'fa-spin' : ''}`} style={{ marginRight: 5 }} />Actualiser
          </button>
          <button onClick={() => navigate('/')} style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <i className="fas fa-home" /> Accueil
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '9px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, position: 'relative',
            background: tab === t.key ? 'linear-gradient(135deg,var(--green-primary),var(--green-dark))' : 'rgba(0,0,0,0.05)',
            color: tab === t.key ? '#fff' : 'var(--text-muted)',
          }}>
            <i className={`fas ${t.icon}`} style={{ marginRight: 5 }} />{t.label}
            {t.badge > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── DASHBOARD ─── */}
      {tab === 'dashboard' && stats && (
        <div>
          {/* Alertes en attente */}
          {(stats.depots.en_attente > 0 || stats.retraits.en_attente > 0) && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              {stats.depots.en_attente > 0 && (
                <button onClick={() => setTab('depots')} style={{ flex: 1, minWidth: 160, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(245,197,24,0.4)', background: 'rgba(245,197,24,0.08)', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}>
                  <p style={{ color: '#f59e0b', fontWeight: 700, fontSize: 14 }}><i className="fas fa-clock" style={{ marginRight: 6 }} />{stats.depots.en_attente} dépôt(s) en attente</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{fmt(stats.depots.total_attente)} FCFA à valider → cliquer pour traiter</p>
                </button>
              )}
              {stats.retraits.en_attente > 0 && (
                <button onClick={() => setTab('retraits')} style={{ flex: 1, minWidth: 160, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}>
                  <p style={{ color: '#ef4444', fontWeight: 700, fontSize: 14 }}><i className="fas fa-hourglass-half" style={{ marginRight: 6 }} />{stats.retraits.en_attente} retrait(s) en attente</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{fmt(stats.retraits.total_attente)} FCFA à traiter → cliquer pour traiter</p>
                </button>
              )}
            </div>
          )}

          {/* Grille de stats principales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Utilisateurs total', value: stats.users.count, sub: `+${stats.users.today} aujourd'hui`, icon: 'fa-users', color: 'var(--green-primary)', bg: 'rgba(34,197,94,0.08)' },
              { label: 'Total dépôts validés', value: `${fmt(stats.depots.total)} FCFA`, sub: `${stats.depots.en_attente} en attente`, icon: 'fa-arrow-circle-down', color: 'var(--blue-primary)', bg: 'rgba(59,130,246,0.08)' },
              { label: 'Total retraits validés', value: `${fmt(stats.retraits.total)} FCFA`, sub: `${stats.retraits.en_attente} en attente`, icon: 'fa-hand-holding-usd', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
              { label: 'Plans VIP actifs', value: stats.commandes.count, sub: 'investissements en cours', icon: 'fa-chart-line', color: '#a855f7', bg: 'rgba(168,85,247,0.08)' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}33`, borderRadius: 14, padding: '16px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className={`fas ${s.icon}`} style={{ color: s.color, fontSize: 16 }} />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>{s.label}</p>
                </div>
                <p style={{ fontWeight: 800, fontSize: 18, color: s.color }}>{s.value}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Balance et soldes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 20 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}><i className="fas fa-balance-scale" style={{ marginRight: 6 }} />Balance nette plateforme</p>
              <p style={{ fontWeight: 800, fontSize: 22, color: stats.balance.nette >= 0 ? 'var(--green-primary)' : '#ef4444' }}>
                {stats.balance.nette >= 0 ? '+' : ''}{fmt(stats.balance.nette)} FCFA
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Dépôts validés − Retraits validés</p>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 20 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}><i className="fas fa-wallet" style={{ marginRight: 6 }} />Soldes cumulés des utilisateurs</p>
              <p style={{ fontWeight: 800, fontSize: 22, color: 'var(--blue-primary)' }}>{fmt(stats.balance.soldes_utilisateurs)} FCFA</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Total soldes de tous les comptes</p>
            </div>
          </div>

          {/* Raccourcis actions rapides */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--text-muted)' }}><i className="fas fa-bolt" style={{ marginRight: 6 }} />Actions rapides</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { label: 'Gérer dépôts', tab: 'depots', icon: 'fa-arrow-down', badge: stats.depots.en_attente },
                { label: 'Gérer retraits', tab: 'retraits', icon: 'fa-hand-holding-usd', badge: stats.retraits.en_attente },
                { label: 'Utilisateurs', tab: 'users', icon: 'fa-users' },
                { label: 'Transactions', tab: 'transactions', icon: 'fa-receipt' },
                { label: 'Plans VIP', tab: 'plans', icon: 'fa-chart-line' },
                { label: 'Paramètres', tab: 'settings', icon: 'fa-cog' },
              ].map(a => (
                <button key={a.tab} onClick={() => setTab(a.tab)} style={{ position: 'relative', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.03)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <i className={`fas ${a.icon}`} style={{ marginRight: 5 }} />{a.label}
                  {a.badge > 0 && <span style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 17, height: 17, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{a.badge}</span>}
                </button>
              ))}
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
            <i className="fas fa-sync-alt" style={{ marginRight: 4 }} />Actualisation automatique toutes les 30 secondes
          </p>
        </div>
      )}

      {/* ─── DÉPÔTS ─── */}
      {tab === 'depots' && (
        <div>
          {depots.filter(d => d.statut === 'en_attente').length > 0 && (
            <p style={{ color: '#f59e0b', fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
              <i className="fas fa-clock" style={{ marginRight: 6 }} />
              {depots.filter(d => d.statut === 'en_attente').length} dépôt(s) en attente
            </p>
          )}
          {depots.map(d => (
            <div key={d.id} className="card" style={{ marginBottom: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <p style={{ fontWeight: 700 }}>{d.nom} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>• {d.telephone}</span></p>
                  <p style={{ color: 'var(--green-primary)', fontWeight: 700, fontSize: 16 }}>{fmt(d.montant)} FCFA</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{d.pays} • {d.operateur} • {new Date(d.date_depot).toLocaleDateString('fr-FR')}</p>
                </div>
                <span className={`badge badge-${statusColor[d.statut] || 'yellow'}`}>{d.statut}</span>
              </div>
              {d.statut === 'en_attente' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => validateDepot(d.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'rgba(27,42,107,0.15)', color: 'var(--green-primary)', fontWeight: 600, cursor: 'pointer' }}>
                    <i className="fas fa-check" /> Valider
                  </button>
                  <button onClick={() => rejectDepot(d.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', color: 'var(--error)', fontWeight: 600, cursor: 'pointer' }}>
                    <i className="fas fa-times" /> Rejeter
                  </button>
                </div>
              )}
            </div>
          ))}
          {depots.length === 0 && <div className="empty-state"><i className="fas fa-inbox" /><p>Aucun dépôt</p></div>}
        </div>
      )}

      {/* ─── RETRAITS ─── */}
      {tab === 'retraits' && (
        <div>
          {retraits.map(r => (
            <div key={r.id} className="card" style={{ marginBottom: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <p style={{ fontWeight: 700 }}>{r.nom} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>• {r.pays || '—'}</span></p>
                  <p style={{ color: 'var(--blue-primary)', fontWeight: 700, fontSize: 18 }}>{fmt(r.montant_net)} FCFA <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>à payer</span></p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>Brut {fmt(r.montant)} • Frais {fmt(r.frais)} (10%)</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
                    <i className="fas fa-hashtag" style={{ marginRight: 4 }} />N° de retrait : <strong>{r.numero_compte || '—'}</strong> ({r.methode || '—'})
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    <i className="far fa-clock" style={{ marginRight: 4 }} />{new Date(r.date_demande).toLocaleString('fr-FR')}
                  </p>
                </div>
                <span className={`badge badge-${statusColor[r.statut] || 'yellow'}`}>{r.statut}</span>
              </div>
              {r.statut === 'en_attente' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => validateRetrait(r.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'rgba(27,42,107,0.15)', color: 'var(--green-primary)', fontWeight: 600, cursor: 'pointer' }}>
                    <i className="fas fa-check" /> Valider
                  </button>
                  <button onClick={() => rejectRetrait(r.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', color: 'var(--error)', fontWeight: 600, cursor: 'pointer' }}>
                    <i className="fas fa-times" /> Annuler & rembourser
                  </button>
                </div>
              )}
            </div>
          ))}
          {retraits.length === 0 && <div className="empty-state"><i className="fas fa-inbox" /><p>Aucun retrait</p></div>}
        </div>
      )}

      {/* ─── RECHARGES DÉMO (Roue) ─── */}
      {tab === 'demo' && (
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
            <i className="fas fa-info-circle" style={{ marginRight: 6 }} />
            Demandes de rechargement du solde démo (100 000 FCFA). Les mises et gains du mode démo n'apparaissent pas ici.
          </p>
          {demoRecharges.map(r => (
            <div key={r.id} className="card" style={{ marginBottom: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <p style={{ fontWeight: 700 }}>{r.nom} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>• {r.pays || '—'}</span></p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{r.telephone || '—'}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                    <i className="far fa-clock" style={{ marginRight: 4 }} />{new Date(r.date_demande).toLocaleString('fr-FR')}
                  </p>
                </div>
                <span className={`badge badge-${statusColor[r.statut] || 'yellow'}`}>{r.statut}</span>
              </div>
              {r.statut === 'en_attente' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => validateDemoRecharge(r.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'rgba(27,42,107,0.15)', color: 'var(--green-primary)', fontWeight: 600, cursor: 'pointer' }}>
                    <i className="fas fa-check" /> Recharger (100 000)
                  </button>
                  <button onClick={() => rejectDemoRecharge(r.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', color: 'var(--error)', fontWeight: 600, cursor: 'pointer' }}>
                    <i className="fas fa-times" /> Rejeter
                  </button>
                </div>
              )}
            </div>
          ))}
          {demoRecharges.length === 0 && <div className="empty-state"><i className="fas fa-inbox" /><p>Aucune demande</p></div>}
        </div>
      )}

      {/* ─── CADEAUX VIP ─── */}
      {tab === 'cadeaux' && (
        <div>
          {cadeaux.filter(c => c.statut === 'en_attente').length > 0 && (
            <p style={{ color: '#f59e0b', fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
              <i className="fas fa-clock" style={{ marginRight: 6 }} />
              {cadeaux.filter(c => c.statut === 'en_attente').length} cadeau(x) en attente
            </p>
          )}
          {cadeaux.map(c => (
            <div key={c.id} className="card" style={{ marginBottom: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <p style={{ fontWeight: 700 }}>{c.nom} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>• {c.telephone}</span></p>
                  <p style={{ color: 'var(--green-primary)', fontWeight: 700, fontSize: 16 }}>{fmt(c.montant)} FCFA</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Cadeau VIP {c.niveau} • {new Date(c.date_demande).toLocaleDateString('fr-FR')}</p>
                </div>
                <span className={`badge badge-${statusColor[c.statut] || 'yellow'}`}>{c.statut}</span>
              </div>
              {c.statut === 'en_attente' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => validateCadeau(c.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'rgba(27,42,107,0.15)', color: 'var(--green-primary)', fontWeight: 600, cursor: 'pointer' }}>
                    <i className="fas fa-check" /> Valider & créditer
                  </button>
                  <button onClick={() => rejectCadeau(c.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', color: 'var(--error)', fontWeight: 600, cursor: 'pointer' }}>
                    <i className="fas fa-times" /> Rejeter
                  </button>
                </div>
              )}
            </div>
          ))}
          {cadeaux.length === 0 && <div className="empty-state"><i className="fas fa-inbox" /><p>Aucun cadeau réclamé</p></div>}
        </div>
      )}

      {/* ─── TRANSACTIONS ─── */}
      {tab === 'transactions' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <select value={txTypeFilter} onChange={e => setTxTypeFilter(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }}>
              <option value="all">Tous les types</option>
              <option value="depot">Dépôt</option>
              <option value="retrait">Retrait</option>
              <option value="investissement">Investissement</option>
              <option value="parrainage">Commission parrainage</option>
              <option value="revenu">Revenu investissement</option>
              <option value="bonus">Bonus roue</option>
              <option value="credit_admin">Crédit administrateur</option>
              <option value="cadeau_vip">Cadeau VIP</option>
              <option value="mise_roue">Mise roue</option>
            </select>
            <select value={txStatutFilter} onChange={e => setTxStatutFilter(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }}>
              <option value="all">Tous les statuts</option>
              <option value="valide">Validé</option>
              <option value="en_attente">En attente</option>
              <option value="rejete">Rejeté</option>
              <option value="actif">Actif</option>
            </select>
          </div>
          {transactions
            .filter(t => (txTypeFilter === 'all' || t.kind === txTypeFilter) && (txStatutFilter === 'all' || t.statut === txStatutFilter))
            .map(t => (
              <div key={t.id} className="card" style={{ marginBottom: 10, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{t.label}</p>
                    {t.user && <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t.user.nom} • {t.user.telephone}</p>}
                    <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{new Date(t.date).toLocaleString('fr-FR')} • {t.id}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700, fontSize: 15, color: t.sens === '+' ? 'var(--green-primary)' : 'var(--text-primary)' }}>{t.sens}{fmt(t.montant)}</p>
                    <span className={`badge badge-${statusColor[t.statut] || 'yellow'}`}>{t.statut}</span>
                  </div>
                </div>
              </div>
            ))}
          {transactions.length === 0 && <div className="empty-state"><i className="fas fa-inbox" /><p>Aucune transaction</p></div>}
        </div>
      )}

      {/* ─── ROUE DE LA FORTUNE (statistiques) ─── */}
      {tab === 'roue' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
            <i className="fas fa-dharmachakra" style={{ marginRight: 6, color: 'var(--green-primary)' }} />
            Gains de la plateforme générés par la <strong>roue tournante</strong> uniquement (mises encaissées − bonus reversés).
          </p>

          {/* Filtre de période */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { key: 'today', label: "Aujourd'hui" },
              { key: 'yesterday', label: 'Jour passé' },
              { key: '7days', label: '7 derniers jours' },
              { key: 'all', label: 'Tout' },
            ].map(p => (
              <button key={p.key} onClick={() => setWheelPeriod(p.key)} style={{
                padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                background: wheelPeriod === p.key ? 'linear-gradient(135deg,var(--green-primary),var(--green-dark))' : 'rgba(0,0,0,0.05)',
                color: wheelPeriod === p.key ? '#fff' : 'var(--text-muted)',
              }}>{p.label}</button>
            ))}
          </div>

          {wheelLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="loading-spinner" /></div>
          ) : (
            <>
              {/* Cartes récapitulatives */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div className="card" style={{ background: 'linear-gradient(135deg,rgba(27,42,107,0.12),rgba(0,0,0,0.06))' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Gain net plateforme</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: (wheelStats?.summary?.netGain ?? 0) >= 0 ? 'var(--green-primary)' : 'var(--error)' }}>
                    {fmt(wheelStats?.summary?.netGain)} F
                  </p>
                </div>
                <div className="card">
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Parties jouées (payantes)</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue-primary)' }}>{fmt(wheelStats?.summary?.paidPlays)}</p>
                </div>
                <div className="card">
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Mises encaissées</p>
                  <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--green-primary)' }}>+{fmt(wheelStats?.summary?.totalMises)} F</p>
                </div>
                <div className="card">
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Bonus reversés</p>
                  <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--error)' }}>−{fmt(wheelStats?.summary?.totalBonus)} F</p>
                </div>
              </div>

              {/* Courbe */}
              <div className="card" style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                  <i className="fas fa-chart-line" style={{ marginRight: 6, color: 'var(--green-primary)' }} />
                  Évolution du gain net {wheelPeriod === 'today' ? "(aujourd'hui, par heure)" : wheelPeriod === 'yesterday' ? '(jour passé, par heure)' : '(par jour)'}
                </p>
                <MiniLineChart
                  data={(wheelStats?.chart || []).map(c => ({ label: c.label, value: c.net }))}
                  color="var(--green-primary)"
                />
              </div>

              {/* Petit tableau récapitulatif */}
              <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                  <i className="fas fa-table" style={{ marginRight: 6, color: 'var(--blue-primary)' }} />Détail par {wheelPeriod === 'today' || wheelPeriod === 'yesterday' ? 'heure' : 'jour'}
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '6px 4px' }}>Période</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right' }}>Mises</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right' }}>Bonus</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right' }}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(wheelStats?.chart || []).filter(c => c.mises || c.bonus).map((c, i) => (
                      <tr key={i} style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        <td style={{ padding: '6px 4px', fontWeight: 600 }}>{c.label}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', color: 'var(--green-primary)' }}>+{fmt(c.mises)}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', color: 'var(--error)' }}>−{fmt(c.bonus)}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700, color: c.net >= 0 ? 'var(--green-primary)' : 'var(--error)' }}>{fmt(c.net)}</td>
                      </tr>
                    ))}
                    {!(wheelStats?.chart || []).some(c => c.mises || c.bonus) && (
                      <tr><td colSpan={4} style={{ padding: '14px 4px', textAlign: 'center', color: 'var(--text-muted)' }}>Aucune activité sur cette période</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Top joueurs */}
              <div className="card">
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                  <i className="fas fa-trophy" style={{ marginRight: 6, color: '#f59e0b' }} />Joueurs les plus actifs
                </p>
                {(wheelStats?.topPlayers || []).length === 0 ? (
                  <div style={{ padding: '14px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Aucun joueur sur cette période</div>
                ) : (
                  (wheelStats.topPlayers).map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: i < 3 ? '#f59e0b22' : 'rgba(0,0,0,0.05)', color: i < 3 ? '#f59e0b' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nom}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.plays} partie(s) · {fmt(p.totalMise)} F misés</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gain plateforme</p>
                        <p style={{ fontWeight: 700, fontSize: 13, color: p.net >= 0 ? 'var(--green-primary)' : 'var(--error)' }}>{fmt(p.net)} F</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── UTILISATEURS ─── */}
      {tab === 'users' && (
        <div>
          {/* Recherche + filtre pays */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px', position: 'relative' }}>
              <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }} />
              <input
                type="text"
                placeholder="Rechercher (nom, numéro, code…)"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }}
              />
            </div>
            <select
              value={userPays}
              onChange={e => setUserPays(e.target.value)}
              style={{ flex: '0 0 auto', minWidth: 140, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }}
            >
              <option value="">Tous les pays</option>
              {paysList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {users.map(u => (
            <div key={u.id} className="card" style={{ marginBottom: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 700 }}>{u.nom} {u.role === 'admin' && <span className="badge badge-blue" style={{ marginLeft: 6 }}>Admin</span>}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{u.telephone} • {u.pays}</p>
                  <p style={{ color: 'var(--green-primary)', fontWeight: 600, fontSize: 13 }}>{fmt(u.solde)} FCFA</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{new Date(u.date_inscription).toLocaleDateString('fr-FR')}</p>
                </div>
                <button onClick={() => openUserDetail(u.id)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'rgba(27,42,107,0.15)', color: 'var(--green-primary)', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                  <i className="fas fa-cog" /> Gérer
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && <div className="empty-state"><i className="fas fa-users" /><p>Aucun utilisateur</p></div>}
        </div>
      )}

      {/* ─── POSTS ─── */}
      {tab === 'posts' && (
        <div>
          {posts.map(p => (
            <div key={p.id} className="card" style={{ marginBottom: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, marginBottom: 4 }}>{p.nom}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{p.message}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>{new Date(p.date_creation).toLocaleDateString('fr-FR')}</p>
                </div>
                <span className={`badge badge-${statusColor[p.statut] || 'yellow'}`}>{p.statut}</span>
              </div>
              {p.statut === 'en_attente' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => validatePost(p.id)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'rgba(27,42,107,0.15)', color: 'var(--green-primary)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    <i className="fas fa-check" /> Valider
                  </button>
                  <button onClick={() => rejectPost(p.id)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', color: 'var(--error)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    <i className="fas fa-times" /> Rejeter
                  </button>
                </div>
              )}
            </div>
          ))}
          {posts.length === 0 && <div className="empty-state"><i className="fas fa-newspaper" /><p>Aucun post</p></div>}
        </div>
      )}

      {/* ─── PLANS VIP ─── */}
      {tab === 'plans' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontWeight: 700, fontSize: 15 }}><i className="fas fa-chart-line" style={{ color: 'var(--green-primary)', marginRight: 8 }} />Plans d'investissement ({plans.length})</p>
            <button onClick={() => openPlanModal()} className="btn btn-primary" style={{ padding: '9px 14px', fontSize: 12 }}>
              <i className="fas fa-plus" /> Ajouter
            </button>
          </div>
          {plans.map((plan, idx) => {
            const revJ = (plan.prix * plan.rendement_journalier) / 100;
            const revTotal = revJ * plan.duree_jours;
            const COLORS = ['#1B2A6B', '#000000', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];
            const color = COLORS[idx % COLORS.length];
            return (
              <div key={plan.id} className="card" style={{ marginBottom: 10, padding: '14px 16px', borderLeft: `3px solid ${color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  {plan.image_url && (
                    <img src={`/uploads/${plan.image_url}`} alt={plan.nom} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', marginRight: 12, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color }}>{plan.nom}</p>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Prix : <strong style={{ color: 'var(--text-primary)' }}>{fmt(plan.prix)} FCFA</strong></p>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Durée : <strong style={{ color: 'var(--text-primary)' }}>{plan.duree_jours}j</strong></p>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Rend. : <strong style={{ color: 'var(--green-primary)' }}>{plan.rendement_journalier}%/j</strong></p>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      +{fmt(revJ)} FCFA/j • Total : {fmt(revTotal)} FCFA
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openPlanModal(plan)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.15)', color: 'var(--blue-primary)', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                      <i className="fas fa-edit" />
                    </button>
                    <button onClick={() => deletePlan(plan.id)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', color: 'var(--error)', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {plans.length === 0 && (
            <div className="empty-state">
              <i className="fas fa-chart-line" />
              <p>Aucun plan — exécutez fixes.sql dans Supabase</p>
            </div>
          )}
        </div>
      )}

      {/* ─── AFFICHES (images) ─── */}
      {tab === 'annonces' && (
        <div>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
            <i className="fas fa-image" style={{ color: '#f59e0b', marginRight: 8 }} />Affiches du dashboard (images)
          </p>

          {/* Zone upload */}
          <div className="card" style={{ marginBottom: 20, padding: 20, border: '2px dashed rgba(27,42,107,0.4)' }}>
            <p style={{ fontWeight: 600, marginBottom: 14, color: 'var(--text-secondary)', fontSize: 14 }}>
              <i className="fas fa-cloud-upload-alt" style={{ color: 'var(--green-primary)', marginRight: 8 }} />
              Ajouter une nouvelle affiche
            </p>

            {/* Zone de clic pour choisir image */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                borderRadius: 14, border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.03)',
                height: imagePreview ? 'auto' : 140, minHeight: 140,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', overflow: 'hidden', marginBottom: 14, transition: 'all 0.2s',
              }}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Aperçu" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 14 }} />
              ) : (
                <>
                  <i className="fas fa-image" style={{ fontSize: 40, color: 'var(--text-muted)', marginBottom: 10 }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cliquez pour choisir une image</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>JPG, PNG, GIF — max 10 Mo</p>
                </>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              {imagePreview && (
                <button onClick={() => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="btn btn-outline" style={{ flex: 1, padding: '12px' }}>
                  <i className="fas fa-times" /> Changer
                </button>
              )}
              <button
                onClick={uploadAnnonce}
                disabled={!imageFile || uploading}
                className="btn btn-primary"
                style={{ flex: 1, padding: '12px', opacity: (!imageFile || uploading) ? 0.5 : 1 }}
              >
                {uploading
                  ? <><span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: 8 }} />Publication...</>
                  : <><i className="fas fa-paper-plane" style={{ marginRight: 8 }} />Publier l'affiche</>
                }
              </button>
            </div>
          </div>

          {/* Liste des affiches */}
          {annonces.length > 0 && (
            <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
              {annonces.length} affiche{annonces.length > 1 ? 's' : ''} publiée{annonces.length > 1 ? 's' : ''}
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {annonces.map(ann => (
              <div key={ann.id} style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border-color)', opacity: ann.actif ? 1 : 0.45, position: 'relative' }}>
                {ann.image ? (
                  <img
                    src={`/uploads/${ann.image}`}
                    alt="Affiche"
                    style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{ height: 160, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-image" style={{ fontSize: 36, color: 'var(--text-muted)' }} />
                  </div>
                )}
                {/* Badge statut */}
                <div style={{ position: 'absolute', top: 8, left: 8 }}>
                  <span style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 700,
                    background: ann.actif ? 'rgba(27,42,107,0.9)' : 'rgba(0,0,0,0.6)',
                    color: '#fff',
                  }}>
                    {ann.actif ? '● EN DIRECT' : '● Masqué'}
                  </span>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, padding: 8, background: 'var(--bg-card)' }}>
                  <button onClick={() => toggleAnnonce(ann)} style={{
                    flex: 1, padding: '7px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: ann.actif ? 'rgba(239,68,68,0.1)' : 'rgba(27,42,107,0.15)',
                    color: ann.actif ? 'var(--error)' : 'var(--green-primary)',
                  }}>
                    <i className={`fas ${ann.actif ? 'fa-eye-slash' : 'fa-eye'}`} /> {ann.actif ? 'Masquer' : 'Afficher'}
                  </button>
                  <button onClick={() => deleteAnnonce(ann.id)} style={{ padding: '7px 10px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.08)', color: 'var(--error)', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {annonces.length === 0 && (
            <div className="empty-state">
              <i className="fas fa-image" />
              <p>Aucune affiche — uploadez votre première image</p>
            </div>
          )}
        </div>
      )}

      {/* ─── FAQ ─── */}
      {tab === 'faq' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontWeight: 700, fontSize: 15 }}><i className="fas fa-question-circle" style={{ color: 'var(--green-primary)', marginRight: 8 }} />Questions fréquentes ({faqs.length})</p>
            <button onClick={() => openFaqModal()} className="btn btn-primary" style={{ padding: '9px 14px', fontSize: 12 }}>
              <i className="fas fa-plus" /> Ajouter
            </button>
          </div>
          {faqs.map(faq => (
            <div key={faq.id} className="card" style={{ marginBottom: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>#{faq.ordre ?? 0}</span>{faq.question}
                  </p>
                  {faq.reponse && (
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{faq.reponse}</p>
                  )}
                  {faq.image && (
                    <img src={`/uploads/${faq.image}`} alt={faq.question} style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', marginTop: 8 }} />
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => openFaqModal(faq)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.15)', color: 'var(--blue-primary)', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                    <i className="fas fa-edit" />
                  </button>
                  <button onClick={() => deleteFaq(faq.id)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', color: 'var(--error)', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {faqs.length === 0 && (
            <div className="empty-state">
              <i className="fas fa-question-circle" />
              <p>Aucune question — exécutez faq.sql dans Supabase puis ajoutez-en</p>
            </div>
          )}
        </div>
      )}

      {/* ─── PARAMÈTRES ─── */}
      {tab === 'settings' && (
        <div>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
            <i className="fas fa-cog" style={{ color: 'var(--blue-primary)', marginRight: 8 }} />Paramètres généraux
          </p>

          <div className="card" style={{ padding: 20, marginBottom: 12 }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>Dépôt minimum</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Montant minimal qu'un utilisateur peut déposer (en FCFA)</p>
            <div className="input-group" style={{ marginBottom: 16 }}>
              <label>Montant minimum (FCFA)</label>
              <input type="number" value={settings.min_depot || '500'} onChange={e => setSettings(s => ({ ...s, min_depot: e.target.value }))} placeholder="500" />
            </div>
            <button className="btn btn-primary" onClick={saveSettings} style={{ padding: '12px 24px' }}>
              <i className="fas fa-save" style={{ marginRight: 8 }} />Enregistrer
            </button>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 12 }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>
              <i className="fas fa-music" style={{ color: 'var(--blue-primary)', marginRight: 8 }} />Musique de la Roue
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
              Musique de fond jouée automatiquement lorsqu'un utilisateur ouvre la page de la Roue. Formats audio (MP3, etc.), 20 Mo maximum.
            </p>

            {settings.roue_music_url ? (
              <div style={{ marginBottom: 16 }}>
                <audio controls src={settings.roue_music_url} style={{ width: '100%', marginBottom: 10 }} />
                <button className="btn btn-secondary" onClick={removeMusic} style={{ padding: '8px 16px' }}>
                  <i className="fas fa-trash" style={{ marginRight: 8 }} />Supprimer la musique actuelle
                </button>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16, fontStyle: 'italic' }}>
                Aucune musique configurée pour le moment.
              </p>
            )}

            <div className="input-group" style={{ marginBottom: 16 }}>
              <label>{settings.roue_music_url ? 'Remplacer par un nouveau fichier' : 'Choisir un fichier audio'}</label>
              <input type="file" accept="audio/*" onChange={e => setMusicFile(e.target.files?.[0] || null)} />
            </div>
            <button className="btn btn-primary" onClick={uploadMusic} disabled={musicUploading || !musicFile} style={{ padding: '12px 24px' }}>
              <i className={`fas ${musicUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`} style={{ marginRight: 8 }} />
              {musicUploading ? 'Envoi…' : 'Enregistrer la musique'}
            </button>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 12 }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>
              <i className="fas fa-users" style={{ color: 'var(--green-primary)', marginRight: 8 }} />Commissions de parrainage
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
              Pourcentage versé au parrain sur chaque investissement de ses filleuls. Les nouvelles valeurs s'appliquent immédiatement à tous les achats suivants.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div className="input-group">
                <label>Niveau 1 (%)</label>
                <input type="number" min="0" step="0.1" value={settings.commission_niveau1 ?? '10'} onChange={e => setSettings(s => ({ ...s, commission_niveau1: e.target.value }))} placeholder="10" />
              </div>
              <div className="input-group">
                <label>Niveau 2 (%)</label>
                <input type="number" min="0" step="0.1" value={settings.commission_niveau2 ?? '5'} onChange={e => setSettings(s => ({ ...s, commission_niveau2: e.target.value }))} placeholder="5" />
              </div>
              <div className="input-group">
                <label>Niveau 3 (%)</label>
                <input type="number" min="0" step="0.1" value={settings.commission_niveau3 ?? '2'} onChange={e => setSettings(s => ({ ...s, commission_niveau3: e.target.value }))} placeholder="2" />
              </div>
            </div>
            <button className="btn btn-primary" onClick={saveCommissions} style={{ padding: '12px 24px' }}>
              <i className="fas fa-save" style={{ marginRight: 8 }} />Enregistrer les commissions
            </button>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 12 }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>
              <i className="fab fa-telegram" style={{ color: 'var(--blue-primary)', marginRight: 8 }} />Lien du support Telegram
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
              Lien ouvert lorsque l'utilisateur clique sur « Support Telegram » dans la page FAQ et Support. Laissez vide pour masquer le bouton.
            </p>
            <div className="input-group" style={{ marginBottom: 16 }}>
              <label>Lien Telegram</label>
              <input type="text" value={settings.support_telegram || ''} onChange={e => setSettings(s => ({ ...s, support_telegram: e.target.value }))} placeholder="https://t.me/votre_support" />
            </div>
            <button className="btn btn-primary" onClick={saveSupport} style={{ padding: '12px 24px' }}>
              <i className="fas fa-save" style={{ marginRight: 8 }} />Enregistrer le lien
            </button>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 12 }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>
              <i className="fas fa-users" style={{ color: 'var(--green-primary)', marginRight: 8 }} />Liens de la communauté
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
              Liens ouverts depuis la page « Rejoindre la communauté ». Laissez vide pour désactiver un bouton.
            </p>
            <div className="input-group" style={{ marginBottom: 12 }}>
              <label><i className="fab fa-telegram" style={{ marginRight: 6 }} />Lien Telegram</label>
              <input type="text" value={settings.communaute_telegram || ''} onChange={e => setSettings(s => ({ ...s, communaute_telegram: e.target.value }))} placeholder="https://t.me/votre_canal" />
            </div>
            <div className="input-group" style={{ marginBottom: 16 }}>
              <label><i className="fab fa-whatsapp" style={{ marginRight: 6 }} />Lien WhatsApp</label>
              <input type="text" value={settings.communaute_whatsapp || ''} onChange={e => setSettings(s => ({ ...s, communaute_whatsapp: e.target.value }))} placeholder="https://chat.whatsapp.com/votre_groupe" />
            </div>
            <button className="btn btn-primary" onClick={saveCommunity} style={{ padding: '12px 24px' }}>
              <i className="fas fa-save" style={{ marginRight: 8 }} />Enregistrer les liens
            </button>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 12 }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>
              <i className="fas fa-image" style={{ color: 'var(--green-primary)', marginRight: 8 }} />Logos des moyens de paiement
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
              Tous les moyens de paiement disponibles sont listés ci-dessous. Cliquez sur « Choisir un logo » pour associer une image à un opérateur.
            </p>

            {operatorsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><span className="loading-spinner" style={{ width: 28, height: 28, borderWidth: 3 }} /></div>
            ) : operators.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>Aucun moyen de paiement disponible pour le moment.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                {operators.map(op => (
                  <div key={op.operator_code} style={{ textAlign: 'center', padding: 12, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12 }}>
                    <div style={{ width: 56, height: 56, margin: '0 auto 8px', borderRadius: 12, overflow: 'hidden', background: '#fff', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {op.logo_url ? <img src={op.logo_url} alt={op.operator_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <i className="fas fa-image" style={{ color: 'var(--text-muted)' }} />}
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{op.operator_name}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>{op.operator_code}</p>
                    <label className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, padding: '7px 10px', cursor: 'pointer', width: '100%' }}>
                      {logoUploading === op.operator_code ? (
                        <span className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                      ) : (
                        <><i className="fas fa-upload" />{op.logo_url ? 'Changer' : 'Choisir un logo'}</>
                      )}
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={logoUploading === op.operator_code}
                        onChange={e => { uploadOperatorLogo(op, e.target.files[0]); e.target.value = ''; }} />
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 16, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p style={{ fontWeight: 600, fontSize: 13, color: '#f87171', marginBottom: 8 }}>
              <i className="fas fa-exclamation-triangle" style={{ marginRight: 6 }} />Requis : exécuter fixes.sql dans Supabase
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Si vous avez une erreur de sauvegarde, c'est que les tables <code>settings</code> et <code>annonces</code> n'existent pas encore. Allez dans <strong>Supabase → SQL Editor</strong> et exécutez le contenu du fichier <code>server/fixes.sql</code>.
            </p>
          </div>

          <div className="card" style={{ padding: 16, marginTop: 12 }}>
            <p style={{ fontWeight: 700, marginBottom: 12 }}>Probabilités de la roue</p>
            {[
              { label: '1 000 FCFA', prob: '0%', color: '#ef4444' },
              { label: '500 FCFA', prob: '0,001%', color: '#f59e0b' },
              { label: '200 FCFA', prob: '0,01%', color: '#a855f7' },
              { label: '100 FCFA', prob: '0,01%', color: '#000000' },
              { label: '50 FCFA', prob: '0,01%', color: '#1B2A6B' },
              { label: '0 FCFA', prob: '~99,96%', color: 'var(--text-muted)' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <span style={{ fontSize: 13, color: r.color, fontWeight: 600 }}>{r.label}</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.prob}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
