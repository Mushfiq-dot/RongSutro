-- RongSutro MySQL schema + demo seed data
-- Tested for MySQL 8.0+ / MariaDB 10.6+ compatibility.
-- All monetary columns are stored as integer paisa: Tk 1.00 = 100 paisa.

CREATE DATABASE IF NOT EXISTS RongSutro
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE RongSutro;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS artisan_ledger;
DROP TABLE IF EXISTS payouts;
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS carts;
DROP TABLE IF EXISTS wishlist_items;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS addresses;
DROP TABLE IF EXISTS artisans;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer', 'artisan', 'admin') NOT NULL DEFAULT 'customer',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB;

CREATE TABLE artisans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  shop_name VARCHAR(160) NOT NULL,
  story TEXT NULL,
  district VARCHAR(100) NOT NULL,
  status ENUM('pending', 'verified', 'suspended') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_artisans_user (user_id),
  KEY idx_artisans_status (status),
  CONSTRAINT fk_artisans_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE addresses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  recipient VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  address_line VARCHAR(255) NOT NULL,
  district VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL DEFAULT 'Dhaka',
  postal_code VARCHAR(20) NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_addresses_user_default (user_id, is_default),
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(110) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name),
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB;

CREATE TABLE products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  artisan_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT NULL,
  price_paisa BIGINT UNSIGNED NOT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('pending', 'approved', 'rejected', 'archived') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_products_artisan_status (artisan_id, status),
  KEY idx_products_category_status (category_id, status),
  KEY idx_products_status_created (status, created_at),
  CONSTRAINT fk_products_artisan FOREIGN KEY (artisan_id) REFERENCES artisans (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_products_price CHECK (price_paisa > 0)
) ENGINE=InnoDB;

CREATE TABLE product_images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  alt_text VARCHAR(255) NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_images_product (product_id, is_primary, sort_order),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reviews_user_product (user_id, product_id),
  KEY idx_reviews_product (product_id, created_at),
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

CREATE TABLE wishlist_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wishlist_user_product (user_id, product_id),
  CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE carts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_carts_user (user_id),
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE cart_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cart_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_items_cart_product (cart_id, product_id),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_cart_items_quantity CHECK (quantity > 0)
) ENGINE=InnoDB;

