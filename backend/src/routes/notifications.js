const express = require('express');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');
const { asyncHandler } = require('../utils');

const router = express.Router();
router.use(authRequired);

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, title, message, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [req.user.id]
  );
  res.json({ notifications: rows });
}));

router.patch('/:id/read', asyncHandler(async (req, res) => {
  const [result] = await pool.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Notification not found.' });
  res.json({ message: 'Notification marked as read.' });
}));

module.exports = router;
