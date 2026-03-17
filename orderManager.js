const db = require("./database");
const pizza = require("./pizza");
const utils = require("./utils");
const config = require("./config");

let lastOrderId = 0;

function isAsciiLetterOrDigit(char) {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
}

function isValidLocalPart(localPart) {
  if (!localPart || localPart.length > 64) {
    return false;
  }

  const allowedSpecials = ".!#$%&'*+/=?^_`{|}~-";
  for (let i = 0; i < localPart.length; i++) {
    const char = localPart[i];
    if (isAsciiLetterOrDigit(char)) {
      continue;
    }

    if (allowedSpecials.indexOf(char) === -1) {
      return false;
    }
  }

  if (localPart[0] === "." || localPart[localPart.length - 1] === ".") {
    return false;
  }

  return localPart.indexOf("..") === -1;
}

function isValidDomain(domain) {
  if (!domain || domain.length > 253) {
    return false;
  }

  if (
    domain.indexOf("..") !== -1 ||
    domain[0] === "." ||
    domain[domain.length - 1] === "."
  ) {
    return false;
  }

  const labels = domain.split(".");
  if (labels.length < 2) {
    return false;
  }

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!label || label.length > 63) {
      return false;
    }

    if (label[0] === "-" || label[label.length - 1] === "-") {
      return false;
    }

    for (let j = 0; j < label.length; j++) {
      const char = label[j];
      if (!isAsciiLetterOrDigit(char) && char !== "-") {
        return false;
      }
    }
  }

  return true;
}

function isValidEmail(email) {
  if (typeof email !== "string") {
    return false;
  }

  const sanitizedEmail = email.trim();

  if (
    !sanitizedEmail ||
    sanitizedEmail.length > 254 ||
    sanitizedEmail.indexOf(" ") !== -1
  ) {
    return false;
  }

  const atIndex = sanitizedEmail.indexOf("@");
  if (
    atIndex <= 0 ||
    atIndex !== sanitizedEmail.lastIndexOf("@") ||
    atIndex === sanitizedEmail.length - 1
  ) {
    return false;
  }

  const localPart = sanitizedEmail.slice(0, atIndex);
  const domain = sanitizedEmail.slice(atIndex + 1);

  return isValidLocalPart(localPart) && isValidDomain(domain);
}

function applyInflationTax(ordersRows) {
  const result = [];

  for (let i = 0; i < ordersRows.length; i++) {
    let order = ordersRows[i];
    order.total = utils.round(order.total);
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
        if (order.promoCode === "BOGO") {
          // For each identical pizza, every second one is free
          for (let i = 0; i < order.items.length; i++) {
            const item = order.items[i];
            const freeQty = Math.floor(item.qty / 2);
            total -= pizza.getPizzaPrice(item.pizzaId) * freeQty;
          }
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

            let q =
              "INSERT INTO orders (total, status, promo, email) VALUES (?, 'CREATED', ?, ?)";
            db.run(q, [total, promo, customerEmail], function (err3) {
              if (err3) return cb({ error: "db error" });
              cb(null, {
                id: this.lastID,
                totalHT: utils.round(totalHT),
                totalTTC: utils.round(total),
                email: customerEmail,
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

    cb(null, applyInflationTax(rows));
  });
}

function getOrdersByEmail(email, cb) {
  if (!isValidEmail(email)) {
    return cb({ error: "invalid email" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  db.all(
    "SELECT * FROM orders WHERE email = ?",
    [normalizedEmail],
    function (err, rows) {
      if (err) return cb(err);

      cb(null, applyInflationTax(rows));
    },
  );
}

module.exports = {
  createOrder,
  getOrders,
  getOrdersByEmail,
};
