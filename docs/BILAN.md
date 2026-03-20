# Bilan du Projet

---

## Évolution de la Qualité

### État Initial

Au lancement du projet, l'analyse statique via **SonarQube** révélait un ensemble de failles de sécurité, de bugs et de _code smells_ significatifs, répartis sur quatre axes :

| Axe                   | Problèmes identifiés                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 🔴 **Sécurité**       | Injections SQL sur requêtes non préparées (`database.js`), vulnérabilité ReDoS liée aux regex de validation d'emails         |
| 🟠 **Fiabilité**      | Mauvaise gestion asynchrone des erreurs, variables non définies, incohérences sur les calculs d'inflation/TVA                |
| 🟡 **Maintenabilité** | Logique fortement couplée, variables inutilisées, fonctions à haute complexité cyclomatique, conventions de code hétérogènes |
| ⚪ **Couverture**     | Quasi inexistante, rendant tout refactoring risqué                                                                           |

---

### État Final

À l'issue des sessions de refactoring, de correction de bugs et d'implémentation de tests automatisés, la dette technique a été **drastiquement réduite** :

#### Sécurité — 0 Vulnerabilities

- Mise en place systématique de **requêtes SQL paramétrées**.
- Résolution du pattern regex vulnérable au **ReDoS**.
- Aucun hotspot de sécurité restant.

#### Fiabilité — 0 Bugs

- Suppression du timeout bloquant l'event-loop.
- Validation robuste des données d'entrée (`orderManager`, `routes.js`).
- Aucun bug détecté à l'analyse.

#### Maintenabilité

- Extraction stricte de la logique métier hors des contrôleurs.
- Suppression du code mort (imports inutilisés, `console.log` de debug).
- Réduction de la complexité cyclomatique sur l'ensemble des modules.

#### Couverture de Tests

- Implémentation de suites **Jest** couvrant tous les modules majeurs : `orderManager`, `database`, `routes`.
- Amélioration significative du taux de couverture global.

> _Capture d'écran — état final SonarQube (clean rating) :_
> ![État final SonarQube](/public/docs/etat_final.png)

---

## Correctifs majeurs — failles critiques résolues (explications techniques)

### 1) Injection SQL (SQLi) — requêtes concaténées → requêtes paramétrées

#### Symptôme / faille

Dans une version initiale du projet, certaines requêtes SQL étaient construites via **concaténation de chaînes** (ex: `"... WHERE id = " + userInput`).

Ce pattern ouvre la porte à :

- fuite de données (lecture non autorisée),
- corruption/destruction de données (DROP/UPDATE),
- contournement de contrôles métier (ex: forcer un `id`),

#### Correctif appliqué

- Passage à des **requêtes paramétrées** côté sqlite (placeholders `?` + tableau de paramètres).

Exemple (version actuelle dans `orderManager.js`) :

- `db.get("SELECT stock, price FROM pizzas WHERE id = ?", [firstId], cb)`
- `db.run("UPDATE pizzas SET stock = ? WHERE id = ?", [row.stock - qty, firstId], cb)`
- `db.run("INSERT INTO orders (...) VALUES (?, 'CREATED', ?, ?)", [total, promo, customerEmail], cb)`

#### Pourquoi ça corrige

Le driver SQLite sépare **le plan d’exécution SQL** des **données**. Les entrées utilisateur ne peuvent plus être interprétées comme du SQL.

Référence interne : `docs/adr/0001-requetes-sql-parametrees.md`.

---

### 2) Bug critique de promo « FREEPIZZA » annulée par les fallbacks legacy

#### Symptôme / faille

Le système de pricing mélangeait :

- une logique de promo qui fixait `total = 0` (`FREEPIZZA`),
- puis des _fallbacks legacy_ qui traitaient `total === 0` comme une erreur et forçaient un prix (ex: `10€`), ou recalculaient via une logique legacy.

Cela transformait une commande gratuite en commande payante.

#### Correctif appliqué

- Conservation de l’intention métier : **si le total est à 0 à cause d’un code promo**, ne pas déclencher de fallback.

Dans l’implémentation actuelle (`orderManager.js`) :

- constante `PROMO_FREE_PIZZA`,
- condition : `if (total === 0 && order.promoCode !== PROMO_FREE_PIZZA) { ... }`

#### Pourquoi ça corrige

On distingue :

- **total à 0 intentionnel** (promo),
- **total à 0 anormal** (erreur de pricing / item mal formé).

---

### 3) Cohérence fiscale et contrat API — séparation totalHT/totalTTC

#### Symptôme / faille