CREATE TABLE orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  shipping_address_id BIGINT UNSIGNED NULL,
  order_number VARCHAR(32) NOT NULL,
  status ENUM('processing', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'processing',
  total_paisa BIGINT UNSIGNED NOT NULL,
  shipping_paisa BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_number (order_number),
  KEY idx_orders_customer_created (customer_id, created_at),
  KEY idx_orders_status_created (status, created_at),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orders_address FOREIGN KEY (shipping_address_id) REFERENCES addresses (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_orders_total CHECK (total_paisa >= 0)
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  artisan_id BIGINT UNSIGNED NOT NULL,
  product_name VARCHAR(180) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price_paisa BIGINT UNSIGNED NOT NULL,
  commission_paisa BIGINT UNSIGNED NOT NULL DEFAULT 0,
  artisan_share_paisa BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_product (product_id),
  KEY idx_order_items_artisan (artisan_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_order_items_artisan FOREIGN KEY (artisan_id) REFERENCES artisans (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_order_items_quantity CHECK (quantity > 0)
) ENGINE=InnoDB;

CREATE TABLE payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(60) NOT NULL DEFAULT 'demo_checkout',
  transaction_ref VARCHAR(120) NULL,
  amount_paisa BIGINT UNSIGNED NOT NULL,
  status ENUM('pending', 'authorized', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payments_order_status (order_id, status),
  UNIQUE KEY uq_payments_provider_ref (provider, transaction_ref),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE shipments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  tracking_number VARCHAR(120) NULL,
  courier VARCHAR(100) NULL,
  status ENUM('pending', 'in_transit', 'delivered', 'returned') NOT NULL DEFAULT 'pending',
  shipped_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_shipments_order (order_id),
  UNIQUE KEY uq_shipments_tracking (tracking_number),
  CONSTRAINT fk_shipments_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE payouts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  artisan_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  amount_paisa BIGINT UNSIGNED NOT NULL,
  status ENUM('pending', 'processing', 'paid', 'failed') NOT NULL DEFAULT 'pending',
  reference VARCHAR(120) NULL,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payouts_artisan_status (artisan_id, status),
  CONSTRAINT fk_payouts_artisan FOREIGN KEY (artisan_id) REFERENCES artisans (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_payouts_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE artisan_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  artisan_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NULL,
  gross_paisa BIGINT UNSIGNED NOT NULL DEFAULT 0,
  commission_paisa BIGINT UNSIGNED NOT NULL DEFAULT 0,
  artisan_share_paisa BIGINT UNSIGNED NOT NULL DEFAULT 0,
  entry_type ENUM('sale', 'payout', 'adjustment') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ledger_artisan_created (artisan_id, created_at),
  KEY idx_ledger_order_item (order_item_id),
  CONSTRAINT fk_ledger_artisan FOREIGN KEY (artisan_id) REFERENCES artisans (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_ledger_order_item FOREIGN KEY (order_item_id) REFERENCES order_items (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_read (user_id, is_read, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Demo seed data. The password for every seeded user is: password
-- Change these credentials before using the database outside a demo.
INSERT INTO users (id, name, email, phone, password_hash, role) VALUES
  (1, 'Ayesha Rahman', 'ayesha@example.com', '+8801712345678', '$2a$10$cz5QeXmpj3UngCMKi2xOTe6wfKov//rhbKb7Hec/KNOPb889pMfta', 'customer'),
  (2, 'Nusrat Jahan', 'nusrat@example.com', '+8801812345678', '$2a$10$cz5QeXmpj3UngCMKi2xOTe6wfKov//rhbKb7Hec/KNOPb889pMfta', 'customer'),
  (3, 'Rina Begum', 'rina@rongsutro.demo', '+8801912345678', '$2a$10$cz5QeXmpj3UngCMKi2xOTe6wfKov//rhbKb7Hec/KNOPb889pMfta', 'artisan'),
  (4, 'Shahana Khatun', 'shahana@rongsutro.demo', '+8801912345679', '$2a$10$cz5QeXmpj3UngCMKi2xOTe6wfKov//rhbKb7Hec/KNOPb889pMfta', 'artisan'),
  (5, 'Momena Akter', 'momena@rongsutro.demo', '+8801912345680', '$2a$10$cz5QeXmpj3UngCMKi2xOTe6wfKov//rhbKb7Hec/KNOPb889pMfta', 'artisan'),
  (6, 'Nasima Yasmin', 'nasima@rongsutro.demo', '+8801912345681', '$2a$10$cz5QeXmpj3UngCMKi2xOTe6wfKov//rhbKb7Hec/KNOPb889pMfta', 'artisan'),
  (7, 'Samira Ahmed', 'admin@rongsutro.demo', '+8801711111111', '$2a$10$cz5QeXmpj3UngCMKi2xOTe6wfKov//rhbKb7Hec/KNOPb889pMfta', 'admin');

INSERT INTO artisans (id, user_id, shop_name, story, district, status) VALUES
  (1, 3, 'Rina Begum Studio', 'Rina learned to work the loom beside her mother. Today she leads a small home studio and teaches two younger weavers.', 'Tangail', 'verified'),
  (2, 4, 'Shahana Khatun Handloom', 'Shahana loves colors that feel like sunlight. Her pieces are practical, joyful and made to be worn often.', 'Tangail', 'verified'),
  (3, 5, 'Momena Akter Muslin', 'Momena is known for patient, intricate work and a quiet belief that the finest details should be felt before they are seen.', 'Pabna', 'verified'),
  (4, 6, 'Nasima Yasmin Weaves', 'Nasima brings a fresh eye to traditional motifs and is currently completing her RongSutro verification.', 'Narsingdi', 'pending');

INSERT INTO addresses (id, user_id, recipient, phone, address_line, district, city, postal_code, is_default) VALUES
  (1, 1, 'Ayesha Rahman', '+8801712345678', 'House 24, Road 7, Dhanmondi', 'Dhanmondi', 'Dhaka', '1209', TRUE),
  (2, 2, 'Nusrat Jahan', '+8801812345678', 'House 12, Road 28, Gulshan', 'Gulshan', 'Dhaka', '1212', TRUE);

INSERT INTO categories (id, name, slug) VALUES
  (1, 'Jamdani', 'jamdani'),
  (2, 'Tangail', 'tangail'),
  (3, 'Muslin', 'muslin');

INSERT INTO products (id, artisan_id, category_id, name, description, price_paisa, stock, status) VALUES
  (1, 1, 1, 'Meghla Jamdani', 'A light-as-air Jamdani with quiet rose motifs, woven slowly on a traditional pit loom.', 485000, 10, 'approved'),
  (2, 2, 2, 'Bhorer Alo', 'A soft ivory Tangail saree finished with a warm, sunrise-inspired border.', 380000, 8, 'approved'),
  (3, 3, 3, 'Kashful Neel', 'An indigo muslin with the delicate movement of kash flowers in a river breeze.', 560000, 6, 'approved'),
  (4, 1, 2, 'Shonar Dori', 'A sunny, everyday heirloom with a hand-finished zari-inspired selvedge.', 425000, 9, 'approved'),
  (5, 4, 1, 'Nodi Paar', 'A calm sage Jamdani inspired by the changing light on a riverbank.', 510000, 7, 'approved'),
  (6, 3, 3, 'Chandrabindu', 'A rich plum muslin with small moon-like motifs for evening occasions.', 620000, 4, 'approved'),
  (7, 2, 2, 'Lal Mati', 'Warm terracotta checks made for easy days and a little extra color.', 345000, 12, 'approved'),
  (8, 4, 1, 'Bela Sheshe', 'A new pearl-white design awaiting approval from the RongSutro team.', 475000, 5, 'pending');

INSERT INTO product_images (product_id, image_url, alt_text, is_primary) VALUES
  (1, 'https://placehold.co/800x1000/f0bfd1/6e3158?text=Meghla+Jamdani', 'Meghla Jamdani', TRUE),
  (2, 'https://placehold.co/800x1000/e9d3ab/6e3158?text=Bhorer+Alo', 'Bhorer Alo', TRUE),
  (3, 'https://placehold.co/800x1000/9fb0d2/283750?text=Kashful+Neel', 'Kashful Neel', TRUE),
  (4, 'https://placehold.co/800x1000/f0c06d/6e3158?text=Shonar+Dori', 'Shonar Dori', TRUE),
  (5, 'https://placehold.co/800x1000/b4d4c1/315c4d?text=Nodi+Paar', 'Nodi Paar', TRUE),
  (6, 'https://placehold.co/800x1000/b48cac/452d59?text=Chandrabindu', 'Chandrabindu', TRUE),
  (7, 'https://placehold.co/800x1000/d58b6c/6e3158?text=Lal+Mati', 'Lal Mati', TRUE),
  (8, 'https://placehold.co/800x1000/e7dad6/6e3158?text=Bela+Sheshe', 'Bela Sheshe', TRUE);

INSERT INTO carts (id, user_id) VALUES (1, 1), (2, 2);
INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (1, 3, 1), (2, 2, 1);

INSERT INTO orders (id, customer_id, shipping_address_id, order_number, status, total_paisa, shipping_paisa, created_at) VALUES
  (1, 1, 1, 'RS-1048', 'delivered', 500000, 15000, '2026-11-08 10:30:00'),
  (2, 1, 1, 'RS-1052', 'shipped', 1085000, 15000, '2026-11-10 14:15:00'),
  (3, 2, 2, 'RS-1057', 'processing', 395000, 15000, '2026-11-12 09:20:00');

INSERT INTO order_items (id, order_id, product_id, artisan_id, product_name, quantity, unit_price_paisa, commission_paisa, artisan_share_paisa) VALUES
  (1, 1, 1, 1, 'Meghla Jamdani', 1, 485000, 135800, 349200),
  (2, 2, 3, 3, 'Kashful Neel', 1, 560000, 156800, 403200),
  (3, 2, 5, 4, 'Nodi Paar', 1, 510000, 142800, 367200),
  (4, 3, 2, 2, 'Bhorer Alo', 1, 380000, 106400, 273600);

INSERT INTO payments (id, order_id, provider, amount_paisa, status, paid_at) VALUES
  (1, 1, 'demo_checkout', 500000, 'paid', '2026-11-08 10:31:00'),
  (2, 2, 'demo_checkout', 1085000, 'paid', '2026-11-10 14:16:00'),
  (3, 3, 'demo_checkout', 395000, 'pending', NULL);

INSERT INTO shipments (id, order_id, tracking_number, courier, status, shipped_at, delivered_at) VALUES
  (1, 1, 'RSBD-1048', 'Pathao Parcel', 'delivered', '2026-11-08 15:00:00', '2026-11-12 11:00:00'),
  (2, 2, 'RSBD-1052', 'RedX', 'in_transit', '2026-11-11 10:00:00', NULL);

INSERT INTO payouts (id, artisan_id, order_id, amount_paisa, status, reference, paid_at) VALUES
  (1, 1, 1, 349200, 'paid', 'PAYOUT-RS-1048', '2026-11-14 12:00:00'),
  (2, 3, 2, 403200, 'processing', NULL, NULL),
  (3, 4, 2, 367200, 'processing', NULL, NULL);

INSERT INTO artisan_ledger (id, artisan_id, order_item_id, gross_paisa, commission_paisa, artisan_share_paisa, entry_type) VALUES
  (1, 1, 1, 485000, 135800, 349200, 'sale'),
  (2, 3, 2, 560000, 156800, 403200, 'sale'),
  (3, 4, 3, 510000, 142800, 367200, 'sale');

INSERT INTO notifications (user_id, title, message, is_read) VALUES
  (1, 'Order delivered', 'Your Meghla Jamdani order RS-1048 was delivered.', TRUE),
  (1, 'New dispatch update', 'Order RS-1052 is on its way to Dhanmondi.', FALSE),
  (3, 'Payout scheduled', 'Your next RongSutro payout is scheduled for 15 Nov 2026.', FALSE),
  (7, 'Product awaiting review', 'Bela Sheshe is waiting for product approval.', FALSE);

-- Useful reporting view for the artisan earnings dashboard.
CREATE OR REPLACE VIEW artisan_earnings AS
SELECT
  a.id AS artisan_id,
  a.shop_name,
  COALESCE(SUM(l.gross_paisa), 0) AS gross_paisa,
  COALESCE(SUM(l.commission_paisa), 0) AS commission_paisa,
  COALESCE(SUM(l.artisan_share_paisa), 0) AS artisan_share_paisa
FROM artisans a
LEFT JOIN artisan_ledger l ON l.artisan_id = a.id AND l.entry_type = 'sale'
GROUP BY a.id, a.shop_name;
