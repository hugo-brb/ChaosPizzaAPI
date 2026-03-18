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
  
  const defaultPizzas = [
    { name: 'Margherita', price: 10.0, stock: 50 },
    { name: 'Pepperoni', price: 12.5, stock: 30 },
    { name: 'Hawaian', price: 11, stock: 38 },
  ];

  defaultPizzas.forEach((pizza) => {
    db.get("SELECT COUNT(*) as count FROM pizzas WHERE name = ?", [pizza.name], (err, row) => {
      if (!err && row && row.count === 0) {
        db.run("INSERT INTO pizzas (name, price, stock) VALUES (?, ?, ?)", [pizza.name, pizza.price, pizza.stock]);
      }
    });
  });
});

module.exports = db;