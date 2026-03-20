# Bilan du Projet

## L'évolution de la qualité

Ce document présente une comparaison de l'état initial et de l'état final du projet concernant la qualité du code, en s'appuyant sur les métriques remontées par SonarQube (SonarCloud).

### État Initial
Au début du projet, l'analyse statique du code (SonarQube) révélait plusieurs failles de sécurité, bugs et "code smells". Les principales problématiques étaient :
- **Vulnérabilités de sécurité** : Risques d'injection SQL sur les requêtes non préparées (`database.js`), et vulnérabilité aux attaques ReDoS liées aux expressions régulières complexes pour la validation des emails.
- **Fiabilité (Bugs)** : Mauvaise gestion asynchrone des erreurs, variables non définies, et problèmes d'incohérence mathématique sur des calculs d'inflation/TVA.
- **Maintenabilité (Code Smells)** : Logique fortement couplée, variables non utilisées, fonctions trop complexes (haute complexité cyclomatique), et un manque de conventions de code homogènes.
- **Couverture de code** : Initialement faible ou quasi inexistante, limitant notre capacité à refactoriser en toute sécurité.

*(Insérer ici une capture d'écran de l'état initial SonarQube : `![État initial SonarQube](./docs/images/sonar-initial.png)`)*

---

### État Final et Réduction de la Dette Technique
À la suite de différentes sessions de refactoring, de corrections de bugs et d'ajout de tests automatisés, la dette technique a été drastiquement réduite :

- **Sécurité [Note A]** :
  - Mise en place stricte de requêtes SQL paramétrées en base de données.
  - Résolution du pattern regex pour parer au risque ReDoS.
  - Aucun hotspot de sécurité restant (0 Vulnerabilities).
- **Fiabilité [Note A]** :
  - Retrait du timeout bloquant l'event-loop (correction Perf).
  - Validation robuste des données d'entrée (`orderManager`, `routes.js`).
  - Aucun Bug n'est relevé (0 Bugs).
- **Maintenabilité [Note A]** :
  - Extraction stricte de la logique métier hors des contrôleurs.
  - Suppression du code mort (déclarations inutilisées, logs consoles de débug).
  - Réduction drastique de la complexité (refactoring des "code smells" identifiés).
- **Couverture de Tests** : Amélioration significative grâce à l'implémentation de multiples suites Jest sur tous les modules majeurs (`orderManager`, `database`, `routes`).

*(Insérer ici une capture d'écran de l'état final SonarQube démontrant le clean rating : `![État final SonarQube](./docs/images/sonar-final.png)`)*

### Conclusion sur la Qualité
Le passage strict par la CI d'analyse SonarCloud a obligé l'équipe à revoir les fondements du code originel. La dette technique accumulée au tout début de l'implémentation de la "Chaos Pizza API" a aujourd'hui été gommée, assurant un projet plus pérenne, fiable, et extensible pour de futures intégrations.
