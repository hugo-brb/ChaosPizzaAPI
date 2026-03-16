# Chaos Pizza API

Simple pizza delivery API.

## Install
npm install

## Run
npm start

## API

- `POST /orders`
	- Requiert `email` et `items` dans le body JSON.
- `GET /orders`
	- Retourne l'historique global des commandes.
- `GET /orders/user/:email`
	- Retourne l'historique des commandes pour une adresse email.
