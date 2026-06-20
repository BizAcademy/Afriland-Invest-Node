import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { saveRefCode } from './lib/cookies';

// Capturer le code de parrainage (?p=CODE) dès le chargement de la page,
// avant toute redirection du routeur, et le conserver 7 jours sur ce navigateur
// (localStorage + cookie). Ainsi, même si l'utilisateur ne s'inscrit pas tout de
// suite et revient plus tard, le code reste appliqué.
const refParam = new URLSearchParams(window.location.search).get('p');
let redirecting = false;
if (refParam) {
  saveRefCode(refParam);
  // Rediriger l'utilisateur invité directement vers la page d'inscription,
  // en conservant le code dans l'URL comme secours supplémentaire.
  if (!window.location.pathname.endsWith('/register')) {
    redirecting = true;
    const code = encodeURIComponent(refParam.trim().toUpperCase());
    window.location.replace(`/register?p=${code}`);
  }
}

if (!redirecting) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
