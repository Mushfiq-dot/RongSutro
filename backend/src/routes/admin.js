const express = require('express');
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils');

const router = express.Router();
router.use(authRequired, requireRole('admin'));

router.get('/dashboard', asyncHandler(async (req, res) => {
  const [[gmv]] = await pool.query("SELECT COALESCE(SUM(total_paisa), 0) AS gmv_paisa, COUNT(*) AS order_count FROM orders WHERE status <> 'cancelled'");
  const [[artisans]] = await pool.query("SELECT COUNT(*) AS total, SUM(status = 'verified') AS verified, SUM(status = 'pending') AS pending FROM artisans");
  const [[products]] = await pool.query("SELECT COUNT(*) AS total, SUM(status = 'approved') AS approved, SUM(status = 'pending') AS pending FROM products");
  res.json({ gmv_paisa: Number(gmv.gmv_paisa), order_count: Number(gmv.order_count), artisans, products });
}));

router.get('/pending', asyncHandler(async (req, res) => {
  const [artisans] = await pool.query(
    `SELECT a.id, a.shop_name, a.story, a.district, a.status, u.id AS user_id, u.name, u.email
       FROM artisans a JOIN users u ON u.id = a.user_id WHERE a.status = 'pending' ORDER BY a.created_at ASC`
  );
  const [products] = await pool.query(
    `SELECT p.id, p.name, p.description, p.price_paisa, p.stock, p.created_at,
            a.id AS artisan_id, a.shop_name, u.name AS artisan_name, c.name AS category_name
       FROM products p JOIN artisans a ON a.id = p.artisan_id JOIN users u ON u.id = a.user_id
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'pending' ORDER BY p.created_at ASC`
  );
  res.json({ artisans, products });
}));

module.exports = router;
