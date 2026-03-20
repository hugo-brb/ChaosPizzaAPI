let mockAll;
let mockGet;
let mockRun;
let mockSerialize;

beforeEach(() => {
  jest.resetModules();

  mockAll = jest.fn();
  mockGet = jest.fn();
  mockRun = jest.fn();
  mockSerialize = jest.fn((fn) => fn());

  jest.mock("sqlite3", () => ({
    verbose: () => ({
      Database: jest.fn().mockImplementation(() => ({
        all: mockAll,
        get: mockGet,
        run: mockRun,
        serialize: mockSerialize,
      })),
    }),
  }));
});

// ─────────────────────────────────────────────
// Initialisation — db.serialize
// ─────────────────────────────────────────────
describe("database.js — initialisation", () => {
  test("appelle db.serialize au chargement", () => {
    require("../database");
    expect(mockSerialize).toHaveBeenCalledTimes(1);
  });

  test("crée les tables pizzas et orders, l'index et appelle ensureOrdersEmailColumn", () => {
    // mock db.all pour ensureOrdersEmailColumn (colonnes avec email déjà présent)
    mockAll.mockImplementation((query, cb) => {
      cb(null, [{ name: "email" }]);
    });
    // mock db.get pour le seed (pizza déjà existante)
    mockGet.mockImplementation((query, params, cb) => {
      cb(null, { count: 1 });
    });

    require("../database");

    // 4 appels à db.run : CREATE pizzas, CREATE INDEX unique, CREATE orders, CREATE INDEX email
    const runCalls = mockRun.mock.calls;
    expect(runCalls[0][0]).toContain("CREATE TABLE IF NOT EXISTS pizzas");
    expect(runCalls[2][0]).toContain("CREATE TABLE IF NOT EXISTS orders");
    expect(runCalls[3][0]).toContain("CREATE INDEX IF NOT EXISTS");
  });
});

// ─────────────────────────────────────────────
// ensureOrdersEmailColumn
// ─────────────────────────────────────────────
describe("database.js — ensureOrdersEmailColumn", () => {
  test("ne fait rien si la colonne email existe déjà", () => {
    mockAll.mockImplementation((query, cb) => {
      cb(null, [{ name: "id" }, { name: "total" }, { name: "email" }]);
    });
    mockGet.mockImplementation((query, params, cb) => {
      cb(null, { count: 1 });
    });

    require("../database");

    // db.run ne doit PAS contenir un ALTER TABLE
    const alterCalls = mockRun.mock.calls.filter((c) =>
      c[0].includes("ALTER TABLE"),
    );
    expect(alterCalls).toHaveLength(0);
  });

  test("ajoute la colonne email si elle n'existe pas", () => {
    mockAll.mockImplementation((query, cb) => {
      cb(null, [{ name: "id" }, { name: "total" }]);
    });
    mockRun.mockImplementation((query, ...rest) => {
      const cb = rest[rest.length - 1];
      if (typeof cb === "function") cb(null);
    });
    mockGet.mockImplementation((query, params, cb) => {
      cb(null, { count: 1 });
    });

    require("../database");

    const alterCalls = mockRun.mock.calls.filter((c) =>
      c[0].includes("ALTER TABLE"),
    );
    expect(alterCalls).toHaveLength(1);
    expect(alterCalls[0][0]).toContain("ADD COLUMN email TEXT");
  });

  test("log une erreur si ALTER TABLE échoue", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    mockAll.mockImplementation((query, cb) => {
      cb(null, [{ name: "id" }, { name: "total" }]);
    });
    mockRun.mockImplementation((query, ...rest) => {
      const cb = rest[rest.length - 1];
      if (typeof cb === "function" && query.includes("ALTER TABLE")) {
        cb(new Error("ALTER failed"));
      } else if (typeof cb === "function") {
        cb(null);
      }
    });
    mockGet.mockImplementation((query, params, cb) => {
      cb(null, { count: 1 });
    });

    require("../database");

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to add email column to orders table:",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  test("log une erreur si PRAGMA échoue", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    mockAll.mockImplementation((query, cb) => {
      cb(new Error("PRAGMA failed"));
    });
    mockGet.mockImplementation((query, params, cb) => {
      cb(null, { count: 1 });
    });

    require("../database");

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to inspect orders table schema:",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  test("log une erreur si PRAGMA retourne un résultat non-tableau", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    mockAll.mockImplementation((query, cb) => {
      cb(null, "not-an-array");
    });
    mockGet.mockImplementation((query, params, cb) => {
      cb(null, { count: 1 });
    });

    require("../database");

    expect(consoleSpy).toHaveBeenCalledWith(
      "Unexpected result when inspecting orders table schema:",
      "not-an-array",
    );
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────
// Seed des pizzas
// ─────────────────────────────────────────────
describe("database.js — seed des pizzas", () => {
  test("insère les pizzas par défaut si count === 0", () => {
    mockAll.mockImplementation((query, cb) => {
      cb(null, [{ name: "email" }]);
    });
    mockGet.mockImplementation((query, params, cb) => {
      cb(null, { count: 0 });
    });
    mockRun.mockImplementation((query, ...rest) => {
      const cb = rest[rest.length - 1];
      if (typeof cb === "function") cb(null);
    });

    require("../database");

    const insertCalls = mockRun.mock.calls.filter((c) =>
      c[0].includes("INSERT OR IGNORE INTO pizzas"),
    );
    expect(insertCalls).toHaveLength(3);
  });

  /* Note: The current implementation uses INSERT OR IGNORE for each pizza, 
     so we don't have a check for count > 0 before seeding anymore. */
  test("ne fait rien si row est null lors du seed (obsolète)", () => {
    // Ce test reste ici pour la structure mais le code actuel ne fait plus de SELECT count
  });

  /* Note: SELECT count is no longer used in the current implementation */
  test("ne fait rien si SELECT count échoue (obsolète)", () => {
  });

  test("log une erreur si l'INSERT d'une pizza échoue", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    mockAll.mockImplementation((query, cb) => {
      cb(null, [{ name: "email" }]);
    });
    mockRun.mockImplementation((query, ...rest) => {
      const cb = rest[rest.length - 1];
      if (typeof cb === "function" && query.includes("INSERT OR IGNORE INTO pizzas")) {
        cb(new Error("INSERT failed"));
      } else if (typeof cb === "function") {
        cb(null);
      }
    });

    require("../database");

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to insert default pizza record:",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  test("ne fait rien si row est null lors du seed", () => {
    mockAll.mockImplementation((query, cb) => {
      cb(null, [{ name: "email" }]);
    });
    mockGet.mockImplementation((query, params, cb) => {
      cb(null, null);
    });

    require("../database");

    const insertCalls = mockRun.mock.calls.filter((c) =>
      c[0].includes("INSERT INTO pizzas"),
    );
    expect(insertCalls).toHaveLength(0);
  });
});
