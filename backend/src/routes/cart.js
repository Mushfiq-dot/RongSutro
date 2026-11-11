const express = require('express');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');
const { asyncHandler, asPositiveInt } = require('../utils');

const router = express.Router();
router.use(authRequired);

async function getOrCreateCart(userId, connection = pool) {
  const [rows] = await connection.execute('SELECT id FROM carts WHERE user_id = ? LIMIT 1', [userId]);
  if (rows[0]) return rows[0].id;
  const [result] = await connection.execute('INSERT INTO carts (user_id) VALUES (?)', [userId]);
  return result.insertId;
}

async function cartPayload(userId) {
  const [rows] = await pool.execute(
    `SELECT c.id AS cart_id, ci.product_id, ci.quantity, p.name, p.price_paisa,
            p.stock, a.shop_name AS artisan_shop_name,
            (ci.quantity * p.price_paisa) AS line_total_paisa
       FROM carts c
       LEFT JOIN cart_items ci ON ci.cart_id = c.id
       LEFT JOIN products p ON p.id = ci.product_id
       LEFT JOIN artisans a ON a.id = p.artisan_id
      WHERE c.user_id = ?
      ORDER BY ci.created_at ASC`,
    [userId]
  );
  const items = rows.filter((row) => row.product_id);
  return { cart_id: rows[0]?.cart_id || null, items, total_paisa: items.reduce((sum, item) => sum + Number(item.line_total_paisa), 0) };
}

router.get('/', asyncHandler(async (req, res) => res.json(await cartPayload(req.user.id))));

router.post('/items', asyncHandler(async (req, res) => {
  const productId = asPositiveInt(req.body.product_id, 0);
  const quantity = asPositiveInt(req.body.quantity, 1);
  if (!productId) return res.status(400).json({ error: 'A valid product_id is required.' });

  const [products] = await pool.execute('SELECT id, stock, status FROM products WHERE id = ? LIMIT 1', [productId]);
  const product = products[0];
  if (!product || product.status !== 'approved') return res.status(404).json({ error: 'Product is not available.' });
  const cartId = await getOrCreateCart(req.user.id);
  const [existing] = await pool.execute('SELECT quantity FROM cart_items WHERE cart_id = ? AND product_id = ? LIMIT 1', [cartId, productId]);
  const nextQuantity = Number(existing[0]?.quantity || 0) + quantity;
  if (nextQuantity > product.stock) return res.status(409).json({ error: `Only ${product.stock} unit(s) are currently in stock.` });

  if (existing[0]) await pool.execute('UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?', [nextQuantity, cartId, productId]);
  else await pool.execute('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)', [cartId, productId, quantity]);
  res.status(201).json(await cartPayload(req.user.id));
}));

router.patch('/items/:productId', asyncHandler(async (req, res) => {
  const quantity = asPositiveInt(req.body.quantity, 0);
  const cartId = await getOrCreateCart(req.user.id);
  if (!quantity) {
    await pool.execute('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?', [cartId, req.params.productId]);
  } else {
    const [products] = await pool.execute('SELECT stock, status FROM products WHERE id = ? LIMIT 1', [req.params.productId]);
    if (!products[0] || products[0].status !== 'approved') return res.status(404).json({ error: 'Product is not available.' });
    if (quantity > products[0].stock) return res.status(409).json({ error: 'Requested quantity exceeds current stock.' });
    await pool.execute('UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?', [quantity, cartId, req.params.productId]);
  }
  res.json(await cartPayload(req.user.id));
}));

router.delete('/items/:productId', asyncHandler(async (req, res) => {
  const cartId = await getOrCreateCart(req.user.id);
  await pool.execute('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?', [cartId, req.params.productId]);
  res.json(await cartPayload(req.user.id));
}));

router.delete('/', asyncHandler(async (req, res) => {
  const cartId = await getOrCreateCart(req.user.id);
  await pool.execute('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
  res.json({ cart_id: cartId, items: [], total_paisa: 0 });
}));

module.exports = router;
