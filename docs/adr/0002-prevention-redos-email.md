# ADR 0002 : Remplacement de la validation e-mail (Prévention ReDoS)

## Statut
Accepté

## Contexte
La validation des adresses e-mail soumises par les clients (lors de la création d'une commande) s'appuyait sur une expression régulière (Regex) complexe. Durant les audits de configuration (comme ceux de SonarCloud), il est apparu que ce type d'expression pouvait engendrer un temps de traitement exponentiel (Catastrophic Backtracking) sur des chaînes malicieusement forgées, provoquant alors un déni de service de l'application (attaque ReDoS - Regular Expression Denial of Service). 

## Décision
À l'intégration du commit (`5037698`), nous avons supprimé la validation par regex complexe et vulnérable de l'e-mail des clients, au profit de méthodes de vérification plus basiques, voire déléguées à l'API de validation du navigateur en amont (ou l'utilisation de méthodes internes sans backtracking).

## Conséquences

### Positives
- **Résilience et Sécurité** : La faille ReDoS est corrigée, l'application ne peut plus être mise hors-service via de simples chaînes d'entrée corrompues, rendant le calcul stable en Node.js.
- **Réduction de la complexité technique** : Moins de code inutile à maintenir sur le pattern regex.

### Négatives
- La validation stricte selon les RFCs très spécifiques sur la conformité de l'email pourrait être légèrement moins exhaustive, bien que l'important soit la vérification du domaine.
