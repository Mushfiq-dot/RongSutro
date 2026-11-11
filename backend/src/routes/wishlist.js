const express = require('express');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');
const { asyncHandler } = require('../utils');

const router = express.Router();
router.use(authRequired);

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT w.id, w.product_id, w.created_at, p.name, p.price_paisa, p.stock,
            p.category_id, c.name AS category_name,
            a.shop_name AS artisan_shop_name,
            (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC LIMIT 1) AS image_url
       FROM wishlist_items w
       JOIN products p ON p.id = w.product_id
       JOIN artisans a ON a.id = p.artisan_id
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE w.user_id = ? ORDER BY w.created_at DESC`,
    [req.user.id]
  );
  res.json({ items: rows });
}));

router.post('/:productId', asyncHandler(async (req, res) => {
  const [products] = await pool.execute('SELECT id FROM products WHERE id = ? AND status = \'approved\' LIMIT 1', [req.params.productId]);
  if (!products[0]) return res.status(404).json({ error: 'Product not found.' });
  try {
    await pool.execute('INSERT INTO wishlist_items (user_id, product_id) VALUES (?, ?)', [req.user.id, req.params.productId]);
    res.status(201).json({ message: 'Product added to wishlist.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Product is already in your wishlist.' });
    throw error;
  }
}));

router.delete('/:productId', asyncHandler(async (req, res) => {
  await pool.execute('DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?', [req.user.id, req.params.productId]);
  res.json({ message: 'Product removed from wishlist.' });
}));

module.exports = router;
