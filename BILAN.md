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

> *Capture d'écran — état final SonarQube (clean rating) :*
> ![État final SonarQube](/public/docs/etat_final.png)

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
 
La présence de **timeouts inutiles** a par exemple demandé un minimum d'analyse pour comprendre leur origine avant de les supprimer sereinement. Rien de bloquant, mais sur du code peu documenté, il vaut mieux prendre le temps de comprendre plutôt que de modifier à l'aveugle.
 
Le bug d'**inflation à 5 %** et les problèmes sur les codes promotionnels ont suivi la même logique : identifier où le calcul était effectué, comprendre ce qui était attendu, puis corriger. Les corrections en elles-mêmes étaient assez simples une fois le code bien compris.
 
Enfin, le cas des **prix négatifs** a été identifié mais laissé de côté faute de temps. Ce choix était délibéré : le corriger proprement aurait demandé de toucher à la logique de calcul des prix, ce qui dépassait le périmètre du projet. Il reste documenté comme dette technique à traiter ultérieurement.