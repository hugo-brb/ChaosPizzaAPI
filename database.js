const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./pizza.db');

function ensureOrdersEmailColumn() {
  db.all("PRAGMA table_info(orders)", (err, columns) => {
    if (err || !Array.isArray(columns)) {
      return;
    }

    const hasEmailColumn = columns.some((column) => column.name === 'email');
    if (!hasEmailColumn) {
      db.run("ALTER TABLE orders ADD COLUMN email TEXT");
    }
  });
}

db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS pizzas (id INTEGER PRIMARY KEY, name TEXT, price REAL, stock INTEGER)");
  db.run("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, total REAL, status TEXT, promo TEXT, email TEXT)");
  ensureOrdersEmailColumn();

  // Index sur l'email pour de meilleures performances sur GET /orders/user/:email
  db.run("CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email)");

  db.get("SELECT COUNT(*) as count FROM pizzas", (err, row) => {
    if (row.count === 0) {
      db.run("INSERT INTO pizzas (name, price, stock) VALUES ('Margherita', 10.0, 50)");
      db.run("INSERT INTO pizzas (name, price, stock) VALUES ('Pepperoni', 12.5, 30)");
      db.run("INSERT INTO pizzas (name, price, stock) VALUES ('4 Formaggi', 13.0, 67)"); // Petite pizza secrete (pour les gourmands)
    }
  });
});

module.exports = db;