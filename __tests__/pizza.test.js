jest.mock('../database', () => ({
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn(),
    close: jest.fn((cb) => cb && cb()),
}));

const db = require('../database');

// On recharge pizza après avoir mocké la DB
let pizza;

beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Recharger la DB mockée et pizza à chaque test pour réinitialiser le cache global
    jest.mock('../database', () => ({
        all: jest.fn(),
        get: jest.fn(),
        run: jest.fn(),
        close: jest.fn((cb) => cb && cb()),
    }));

    pizza = require('../pizza');
});

// ─────────────────────────────────────────────
// getAllPizzas
// ─────────────────────────────────────────────
describe('pizza — getAllPizzas()', () => {
    test('appelle db.all et retourne les lignes via callback', () => {
        const fakePizzas = [
            { id: 1, name: 'Margherita', price: 10.0, stock: 50 },
            { id: 2, name: 'Pepperoni', price: 12.5, stock: 30 },
        ];
        const db = require('../database');
        db.all.mockImplementation((query, cb) => cb(null, fakePizzas));

        const cb = jest.fn();
        pizza.getAllPizzas(cb);

        expect(db.all).toHaveBeenCalledWith('SELECT * FROM pizzas', cb);
        expect(cb).toHaveBeenCalledWith(null, fakePizzas);
    });

    test('propage l\'erreur DB au callback', () => {
        const fakeError = new Error('DB down');
        const db = require('../database');
        db.all.mockImplementation((query, cb) => cb(fakeError, null));

        const cb = jest.fn();
        pizza.getAllPizzas(cb);

        expect(cb).toHaveBeenCalledWith(fakeError, null);
    });

    test('retourne un tableau vide si aucune pizza', () => {
        const db = require('../database');
        db.all.mockImplementation((query, cb) => cb(null, []));

        const cb = jest.fn();
        pizza.getAllPizzas(cb);

        expect(cb).toHaveBeenCalledWith(null, []);
    });
});

// ────────────────────────────────────────────────────────
// getPizzaPrice — basé sur le cache globalPizzaCache
// ────────────────────────────────────────────────────────
describe('pizza — getPizzaPrice()', () => {
    test('retourne 0 si le cache est vide (DB pas encore répondue)', () => {
        // Au chargement du module, db.all ne déclenche pas le callback → cache vide
        const db = require('../database');
        db.all.mockImplementation(() => { }); // pas de callback

        jest.resetModules();
        jest.mock('../database', () => ({ all: jest.fn() }));
        const pizzaFresh = require('../pizza');

        expect(pizzaFresh.getPizzaPrice(1)).toBe(0);
    });

    test('retourne 0 pour un id inconnu', () => {
        const db = require('../database');
        // Cache rempli avec id=1 seulement
        db.all.mockImplementation((q, cb) =>
            cb(null, [{ id: 1, name: 'Margherita', price: 10.0, stock: 50 }])
        );

        jest.resetModules();
        jest.mock('../database', () => {
            const m = { all: jest.fn() };
            return m;
        });

        const freshDb = require('../database');
        freshDb.all.mockImplementation((q, cb) =>
            cb(null, [{ id: 1, name: 'Margherita', price: 10.0, stock: 50 }])
        );

        const pizzaFresh = require('../pizza');
        // id=999 n'est pas dans le cache
        expect(pizzaFresh.getPizzaPrice(999)).toBe(0);
    });

    test('retourne le prix correct pour un id connu dans le cache', () => {
        jest.resetModules();
        jest.mock('../database', () => {
            const m = { all: jest.fn() };
            // Simule le remplissage du cache au chargement du module
            m.all.mockImplementation((q, cb) =>
                cb(null, [
                    { id: 1, name: 'Margherita', price: 10.0, stock: 50 },
                    { id: 2, name: 'Pepperoni', price: 12.5, stock: 30 },
                ])
            );
            return m;
        });

        const pizzaFresh = require('../pizza');

        expect(pizzaFresh.getPizzaPrice(1)).toBe(10.0);
        expect(pizzaFresh.getPizzaPrice(2)).toBe(12.5);
    });

    test('la comparaison est faite avec == (pas ===) — id en string fonctionne', () => {
        jest.resetModules();
        jest.mock('../database', () => {
            const m = { all: jest.fn() };
            m.all.mockImplementation((q, cb) =>
                cb(null, [{ id: 1, name: 'Margherita', price: 10.0, stock: 50 }])
            );
            return m;
        });

        const pizzaFresh = require('../pizza');
        // getPizzaPrice utilise ==, donc '1' == 1 est true
        expect(pizzaFresh.getPizzaPrice('1')).toBe(10.0);
    });
});
