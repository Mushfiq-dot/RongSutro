/* RongSutro production-style local app: UI state comes from the Express API; only the auth token is stored locally. */
const API = '/api';
const TOKEN_KEY = 'rongsutro_auth_token';
const state = {
  token: localStorage.getItem(TOKEN_KEY), user: null,
  route: 'shop', products: [], categories: [], artisans: [], orders: [],
  cart: { items: [], total_paisa: 0 }, addresses: [], wishlist: [],
  pending: { artisans: [], products: [] }, admin: null, summary: null,
  search: '', categoryId: '', sort: 'newest', authMode: 'login', loading: false
};
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money = paisa => `৳${(Number(paisa || 0) / 100).toLocaleString('en-BD', {minimumFractionDigits: 0, maximumFractionDigits: 2})}`;
const date = value => value ? new Date(value).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : '—';
const titleCase = value => String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const initials = value => String(value || 'RS').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();

async function api(path, options = {}) {
  const headers = { ...(options.body ? {'Content-Type':'application/json'} : {}), ...(state.token ? {Authorization:`Bearer ${state.token}`} : {}), ...(options.headers || {}) };
  let response;
  try { response = await fetch(`${API}${path}`, {...options, headers, body: options.body ? JSON.stringify(options.body) : undefined}); }
  catch (_) { throw new Error('Cannot reach the API. Make sure the RongSutro server is running.'); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.token) { logout(false); }
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload;
}
function showToast(message, kind = '') {
  const host = $('#toast-region'); if (!host) return;
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = message; host.append(el);
  setTimeout(() => el.remove(), 3800);
}
function setBusy(button, busy, text = 'Please wait…') {
  if (!button) return;
  if (busy) { button.dataset.oldText = button.textContent; button.textContent = text; button.disabled = true; }
  else { button.textContent = button.dataset.oldText || button.textContent; button.disabled = false; }
}
function productImage(product, className = 'product-visual') {
  const url = product.image_url || product.images?.[0]?.image_url;
  if (url && /^https?:\/\//i.test(url)) {
    return `<div class="${className}"><div class="product-placeholder">রংসূত্র</div><img src="${escapeHTML(url)}" alt="${escapeHTML(product.name)}" loading="lazy"></div>`;
  }
  return `<div class="${className}"><div class="product-placeholder">রংসূত্র</div></div>`;
}
function pageMeta() {
  const map = {
    shop:['Customer marketplace','Discover handwoven stories'], artisans:['Customer marketplace','Meet the makers'], orders:['Your account','Your orders'], wishlist:['Your account','Saved pieces'],
    'artisan-home':['Artisan studio','Your studio at a glance'], 'artisan-products':['Artisan studio','Your product collection'], 'artisan-orders':['Artisan studio','Orders for your studio'], earnings:['Artisan studio','Your earnings'],
    'admin-home':['Marketplace operations','Marketplace overview'], 'admin-review':['Marketplace operations','Review and verify'], 'admin-orders':['Marketplace operations','Order management']
  };
  return map[state.route] || map.shop;
}
function navigation() {
  if (state.user.role === 'customer') return [
    ['shop','⌂','Browse sarees'], ['artisans','♧','Meet artisans'], ['orders','▣','My orders'], ['wishlist','♡','Wishlist']
  ];
  if (state.user.role === 'artisan') return [
    ['artisan-home','⌂','Overview'], ['artisan-products','◈','My products'], ['artisan-orders','▣','Orders'], ['earnings','৳','Earnings']
  ];
  return [['admin-home','⌂','Overview'], ['admin-review','✓','Review queue'], ['admin-orders','▣','All orders']];
}
function renderShell(content = '') {
  const [eyebrow, heading] = pageMeta();
  const nav = navigation();
  $('#app').innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="brand-lockup"><div class="brand-mark"><i></i><i></i><i></i></div><div><div class="brand-name">RongSutro</div><div class="brand-tagline">Woven with dignity</div></div></div>
        <div class="workspace-chip">${escapeHTML(titleCase(state.user.role))} workspace</div>
        <nav class="sidebar-nav"><div class="nav-label">Workspace</div>${nav.map(([id,icon,label])=>`<button class="nav-link ${state.route===id?'active':''}" data-route="${id}"><span class="nav-symbol">${icon}</span><span>${label}</span></button>`).join('')}</nav>
        <div class="sidebar-bottom"><div class="sidebar-help"><div class="help-symbol">✦</div><div><strong>Need a little help?</strong><span>RongSutro support is here.</span></div></div><div class="profile-mini"><div class="avatar">${initials(state.user.name)}</div><div><strong>${escapeHTML(state.user.name)}</strong><span>${escapeHTML(state.user.email)}</span></div></div></div>
      </aside>
      <div class="mobile-backdrop" id="mobile-backdrop"></div>
      <main class="main-panel">
        <header class="topbar"><button class="icon-btn mobile-menu" id="mobile-menu" aria-label="Open menu">☰</button><div class="topbar-title"><div class="eyebrow">${eyebrow}</div><h1>${heading}</h1></div><div class="topbar-actions">${state.user.role==='customer'?`<button class="cart-button" data-action="open-cart">Bag <b id="cart-count">${state.cart.items.reduce((sum,item)=>sum+Number(item.quantity),0)}</b></button>`:''}<button class="btn btn-ghost btn-small" data-action="logout">Sign out</button></div></header>
        <section class="page-content" id="page-content">${content || '<div class="loading-state">Loading your workspace…</div>'}</section>
      </main>
    </div>`;
}
function renderAuth(error = '') {
  const register = state.authMode === 'register';
  $('#app').innerHTML = `
    <main class="auth-layout">
      <section class="auth-art"><div class="auth-brand"><div class="brand-mark"><i></i><i></i><i></i></div><div><div class="brand-name">RongSutro</div><div class="brand-tagline">Woven with dignity</div></div></div><div class="auth-copy"><span class="eyebrow">A fairer thread between maker and wearer</span><h1>Tradition, woven into tomorrow.</h1><p>Discover the people, stories and craft behind Bangladesh's handwoven textiles. Every purchase helps skilled artisans earn with dignity.</p></div><div class="fabric-art"></div><div class="auth-foot">Made with respect for the hands behind every weave.</div></section>
      <section class="auth-panel"><div class="auth-card"><span class="eyebrow">Welcome to RongSutro</span><h2>${register?'Create your account':'Welcome back'}</h2><p>${register?'Join the marketplace as a customer or artisan.':'Sign in to continue to your RongSutro workspace.'}</p>
        <div class="auth-tabs"><button class="${!register?'active':''}" data-auth-mode="login">Sign in</button><button class="${register?'active':''}" data-auth-mode="register">Create account</button></div>
        <div class="auth-error ${error?'show':''}" id="auth-error">${escapeHTML(error)}</div>
        <form id="auth-form">
          ${register?`<div class="field"><label for="auth-name">Full name</label><input id="auth-name" name="name" autocomplete="name" required maxlength="120"></div>`:''}
          <div class="field"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" required></div>
          ${register?`<div class="field"><label for="auth-phone">Phone number (optional)</label><input id="auth-phone" name="phone" autocomplete="tel"></div>`:''}
          <div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" minlength="8" autocomplete="${register?'new-password':'current-password'}" required></div>
          ${register?`<div class="field"><label for="auth-role">I am joining as</label><select id="auth-role" name="role"><option value="customer">Customer</option><option value="artisan">Artisan</option></select></div><div id="artisan-fields" hidden><div class="field"><label for="shop-name">Studio / shop name</label><input id="shop-name" name="shop_name"></div><div class="field"><label for="district">District</label><input id="district" name="district"></div><div class="field"><label for="story">Your story (optional)</label><textarea id="story" name="story" placeholder="Tell customers about your craft…"></textarea></div></div>`:''}
          <button class="btn btn-primary auth-submit" type="submit">${register?'Create account':'Sign in'} →</button>
        </form><div class="auth-note">Customer and artisan accounts can register here. Admin access is created by the marketplace administrator.</div>
      </div></section>
    </main>`;
}
async function boot() {
  if (!state.token) { renderAuth(); return; }
  try {
    const result = await api('/auth/me'); state.user = result.user;
    await refreshCartIfCustomer();
    state.route = state.user.role === 'customer' ? 'shop' : state.user.role === 'artisan' ? 'artisan-home' : 'admin-home';
    await navigate(state.route, false);
  } catch (error) { state.token = null; localStorage.removeItem(TOKEN_KEY); renderAuth(); }
}
async function refreshCartIfCustomer() {
  if (state.user?.role !== 'customer') return;
  const result = await api('/cart'); state.cart = result;
}
async function navigate(route, updateHistory = true) {
  const allowed = navigation().map(item=>item[0]);
  if (!allowed.includes(route)) route = allowed[0];
  state.route = route;
  renderShell('<div class="loading-state">Loading your workspace…</div>');
  if (updateHistory) window.history.replaceState({}, '', `#${route}`);
  try {
    if (route === 'shop') {
      const [products,categories,wishlist] = await Promise.all([api('/products?limit=100'), api('/categories'), api('/wishlist')]);
      state.products = products.products || []; state.categories = categories.categories || []; state.wishlist = wishlist.items || [];
      await refreshCartIfCustomer(); renderShell(renderShop());
    } else if (route === 'artisans') {
      const result = await api('/artisans'); state.artisans = result.artisans || []; renderShell(renderArtisans());
    } else if (route === 'orders' || route === 'artisan-orders' || route === 'admin-orders') {
      const result = await api('/orders'); state.orders = result.orders || []; renderShell(renderOrders());
    } else if (route === 'wishlist') {
      const result = await api('/wishlist'); state.wishlist = result.items || []; renderShell(renderWishlist());
    } else if (route === 'artisan-home' || route === 'artisan-products' || route === 'earnings') {
      const [summary, products, orders] = await Promise.all([api('/artisans/me/summary'), api('/products/mine?limit=100'), api('/orders')]);
      state.summary = summary; state.products = products.products || []; state.orders = orders.orders || [];
      renderShell(route === 'artisan-home' ? renderArtisanHome() : route === 'artisan-products' ? renderArtisanProducts() : renderEarnings());
    } else if (route === 'admin-home' || route === 'admin-review') {
      const [dashboard,pending] = await Promise.all([api('/admin/dashboard'), api('/admin/pending')]);
      state.admin = dashboard; state.pending = pending;
      renderShell(route === 'admin-home' ? renderAdminHome() : renderAdminReview());
    }
  } catch (error) { if (!state.user) return; renderShell(`<div class="empty-state"><h3>Couldn't load this page</h3><p>${escapeHTML(error.message)}</p><button class="btn btn-primary" data-action="retry">Try again</button></div>`); }
}
function productCard(product) {
  const inWishlist = state.wishlist.some(item=>Number(item.product_id)===Number(product.id));
  return `<article class="product-card"><div class="product-open" data-action="open-product" data-id="${product.id}" role="button" tabindex="0" aria-label="View ${escapeHTML(product.name)}">${productImage(product)}</div><div class="product-body"><div class="product-category">${escapeHTML(product.category_name || 'Handwoven')}</div><button class="product-name-button" data-action="open-product" data-id="${product.id}">${escapeHTML(product.name)}</button><div class="product-maker">By ${escapeHTML(product.artisan_shop_name || product.artisan_name || 'RongSutro artisan')}</div><div class="product-bottom"><span class="product-price">${money(product.price_paisa)}</span><div class="product-actions"><button class="card-icon" title="${inWishlist?'Remove from':'Add to'} wishlist" data-action="wishlist-toggle" data-id="${product.id}">${inWishlist?'♥':'♡'}</button><button class="btn btn-primary btn-small" data-action="add-cart" data-id="${product.id}">Add</button></div></div></div></article>`;
}
function renderShop() {
  const list = state.products.filter(product => {
    const query = state.search.trim().toLowerCase();
    const matchesQuery = !query || [product.name,product.description,product.artisan_name,product.artisan_shop_name,product.category_name].some(value=>String(value||'').toLowerCase().includes(query));
    return matchesQuery && (!state.categoryId || String(product.category_id)===String(state.categoryId));
  }).sort((a,b)=>state.sort==='price-asc'?Number(a.price_paisa)-Number(b.price_paisa):state.sort==='price-desc'?Number(b.price_paisa)-Number(a.price_paisa):new Date(b.created_at)-new Date(a.created_at));
  return `<section class="hero"><div class="hero-copy"><span class="hero-kicker">Handwoven in Bangladesh</span><h2>A saree should carry a story.</h2><p>Meet the makers, explore heritage weaves and choose a piece made with patience, skill and care.</p><button class="btn btn-primary" data-action="scroll-catalog">Explore the collection →</button></div><div class="hero-fabric"></div></section>
    <div class="page-heading"><div><h2 class="section-title">The collection</h2><p>Every item is listed by an artisan and reviewed by RongSutro.</p></div><span class="status approved">${list.length} available pieces</span></div>
    <div class="toolbar"><label class="toolbar-search"><span>⌕</span><input id="product-search" class="toolbar-input" style="max-width:none" placeholder="Search saree, weave or artisan" value="${escapeHTML(state.search)}"></label><button class="filter-chip ${!state.categoryId?'active':''}" data-category="">All weaves</button>${state.categories.map(c=>`<button class="filter-chip ${String(state.categoryId)===String(c.id)?'active':''}" data-category="${c.id}">${escapeHTML(c.name)}</button>`).join('')}<select class="toolbar-input" id="product-sort" aria-label="Sort products"><option value="newest" ${state.sort==='newest'?'selected':''}>Newest</option><option value="price-asc" ${state.sort==='price-asc'?'selected':''}>Price: low to high</option><option value="price-desc" ${state.sort==='price-desc'?'selected':''}>Price: high to low</option></select></div>
    <div id="product-results">${list.length?`<div class="product-grid">${list.map(productCard).join('')}</div>`:`<div class="empty-state"><h3>No pieces found</h3><p>Try a different search or category.</p><button class="btn btn-soft" data-action="clear-filters">Clear filters</button></div>`}</div>`;
}
function renderArtisans() {
  if (!state.artisans.length) return `<div class="empty-state"><h3>Meet our makers</h3><p>There are no verified artisan profiles to show yet.</p></div>`;
  return `<div class="page-heading"><div><h2 class="section-title">The hands behind the weave</h2><p>Verified artisans and their stories.</p></div><span class="status verified">${state.artisans.length} verified</span></div><div class="artisan-grid">${state.artisans.map((a,i)=>`<article class="artisan-card"><div class="artisan-banner"><div class="avatar">${initials(a.name)}</div></div><div class="artisan-card-body"><span class="status verified">Verified artisan</span><h3>${escapeHTML(a.shop_name || a.name)}</h3><div class="artisan-location">${escapeHTML(a.district || 'Bangladesh')} · ${Number(a.product_count||0)} listed pieces</div><p>${escapeHTML(a.story || 'A skilled maker preserving Bangladesh’s handloom traditions.')}</p><span class="muted" style="font-size:10px">${escapeHTML(a.name)}</span></div></article>`).join('')}</div>`;
}
function renderOrders() {
  const heading = state.user.role==='customer'?'Your orders':state.user.role==='artisan'?'Orders containing your products':'All marketplace orders';
  if (!state.orders.length) return `<div class="page-heading"><div><h2 class="section-title">${heading}</h2><p>Track order progress from placement to delivery.</p></div></div><div class="empty-state"><h3>No orders yet</h3><p>Orders will appear here when a customer completes checkout.</p>${state.user.role==='customer'?'<button class="btn btn-primary" data-route="shop">Browse the collection</button>':''}</div>`;
  return `<div class="page-heading"><div><h2 class="section-title">${heading}</h2><p>${state.orders.length} order record(s) from the live database.</p></div></div><div class="content-card"><div class="data-table-wrap"><table><thead><tr><th>Order</th>${state.user.role!=='customer'?'<th>Customer</th>':''}<th>Items</th><th>Total</th><th>Date</th><th>Status</th><th>Details</th></tr></thead><tbody>${state.orders.map(o=>`<tr><td><strong>${escapeHTML(o.order_number)}</strong><span class="table-muted">#${o.id}</span></td>${state.user.role!=='customer'?`<td>${escapeHTML(o.customer_name||'Customer')}</td>`:''}<td>${Number(o.item_count||0)}</td><td><strong>${money(o.total_paisa)}</strong></td><td>${date(o.created_at)}</td><td>${state.user.role==='customer'?`<span class="status ${escapeHTML(o.status)}">${escapeHTML(titleCase(o.status))}</span>`:`<select class="inline-select order-status" data-id="${o.id}">${['processing','shipped','delivered','cancelled'].map(status=>`<option value="${status}" ${status===o.status?'selected':''}>${titleCase(status)}</option>`).join('')}</select>`}</td><td><button class="btn btn-soft btn-small" data-action="view-order" data-id="${o.id}">View</button></td></tr>`).join('')}</tbody></table></div></div>`;
}
function renderWishlist() {
  return `<div class="page-heading"><div><h2 class="section-title">Your saved pieces</h2><p>Products you have added to your wishlist.</p></div></div>${state.wishlist.length?`<div class="product-grid">${state.wishlist.map(item=>productCard({...item,id:item.product_id,category_name:item.category_name,artisan_shop_name:item.artisan_shop_name})).join('')}</div>`:`<div class="empty-state"><h3>Your wishlist is waiting</h3><p>Save products you love while browsing the collection.</p><button class="btn btn-primary" data-route="shop">Browse sarees</button></div>`}`;
}
function renderArtisanHome() {
  const s=state.summary||{}; const profile=s.artisan||{};
  return `<div class="notice">Your artisan profile status: <strong>${escapeHTML(titleCase(profile.status||'pending'))}</strong>. New products submitted by artisans are sent to the admin review queue.</div><div class="page-heading"><div><h2 class="section-title">Welcome, ${escapeHTML(state.user.name.split(' ')[0])}</h2><p>${escapeHTML(profile.shop_name||'Your artisan studio')} · ${escapeHTML(profile.district||'')}</p></div><button class="btn btn-primary" data-action="new-product">+ Add a product</button></div><div class="stat-grid"><div class="stat-card"><div class="stat-label">All products</div><div class="stat-value">${Number(s.products?.total||0)}</div><div class="stat-foot">In your studio</div></div><div class="stat-card"><div class="stat-label">Approved</div><div class="stat-value">${Number(s.products?.approved||0)}</div><div class="stat-foot">Visible in the shop</div></div><div class="stat-card"><div class="stat-label">Pending review</div><div class="stat-value">${Number(s.products?.pending||0)}</div><div class="stat-foot">Waiting for admin</div></div><div class="stat-card"><div class="stat-label">Your earnings</div><div class="stat-value">${money(s.earnings_paisa||0)}</div><div class="stat-foot">Artisan share recorded in ledger</div></div></div><section class="content-card"><div class="card-head"><div><h3>Recent products</h3><p>Product status is kept in the database.</p></div><button class="btn btn-soft btn-small" data-route="artisan-products">View all</button></div>${state.products.length?`<div class="data-table-wrap"><table><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead><tbody>${state.products.slice(0,5).map(p=>`<tr><td><strong>${escapeHTML(p.name)}</strong><span class="table-muted">${escapeHTML(p.category_name||'Handwoven')}</span></td><td>${money(p.price_paisa)}</td><td>${p.stock}</td><td><span class="status ${escapeHTML(p.status)}">${escapeHTML(titleCase(p.status))}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">You have not listed any products yet.</p>'}</section>`;
}
function renderArtisanProducts() {
  return `<div class="page-heading"><div><h2 class="section-title">Your collection</h2><p>Manage your own listings. New products require admin approval.</p></div><button class="btn btn-primary" data-action="new-product">+ Add product</button></div>${state.products.length?`<div class="content-card"><div class="data-table-wrap"><table><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>${state.products.map(p=>`<tr><td><strong>${escapeHTML(p.name)}</strong><span class="table-muted">${escapeHTML(p.category_name||'Handwoven')}</span></td><td>${money(p.price_paisa)}</td><td>${p.stock}</td><td><span class="status ${escapeHTML(p.status)}">${escapeHTML(titleCase(p.status))}</span></td><td>${date(p.created_at)}</td><td><button class="btn btn-danger btn-small" data-action="archive-product" data-id="${p.id}">Archive</button></td></tr>`).join('')}</tbody></table></div></div>`:`<div class="empty-state"><h3>Your first product starts here</h3><p>Add a product to submit it for marketplace review.</p><button class="btn btn-primary" data-action="new-product">Add a product</button></div>`}`;
}
function renderEarnings() {
  const s=state.summary||{};
  return `<div class="page-heading"><div><h2 class="section-title">Earnings and fair share</h2><p>Totals are calculated from your artisan ledger records.</p></div></div><div class="stat-grid"><div class="stat-card"><div class="stat-label">Total earned</div><div class="stat-value">${money(s.earnings_paisa||0)}</div><div class="stat-foot">Your recorded share</div></div><div class="stat-card"><div class="stat-label">Gross sales</div><div class="stat-value">${money(s.gross_paisa||0)}</div><div class="stat-foot">Value of your sold work</div></div><div class="stat-card"><div class="stat-label">Platform commission</div><div class="stat-value">${money(s.commission_paisa||0)}</div><div class="stat-foot">Recorded marketplace fee</div></div><div class="stat-card"><div class="stat-label">Orders</div><div class="stat-value">${Number(s.order_count||0)}</div><div class="stat-foot">Orders with your products</div></div></div><div class="notice">These figures show ledger records only. Payout transfers are not processed by this prototype.</div>`;
}
function renderAdminHome() {
  const d=state.admin||{}, a=d.artisans||{}, p=d.products||{};
  return `<div class="page-heading"><div><h2 class="section-title">Marketplace at a glance</h2><p>Live operational figures from RongSutro's database.</p></div><button class="btn btn-primary" data-route="admin-review">Open review queue →</button></div><div class="stat-grid"><div class="stat-card"><div class="stat-label">Gross merchandise value</div><div class="stat-value">${money(d.gmv_paisa||0)}</div><div class="stat-foot">Non-cancelled orders</div></div><div class="stat-card"><div class="stat-label">Orders</div><div class="stat-value">${Number(d.order_count||0)}</div><div class="stat-foot">All marketplace orders</div></div><div class="stat-card"><div class="stat-label">Verified artisans</div><div class="stat-value">${Number(a.verified||0)}</div><div class="stat-foot">${Number(a.pending||0)} pending verification</div></div><div class="stat-card"><div class="stat-label">Approved products</div><div class="stat-value">${Number(p.approved||0)}</div><div class="stat-foot">${Number(p.pending||0)} waiting for review</div></div></div><div class="content-card"><div class="card-head"><div><h3>Needs attention</h3><p>Items that require an administrator decision.</p></div></div><div class="two-col"><div><strong>${Number(a.pending||0)} artisan profile(s)</strong><p class="muted" style="font-size:10px">Awaiting identity and studio verification.</p><button class="btn btn-soft btn-small" data-route="admin-review">Review artisans</button></div><div><strong>${Number(p.pending||0)} product(s)</strong><p class="muted" style="font-size:10px">Waiting to appear in the public collection.</p><button class="btn btn-soft btn-small" data-route="admin-review">Review products</button></div></div></div>`;
}
function renderAdminReview() {
  const pending=state.pending||{artisans:[],products:[]};
  return `<div class="page-heading"><div><h2 class="section-title">Marketplace review queue</h2><p>Approve products and verify artisan accounts with care.</p></div></div><div class="content-card"><div class="card-head"><div><h3>Artisan verification</h3><p>${pending.artisans.length} profile(s) awaiting a decision.</p></div></div>${pending.artisans.length?`<div class="review-grid">${pending.artisans.map(a=>`<article class="review-card"><span class="status pending">Pending verification</span><h3>${escapeHTML(a.shop_name)}</h3><strong>${escapeHTML(a.name)}</strong><p>${escapeHTML(a.story||'No story provided.')}<br>${escapeHTML(a.district||'')}</p><div class="review-actions"><button class="btn btn-primary btn-small" data-action="artisan-status" data-id="${a.id}" data-status="verified">Verify artisan</button><button class="btn btn-danger btn-small" data-action="artisan-status" data-id="${a.id}" data-status="suspended">Suspend</button></div></article>`).join('')}</div>`:'<p class="muted">No artisan profiles are waiting for verification.</p>'}</div><div class="content-card"><div class="card-head"><div><h3>Product approval</h3><p>${pending.products.length} product(s) awaiting a decision.</p></div></div>${pending.products.length?`<div class="review-grid">${pending.products.map(p=>`<article class="review-card"><span class="status pending">Pending product</span><h3>${escapeHTML(p.name)}</h3><strong>${escapeHTML(p.artisan_name)} · ${escapeHTML(p.shop_name)}</strong><p>${escapeHTML(p.description||'No description supplied.')}<br>${escapeHTML(p.category_name||'Uncategorized')} · ${money(p.price_paisa)} · ${p.stock} in stock</p><div class="review-actions"><button class="btn btn-primary btn-small" data-action="product-status" data-id="${p.id}" data-status="approved">Approve</button><button class="btn btn-danger btn-small" data-action="product-status" data-id="${p.id}" data-status="rejected">Reject</button></div></article>`).join('')}</div>`:'<p class="muted">No products are waiting for approval.</p>'}</div>`;
}
function modal(title, subtitle, body, footer = '', wide = false) {
  $('#modal-root').innerHTML = `<div class="modal ${wide?'wide':''}"><header class="modal-head"><div><h2>${title}</h2><p>${subtitle||''}</p></div><button class="modal-close" data-action="close-modal" aria-label="Close">×</button></header><div class="modal-body">${body}</div>${footer?`<footer class="modal-foot">${footer}</footer>`:''}</div>`;
}
function closeModal(){ $('#modal-root').innerHTML=''; }
async function openProduct(id) {
  try { const result=await api(`/products/${id}`); const p=result.product;
    modal(escapeHTML(p.name),`${escapeHTML(p.artisan_shop_name||p.artisan_name)} · ${escapeHTML(p.district||'Bangladesh')}`,`<div class="modal-product">${productImage(p)}<div><div class="product-category">${escapeHTML(p.category_name||'Handwoven')}</div><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.description||'A handwoven piece from a RongSutro artisan.')}</p><div class="modal-price">${money(p.price_paisa)}</div><p>${Number(p.stock)} unit(s) available</p><div class="status approved">${Number(p.average_rating||0).toFixed(1)} ★ · ${Number(p.review_count||0)} review(s)</div><p style="margin-top:14px">Made by <strong>${escapeHTML(p.artisan_shop_name||p.artisan_name)}</strong></p></div></div>`,`<button class="btn btn-primary" data-action="add-cart" data-id="${p.id}">Add to bag</button>` ,true);
  } catch(error){showToast(error.message,'error');}
}
async function openCart() {
  try { state.cart=await api('/cart'); renderCartModal(); } catch(error){showToast(error.message,'error');}
}
function renderCartModal() {
  const items=state.cart.items||[];
  const body=items.length?`<div class="cart-list">${items.map(item=>`<div class="cart-line"><div class="product-visual"><div class="product-placeholder">রং</div></div><div class="cart-line-info"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.artisan_shop_name||'Artisan')} · ${money(item.price_paisa)} each</span><div style="display:flex;align-items:center;gap:6px;margin-top:7px"><button class="card-icon" data-action="cart-qty" data-id="${item.product_id}" data-qty="${Math.max(0,Number(item.quantity)-1)}">−</button><span>${item.quantity}</span><button class="card-icon" data-action="cart-qty" data-id="${item.product_id}" data-qty="${Number(item.quantity)+1}">+</button><button class="text-button" data-action="remove-cart" data-id="${item.product_id}">Remove</button></div></div><strong>${money(item.line_total_paisa)}</strong></div>`).join('')}</div><div class="cart-total"><span>Subtotal</span><strong>${money(state.cart.total_paisa)}</strong></div><div class="notice" style="margin-top:14px;margin-bottom:0">Cash on delivery is available in this build. No online payment is collected.</div>`:`<div class="empty-state"><h3>Your bag is empty</h3><p>Find a handwoven piece that speaks to you.</p></div>`;
  modal('Your bag',`${items.reduce((n,i)=>n+Number(i.quantity),0)} item(s)`,body,`${items.length?'<button class="btn btn-primary" data-action="checkout">Continue to checkout →</button>':''}<button class="btn btn-ghost" data-action="close-modal">${items.length?'Keep browsing':'Close'}</button>`);
}
async function openCheckout() {
  if (!state.cart.items.length) return;
  try {
    state.addresses=(await api('/addresses')).addresses||[];
    const options=state.addresses.map(a=>`<option value="${a.id}">${escapeHTML(a.recipient)} — ${escapeHTML(a.address_line)}, ${escapeHTML(a.city)}</option>`).join('');
    const hasAddress=state.addresses.length>0;
    const body=`<div class="notice">Checkout is saved to your RongSutro account. Payment is cash on delivery only in this version.</div>${hasAddress?`<div class="field"><label for="checkout-address">Choose a saved delivery address</label><select id="checkout-address"><option value="new">Add a new address</option>${options}</select></div>`:''}<div id="new-address-fields" ${hasAddress?'':' '}><div class="field-grid"><div class="field"><label>Recipient name</label><input id="address-recipient" value="${escapeHTML(state.user.name)}" required></div><div class="field"><label>Phone number</label><input id="address-phone" value="${escapeHTML(state.user.phone||'')}" required></div><div class="field full"><label>Address</label><textarea id="address-line" required placeholder="House, road, area"></textarea></div><div class="field"><label>District / area</label><input id="address-district" required></div><div class="field"><label>City</label><input id="address-city" value="Dhaka" required></div><div class="field"><label>Postal code (optional)</label><input id="address-postal"></div></div></div><div class="cart-total"><span>Items</span><strong>${money(state.cart.total_paisa)}</strong></div><div class="cart-total"><span>Delivery</span><strong>৳150</strong></div><div class="cart-total"><span>Total payable on delivery</span><strong>${money(Number(state.cart.total_paisa)+15000)}</strong></div>`;
    modal('Delivery details','Confirm where you want your order delivered.',body,'<button class="btn btn-primary" data-action="place-order">Place order</button>');
    const select=$('#checkout-address'); if(select) select.addEventListener('change',()=>{$('#new-address-fields').hidden=select.value!=='new';});
    if (hasAddress) $('#new-address-fields').hidden=true;
  } catch(error){showToast(error.message,'error');}
}
async function placeOrder(button) {
  try {
    setBusy(button,true,'Placing order…');
    const selected=$('#checkout-address')?.value;
    let addressId=selected && selected!=='new'?Number(selected):0;
    if (!addressId) {
      const recipient=$('#address-recipient').value.trim(), phone=$('#address-phone').value.trim(), address_line=$('#address-line').value.trim(), district=$('#address-district').value.trim(), city=$('#address-city').value.trim();
      if(!recipient||!phone||!address_line||!district||!city) throw new Error('Please complete all required delivery address fields.');
      const saved=await api('/addresses',{method:'POST',body:{recipient,phone,address_line,district,city,postal_code:$('#address-postal').value.trim(),is_default:state.addresses.length===0}}); addressId=saved.id;
    }
    const result=await api('/orders',{method:'POST',body:{address_id:addressId,payment_provider:'cash_on_delivery'}});
    await refreshCartIfCustomer(); closeModal(); showToast(`Order ${result.order.order_number} placed successfully.`,'success'); await navigate('orders');
  } catch(error){showToast(error.message,'error'); if(button) setBusy(button,false);}
}
async function openOrder(id) {
  try {const result=await api(`/orders/${id}`);const o=result.order;const addr=[o.address_line,o.district,o.city,o.postal_code].filter(Boolean).join(', ');
    modal(`Order ${escapeHTML(o.order_number)}`,`Placed ${date(o.created_at)} · ${titleCase(o.status)}`,`<div class="status ${escapeHTML(o.status)}">${escapeHTML(titleCase(o.status))}</div><div style="margin:13px 0"><strong>Delivery address</strong><p class="muted" style="font-size:11px">${escapeHTML(o.recipient||'')} · ${escapeHTML(o.phone||'')}<br>${escapeHTML(addr||'No address record')}</p></div><div class="cart-list">${o.items.map(item=>`<div class="cart-line"><div class="cart-line-info"><strong>${escapeHTML(item.product_name)}</strong><span>${escapeHTML(item.artisan_shop_name||'Artisan')} · Qty ${item.quantity}</span></div><strong>${money(Number(item.unit_price_paisa)*Number(item.quantity))}</strong></div>`).join('')}</div><div class="cart-total"><span>Delivery</span><strong>${money(o.shipping_paisa)}</strong></div><div class="cart-total"><span>Total</span><strong>${money(o.total_paisa)}</strong></div><p class="muted" style="font-size:10px;margin-top:14px">Payment: ${escapeHTML(titleCase(o.payment_provider||'cash on delivery'))} (${escapeHTML(titleCase(o.payment_status||'pending'))})</p>`,'<button class="btn btn-ghost" data-action="close-modal">Close</button>');
  } catch(error){showToast(error.message,'error');}
}
async function newProductModal() {
  try {const categories=(await api('/categories')).categories||[];
    const body=`<form id="product-form"><div class="field"><label>Product name</label><input name="name" required maxlength="160"></div><div class="field-grid"><div class="field"><label>Category</label><select name="category_id" required>${categories.map(c=>`<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('')}</select></div><div class="field"><label>Price (৳)</label><input name="price" type="number" min="1" step="0.01" required></div><div class="field"><label>Available stock</label><input name="stock" type="number" min="0" step="1" value="1" required></div><div class="field"><label>Image URL (optional)</label><input name="image_url" type="url" placeholder="https://…"></div><div class="field full"><label>Description</label><textarea name="description" placeholder="Describe the weave, materials and story"></textarea></div></div></form>`;
    modal('Add a product','New artisan listings are submitted for administrator approval.',body,'<button class="btn btn-primary" data-action="save-product">Submit for review</button>');
  }catch(error){showToast(error.message,'error');}
}
async function archiveProduct(id) {
  if (!window.confirm('Archive this product? It will no longer appear in the public shop.')) return;
  try { await api(`/products/${id}`, {method:'DELETE'}); showToast('Product archived.','success'); await navigate('artisan-products',false); }
  catch(error) { showToast(error.message,'error'); }
}
async function saveProduct(button) {
  const form=$('#product-form'); if(!form.reportValidity()) return;
  const data=new FormData(form); const payload={name:data.get('name').trim(),category_id:Number(data.get('category_id')),price_paisa:Math.round(Number(data.get('price'))*100),stock:Number(data.get('stock')),description:data.get('description').trim(),image_url:data.get('image_url').trim()||undefined};
  try{setBusy(button,true,'Submitting…');await api('/products',{method:'POST',body:payload});closeModal();showToast('Product submitted for review.','success');await navigate(state.route);}catch(error){showToast(error.message,'error');setBusy(button,false);}
}
async function addCart(id) {
  try{state.cart=await api('/cart/items',{method:'POST',body:{product_id:Number(id),quantity:1}});closeModal();const count=state.cart.items.reduce((sum,item)=>sum+Number(item.quantity),0);const badge=$('#cart-count');if(badge)badge.textContent=count;showToast('Added to your bag.','success');}catch(error){showToast(error.message,'error');}
}
async function updateCart(id, quantity) {
  try{state.cart=await api(`/cart/items/${id}`,{method:'PATCH',body:{quantity:Number(quantity)}});renderCartModal();const badge=$('#cart-count');if(badge)badge.textContent=state.cart.items.reduce((s,i)=>s+Number(i.quantity),0);}catch(error){showToast(error.message,'error');}
}
async function wishlistToggle(id) {
  const exists=state.wishlist.some(item=>Number(item.product_id)===Number(id));
  try{if(exists)await api(`/wishlist/${id}`,{method:'DELETE'});else await api(`/wishlist/${id}`,{method:'POST'});showToast(exists?'Removed from wishlist.':'Saved to wishlist.','success');if(state.route==='wishlist'||state.route==='shop')await navigate(state.route,false);}catch(error){showToast(error.message,'error');}
}
async function updateOrderStatus(select) {
  const previous=select.dataset.previous||select.querySelector('option[selected]')?.value;
  try{await api(`/orders/${select.dataset.id}/status`,{method:'PATCH',body:{status:select.value}});showToast('Order status updated.','success');await navigate(state.route,false);}catch(error){showToast(error.message,'error');if(previous)select.value=previous;}
}
async function updateReview(type,id,status) {
  try{if(type==='product')await api(`/products/${id}`,{method:'PATCH',body:{status}});else await api(`/artisans/${id}/status`,{method:'PATCH',body:{status}});showToast(`${type==='product'?'Product':'Artisan'} ${status==='approved'||status==='verified'?'approved':'updated'}.`,'success');await navigate(state.route,false);}catch(error){showToast(error.message,'error');}
}
function logout(show = true) {
  localStorage.removeItem(TOKEN_KEY);state.token=null;state.user=null;state.cart={items:[],total_paisa:0};state.route='shop';
  if(show)showToast('You have signed out.');renderAuth();
}
async function submitAuth(form, button) {
  const data=new FormData(form);const register=state.authMode==='register';const payload=Object.fromEntries(data.entries());
  if(register&&payload.role==='artisan'&&(!payload.shop_name?.trim()||!payload.district?.trim())){renderAuth('Artisan accounts need a studio name and district.');return;}
  try{setBusy(button,true,register?'Creating account…':'Signing in…');const result=await api(`/auth/${register?'register':'login'}`,{method:'POST',body:payload});state.token=result.token;localStorage.setItem(TOKEN_KEY,result.token);state.user=result.user;state.route=state.user.role==='customer'?'shop':state.user.role==='artisan'?'artisan-home':'admin-home';await refreshCartIfCustomer();await navigate(state.route,false);}catch(error){renderAuth(error.message);}finally{if(button?.isConnected)setBusy(button,false);}
}

// Global event delegation keeps markup simple and avoids binding duplicate handlers after each render.
document.addEventListener('error', event => { if (event.target instanceof HTMLImageElement && event.target.closest('.product-visual')) event.target.remove(); }, true);
document.addEventListener('click', async event => {
  const route=event.target.closest('[data-route]'); if(route){await navigate(route.dataset.route);$('#sidebar')?.classList.remove('open');$('#mobile-backdrop')?.classList.remove('open');return;}
  const authMode=event.target.closest('[data-auth-mode]');if(authMode){state.authMode=authMode.dataset.authMode;renderAuth();return;}
  const category=event.target.closest('[data-category]');if(category){state.categoryId=category.dataset.category;renderShell(renderShop());return;}
  const action=event.target.closest('[data-action]');if(!action)return;
  const id=action.dataset.id;
  switch(action.dataset.action){
    case 'logout': logout();break;
    case 'retry': await navigate(state.route,false);break;
    case 'scroll-catalog': $('#product-search')?.scrollIntoView({behavior:'smooth',block:'center'});break;
    case 'clear-filters': state.search='';state.categoryId='';await navigate('shop',false);break;
    case 'open-product': await openProduct(id);break;
    case 'add-cart': await addCart(id);break;
    case 'wishlist-toggle': await wishlistToggle(id);break;
    case 'open-cart': await openCart();break;
    case 'close-modal': closeModal();break;
    case 'checkout': await openCheckout();break;
    case 'place-order': await placeOrder(action);break;
    case 'cart-qty': await updateCart(id,action.dataset.qty);break;
    case 'remove-cart': await updateCart(id,0);break;
    case 'view-order': await openOrder(id);break;
    case 'new-product': await newProductModal();break;
    case 'save-product': await saveProduct(action);break;
    case 'archive-product': await archiveProduct(id);break;
    case 'product-status': await updateReview('product',id,action.dataset.status);break;
    case 'artisan-status': await updateReview('artisan',id,action.dataset.status);break;
  }
});
document.addEventListener('submit', async event=>{
  if(event.target.id==='auth-form'){event.preventDefault();await submitAuth(event.target,event.submitter);}
  if(event.target.id==='product-form')event.preventDefault();
});
document.addEventListener('input', event=>{
  if(event.target.id==='product-search'){state.search=event.target.value;const temp=document.createElement('div');temp.innerHTML=renderShop();const nextResults=$('#product-results',temp);if(nextResults&&$('#product-results'))$('#product-results').innerHTML=nextResults.innerHTML;const count=$('.page-heading .status');if(count)count.textContent=`${state.products.filter(p=>{const q=state.search.trim().toLowerCase();return (!q||[p.name,p.description,p.artisan_name,p.artisan_shop_name,p.category_name].some(v=>String(v||'').toLowerCase().includes(q)))&&(!state.categoryId||String(p.category_id)===String(state.categoryId));}).length} available pieces`;}
});
document.addEventListener('change', async event=>{
  if(event.target.id==='auth-role'){const artisan=event.target.value==='artisan';$('#artisan-fields').hidden=!artisan;$('#shop-name').required=artisan;$('#district').required=artisan;}
  if(event.target.id==='product-sort'){state.sort=event.target.value;renderShell(renderShop());}
  if(event.target.classList.contains('order-status'))await updateOrderStatus(event.target);
});
document.addEventListener('keydown', event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('.product-open[role=button]')){event.preventDefault();openProduct(event.target.dataset.id);}});
document.addEventListener('click',event=>{
  if(event.target.id==='mobile-menu'){$('#sidebar')?.classList.add('open');$('#mobile-backdrop')?.classList.add('open');}
  if(event.target.id==='mobile-backdrop'){$('#sidebar')?.classList.remove('open');event.target.classList.remove('open');}
  if(event.target.id==='modal-root')closeModal();
});
window.addEventListener('hashchange',()=>{const route=location.hash.slice(1);if(state.user&&route)navigate(route,false);});
boot();
