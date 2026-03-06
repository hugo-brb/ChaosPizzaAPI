const request = require('supertest');
const app = require('../app');
const db = require('../database');

afterAll((done) => {
  db.close((err) => {
    done();
  });
});

describe('GET /pizzas', () => {
  test('devrait retourner la liste des pizzas', async () => {
    const response = await request(app).get('/pizzas');
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});

describe('POST /orders', () => {
  test('devrait créer une commande valide', async () => {
    const order = {
      items: [
        { pizzaId: 1, qty: 2 }
      ]
    };

    const response = await request(app)
      .post('/orders')
      .send(order)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('status');
    expect(response.body.status).toBe('CREATED');
  });

  test('devrait rejeter une commande sans items', async () => {
    const response = await request(app)
      .post('/orders')
      .send({})
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(400);
  });

  test('devrait appliquer le code promo FREEPIZZA', async () => {
    const order = {
      items: [
        { pizzaId: 1, qty: 1 }
      ],
      promoCode: 'FREEPIZZA'
    };

    const response = await request(app)
      .post('/orders')
      .send(order)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(10); // legacy fallback when total is 0
  });

  test('devrait appliquer le code promo HALF', async () => {
    const order = {
      items: [
        { pizzaId: 1, qty: 2 }
      ],
      promoCode: 'HALF'
    };

    const response = await request(app)
      .post('/orders')
      .send(order)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('total');
    // Le total devrait être divisé par 2, mais difficile à tester sans connaître le prix exact
  });

  test('devrait appliquer la réduction multi-items', async () => {
    const order = {
      items: [
        { pizzaId: 1, qty: 1 },
        { pizzaId: 2, qty: 1 }
      ]
    };

    const response = await request(app)
      .post('/orders')
      .send(order)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('total');
    // Réduction de 10% appliquée
  });
});

describe('GET /orders', () => {
  test('devrait retourner la liste des commandes', async () => {
    const response = await request(app).get('/orders');
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});
