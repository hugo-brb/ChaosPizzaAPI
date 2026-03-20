# ADR 0001 : Utilisation de requêtes SQL paramétrées

## Statut
Accepté

## Contexte
Initialement, l'accès à la base de données (SQLite) dans le fichier `database.js` se faisait en concaténant directement des chaînes de caractères avec des entrées provenant de l'utilisateur (par exemple, un email ou des identifiants). Cette pratique exposait gravement l'application aux attaques par Injection SQL (SQLi), permettant à un attaquant potentiel d'exécuter des commandes malveillantes en manipulant les entrées de l'API.

## Décision
Lors du commit `8c50970`, nous avons procédé à un refactoring de la couche d'accès aux données, consistant à remplacer toutes les concaténations non sécurisées par des **requêtes paramétrées** (parameterized statements). 

Désormais :
- Les valeurs dynamiques de la requête SQL sont substituées par des paramètres analytiques (ex: `?` pour SQLite).
- Les données brutes issues de l'API sont communiquées au driver de la base de données sous forme de tableau séparé de la requête elle-même. 
- L'interprétation des chaînes SQL se fait strictement séparément, bloquant ainsi l'exécution involontaire de code malveillant.

## Conséquences

### Positives :
- **Sécurité** : Élimination de la vulnérabilité d'injection SQL. La base est protégée contre la fraude.
- **Assainissement des données** : Le driver s'assure du bon typage et de l'échappement correct des variables passées en paramètres avant requête.
- **Réutilisabilité et Lisibilité** : Le corps des requêtes SQL reste visuellement intact, augmentant la lisibilité de celles-ci au sein du code JS. 

### Négatives :
- Nécessite d'adapter toute insertion, mise à jour ou sélection en base pour séparer les données des instructions avec ce format de tableau.
- Obligation de sensibiliser les futurs contributeurs sur cette bonne pratique pour éviter de recréer de nouvelles concaténations.
