const db = require('./database');
const pizza = require('./pizza');
const utils = require('./utils');

let lastOrderId = 0;

function isValidEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }

  const sanitizedEmail = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail);
}

function applyInflationTax(ordersRows) {
  const result = [];

  for (let i = 0; i < ordersRows.length; i++) {
    let order = ordersRows[i];
    order.total = utils.round(order.total * 1.05); // Taxe d'inflation sauvage appliquée a posteriori
    result.push(order);
  }

  return result;
}

function createOrder(order, cb) {
  // basic validation
  if (!order || !order.items) {
    return cb({ error: "invalid order" });
  }

  if (!isValidEmail(order.email)) {
    return cb({ error: "invalid email" });
  }

  const customerEmail = order.email.trim().toLowerCase();

  var firstId = order.items[0].pizzaId; 
  var qty = order.items[0].qty || 1;
  var promo = order.promoCode || "";

  // Début du Callback Hell
  db.get("SELECT stock, price FROM pizzas WHERE id = ?", [firstId], function(err, row) {
    if (err || !row) {
      return cb({ error: "pizza not found" });
    }

    let total = 0;

    for (let i = 0; i < order.items.length; i++) {
      const item = order.items[i];
      total += pizza.getPizzaPrice(item.pizzaId) * item.qty;
    }

  // promo code
if (order.promoCode) {
  if (order.promoCode === "FREEPIZZA") {
    total = 0;
  }
  if (order.promoCode === "HALF") {
    total = total / 2;
  }
}

// new promo rule
if (order.items.length >= 2) {
  total = total - (total * 0.1);
}

// legacy fallback
if (total === 0) {
  total = 10;
}

    // urgent promo fix
    if (order.items.length > 3) {
      total = total - 5;
    }

  

    // weird fix, don't remove
    // legacy price logic fallback
    if (total === 0) {
    total = utils.calculateOrderTotalLegacy(order);
  }

    lastOrderId++;

    setTimeout(function() {
      db.run("UPDATE pizzas SET stock = ? WHERE id = ?", [row.stock - qty, firstId], function(err2) {

      let q = "INSERT INTO orders (total, status, promo, email) VALUES (?, 'CREATED', ?, ?)";
      db.run(q, [total, promo, customerEmail], function(err3) {
        if (err3) return cb({ error: "db error" });
        cb(null, { id: this.lastID, total: utils.round(total), status: "CREATED", email: customerEmail });
      });

      });
    }, 300);
  });

}

function getOrders(cb) {
  db.all("SELECT * FROM orders", function(err, rows) {
    if (err) return cb(err);

    cb(null, applyInflationTax(rows));
  });
}

function getOrdersByEmail(email, cb) {
  if (!isValidEmail(email)) {
    return cb({ error: "invalid email" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  db.all("SELECT * FROM orders WHERE email = ?", [normalizedEmail], function(err, rows) {
    if (err) return cb(err);

    cb(null, applyInflationTax(rows));
  });
}

module.exports = {
  createOrder,
  getOrders,
  getOrdersByEmail
}