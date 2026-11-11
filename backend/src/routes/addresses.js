const express = require('express');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');
const { asyncHandler } = require('../utils');

const router = express.Router();
router.use(authRequired);

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, recipient, phone, address_line, district, city, postal_code, is_default, created_at FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
    [req.user.id]
  );
  res.json({ addresses: rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { recipient, phone, address_line, district, city = 'Dhaka', postal_code, is_default = false } = req.body;
  if (!recipient || !phone || !address_line || !district) return res.status(400).json({ error: 'Recipient, phone, address_line and district are required.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (is_default) await connection.execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    const [result] = await connection.execute(
      `INSERT INTO addresses (user_id, recipient, phone, address_line, district, city, postal_code, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, recipient, phone, address_line, district, city, postal_code || null, Boolean(is_default)]
    );
    await connection.commit();
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.patch('/:id/default', asyncHandler(async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [owned] = await connection.execute('SELECT id FROM addresses WHERE id = ? AND user_id = ? LIMIT 1', [req.params.id, req.user.id]);
    if (!owned[0]) { await connection.rollback(); return res.status(404).json({ error: 'Address not found.' }); }
    await connection.execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    await connection.execute('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    await connection.commit();
    res.json({ message: 'Default address updated.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const [result] = await pool.execute('DELETE FROM addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Address not found.' });
  res.json({ message: 'Address deleted.' });
}));

module.exports = router;
