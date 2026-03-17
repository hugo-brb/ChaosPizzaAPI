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
const { createOrder, getOrders, getOrdersByEmail } = require("../orderManager");

function getCallbackFromArgs(args) {
  return args[args.length - 1];
}

// Helper : simule un db.get + db.run réussis
function setupDbSuccess(stock = 50) {
  db.get.mockImplementation((...args) => {
    const cb = getCallbackFromArgs(args);
    cb(null, { stock, price: 10.0 });
  });
  db.run
    .mockImplementationOnce((...args) => {
      const cb = getCallbackFromArgs(args);
      cb.call({}, null);
    }) // UPDATE stock
    .mockImplementationOnce((...args) => {
      const cb = getCallbackFromArgs(args);
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

  test("appelle cb avec une erreur si email est absent", () => {
    const cb = jest.fn();
    createOrder({ items: [{ pizzaId: 1, qty: 1 }] }, cb);
    expect(cb).toHaveBeenCalledWith({ error: "invalid email" });
  });

  test("appelle cb avec une erreur si email est invalide", () => {
    const cb = jest.fn();
    createOrder({ email: "not-an-email", items: [{ pizzaId: 1, qty: 1 }] }, cb);
    expect(cb).toHaveBeenCalledWith({ error: "invalid email" });
  });

  test("rejette un email avec local-part vide", () => {
    const cb = jest.fn();
    createOrder({ email: "@example.com", items: [{ pizzaId: 1, qty: 1 }] }, cb);
    expect(cb).toHaveBeenCalledWith({ error: "invalid email" });
  });

  test("rejette un email avec points consécutifs dans la local-part", () => {
    const cb = jest.fn();
    createOrder(
      { email: "a..b@example.com", items: [{ pizzaId: 1, qty: 1 }] },
      cb,
    );
    expect(cb).toHaveBeenCalledWith({ error: "invalid email" });
  });

  test("rejette un email avec local-part commençant ou finissant par un point", () => {
    const cbStart = jest.fn();
    const cbEnd = jest.fn();

    createOrder(
      { email: ".abc@example.com", items: [{ pizzaId: 1, qty: 1 }] },
      cbStart,
    );
    createOrder(
      { email: "abc.@example.com", items: [{ pizzaId: 1, qty: 1 }] },
      cbEnd,
    );

    expect(cbStart).toHaveBeenCalledWith({ error: "invalid email" });
    expect(cbEnd).toHaveBeenCalledWith({ error: "invalid email" });
  });

  test("rejette un email avec domaine sans point", () => {
    const cb = jest.fn();
    createOrder({ email: "abc@example", items: [{ pizzaId: 1, qty: 1 }] }, cb);
    expect(cb).toHaveBeenCalledWith({ error: "invalid email" });
  });

  test("rejette un email avec label de domaine invalide", () => {
    const cbHyphen = jest.fn();
    const cbChar = jest.fn();

    createOrder(
      { email: "abc@-example.com", items: [{ pizzaId: 1, qty: 1 }] },
      cbHyphen,
    );
    createOrder(
      { email: "abc@exa%mple.com", items: [{ pizzaId: 1, qty: 1 }] },
      cbChar,
    );

    expect(cbHyphen).toHaveBeenCalledWith({ error: "invalid email" });
    expect(cbChar).toHaveBeenCalledWith({ error: "invalid email" });
  });

  test("rejette un email avec une local-part > 64 caractères", () => {
    const cb = jest.fn();
    const longLocalPart = `${"a".repeat(65)}@example.com`;
    createOrder({ email: longLocalPart, items: [{ pizzaId: 1, qty: 1 }] }, cb);
    expect(cb).toHaveBeenCalledWith({ error: "invalid email" });
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

    createOrder(
      { email: "client@example.com", items: [{ pizzaId: 1, qty: 1 }] },
      cb,
    );
    jest.runAllTimers();
  });

  test("1 pizza à 10€, qty 2 → total = 20", (done) => {
    pizza.getPizzaPrice.mockReturnValue(10);
    setupDbSuccess();

    const cb = jest.fn((err, result) => {
      expect(result.totalHT).toBe(20);
      done();
    });

    createOrder(
      { email: "client@example.com", items: [{ pizzaId: 1, qty: 2 }] },
      cb,
    );
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
        email: "client@example.com",
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
        email: "client@example.com",
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

    createOrder(
      {
        email: "client@example.com",
        items: [{ pizzaId: 1, qty: 1 }],
        promoCode: "HALF",
      },
      cb,
    );
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
      {
        email: "client@example.com",
        items: [{ pizzaId: 1, qty: 1 }],
        promoCode: "FREEPIZZA",
      },
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

    createOrder(
      {
        email: "client@example.com",
        items: [{ pizzaId: 1, qty: 1 }],
        promoCode: "INVALID",
      },
      cb,
    );
    jest.runAllTimers();
  });

  test("promoCode BOGO : qty 2 de la même pizza → 1 gratuite", (done) => {
    // 2 pizzas à 10€ = 20€, 1 gratuite → total = 10€
    pizza.getPizzaPrice.mockReturnValue(10);
    setupDbSuccess();

    const cb = jest.fn((err, result) => {
      expect(err).toBeNull();
      expect(result.total).toBe(10);
      done();
    });

    createOrder({ items: [{ pizzaId: 1, qty: 2 }], promoCode: "BOGO" }, cb);
    jest.runAllTimers();
  });

  test("promoCode BOGO : qty 3 de la même pizza → 1 gratuite", (done) => {
    // 3 pizzas à 10€ = 30€, 1 gratuite → total = 20€
    pizza.getPizzaPrice.mockReturnValue(10);
    setupDbSuccess();

    const cb = jest.fn((err, result) => {
      expect(err).toBeNull();
      expect(result.total).toBe(20);
      done();
    });

    createOrder({ items: [{ pizzaId: 1, qty: 3 }], promoCode: "BOGO" }, cb);
    jest.runAllTimers();
  });

  test("promoCode BOGO : qty 4 de la même pizza → 2 gratuites", (done) => {
    // 4 pizzas à 10€ = 40€, 2 gratuites → total = 20€
    pizza.getPizzaPrice.mockReturnValue(10);
    setupDbSuccess();

    const cb = jest.fn((err, result) => {
      expect(err).toBeNull();
      expect(result.total).toBe(20);
      done();
    });

    createOrder({ items: [{ pizzaId: 1, qty: 4 }], promoCode: "BOGO" }, cb);
    jest.runAllTimers();
  });

  test("promoCode BOGO : qty 1 de la même pizza → aucune gratuite", (done) => {
    // 1 pizza à 10€ = 10€, 0 gratuite → total = 10€
    pizza.getPizzaPrice.mockReturnValue(10);
    setupDbSuccess();

    const cb = jest.fn((err, result) => {
      expect(err).toBeNull();
      expect(result.total).toBe(10);
      done();
    });

    createOrder({ items: [{ pizzaId: 1, qty: 1 }], promoCode: "BOGO" }, cb);
    jest.runAllTimers();
  });

  test("promoCode BOGO : deux pizzas différentes, qty 2 chacune → 1 gratuite par type", (done) => {
    // pizza 1 : 2 × 10€ → 1 gratuite = 10€
    // pizza 2 : 2 × 12€ → 1 gratuite = 12€
    // sous-total BOGO = 22€
    // 2 items distincts → réduction 10% supplémentaire = 22 × 0.9 = 19.8€
    pizza.getPizzaPrice.mockImplementation((id) => (id === 1 ? 10 : 12));
    setupDbSuccess();

    const cb = jest.fn((err, result) => {
      expect(err).toBeNull();
      expect(result.total).toBe(19.8);
      done();
    });

    createOrder(
      {
        items: [
          { pizzaId: 1, qty: 2 },
          { pizzaId: 2, qty: 2 },
        ],
        promoCode: "BOGO",
      },
      cb,
    );
    jest.runAllTimers();
  });
});

// ─────────────────────────────────────────────
// createOrder — Gestion des erreurs DB
// ─────────────────────────────────────────────
describe("createOrder — erreurs base de données", () => {
  test("retourne pizza not found si la pizza est introuvable", () => {
    const cb = jest.fn();
    db.get.mockImplementation((...args) => {
      const callback = getCallbackFromArgs(args);
      callback(null, null);
    });

    createOrder(
      { email: "client@example.com", items: [{ pizzaId: 9999, qty: 1 }] },
      cb,
    );

    expect(cb).toHaveBeenCalledWith({ error: "pizza not found" });
  });

  test('erreur lors du INSERT → cb appelé avec { error: "db error" }', (done) => {
    pizza.getPizzaPrice.mockReturnValue(10);
    db.get.mockImplementation((...args) => {
      const cb = getCallbackFromArgs(args);
      cb(null, { stock: 50, price: 10 });
    });
    db.run
      .mockImplementationOnce((...args) => {
        const cb = getCallbackFromArgs(args);
        cb.call({}, null);
      }) // UPDATE ok
      .mockImplementationOnce((...args) => {
        const cb = getCallbackFromArgs(args);
        cb.call({}, new Error("INSERT failed"));
      }); // INSERT KO

    const cb = jest.fn((err) => {
      expect(err).toEqual({ error: "db error" });
      done();
    });

    createOrder(
      { email: "client@example.com", items: [{ pizzaId: 1, qty: 1 }] },
      cb,
    );
    jest.runAllTimers();
  });
});

// ─────────────────────────────────────────────
// createOrder — Résultat retourné
// ─────────────────────────────────────────────
describe("createOrder — structure du résultat", () => {
  test("résultat contient id, total et status CREATED", (done) => {
    pizza.getPizzaPrice.mockReturnValue(10);
    db.get.mockImplementation((...args) => {
      const cb = getCallbackFromArgs(args);
      cb(null, { stock: 50, price: 10 });
    });
    db.run
      .mockImplementationOnce((...args) => {
        const cb = getCallbackFromArgs(args);
        cb.call({}, null);
      })
      .mockImplementationOnce((...args) => {
        const cb = getCallbackFromArgs(args);
        cb.call({ lastID: 7 }, null);
      });

    const cb = jest.fn((err, result) => {
      expect(err).toBeNull();
      expect(result).toHaveProperty("id", 7);
      expect(result).toHaveProperty("totalHT");
      expect(result).toHaveProperty("totalTTC");
      expect(result).toHaveProperty("status", "CREATED");
      expect(result).toHaveProperty("email", "client@example.com");
      done();
    });

    createOrder(
      { email: "client@example.com", items: [{ pizzaId: 1, qty: 1 }] },
      cb,
    );
    jest.runAllTimers();
  });
});

// ─────────────────────────────────────────────
// getOrders
// ─────────────────────────────────────────────
describe("getOrders", () => {
  test("retourne les commandes sans modification du prix", (done) => {
    db.all.mockImplementation((q, cb) =>
      cb(null, [{ id: 1, total: 10.0, status: "CREATED", promo: "" }]),
    );

    getOrders((err, result) => {
      expect(err).toBeNull();
      expect(result[0].total).toBe(10.0);
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

  test("retourne le montant exact stocké en base (bogue d'inflation corrigé)", (done) => {
    // La taxe de 5% a été retirée, on doit recevoir exactement 20€
    db.all.mockImplementation((q, cb) =>
      cb(null, [{ id: 2, total: 20.0, status: "CREATED", promo: "HALF" }]),
    );

    getOrders((err, result) => {
      expect(result[0].total).toBe(20.0);
      done();
    });
  });
});

// ─────────────────────────────────────────────
// getOrdersByEmail
// ─────────────────────────────────────────────
describe("getOrdersByEmail", () => {
  test("retourne les commandes d'un email sans modification du prix", (done) => {
    db.all.mockImplementation((query, params, cb) =>
      cb(null, [
        {
          id: 1,
          total: 10.0,
          status: "CREATED",
          promo: "",
          email: "client@example.com",
        },
      ]),
    );

    getOrdersByEmail("client@example.com", (err, result) => {
      expect(err).toBeNull();
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("client@example.com");
      expect(result[0].total).toBe(10.0);
      done();
    });
  });

  test("retourne une erreur si email invalide", () => {
    const cb = jest.fn();
    getOrdersByEmail("not-an-email", cb);
    expect(cb).toHaveBeenCalledWith({ error: "invalid email" });
  });

  test("propage l'erreur DB au callback", (done) => {
    const fakeError = new Error("DB read failed");
    db.all.mockImplementation((query, params, cb) => cb(fakeError, null));

    getOrdersByEmail("client@example.com", (err) => {
      expect(err).toBe(fakeError);
      done();
    });
  });
});
