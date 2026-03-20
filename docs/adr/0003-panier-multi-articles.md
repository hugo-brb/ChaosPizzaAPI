# ADR 0003 : Implémentation du Panier Multi-Articles et gestion unifiée 

## Statut
Accepté

## Contexte
La conception originelle de notre API pour le passage de commande ("Chaos Pizza") limitait vraisemblablement chaque action à une seule pizza. Avec l'évolution des fonctionnalités e-commerce, un client s'attend aujourd'hui à valider en une seule fois plusieurs pizzas. Envoyer les requêtes à l'unité saturait les appels serveurs, et n'était pas structuré pour de gros achats simultanés.

## Décision
Intégration du système de Panier (`fc35fa2` et suivants). Ce choix modifie le modèle comportemental entre l'application client (UI) et l'API `POST /orders`, en permettant de passer des tableaux d'objets (pizzas, avec leurs quantités) lors de la création d'ordre (`orderManager`).

## Conséquences

### Positives
- **Expérience Utilisateur Complète** : La création de commande multi-articles est le standard de l'e-commerce, l'UX s'est considérablement améliorée.
- **Réduction du volume de requêtes** : Limitation de l'envoi de requêtes multiples, allègement du trafic sur l'API et la BDD.
- **Facilitation de la facturation unifiée** : Calculer une somme totale HT/TTC devient plus pertinent sur un lot (TVA calculée en une seule fois au prorata) empêchant les arrondis illogiques.

### Négatives
- Complexification structurelle sur l'insertion des enregistrements de la commande et du détails de la commande.
- Des migrations base de données plus délicates sur la définition relationnelle.
