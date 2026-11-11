const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { issueToken, authRequired } = require('../middleware/auth');
const { asyncHandler, normalizeEmail } = require('../utils');

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, phone, password, role = 'customer', shop_name, story, district } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!name || !normalizedEmail || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (!['customer', 'artisan'].includes(role)) {
    return res.status(400).json({ error: 'New accounts can only be customer or artisan accounts.' });
  }
  if (role === 'artisan' && (!shop_name || !district)) {
    return res.status(400).json({ error: 'Artisan accounts need a shop name and district.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await connection.execute(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), normalizedEmail, phone || null, passwordHash, role]
    );

    if (role === 'artisan') {
      await connection.execute(
        'INSERT INTO artisans (user_id, shop_name, story, district, status) VALUES (?, ?, ?, ?, ?)',
        [result.insertId, shop_name.trim(), story || null, district.trim(), 'pending']
      );
    }

    await connection.commit();
    const user = { id: result.insertId, name: name.trim(), email: normalizedEmail, phone: phone || null, role };
    res.status(201).json({ user, token: issueToken(user) });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'An account with that email already exists.' });
    throw error;
  } finally {
    connection.release();
  }
}));

router.post('/login', asyncHandler(async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body.email);
  const { password } = req.body;
  if (!normalizedEmail || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const [rows] = await pool.execute(
    'SELECT id, name, email, phone, password_hash, role, is_active FROM users WHERE email = ? LIMIT 1',
    [normalizedEmail]
  );
  const user = rows[0];
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  delete user.password_hash;
  delete user.is_active;
  res.json({ user, token: issueToken(user) });
}));

router.get('/me', authRequired, asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.phone, u.role, a.id AS artisan_id,
            a.shop_name, a.story, a.district, a.status AS artisan_status
       FROM users u
       LEFT JOIN artisans a ON a.user_id = u.id
      WHERE u.id = ?`,
    [req.user.id]
  );
  res.json({ user: rows[0] });
}));

module.exports = router;
