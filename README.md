# RongSutro — artisan marketplace

RongSutro is a full-stack marketplace for Bangladesh's handloom artisans. The browser interface is plain HTML, CSS and JavaScript. The API is Node.js + Express, and persistent application data lives in MySQL/MariaDB.

## What works

- **Customer:** create an account, sign in, browse and search approved products, filter by weave, save a wishlist, manage a bag, add a delivery address, place a cash-on-delivery order, and view order details and status.
- **Artisan:** register a studio, see verification and product status, submit products for review, archive own listings, see orders containing their work, and view ledger-based earnings.
- **Admin:** see marketplace figures, verify or suspend artisan profiles, approve or reject products, and update order statuses.
- Passwords are hashed with bcrypt and protected routes use signed JWT bearer tokens. Only the authentication token is stored in browser local storage; products, carts, wishlists, addresses, orders and earnings are read from or written to the database through the API.

## Project structure

```text
rongsutro-full-stack/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── db.js
│       ├── middleware/
│       ├── routes/
│       └── utils.js
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

`backend/src/server.js` serves both the API and the frontend, so you do not need Live Server or a second web server.

## Run locally on macOS

### 1. Configure the database

Make sure MySQL or MariaDB is running on port `3306`. Your database name in `.env` must exactly match the database name shown by `SHOW DATABASES;`.

**For the existing RongSutro database:** it already has the tables, and you have successfully tested `/api/categories`. Keep using that database. Do not import `database/schema.sql` again.

> **Important:** `database/schema.sql` is a fresh-install script. It drops and recreates the RongSutro tables before inserting sample data. Running it against an existing database will delete its current data. Back up your database first, and use this script only when intentionally creating/resetting a demo database.

### 2. Create your private environment file

From the project root, run:

```bash
cd backend
cp .env.example .env
openssl rand -hex 32
```

Open `backend/.env` in VS Code. Set the database values for your local server. For the local MariaDB connection used during setup, they should look like this (leave the password blank only if your database root account has no password):

```dotenv
PORT=4000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:4000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=RongSutro
DB_USER=root
DB_PASSWORD=
DB_CONNECTION_LIMIT=10
JWT_SECRET=paste-the-new-random-value-here
JWT_EXPIRES_IN=7d
```

Use a new random JWT secret; do not reuse a secret pasted into a chat or committed to Git. Never upload `.env` to GitHub.

### 3. Install and start

Still inside the `backend` folder:

```bash
npm install
npm run dev
```

Keep this terminal window open. The server should print:

```text
RongSutro API listening on http://localhost:4000
```

### 4. Open the webapp

Visit **http://localhost:4000**. Do not open `public/index.html` directly and do not use the Live Server extension for this version; the Express server hosts the page and API from the same origin.

Check the database/API health at **http://localhost:4000/api/health**. A healthy response includes `"database":"connected"`.

## Accounts

Customers and artisans can register from the sign-in screen. Artisan registrations require a studio name and district; their profile starts as pending verification, and products they submit start as pending review.

The administrator account is not available through public registration. To promote an account you created, sign out and run this SQL in your RongSutro database (replace the email):

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

Then sign in again; the admin workspace will appear. The fresh-install SQL also seeds `admin@rongsutro.demo` with password `password` for local demonstrations only. Change it immediately and never use it publicly.

## Main API routes

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/products`, `GET /api/products/:id`, `GET /api/products/mine`, product create/update/archive
- `GET /api/categories`, `GET /api/artisans`, `GET /api/artisans/me/summary`
- Authenticated `/api/cart`, `/api/wishlist`, and `/api/addresses`
- Authenticated `/api/orders` for checkout, order details and order status
- `GET /api/admin/dashboard`, `GET /api/admin/pending`

Protected routes require `Authorization: Bearer <token>`. Product and order money values in the API are integer paisa (100 paisa = Tk 1.00).

## Current limitations before public launch

- Checkout creates a real database order but payment is **cash on delivery only**. No card, bKash or Nagad payment is processed.
- Product photos are referenced by URL; direct file upload and cloud image storage are not included.
- Email/SMS verification, password reset, courier integration, automated payout transfer, and production monitoring are not included.
- Before deployment, use HTTPS, a managed database with a least-privilege DB user, a unique production JWT secret, backups, and real payment/shipping integrations where needed. Do not expose the development admin account or credentials.
