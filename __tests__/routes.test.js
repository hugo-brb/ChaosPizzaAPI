const request = require('supertest');
const app = require('../app');

// --- Mocks ---
// On mocke la base de données pour ne pas toucher pizza.db pendant les tests
jest.mock('../database', () => {
    const mockDb = {
        all: jest.fn(),
        get: jest.fn(),
        run: jest.fn(),
        close: jest.fn((cb) => cb && cb()),
    };
    return mockDb;
});

// On mocke pizza et orderManager pour tester les routes de façon isolée
jest.mock('../pizza');
jest.mock('../orderManager');

const pizza = require('../pizza');
const orders = require('../orderManager');

// ─────────────────────────────────────────────
// GET /pizzas
// ─────────────────────────────────────────────
describe('GET /pizzas', () => {
    test('200 — retourne la liste des pizzas', async () => {
        const fakePizzas = [
            { id: 1, name: 'Margherita', price: 10.0, stock: 50 },
            { id: 2, name: 'Pepperoni', price: 12.5, stock: 30 },
        ];
        pizza.getAllPizzas.mockImplementation((cb) => cb(null, fakePizzas));

        const res = await request(app).get('/pizzas');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(2);
        expect(res.body[0]).toMatchObject({ id: 1, name: 'Margherita', price: 10.0 });
    });

    test('200 — retourne un tableau vide si aucune pizza en base', async () => {
        pizza.getAllPizzas.mockImplementation((cb) => cb(null, []));

        const res = await request(app).get('/pizzas');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('500 — erreur base de données', async () => {
        pizza.getAllPizzas.mockImplementation((cb) => cb(new Error('DB failure'), null));

        const res = await request(app).get('/pizzas');

        expect(res.status).toBe(500);
    });
});

// ─────────────────────────────────────────────
// POST /orders
// ─────────────────────────────────────────────
describe('POST /orders', () => {
    test('200 — crée une commande valide', async () => {
        const fakeResult = { id: 1, total: 20.0, status: 'CREATED' };
        orders.createOrder.mockImplementation((body, cb) => cb(null, fakeResult));

        const res = await request(app)
            .post('/orders')
            .send({ email: 'client@example.com', items: [{ pizzaId: 1, qty: 2 }] })
            .set('Content-Type', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ id: 1, total: 20.0, status: 'CREATED' });
    });

    test('200 — la réponse contient bien les propriétés id, total et status', async () => {
        orders.createOrder.mockImplementation((body, cb) =>
            cb(null, { id: 42, total: 12.5, status: 'CREATED' })
        );

        const res = await request(app)
            .post('/orders')
            .send({ email: 'client@example.com', items: [{ pizzaId: 2, qty: 1 }] })
            .set('Content-Type', 'application/json');

        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('total');
        expect(res.body).toHaveProperty('status', 'CREATED');
    });

    test('400 — corps vide (pas de items)', async () => {
        orders.createOrder.mockImplementation((body, cb) =>
            cb({ error: 'invalid order' })
        );

        const res = await request(app)
            .post('/orders')
            .send({})
            .set('Content-Type', 'application/json');

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('400 — body complètement absent', async () => {
        orders.createOrder.mockImplementation((body, cb) =>
            cb({ error: 'invalid order' })
        );

        const res = await request(app)
            .post('/orders')
            .set('Content-Type', 'application/json');

        expect(res.status).toBe(400);
    });

    test('400 — erreur renvoyée par orderManager (ex: DB)', async () => {
        orders.createOrder.mockImplementation((body, cb) =>
            cb({ error: 'db error' })
        );

        const res = await request(app)
            .post('/orders')
            .send({ email: 'client@example.com', items: [{ pizzaId: 1, qty: 1 }] })
            .set('Content-Type', 'application/json');

        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ error: 'db error' });
    });

    test('400 — pizzaId inexistant (erreur propagée depuis orderManager)', async () => {
        orders.createOrder.mockImplementation((body, cb) =>
            cb({ error: 'pizza not found' })
        );

        const res = await request(app)
            .post('/orders')
            .send({ email: 'client@example.com', items: [{ pizzaId: 9999, qty: 1 }] })
            .set('Content-Type', 'application/json');

        expect(res.status).toBe(400);
    });
});

// ─────────────────────────────────────────────
// GET /orders
// ─────────────────────────────────────────────
describe('GET /orders', () => {
    test('200 — retourne la liste des commandes', async () => {
        const fakeOrders = [
            { id: 1, total: 21.0, status: 'CREATED', promo: '' },
            { id: 2, total: 13.13, status: 'CREATED', promo: 'HALF' },
        ];
        orders.getOrders.mockImplementation((cb) => cb(null, fakeOrders));

        const res = await request(app).get('/orders');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(2);
    });

    test('200 — retourne un tableau vide si aucune commande', async () => {
        orders.getOrders.mockImplementation((cb) => cb(null, []));

        const res = await request(app).get('/orders');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('200 — chaque commande possède les champs attendus', async () => {
        orders.getOrders.mockImplementation((cb) =>
            cb(null, [{ id: 1, total: 10.5, status: 'CREATED', promo: '' }])
        );

        const res = await request(app).get('/orders');

        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('total');
        expect(res.body[0]).toHaveProperty('status');
    });

    // Note: la route GET /orders ne gère pas les erreurs DB (pas de res.status 500)
    // Ce test documente le comportement actuel (bug connu)
    test('COMPORTEMENT ACTUEL — erreur DB ignorée, retourne undefined sans planter', async () => {
        orders.getOrders.mockImplementation((cb) => cb(new Error('DB failure'), null));

        const res = await request(app).get('/orders');

        // La route ne gère pas le cas err, elle appelle res.json(null) → 200 avec null
        expect(res.status).toBe(200);
    });
});

// ─────────────────────────────────────────────
// GET /orders/user/:email
// ─────────────────────────────────────────────
describe('GET /orders/user/:email', () => {
    test('200 — retourne l\'historique des commandes d\'un email', async () => {
        const fakeOrders = [
            { id: 1, total: 21, status: 'CREATED', promo: '', email: 'client@example.com' },
            { id: 2, total: 10.5, status: 'CREATED', promo: 'HALF', email: 'client@example.com' },
        ];
        orders.getOrdersByEmail.mockImplementation((email, cb) => cb(null, fakeOrders));

        const res = await request(app).get('/orders/user/client@example.com');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(2);
    });

    test('200 — retourne un tableau vide si aucune commande pour cet email', async () => {
        orders.getOrdersByEmail.mockImplementation((email, cb) => cb(null, []));

        const res = await request(app).get('/orders/user/client@example.com');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('400 — email invalide', async () => {
        orders.getOrdersByEmail.mockImplementation((email, cb) => cb({ error: 'invalid email' }));

        const res = await request(app).get('/orders/user/not-an-email');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'invalid email' });
    });
});

// ─────────────────────────────────────────────
// Route inexistante
// ─────────────────────────────────────────────
describe('Routes inexistantes', () => {
    test('404 — route inconnue', async () => {
        const res = await request(app).get('/route-inexistante');

        expect(res.status).toBe(404);
    });
});
