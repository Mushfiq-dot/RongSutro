const express = require('express');
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { asyncHandler, asPositiveInt } = require('../utils');

const router = express.Router();
router.use(authRequired);

function orderNumber() {
  return `RS-${String(Date.now()).slice(-8)}`;
}

async function canAccessOrder(orderId, user) {
  if (user.role === 'admin') return true;
  if (user.role === 'customer') {
    const [rows] = await pool.execute('SELECT id FROM orders WHERE id = ? AND customer_id = ? LIMIT 1', [orderId, user.id]);
    return Boolean(rows[0]);
  }
  const [rows] = await pool.execute(
    `SELECT oi.id
       FROM order_items oi
       JOIN artisans a ON a.id = oi.artisan_id
      WHERE oi.order_id = ? AND a.user_id = ? LIMIT 1`,
    [orderId, user.id]
  );
  return Boolean(rows[0]);
}

async function orderPayload(orderId) {
  const [orders] = await pool.execute(
    `SELECT o.id, o.order_number, o.customer_id, o.shipping_address_id, o.status,
            o.total_paisa, o.shipping_paisa, o.created_at, o.updated_at,
            u.name AS customer_name, u.email AS customer_email,
            ad.recipient, ad.phone, ad.address_line, ad.district, ad.city, ad.postal_code,
            p.id AS payment_id, p.provider AS payment_provider, p.status AS payment_status,
            s.id AS shipment_id, s.tracking_number, s.courier, s.status AS shipment_status
       FROM orders o
       JOIN users u ON u.id = o.customer_id
       LEFT JOIN addresses ad ON ad.id = o.shipping_address_id
       LEFT JOIN payments p ON p.order_id = o.id
       LEFT JOIN shipments s ON s.order_id = o.id
      WHERE o.id = ?
      LIMIT 1`,
    [orderId]
  );
  if (!orders[0]) return null;
  const [items] = await pool.execute(
    `SELECT oi.id, oi.product_id, oi.artisan_id, oi.product_name, oi.quantity,
            oi.unit_price_paisa, oi.commission_paisa, oi.artisan_share_paisa,
            a.shop_name AS artisan_shop_name
       FROM order_items oi
       LEFT JOIN artisans a ON a.id = oi.artisan_id
      WHERE oi.order_id = ? ORDER BY oi.id ASC`,
    [orderId]
  );
  return { ...orders[0], items };
}

router.get('/', asyncHandler(async (req, res) => {
  const values = [];
  let query = `SELECT o.id, o.order_number, o.status, o.total_paisa, o.shipping_paisa, o.created_at,
                      u.name AS customer_name, COUNT(oi.id) AS item_count
                 FROM orders o
                 JOIN users u ON u.id = o.customer_id
                 LEFT JOIN order_items oi ON oi.order_id = o.id`;
  if (req.user.role === 'customer') { query += ' WHERE o.customer_id = ?'; values.push(req.user.id); }
  else if (req.user.role === 'artisan') {
    query += ' JOIN artisans viewer_artisan ON viewer_artisan.user_id = ? WHERE oi.artisan_id = viewer_artisan.id';
    values.push(req.user.id);
  }
  query += ' GROUP BY o.id ORDER BY o.created_at DESC';
  const [rows] = await pool.execute(query, values);
  res.json({ orders: rows });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!(await canAccessOrder(req.params.id, req.user))) return res.status(403).json({ error: 'You cannot view this order.' });
  const order = await orderPayload(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json({ order });
}));

router.post('/', requireRole('customer'), asyncHandler(async (req, res) => {
  const addressId = asPositiveInt(req.body.address_id, 0);
  if (!addressId) return res.status(400).json({ error: 'address_id is required.' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [addresses] = await connection.execute('SELECT id FROM addresses WHERE id = ? AND user_id = ? LIMIT 1', [addressId, req.user.id]);
    if (!addresses[0]) { await connection.rollback(); return res.status(400).json({ error: 'The selected address does not belong to you.' }); }

    const [cartRows] = await connection.execute(
      `SELECT ci.product_id, ci.quantity, p.name, p.price_paisa, p.stock, p.artisan_id, p.status
         FROM carts c JOIN cart_items ci ON ci.cart_id = c.id
         JOIN products p ON p.id = ci.product_id
        WHERE c.user_id = ? FOR UPDATE`,
      [req.user.id]
    );
    if (!cartRows.length) { await connection.rollback(); return res.status(400).json({ error: 'Your cart is empty.' }); }
    for (const item of cartRows) {
      if (item.status !== 'approved') { await connection.rollback(); return res.status(409).json({ error: `${item.name} is no longer available.` }); }
      if (item.quantity > item.stock) { await connection.rollback(); return res.status(409).json({ error: `${item.name} does not have enough stock.` }); }
    }

    const subtotal = cartRows.reduce((sum, item) => sum + Number(item.price_paisa) * item.quantity, 0);
    const shipping = 15000;
    const [orderResult] = await connection.execute(
      `INSERT INTO orders (customer_id, shipping_address_id, order_number, status, total_paisa, shipping_paisa)
       VALUES (?, ?, ?, 'processing', ?, ?)`,
      [req.user.id, addressId, orderNumber(), subtotal + shipping, shipping]
    );

    for (const item of cartRows) {
      const commission = Math.round(Number(item.price_paisa) * 0.28);
      const artisanShare = Number(item.price_paisa) - commission;
      const [itemResult] = await connection.execute(
        `INSERT INTO order_items
          (order_id, product_id, artisan_id, product_name, quantity, unit_price_paisa, commission_paisa, artisan_share_paisa)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderResult.insertId, item.product_id, item.artisan_id, item.name, item.quantity, item.price_paisa, commission * item.quantity, artisanShare * item.quantity]
      );
      await connection.execute(
        `INSERT INTO artisan_ledger
          (artisan_id, order_item_id, gross_paisa, commission_paisa, artisan_share_paisa, entry_type)
         VALUES (?, ?, ?, ?, ?, 'sale')`,
        [item.artisan_id, itemResult.insertId, Number(item.price_paisa) * item.quantity, commission * item.quantity, artisanShare * item.quantity]
      );
      await connection.execute('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
    }

    await connection.execute(
      "INSERT INTO payments (order_id, provider, amount_paisa, status) VALUES (?, ?, ?, 'pending')",
      [orderResult.insertId, req.body.payment_provider || 'demo_checkout', subtotal + shipping]
    );
    await connection.execute('DELETE ci FROM cart_items ci JOIN carts c ON c.id = ci.cart_id WHERE c.user_id = ?', [req.user.id]);
    await connection.execute(
      "INSERT INTO notifications (user_id, title, message) VALUES (?, 'Order placed', ?)",
      [req.user.id, `Your RongSutro order is being prepared.`]
    );
    await connection.commit();
    res.status(201).json({ order: await orderPayload(orderResult.insertId) });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Please retry checkout; the order number already exists.' });
    throw error;
  } finally {
    connection.release();
  }
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  const allowed = ['processing', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Invalid order status.' });
  if (req.user.role === 'customer') return res.status(403).json({ error: 'Customers cannot update order status.' });
  if (!(await canAccessOrder(req.params.id, req.user))) return res.status(403).json({ error: 'You cannot update this order.' });

  await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  const order = await orderPayload(req.params.id);
  if (order) await pool.execute(
    "INSERT INTO notifications (user_id, title, message) VALUES (?, 'Order updated', ?)",
    [order.customer_id, `Order ${order.order_number} is now ${req.body.status}.`]
  );
  res.json({ order });
}));

module.exports = router;