Le modèle retournait un seul champ `total`, et certaines évolutions/bugs pouvaient conduire à :

- une confusion HT vs TTC,
- une double application de taxes (ou une inflation « appliquée à la lecture »),
- une difficulté à tester/valider le calcul.

#### Correctif appliqué

- Retour explicite de :
  - `totalHT` (hors taxes)
  - `totalTTC` (TTC calculé via `config.TVA_RATE`)
- Arrondis centralisés via `utils.round`.
- Correction de comportements de transformation des totaux lors des lectures (refactoring de `applyInflationTax` → désormais arrondi, pas inflation “magique”).

Référence interne : `docs/adr/0004-separation-prix-ht-ttc-inflation.md`.

---

### 4) Performance — délai artificiel dans le traitement des commandes

#### Symptôme / faille

Un délai artificiel (type `setTimeout(..., 300)`) existait dans le flux de `createOrder`.
Sous charge, cela risque d'augmenter le temps de vie des callbacks DB et d'amplifier les risques de saturation.

#### Correctif appliqué

- Suppression du délai ; exécution immédiate des écritures DB.

Référence interne : `docs/adr/0005-suppression-delai-bloquant-performance.md` et `docs/performance.md`.

---

### 5) Performance DB — index manquant sur `orders(email)`

Ce bug est survenu à l'issue d'une mauvaise implémentation de correctif.

#### Symptôme / faille

La route `GET /orders/user/:email` exécute :

- `SELECT * FROM orders WHERE email = ?`

Sans index, SQLite doit faire un **full table scan** : coût O(N) qui devient vite prohibitif avec beaucoup de commandes.

#### Correctif appliqué

- Ajout de l’index :
  - `CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email)`

Implémentation actuelle : `database.js`.

#### Pourquoi ça corrige

L’accès aux commandes d’un utilisateur devient logarithmique/optimisé (selon le planner SQLite) et évite un scan complet au-delà de quelques milliers de lignes.

---

### 6) Autres durcissements notables

#### Validation de payload

- Rejet des commandes sans items (ou items vides) :
  - `if (!Array.isArray(order.items) || order.items.length === 0) return cb({ error: "invalid order" });`

#### Contraintes de données (DB)

- Index unique sur `pizzas(name)` via :
  - `CREATE UNIQUE INDEX IF NOT EXISTS idx_pizzas_name_unique ON pizzas(name)`
- Insertion des pizzas par défaut en mode idempotent :
  - `INSERT OR IGNORE`.

---

## Retour d'expérience

### Intégration Continue

La mise en place du workflow Git a globalement bien fonctionné, mais plusieurs difficultés ont émergé au cours du projet.

Une partie de l'équipe n'était pas suffisamment familière avec Git et le système de Merge Requests. Cela a engendré des incompréhensions sur le processus à suivre : quand créer une branche, comment soumettre une MR, comment réagir aux retours de la pipeline. Ce manque de maîtrise a ralenti certaines intégrations et nécessité un accompagnement ponctuel entre membres de l'équipe.

La difficulté la plus concrète a été une **MR mergée sans attendre la relecture d'un autre membre de l'équipe**. La pipeline SonarQube était bien configurée et le code l'avait passée, mais la revue humaine pourtant obligatoire dans notre processus n'avait pas eu lieu. Le code en question présentait des problèmes qui auraient pu être relevés lors de cette relecture.

Cela soulève un point d'amélioration clair : **exiger techniquement une approbation avant tout merge**, de façon à ce que le processus ne puisse pas être contourné, même involontairement.

---

### Refactoring du code existant

La nature du projet imposait une contrainte particulière : **améliorer sans tout réécrire**. Cette approche, bien que pragmatique, a nécessité un temps de prise en main du code existant avant de pouvoir intervenir dessus.

La présence de **timeouts inutiles** a par exemple demandé un minimum d'analyse pour comprendre leur origine avant de les supprimer. Rien de bloquant, mais sur du code peu documenté, il vaut mieux prendre le temps de comprendre plutôt que de modifier à l'aveugle.

Le bug d'**inflation à 5 %** et les problèmes sur les codes promotionnels ont suivi la même logique : identifier où le calcul était effectué, comprendre ce qui était attendu, puis corriger. Les corrections en elles-mêmes étaient assez simples une fois le code bien compris.

Enfin, le cas des **prix négatifs** a été identifié mais laissé de côté faute de temps. Ce choix était délibéré : le corriger proprement aurait demandé de toucher à la logique de calcul des prix, ce qui dépassait le périmètre du projet. Il reste documenté comme dette technique à traiter ultérieurement.
