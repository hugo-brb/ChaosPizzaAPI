const db = require("./database");
const pizza = require("./pizza");
const utils = require("./utils");
const config = require("./config");

let lastOrderId = 0;

function createOrder(order, cb) {
  // basic validation
  if (!order || !order.items) {
    return cb({ error: "invalid order" });
  }

  var firstId = order.items[0].pizzaId;
  var qty = order.items[0].qty || 1;
  var promo = order.promoCode || "";

  // Début du Callback Hell
  db.get(
    "SELECT stock, price FROM pizzas WHERE id = ?",
    [firstId],
    function (err, row) {
      if (err) return cb({ error: "db error" });
      if (!row) return cb({ error: "pizza not found" });

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
        total = total - total * 0.1;
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

      // Calculer la TVA
      const totalHT = total;
      total = total * (1 + config.TVA_RATE);

      setTimeout(function () {
        db.run(
          "UPDATE pizzas SET stock = ? WHERE id = ?",
          [row.stock - qty, firstId],
          function (err2) {
            if (err2) return cb({ error: "db error" });

            let q = "INSERT INTO orders (total, status, promo) VALUES (?, 'CREATED', ?)";
            db.run(q, [total, promo], function (err3) {
              if (err3) return cb({ error: "db error" });
              cb(null, {
                id: this.lastID,
                totalHT: utils.round(totalHT),
                totalTTC: utils.round(total),
                status: "CREATED",
              });
            });
          },
        );
      }, 300);
    },
  );
}

function getOrders(cb) {
  db.all("SELECT * FROM orders", function (err, rows) {
    if (err) return cb(err);
    let result = [];

    for (let i = 0; i < rows.length; i++) {
      let o = rows[i];
      o.total = utils.round(o.total * (1 + config.INFLATION_RATE)); // Taxe d'inflation sauvage appliquée a posteriori
      result.push(o);
    }

    cb(null, result);
  });
}

module.exports = {
  createOrder,
  getOrders,
};
