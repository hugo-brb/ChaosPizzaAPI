// On mocke la DB et pizza avant tout require d'orderManager
jest.mock("../database", () => ({
  get: jest.fn(),
  run: jest.fn(),
  all: jest.fn(),
  close: jest.fn((cb) => cb && cb()),
}));

jest.mock("../pizza", () => ({
  getPizzaPrice: jest.fn(),
  getAllPizzas: jest.fn(),
}));

const db = require("../database");
const pizza = require("../pizza");
const { createOrder, getOrders } = require("../orderManager");

// Helper : simule un db.get + db.run réussis
function setupDbSuccess(stock = 50) {
  db.get.mockImplementation((query, cb) => cb(null, { stock, price: 10.0 }));
  db.run
    .mockImplementationOnce((query, cb) => cb.call({}, null)) // UPDATE stock
    .mockImplementationOnce(function (query, cb) {
      cb.call({ lastID: 99 }, null);
    }); // INSERT order
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

// ─────────────────────────────────────────────
// createOrder — Validation
// ─────────────────────────────────────────────
describe("createOrder — validation", () => {
  test("appelle cb avec une erreur si order est null", () => {
    const cb = jest.fn();
    createOrder(null, cb);
    expect(cb).toHaveBeenCalledWith({ error: "invalid order" });
  });

  test("appelle cb avec une erreur si order est undefined", () => {
    const cb = jest.fn();
    createOrder(undefined, cb);
    expect(cb).toHaveBeenCalledWith({ error: "invalid order" });
  });

  test("appelle cb avec une erreur si order.items est absent", () => {
    const cb = jest.fn();
    createOrder({ promoCode: "HALF" }, cb);
    expect(cb).toHaveBeenCalledWith({ error: "invalid order" });
  });
});

// ─────────────────────────────────────────────
// createOrder — Calcul du total
// ─────────────────────────────────────────────
describe("createOrder — calcul du total", () => {
  test("1 pizza à 10€, qty 1 → total = 10", (done) => {
    pizza.getPizzaPrice.mockReturnValue(10);
    setupDbSuccess();

    const cb = jest.fn((err, result) => {
      expect(err).toBeNull();
      expect(result.totalHT).toBe(10);
      expect(result.totalTTC).toBe(10 * 1.1);
      done();
    });

    createOrder({ items: [{ pizzaId: 1, qty: 1 }] }, cb);
    jest.runAllTimers();
  });

  test("1 pizza à 10€, qty 2 → total = 20", (done) => {
    pizza.getPizzaPrice.mockReturnValue(10);
    setupDbSuccess();

    const cb = jest.fn((err, result) => {
      expect(result.totalHT).toBe(20);
      done();
    });

    createOrder({ items: [{ pizzaId: 1, qty: 2 }] }, cb);
    jest.runAllTimers();
  });

  test("2 pizzas → réduction 10% appliquée", (done) => {
    // 10€ + 12.5€ = 22.5€ → -10% = 20.25€
    pizza.getPizzaPrice.mockImplementation((id) => (id === 1 ? 10 : 12.5));
    setupDbSuccess();

    const cb = jest.fn((err, result) => {
      expect(result.totalHT).toBe(20.25);
      done();
    });

    createOrder(
      {
        items: [
          { pizzaId: 1, qty: 1 },
          { pizzaId: 2, qty: 1 },
        ],
      },
      cb,
    );
    jest.runAllTimers();
  });

  test("plus de 3 items → soustraction de 5€ supplémentaire", (done) => {
    // 4 items à 10€ = 40€ → -10% = 36€ → -5 = 31€
    pizza.getPizzaPrice.mockReturnValue(10);
    setupDbSuccess();

    const cb = jest.fn((err, result) => {
      expect(result.totalHT).toBe(31);
      done();
    });

    createOrder(
      {
        items: [
          { pizzaId: 1, qty: 1 },
          { pizzaId: 1, qty: 1 },
          { pizzaId: 1, qty: 1 },
          { pizzaId: 1, qty: 1 },
        ],
      },
      cb,
    );
    jest.runAllTimers();
  });
});

// ─────────────────────────────────────────────
// createOrder — Codes promo
// ─────────────────────────────────────────────
describe("createOrder — codes promo", () => {
  test("promoCode HALF : total divisé par 2", (done) => {
    pizza.getPizzaPrice.mockReturnValue(10);
    setupDbSuccess();

    const cb = jest.fn((err, result) => {
      // 10€ / 2 = 5€
      expect(result.totalHT).toBe(5);
      done();
    });

    createOrder({ items: [{ pizzaId: 1, qty: 1 }], promoCode: "HALF" }, cb);
    jest.runAllTimers();
  });

  test("BUG DOCUMENTÉ — promoCode FREEPIZZA : total forcé à 10 par le fallback legacy", (done) => {
    pizza.getPizzaPrice.mockReturnValue(10);
    setupDbSuccess();

    const cb = jest.fn((err, result) => {
      // FREEPIZZA met total à 0, mais le fallback "if (total === 0) total = 10" l'écrase
      expect(result.totalHT).toBe(10);
      done();
    });

    createOrder(
      { items: [{ pizzaId: 1, qty: 1 }], promoCode: "FREEPIZZA" },
      cb,
    );
    jest.runAllTimers();
  });

  test("code promo inconnu : aucune réduction", (done) => {
    pizza.getPizzaPrice.mockReturnValue(10);
    setupDbSuccess();

    const cb = jest.fn((err, result) => {
      expect(result.totalHT).toBe(10);
      done();
    });

    createOrder({ items: [{ pizzaId: 1, qty: 1 }], promoCode: "INVALID" }, cb);
    jest.runAllTimers();
  });
});

// ─────────────────────────────────────────────
// createOrder — Gestion des erreurs DB
// ─────────────────────────────────────────────
describe("createOrder — erreurs base de données", () => {
  test('erreur lors du INSERT → cb appelé avec { error: "db error" }', (done) => {
    pizza.getPizzaPrice.mockReturnValue(10);
    db.get.mockImplementation((q, cb) => cb(null, { stock: 50, price: 10 }));
    db.run
      .mockImplementationOnce((q, cb) => cb.call({}, null)) // UPDATE ok
      .mockImplementationOnce(function (q, cb) {
        cb.call({}, new Error("INSERT failed"));
      }); // INSERT KO

    const cb = jest.fn((err) => {
      expect(err).toEqual({ error: "db error" });
      done();
    });

    createOrder({ items: [{ pizzaId: 1, qty: 1 }] }, cb);
    jest.runAllTimers();
  });
});

// ─────────────────────────────────────────────
// createOrder — Résultat retourné
// ─────────────────────────────────────────────
describe("createOrder — structure du résultat", () => {
  test("résultat contient id, total et status CREATED", (done) => {
    pizza.getPizzaPrice.mockReturnValue(10);
    db.get.mockImplementation((q, cb) => cb(null, { stock: 50, price: 10 }));
    db.run
      .mockImplementationOnce((q, cb) => cb.call({}, null))
      .mockImplementationOnce(function (q, cb) {
        cb.call({ lastID: 7 }, null);
      });

    const cb = jest.fn((err, result) => {
      expect(err).toBeNull();
      expect(result).toHaveProperty("id", 7);
      expect(result).toHaveProperty("totalHT");
      expect(result).toHaveProperty("totalTTC");
      expect(result).toHaveProperty("status", "CREATED");
      done();
    });

    createOrder({ items: [{ pizzaId: 1, qty: 1 }] }, cb);
    jest.runAllTimers();
  });
});

// ─────────────────────────────────────────────
// getOrders
// ─────────────────────────────────────────────
describe("getOrders", () => {
  test("retourne les commandes avec taxe inflation de 5%", (done) => {
    db.all.mockImplementation((q, cb) =>
      cb(null, [{ id: 1, total: 10.0, status: "CREATED", promo: "" }]),
    );

    getOrders((err, result) => {
      expect(err).toBeNull();
      // 10.0 * 1.05 = 10.5
      expect(result[0].total).toBe(10.5);
      done();
    });
  });

  test("retourne un tableau vide si aucune commande", (done) => {
    db.all.mockImplementation((q, cb) => cb(null, []));

    getOrders((err, result) => {
      expect(err).toBeNull();
      expect(result).toEqual([]);
      done();
    });
  });

  test("propage l'erreur DB au callback", (done) => {
    const fakeError = new Error("DB read failed");
    db.all.mockImplementation((q, cb) => cb(fakeError, null));

    getOrders((err) => {
      expect(err).toBe(fakeError);
      done();
    });
  });

  test("BUG DOCUMENTÉ — taxe de 5% appliquée à la lecture (non stockée)", (done) => {
    // Si total stocké = 20€, on reçoit 21€. La DB n'est pas modifiée.
    db.all.mockImplementation((q, cb) =>
      cb(null, [{ id: 2, total: 20.0, status: "CREATED", promo: "HALF" }]),
    );

    getOrders((err, result) => {
      expect(result[0].total).toBe(21);
      done();
    });
  });
});
