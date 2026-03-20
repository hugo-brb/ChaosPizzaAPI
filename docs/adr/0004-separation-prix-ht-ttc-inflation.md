# ADR 0004 : Séparation des prix en Total HT et TTC via Config

## Statut
Accepté

## Contexte
Afin de répondre à des exigences fiscales, la route `POST /orders` ne pouvait plus se contenter de renvoyer un simple prix de commande flou, défini lors du commit originel de `chaos-pizza-api`. Par ailleurs, il a été nécessaire d'adapter le système aux fluctuations économiques récentes. De même, un taux de TVA modifiable était requis et ne pouvait demeurer un aspect magique ou codé en dur.

## Décision
- Ajout de paramètres configurables dans le code : taux d'inflation (`inflationRates`) et de taxe sur la valeur ajoutée (`TVA`), avec évolution de la méthode de fixation et du calcul global.
- L'objet retourné au moment de la création d'ordre (`POST /orders`) ne comporte plus uniquement un champ `total`, mais remplace ceci par **`totalHT`** (Total Hors Taxes) et **`totalTTC`** (Toutes Taxes Comprises), voir `1a9a76e` et `8c50970`.

## Conséquences

### Positives
- **Conformité Réglementaire** : L'API distribue des détails clairs sur le coût fiscal du comportement d'achat, indispensable pour un terminal point de vente (POS).
- **Flexibilité / Scalabilité Économique** : En permettant à la TVA et l'inflation d'être extraites dans des configs externes, la maintenance se fait sans un lourd redéveloppement. Le logiciel gagne en portabilité pour l'international.
- **Clarification du contrat REST** : API plus stricte et plus descriptive.

### Négatives
- Ajout de logique de calcul en cascade et de conversions flottantes qui peut entraîner de discrètes erreurs d'arrondis si non traités (bien que réglé partiellement via des `utils.js` pour les montants).
- Casse temporaire de la compatibilité ascendante (breaking change sur le champ retourné `total`).
