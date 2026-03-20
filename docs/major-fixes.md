# Correctifs majeurs — failles critiques résolues (explications techniques)

Ce document synthétise les correctifs majeurs apportés à **ChaosPizzaAPI** pour le rendre plus proche d’une API utilisable en contexte réel : sécurité, fiabilité, cohérence métier, et performance.

---

## 1) Injection SQL (SQLi) — requêtes concaténées → requêtes paramétrées

### Symptôme / faille

Dans une version initiale du projet, certaines requêtes SQL étaient construites via **concaténation de chaînes** (ex: `"... WHERE id = " + userInput`).

Ce pattern ouvre la porte à :

- fuite de données (lecture non autorisée),
- corruption/destruction de données (DROP/UPDATE),
- contournement de contrôles métier (ex: forcer un `id`),
- et plus globalement à une compromission de la base SQLite.

### Correctif appliqué

- Passage à des **requêtes paramétrées** côté sqlite (placeholders `?` + tableau de paramètres).

Exemple (version actuelle dans `orderManager.js`) :

- `db.get("SELECT stock, price FROM pizzas WHERE id = ?", [firstId], cb)`
- `db.run("UPDATE pizzas SET stock = ? WHERE id = ?", [row.stock - qty, firstId], cb)`
- `db.run("INSERT INTO orders (...) VALUES (?, 'CREATED', ?, ?)", [total, promo, customerEmail], cb)`

### Pourquoi ça corrige

Le driver SQLite sépare **le plan d’exécution SQL** des **données**. Les entrées utilisateur ne peuvent plus être interprétées comme du SQL.

Référence interne : `docs/adr/0001-requetes-sql-parametrees.md`.

---

## 2) ReDoS (Regular Expression DoS) — validation e-mail par regex

### Symptôme / faille

La validation d’e-mail reposait sur une regex « riche » susceptible de provoquer du **catastrophic backtracking**.
Avec des entrées spécialement forgées, on pouvait faire exploser le temps CPU passé dans l’évaluation de la regex → **déni de service**.

### Correctif appliqué

- Remplacement par une validation déterministe et bornée : parsing `localPart@domain`, contrôles de longueur, caractères autorisés, labels DNS, etc.
- Ajout de tests d’edge-cases pour éviter les régressions.

Implémentation actuelle : `isValidEmail`, `isValidLocalPart`, `isValidDomain` dans `orderManager.js`.

### Pourquoi ça corrige

Les boucles sont linéaires, les tailles sont bornées (254 pour l’e-mail, 64/253/63 selon segments), et il n’y a pas de moteur regex sujet au backtracking exponentiel.

Référence interne : `docs/adr/0002-prevention-redos-email.md`.

---

## 3) Bug critique de promo « FREEPIZZA » annulée par les fallbacks legacy

### Symptôme / faille

Le système de pricing mélangeait :

- une logique de promo qui fixait `total = 0` (`FREEPIZZA`),
- puis des _fallbacks legacy_ qui traitaient `total === 0` comme une erreur et forçaient un prix (ex: `10€`), ou recalculaient via une logique legacy.

Cela transformait une commande gratuite en commande payante.

### Correctif appliqué

- Conservation de l’intention métier : **si le total est à 0 à cause d’un code promo**, ne pas déclencher de fallback.

Dans l’implémentation actuelle (`orderManager.js`) :

- constante `PROMO_FREE_PIZZA`,
- condition : `if (total === 0 && order.promoCode !== PROMO_FREE_PIZZA) { ... }`

### Pourquoi ça corrige

On distingue :

- **total à 0 intentionnel** (promo),
- **total à 0 anormal** (erreur de pricing / item mal formé).

---

## 4) Cohérence fiscale et contrat API — séparation totalHT/totalTTC

### Symptôme / faille

Le modèle retournait un seul champ `total`, et certaines évolutions/bugs pouvaient conduire à :

- une confusion HT vs TTC,
- une double application de taxes (ou une inflation « appliquée à la lecture »),
- une difficulté à tester/valider le calcul.

### Correctif appliqué

- Retour explicite de :
  - `totalHT` (hors taxes)
  - `totalTTC` (TTC calculé via `config.TVA_RATE`)
- Arrondis centralisés via `utils.round`.
- Correction de comportements de transformation des totaux lors des lectures (refactoring de `applyInflationTax` → désormais arrondi, pas inflation “magique”).

Référence interne : `docs/adr/0004-separation-prix-ht-ttc-inflation.md`.

---

## 5) Performance — délai artificiel dans le traitement des commandes

### Symptôme / faille

Un délai artificiel (type `setTimeout(..., 300)`) existait dans le flux de `createOrder`.
Sous charge, ce type de temporisation :

- dégrade le débit (throughput),
- augmente les latences p95/p99,
- augmente le temps de vie des callbacks DB,
- amplifie les risques de saturation.

### Correctif appliqué

- Suppression du délai ; exécution immédiate des écritures DB.

Référence interne : `docs/adr/0005-suppression-delai-bloquant-performance.md` et `docs/performance.md`.

---

## 6) Performance DB — index manquant sur `orders(email)`

### Symptôme / faille

La route `GET /orders/user/:email` exécute :

- `SELECT * FROM orders WHERE email = ?`

Sans index, SQLite doit faire un **full table scan** : coût O(N) qui devient vite prohibitif avec beaucoup de commandes.

### Correctif appliqué

- Ajout de l’index :
  - `CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email)`

Implémentation actuelle : `database.js`.

### Pourquoi ça corrige

L’accès aux commandes d’un utilisateur devient logarithmique/optimisé (selon le planner SQLite) et évite un scan complet au-delà de quelques milliers de lignes.

---

## 7) Autres durcissements notables

### Validation de payload

- Rejet des commandes sans items (ou items vides) :
  - `if (!Array.isArray(order.items) || order.items.length === 0) return cb({ error: "invalid order" });`

### Contraintes de données (DB)

- Index unique sur `pizzas(name)` via :
  - `CREATE UNIQUE INDEX IF NOT EXISTS idx_pizzas_name_unique ON pizzas(name)`
- Insertion des pizzas par défaut en mode idempotent :
  - `INSERT OR IGNORE`.
