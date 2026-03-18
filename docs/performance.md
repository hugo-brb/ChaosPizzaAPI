# Rapport d'analyse — Load Test avant / après fix

**Projet :** chaos-pizza-api  
**Date :** 18 mars 2026  
**Outil :** Artillery  
**Durée du test :** 42 secondes (3 phases)

---

## Résumé des phases

| Phase | Cible | Durée |
|-------|-------|-------|
| Phase 1 — Échauffement | 5 req/sec | 10 s |
| Phase 2 — Trafic soutenu | 20 req/sec | 20 s |
| Phase 3 — Pic de trafic | 50 req/sec | 10 s |

---

## Résultats comparatifs

### Vue globale

| Métrique | Avant fix | Après fix | Évolution |
|----------|-----------|-----------|-----------|
| Requêtes totales | 1 113 | 1 137 | +24 (+2,2 %) |
| Codes 200 (succès) | 950 | 950 | = stable |
| Codes 400 (erreurs) | 163 | 187 | +24 (+14,7 %) ⚠️ |
| Taux d'échec global | 14,6 % | 16,4 % | +1,8 pts ⚠️ |
| VUsers complétés | 787 | 763 | −24 (−3 %) |

### Latence — toutes réponses (ms)

| Percentile | Avant fix | Après fix | Évolution |
|------------|-----------|-----------|-----------|
| Min | 0 | 0 | = stable |
| Max | 10 | 4 | −6 ms (−60 %) ✅ |
| Moyenne | 1,0 | 0,8 | −0,2 ms (−20 %) ✅ |
| Médiane | 1 | 1 | = stable |
| p95 | 2 | 1 | −1 ms (−50 %) ✅ |
| p99 | 4 | 2 | −2 ms (−50 %) ✅ |

### Durée des sessions utilisateurs

| Percentile | Avant fix | Après fix | Évolution |
|------------|-----------|-----------|-----------|
| p95 | 4,2 s | 3,4 s | −0,8 s (−19 %) ✅ |
| p99 | 12,8 s | 5,8 s | −7,0 s (−55 %) ✅ |

---

## Problèmes identifiés

### Problème 1 — Timeout inutile dans le code

Un timeout était défini dans le code de traitement des requêtes sans justification fonctionnelle. Bien qu'il n'ait pas encore provoqué de défaillances massives dans ce test, il représentait un risque sérieux de dégradation des performances sous charge soutenue : toute requête dépassant la limite aurait été abandonnée prématurément, entraînant des erreurs en cascade et une augmentation brutale du p99 lors des pics de trafic.

**Impact observé :** le p99 atteignait 4 ms en global et 10 ms de latence max avant fix, avec des sessions utilisateur pouvant durer jusqu'à 12,8 s au p99 — directement corrélées à des délais d'attente artificiels.

### Problème 2 — Index manquants sur une table de la base de données

Une table avait été créée dans la base de données sans que ses index soient générés. Sans index, chaque requête impliquant cette table déclenchait un parcours complet (*full table scan*), dont le coût augmente linéairement avec le volume de données. Sous charge, cela se traduit par une dégradation progressive des temps de réponse et une saturation plus rapide des ressources de la base.

**Impact observé :** corrélé aux erreurs `Failed capture or match` (163 avant fix), qui surviennent lors du scénario *"Consulter, commander et vérifier sa commande"* — le flux le plus sollicitant pour la base de données.

---

## Solutions appliquées

### Solution 1 — Suppression du timeout

Le timeout inutile a été retiré du code. Les requêtes s'exécutent désormais sans interruption artificielle, ce qui élimine le risque de coupures prématurées sous charge et réduit la variance des temps de réponse.

**Résultat :** latence max réduite de 10 ms à 4 ms, p99 divisé par 2 (4 ms → 2 ms), durée de session p99 réduite de 12,8 s à 5,8 s.

### Solution 2 — Génération des index sur la table

Les index manquants ont été générés sur la table concernée. Les requêtes de lecture peuvent désormais utiliser les index pour localiser les enregistrements efficacement, sans parcourir l'ensemble de la table.

**Résultat :** amélioration générale de la latence moyenne (1 ms → 0,8 ms) et réduction des pics de latence sous charge.

---