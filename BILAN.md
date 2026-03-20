# Bilan du Projet

---

## Évolution de la Qualité

### État Initial

Au lancement du projet, l'analyse statique via **SonarQube** révélait un ensemble de failles de sécurité, de bugs et de *code smells* significatifs, répartis sur quatre axes :

| Axe | Problèmes identifiés |
|-----|----------------------|
| 🔴 **Sécurité** | Injections SQL sur requêtes non préparées (`database.js`), vulnérabilité ReDoS liée aux regex de validation d'emails |
| 🟠 **Fiabilité** | Mauvaise gestion asynchrone des erreurs, variables non définies, incohérences sur les calculs d'inflation/TVA |
| 🟡 **Maintenabilité** | Logique fortement couplée, variables inutilisées, fonctions à haute complexité cyclomatique, conventions de code hétérogènes |
| ⚪ **Couverture** | Quasi inexistante, rendant tout refactoring risqué |

---

### État Final

À l'issue des sessions de refactoring, de correction de bugs et d'implémentation de tests automatisés, la dette technique a été **drastiquement réduite** :

#### Sécurité — Note A · 0 Vulnerabilities

- Mise en place systématique de **requêtes SQL paramétrées**.
- Résolution du pattern regex vulnérable au **ReDoS**.
- Aucun hotspot de sécurité restant.

#### Fiabilité — Note A · 0 Bugs

- Suppression du timeout bloquant l'event-loop.
- Validation robuste des données d'entrée (`orderManager`, `routes.js`).
- Aucun bug détecté à l'analyse.

#### Maintenabilité — Note A

- Extraction stricte de la logique métier hors des contrôleurs.
- Suppression du code mort (imports inutilisés, `console.log` de debug).
- Réduction de la complexité cyclomatique sur l'ensemble des modules.

#### Couverture de Tests

- Implémentation de suites **Jest** couvrant tous les modules majeurs : `orderManager`, `database`, `routes`.
- Amélioration significative du taux de couverture global.

> 📸 *Capture d'écran — état final SonarQube (clean rating) :*
> ![État final SonarQube](/public/docs/etat_final.png)

---