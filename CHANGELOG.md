# Changelog

Toutes les modifications notables apportées à ce projet seront documentées dans ce fichier.

### Fonctionnalités (Features)
* **Frontend** : Ajout d'un champ de saisie pour renseigner l'adresse email dans le formulaire de commande.
* **Frontend** : Validation côté client de l'adresse email et gestion dynamique de l'état du bouton de validation de commande.
* **Frontend** : Simplification et mise à jour du style UI pour l'affichage des messages d'erreur.
* **API** : Ajout d'une route permettant de récupérer l'historique des commandes d'un utilisateur depuis son email (`/orders/user/:email`).
* **Commandes** : Sauvegarde de l'email du client dans la base de données lors d'une commande.
* **Prix et taxes** : Introduction de taux de TVA et d'inflation configurables.
* **Prix et taxes** : Ajout des champs `totalHT` et `totalTTC` dans les réponses de création de commande, en remplacement de l'ancien champ `total`.
* **Prix et taxes** : Ajout d'un système de TVA et séparation visuelle HT/TVA/TTC.
* **Frontend** : Ajout du script `utils.js` pour un formatage homogène et un arrondissement précis des prix sur l'interface client (`index.html`).
* **Promotions** : Ajout du code promotionnel `BOGO` (Buy One Get One) à la fonction de création de commandes.
* **Promotions** : Amélioration générale du système de codes promotionnels et petits ajustements (dont `FREEPIZZA`).
* **Intégration Continue (CI)** : Intégration de SonarCloud pour l'analyse de qualité du code.
* **Intégration Continue (CI)** : Mise en place des rapports de couverture de tests Jest dans le workflow de build.

### Corrections de bugs (Fixes)
* **Frontend** : Suppression de la restriction qui limitait la commande à une seule pizza de manière simultanée. Les commandes multiples (panier complet) sont dorénavant fonctionnelles.
* **Base de données** : Retrait de l'insertion de la pizza hawaïenne dans le jeu de données par défaut pour éviter de potentiels doublons ou conflits.
* **Performances/Tests de charge** : Mise à jour des scénarios de test Artillery pour une meilleure simulation du trafic.
* **Performances/Tests de charge** : Typage corrigé (retrait des guillemets) pour les variables aléatoires envoyées dans la configuration Artillery.
* **Base de données** : Sécurisation des requêtes en base avec des déclarations paramétrées (prévention d'injections).
* **Base de données** : Sécurisation de la structure pour vérifier la bonne existence de la colonne email.
* **Calculs** : Rectification d'un bug majeur d'inflation appliqué à répétition dans `getOrders`.
* **Calculs** : Ajustement sur le calcul global du ticket pour éviter la double taxe liée à l'inflation.
* **Calculs** : Résolution globale d'un bug précédent concernant le montant total.
* **Sécurité** : Suppression des vérifications d'adresses email basées sur des expressions régulières (Regex) instables pour empêcher les risques de ReDoS (Déni de service).
* **Qualité du code** : Différentes résolutions de retours d'analyse du code par SonarCloud (notamment dans `orderManager.js` et `utils.js`).
* **Promotions** : Résolution du comportement aléatoire et cassé qui empêchait l'application de certains codes de réduction.

### Performances (Perf)
* **Système global** : Retrait d'un timeout délibéré qui ralentissait artificiellement le système de gestion de commandes (`orderManager`).

### Tests
* Divers correctifs et résolutions de tests CI qui échouaient.
* Ajout de tests de base de données (`database.test.js`) pour garantir l'intégrité des données locales et des accès.
* Ajout de tests couvrant le code promotionnel BOGO.`
* Ajout de cas limites sur la validation de l'adresse email (Edge-cases) pour pallier les rapports SonarCloud.
* Mise à jour des tests pour le code promo `FREEPIZZA` suite au remaniement des calculs TTC.
* Adaptation des tests existants à l'intégration de la nouvelle TVA.
* Création initiale des tests unitaires et des tests d'API (`routes.test.js`).

### Documentation
* Ajout d'un système d'ADR (Architecture Decision Records) dans `docs/adr/` afin de formaliser et documenter en continu les choix forts d'architecture adoptés sur le projet.
* Amélioration du `README.md` pour clarifier la section des fonctionnalités et fournir une meilleure vue d'ensemble sur les points de terminaisons (endpoints) de l'API.
* Ajout d'un rapport complet d'analyse des performances (`performance.md`) avec comparatif "avant / après" concernant la tenue de charge.
* Documentation mise à jour sur les endpoints exposés (incluant la fonction historique utilisateur et les emails).

### Chores & Build
* Utilisation d'actions GitHub Workflow fixées sur des commits (SHA) pour une meilleure sécurité.
* Améliorations des exécutions du script de CI (dont ajouts de `npm rebuild sqlite3` pour les compatibilités CI et `npm install --ignore-scripts`).