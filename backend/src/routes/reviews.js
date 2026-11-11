const express = require('express');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');
const { asyncHandler, asPositiveInt } = require('../utils');

const router = express.Router();

router.get('/product/:productId', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS customer_name
       FROM reviews r JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ? ORDER BY r.created_at DESC`,
    [req.params.productId]
  );
  res.json({ reviews: rows });
}));

router.post('/product/:productId', authRequired, asyncHandler(async (req, res) => {
  const rating = asPositiveInt(req.body.rating, 0);
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be an integer from 1 to 5.' });
  const [products] = await pool.execute('SELECT id FROM products WHERE id = ? AND status = \'approved\' LIMIT 1', [req.params.productId]);
  if (!products[0]) return res.status(404).json({ error: 'Product not found.' });

  const [purchased] = await pool.execute(
    `SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.customer_id = ? AND oi.product_id = ? AND o.status = 'delivered' LIMIT 1`,
    [req.user.id, req.params.productId]
  );
  if (!purchased[0]) return res.status(403).json({ error: 'You can review a product after it has been delivered to you.' });

  try {
    const [result] = await pool.execute(
      'INSERT INTO reviews (user_id, product_id, rating, comment) VALUES (?, ?, ?, ?)',
      [req.user.id, req.params.productId, rating, req.body.comment || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'You have already reviewed this product.' });
    throw error;
  }
}));

module.exports = router;
