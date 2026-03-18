const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./pizza.db");

function ensureOrdersEmailColumn() {
  db.all("PRAGMA table_info(orders)", (err, columns) => {
    if (err) {
      console.error("Failed to inspect orders table schema:", err);
      return;
    }
    if (!Array.isArray(columns)) {
      console.error(
        "Unexpected result when inspecting orders table schema:",
        columns,
      );
      return;
    }

    const hasEmailColumn = columns.some((column) => column.name === "email");
    if (!hasEmailColumn) {
      db.run("ALTER TABLE orders ADD COLUMN email TEXT", (alterErr) => {
        if (alterErr) {
          console.error(
            "Failed to add email column to orders table:",
            alterErr,
          );
        }
      });
    }
  });
}

db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS pizzas (id INTEGER PRIMARY KEY, name TEXT, price REAL, stock INTEGER)",
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, total REAL, status TEXT, promo TEXT, email TEXT)",
  );
  ensureOrdersEmailColumn();

  // Index sur l'email pour de meilleures performances sur GET /orders/user/:email
  db.run("CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email)");

  const defaultPizzas = [
    { name: "Margherita", price: 10.0, stock: 50 },
    { name: "Pepperoni", price: 12.5, stock: 30 },
    { name: "Hawaiian", price: 11, stock: 38 },
  ];

  defaultPizzas.forEach((pizza) => {
    db.get(
      "SELECT COUNT(*) as count FROM pizzas WHERE name = ?",
      [pizza.name],
      (err, row) => {
        if (err) {
          console.error(
            "Failed to check existing pizza count for default seed:",
            err,
          );
          return;
        }

        if (row && row.count === 0) {
          db.run(
            "INSERT INTO pizzas (name, price, stock) VALUES (?, ?, ?)",
            [pizza.name, pizza.price, pizza.stock],
            (insertErr) => {
              if (insertErr) {
                console.error(
                  "Failed to insert default pizza record:",
                  insertErr,
                );
              }
            },
          );
        }
      },
    );
  });
});

module.exports = db;
