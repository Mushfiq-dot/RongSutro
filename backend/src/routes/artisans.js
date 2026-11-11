const express = require('express');
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { asyncHandler, asPositiveInt } = require('../utils');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(asPositiveInt(req.query.limit, 24), 100);
  const offset = Math.max(Number.parseInt(req.query.offset || 0, 10) || 0, 0);
  const [rows] = await pool.execute(
    `SELECT a.id, a.shop_name, a.story, a.district, a.status, a.created_at,
            u.name, COUNT(DISTINCT p.id) AS product_count
       FROM artisans a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN products p ON p.artisan_id = a.id AND p.status = 'approved'
      WHERE a.status = 'verified'
      GROUP BY a.id
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  res.json({ artisans: rows });
}));

router.get('/me/summary', authRequired, requireRole('artisan'), asyncHandler(async (req, res) => {
  const [profiles] = await pool.execute(
    'SELECT id, shop_name, story, district, status, created_at FROM artisans WHERE user_id = ? LIMIT 1',
    [req.user.id]
  );
  const artisan = profiles[0];
  if (!artisan) return res.status(404).json({ error: 'Artisan profile not found.' });
  const [[products]] = await pool.execute(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(status = 'approved'), 0) AS approved,
            COALESCE(SUM(status = 'pending'), 0) AS pending
       FROM products WHERE artisan_id = ?`, [artisan.id]
  );
  const [[ledger]] = await pool.execute(
    `SELECT COALESCE(SUM(al.artisan_share_paisa), 0) AS earnings_paisa,
            COALESCE(SUM(al.gross_paisa), 0) AS gross_paisa,
            COALESCE(SUM(al.commission_paisa), 0) AS commission_paisa,
            COUNT(DISTINCT oi.order_id) AS order_count
       FROM artisan_ledger al
       LEFT JOIN order_items oi ON oi.id = al.order_item_id
      WHERE al.artisan_id = ?`, [artisan.id]
  );
  res.json({ artisan, products: Object.fromEntries(Object.entries(products).map(([key, value]) => [key, Number(value)])),
    earnings_paisa: Number(ledger.earnings_paisa), gross_paisa: Number(ledger.gross_paisa),
    commission_paisa: Number(ledger.commission_paisa), order_count: Number(ledger.order_count) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT a.id, a.shop_name, a.story, a.district, a.status, a.created_at,
            u.id AS user_id, u.name, u.email,
            COUNT(DISTINCT p.id) AS product_count
       FROM artisans a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN products p ON p.artisan_id = a.id AND p.status = 'approved'
      WHERE a.id = ?
      GROUP BY a.id
      LIMIT 1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Artisan not found.' });
  res.json({ artisan: rows[0] });
}));

router.patch('/:id/status', authRequired, requireRole('admin'), asyncHandler(async (req, res) => {
  const allowed = ['pending', 'verified', 'suspended'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Invalid artisan status.' });
  const [result] = await pool.execute('UPDATE artisans SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Artisan not found.' });
  res.json({ message: 'Artisan status updated.', status: req.body.status });
}));

module.exports = router;
