# ADR 0005 : Suppression du délai bloquant pour la montée en charge

## Statut
Accepté

## Contexte
Pendant les tests d'analyse de trafic (Load Test/stress test), un important goulot d'étranglement a bloqué la disponibilité réseau pour les appels vers `/orders` : la performance tombait drastiquement sous le seuil d'exigence d'une application de restauration rapide. Ce comportement était notamment causé par un temps d'attente (timeout) ou traitement inutile programmé lors du traitement interne des commandes.

## Décision
Pour assurer des performances constantes avec une tolérance en charge appropriée, le timeout dans `orderManager.js` générant ce délai de calcul ralenti a été identifié et retiré lors du commit `b749fb0`.

## Conséquences

### Positives
- **Amélioration drastique des performances (Latency)** : L'application n'est plus encombrée par un ralentissement artificiel, et répond dans le scope attendu d'un middleware API. L'event-loop n'est plus bridé.
- **Réussite des scénarios K6 (ou JMeter)** : La validation des tests de performance automatisés (`loadtest.yml`/scenario Load) s'est avérée fructueuse après modification.

### Négatives
- Le comportement d'attente pouvait exister à l'origine pour une raison (simuler l'appel à une banque externe, l'intégration lente d'un ERP ou des besoins didactiques). Sans cela, il n'y a plus ce garde-fou, mais pour une API production-ready il n'avait pas sa place.
