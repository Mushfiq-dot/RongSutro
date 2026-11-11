const express = require('express');
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { asyncHandler, asPositiveInt } = require('../utils');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(asPositiveInt(req.query.limit, 24), 100);
  const offset = Math.max(Number.parseInt(req.query.offset || 0, 10) || 0, 0);
  const values = [];
  const where = ["p.status = 'approved'"];

  if (req.query.category_id) { where.push('p.category_id = ?'); values.push(req.query.category_id); }
  if (req.query.artisan_id) { where.push('p.artisan_id = ?'); values.push(req.query.artisan_id); }
  if (req.query.q) {
    where.push('(p.name LIKE ? OR p.description LIKE ? OR a.shop_name LIKE ? OR c.name LIKE ?)');
    const search = `%${req.query.q}%`;
    values.push(search, search, search, search);
  }

  const [rows] = await pool.execute(
    `SELECT p.id, p.artisan_id, p.category_id, p.name, p.description,
            p.price_paisa, p.stock, p.status, p.created_at, p.updated_at,
            a.shop_name AS artisan_shop_name, u.name AS artisan_name,
            c.name AS category_name, c.slug AS category_slug,
            COALESCE(AVG(r.rating), 0) AS average_rating, COUNT(r.id) AS review_count,
            (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC LIMIT 1) AS image_url
       FROM products p
       JOIN artisans a ON a.id = p.artisan_id
       JOIN users u ON u.id = a.user_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN reviews r ON r.product_id = p.id
      WHERE ${where.join(' AND ')}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );
  res.json({ products: rows, pagination: { limit, offset } });
}));

router.get('/mine', authRequired, requireRole('artisan', 'admin'), asyncHandler(async (req, res) => {
  const limit = Math.min(asPositiveInt(req.query.limit, 100), 100);
  const offset = Math.max(Number.parseInt(req.query.offset || 0, 10) || 0, 0);
  let artisanId = req.query.artisan_id || null;
  if (req.user.role === 'artisan') {
    const artisan = await artisanForUser(req.user.id);
    if (!artisan) return res.status(404).json({ error: 'Artisan profile not found.' });
    artisanId = artisan.id;
  }
  const values = [];
  let where = '1 = 1';
  if (artisanId) { where += ' AND p.artisan_id = ?'; values.push(artisanId); }
  const [rows] = await pool.execute(
    `SELECT p.id, p.artisan_id, p.category_id, p.name, p.description,
            p.price_paisa, p.stock, p.status, p.created_at, p.updated_at,
            a.shop_name AS artisan_shop_name, u.name AS artisan_name,
            c.name AS category_name, c.slug AS category_slug,
            (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC LIMIT 1) AS image_url
       FROM products p JOIN artisans a ON a.id = p.artisan_id
       JOIN users u ON u.id = a.user_id LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );
  res.json({ products: rows, pagination: { limit, offset } });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT p.id, p.artisan_id, p.category_id, p.name, p.description,
            p.price_paisa, p.stock, p.status, p.created_at, p.updated_at,
            a.shop_name AS artisan_shop_name, u.name AS artisan_name,
            a.district, c.name AS category_name, c.slug AS category_slug,
            COALESCE(AVG(r.rating), 0) AS average_rating, COUNT(r.id) AS review_count
       FROM products p
       JOIN artisans a ON a.id = p.artisan_id
       JOIN users u ON u.id = a.user_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN reviews r ON r.product_id = p.id
      WHERE p.id = ? AND p.status = 'approved'
      GROUP BY p.id
      LIMIT 1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Product not found.' });

  const [images] = await pool.execute(
    'SELECT id, image_url, alt_text, sort_order, is_primary FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC, id ASC',
    [req.params.id]
  );
  res.json({ product: { ...rows[0], images } });
}));

async function artisanForUser(userId) {
  const [rows] = await pool.execute('SELECT id, status FROM artisans WHERE user_id = ? LIMIT 1', [userId]);
  return rows[0];
}

router.post('/', authRequired, requireRole('artisan', 'admin'), asyncHandler(async (req, res) => {
  const { name, description, price_paisa, stock = 0, category_id, image_url, alt_text } = req.body;
  const parsedStock = Number(stock);
  if (!name || !Number.isInteger(Number(price_paisa)) || Number(price_paisa) < 1 || !Number.isInteger(Number(category_id)) || Number(category_id) < 1) {
    return res.status(400).json({ error: 'Name, category_id and a positive integer price_paisa are required.' });
  }
  if (!Number.isInteger(parsedStock) || parsedStock < 0) {
    return res.status(400).json({ error: 'Stock must be a non-negative whole number.' });
  }

  let artisanId = req.body.artisan_id;
  if (req.user.role === 'artisan') {
    const artisan = await artisanForUser(req.user.id);
    if (!artisan) return res.status(403).json({ error: 'Your artisan profile has not been created.' });
    artisanId = artisan.id;
  }
  if (!artisanId) return res.status(400).json({ error: 'artisan_id is required for admin-created products.' });

  const status = req.user.role === 'admin' ? (req.body.status || 'approved') : 'pending';
  const [result] = await pool.execute(
    `INSERT INTO products (artisan_id, category_id, name, description, price_paisa, stock, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [artisanId, category_id, name.trim(), description || null, Number(price_paisa), parsedStock, status]
  );

  if (image_url) await pool.execute(
    'INSERT INTO product_images (product_id, image_url, alt_text, is_primary) VALUES (?, ?, ?, 1)',
    [result.insertId, image_url, alt_text || name]
  );
  res.status(201).json({ id: result.insertId, status });
}));

router.patch('/:id', authRequired, requireRole('artisan', 'admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.execute('SELECT id, artisan_id, status FROM products WHERE id = ? LIMIT 1', [req.params.id]);
  const product = rows[0];
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  if (req.user.role === 'artisan') {
    const artisan = await artisanForUser(req.user.id);
    if (!artisan || artisan.id !== product.artisan_id) return res.status(403).json({ error: 'You can only edit your own products.' });
  }

  const allowed = ['name', 'description', 'price_paisa', 'stock', 'category_id'];
  const updates = [];
  const values = [];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) { updates.push(`${field} = ?`); values.push(req.body[field]); }
  });
  if (req.user.role === 'admin' && req.body.status !== undefined) {
    if (!['pending', 'approved', 'rejected', 'archived'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid product status.' });
    updates.push('status = ?'); values.push(req.body.status);
  }
  if (!updates.length) return res.status(400).json({ error: 'No editable fields were provided.' });

  values.push(req.params.id);
  await pool.execute(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);
  res.json({ message: 'Product updated.' });
}));

router.delete('/:id', authRequired, requireRole('artisan', 'admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.execute('SELECT artisan_id FROM products WHERE id = ? LIMIT 1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Product not found.' });
  if (req.user.role === 'artisan') {
    const artisan = await artisanForUser(req.user.id);
    if (!artisan || artisan.id !== rows[0].artisan_id) return res.status(403).json({ error: 'You can only remove your own products.' });
  }
  await pool.execute("UPDATE products SET status = 'archived' WHERE id = ?", [req.params.id]);
  res.json({ message: 'Product archived.' });
}));

module.exports = router;
