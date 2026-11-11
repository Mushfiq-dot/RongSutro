require('dotenv').config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('replace-with')) {
  console.error('Set JWT_SECRET in backend/.env to a fresh random value (at least 32 characters).');
  process.exit(1);
}

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const pool = require('./db');

const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const artisanRoutes = require('./routes/artisans');
const productRoutes = require('./routes/products');
const addressRoutes = require('./routes/addresses');
const cartRoutes = require('./routes/cart');
const wishlistRoutes = require('./routes/wishlist');
const orderRoutes = require('./routes/orders');
const reviewRoutes = require('./routes/reviews');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'rongsutro-api', database: 'connected' });
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/artisans', artisanRoutes);
app.use('/api/products', productRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found.' }));

const publicDirectory = path.resolve(__dirname, '../../public');
app.use(express.static(publicDirectory, { index: 'index.html', dotfiles: 'ignore' }));
app.get('*', (req, res, next) => {
  res.sendFile(path.join(publicDirectory, 'index.html'), error => error && next(error));
});
app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : error.message
  });
});

app.listen(port, () => console.log(`RongSutro API listening on http://localhost:${port}`));
