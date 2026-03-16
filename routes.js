const express = require('express');
const router = express.Router();
const pizza = require('./pizza');
const orders = require('./orderManager');

router.get('/pizzas', (req, res) => {
  pizza.getAllPizzas((err, rows) => {
    if (err) res.status(500).send("err");
    else res.json(rows);
  });
});

router.post('/orders', (req, res) => {
  orders.createOrder(req.body, (err, result) => {
    if (err) res.status(400).json(err);
    else res.json(result);
  });
});

router.get('/orders', (req, res) => {
  orders.getOrders((err, result) => {
    res.json(result);
  });
});

router.get('/config', (req, res) => {
  res.json(require('./config'));
});

module.exports = router;