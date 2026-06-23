// Ponte verso NorthStar — l'app "seria" di orientamento e crescita professionale
// (https://github.com/GarikVolegov/NorthStar). SCHIERATI è il gioco gratuito che fa da
// porta d'ingresso; questa è l'unica fonte di verità per il link tracciato.
//
// Da confermare con il founder (vedi docs/marketing/tracking-e-link.md):
//   1. il DOMINIO di produzione di NorthStar;
//   2. il CODICE AFFILIATO per attribuire le iscrizioni che nascono dal gioco.
// NorthStar cattura il referral su /sign-up (`?ref=` o `?referralCode=`): per attribuire
// le iscrizioni, sostituire con `https://<dominio>/sign-up?ref=<codice>&utm_...`.
export const NORTHSTAR_URL =
  'https://ainorthstar.vercel.app/?utm_source=schierati&utm_medium=app&utm_campaign=fine-partita';
