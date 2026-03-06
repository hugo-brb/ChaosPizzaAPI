const utils = require('../utils');

describe('Utils - round()', () => {
  test('devrait arrondir correctement à 2 décimales', () => {
    expect(utils.round(10.567)).toBe(10.57);
    expect(utils.round(10.564)).toBe(10.56);
  });

  test('devrait retourner 0 pour une valeur falsy', () => {
    expect(utils.round(0)).toBe(0);
    expect(utils.round(null)).toBe(0);
    expect(utils.round(undefined)).toBe(0);
  });

  test('devrait gérer les nombres entiers', () => {
    expect(utils.round(10)).toBe(10);
  });
});

describe('Utils - formatPrice()', () => {
  test('devrait formatter le prix avec €', () => {
    expect(utils.formatPrice(10)).toBe('10€');
    expect(utils.formatPrice(15.99)).toBe('15.99€');
  });

  test('devrait gérer 0', () => {
    expect(utils.formatPrice(0)).toBe('0€');
  });
});

describe('Utils - calculateOrderTotalLegacy()', () => {
  test('devrait calculer le total d\'une commande simple', () => {
    const mockOrder = {
      items: [
        { pizzaId: 1, qty: 2 }
      ]
    };
    
    // Note: ce test nécessite que la DB soit initialisée avec des pizzas
    const total = utils.calculateOrderTotalLegacy(mockOrder);
    expect(typeof total).toBe('number');
    expect(total).toBeGreaterThanOrEqual(0);
  });

  test('devrait retourner 0 pour une commande invalide', () => {
    expect(utils.calculateOrderTotalLegacy(null)).toBe(0);
    expect(utils.calculateOrderTotalLegacy({})).toBe(0);
    expect(utils.calculateOrderTotalLegacy({ items: [] })).toBe(0);
  });

  test('devrait gérer les items sans pizzaId', () => {
    const mockOrder = {
      items: [
        { qty: 2 }
      ]
    };
    const total = utils.calculateOrderTotalLegacy(mockOrder);
    expect(total).toBe(0);
  });

  test('devrait gérer les quantités par défaut', () => {
    const mockOrder = {
      items: [
        { pizzaId: 1 }
      ]
    };
    const total = utils.calculateOrderTotalLegacy(mockOrder);
    expect(typeof total).toBe('number');
  });
});
