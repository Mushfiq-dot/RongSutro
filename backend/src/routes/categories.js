const express = require('express');
const pool = require('../db');
const { asyncHandler } = require('../utils');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, name, slug FROM categories ORDER BY name ASC'
  );
  res.json({ categories: rows });
}));

module.exports = router;
