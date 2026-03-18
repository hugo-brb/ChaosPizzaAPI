# Chaos Pizza API

Simple pizza delivery API.

## Features

- **Pizzas Catalogue:** View available pizzas and prices.
- **Order Management:** Create new orders, apply promotional logic, calculate taxes.
- **Order History:** Fetch all global orders or filter by user email.
- **Promo Codes:** Supports `HALF` (50% off), `FREEPIZZA` (Free total logic legacy hook), and dynamic quantity rules.

## Local setup

### Install dependencies

```bash
npm install
```

### Run the server

```bash
npm start
```

The server will be running on `http://localhost:3000`.

### Run tests

```bash
npm test
npm run test:watch
npm run test:coverage
```

### Run Load Tests

To evaluate performance based on `artillery`:

```bash
npm run load-test
```

## Endpoints

### 🍕 Pizzas

- `GET /pizzas`
  - Returns the list of available pizzas in the database limit stock.

### 📦 Orders

- `POST /orders`
  - Place a new order.
  - **Body Example:**
    ```json
    {
      "email": "user@example.com",
      "items": [{ "pizzaId": 1, "qty": 2 }],
      "promoCode": "HALF"
    }
    ```
  - **Returns:** The generated order id, Subtotal (HT), Total (TTC), email, and status.

- `GET /orders`
  - Returns the global history of all orders. _(Performance: Note this performs a full scan)_.

- `GET /orders/user/:email`
  - Returns the history of orders for a specific email address.

### ⚙️ Utilities

- `GET /health`
  - Check server health status.

- `GET /config`
  - Get global API configuration setup (Prices, TVA rate, Inflation config).

## Architecture

- **Database:** Local SQLite (`pizza.db` created dynamically). Use standard statements and contains `pizzas` & `orders` tables.
- **Tests Framework:** Jest testing framework (unit testing, mocking db functions, request integration testing via `supertest`).
- **Load Testing:** Artillery implementation inside `loadtest.yml`.
- **UI Included:** Features a functional lightweight UI natively served by Express (accessible at `http://localhost:3000/`).

## Development notes

This project contains intentional logic loopholes and legacy hooks used to learn and patch buggy applications. Always check related tests running regression tools when altering `orderManager.js` calculation blocks.
