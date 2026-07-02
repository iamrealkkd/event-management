/* ============================================
   EVENTHUB — Premium Event Management Platform
   Frontend-only build with localStorage-based auth.
   ============================================
   NOTE FOR BACKEND INTEGRATION:
   All temporary auth lives in the AuthService object below.
   When the Express + MongoDB backend is ready, replace the
   methods in AuthService with real fetch() calls. The rest of
   the app talks to AuthService only — no other changes needed.
   ============================================ */
'use strict';

/* ============================================
   LIVE DATA STATE (backend-driven)
   ============================================ */
const CATEGORIES = [
  { name: 'Hackathon',       icon: '💻', color: 'wine'  },
  { name: 'Concert',         icon: '🎤', color: 'gold'  },
  { name: 'Stand-up Comedy', icon: '🎭', color: 'wine'  },
  { name: 'Webinar',         icon: '🖥️', color: 'gold'  },
  { name: 'Workshop',        icon: '🛠️', color: 'wine'  },
  { name: 'Business',        icon: '💼', color: 'gold'  },
  { name: 'Food Festival',   icon: '🍷', color: 'wine'  },
  { name: 'Gaming',          icon: '🎮', color: 'gold'  },
  { name: 'Marathon',        icon: '🏃', color: 'wine'  },
];

const API_BASE = '/api';
let EVENTS = [];
let BOOKINGS = [];
let PAYMENTS = [];
let USERS = [];
let MY_BOOKINGS = [];
let MY_TICKETS = [];
let FEATURED_EVENTS = [];
let TRENDING_EVENTS = [];

function normalizeEvent(e) {
  const date = e.date ? new Date(e.date) : null;
  return {
    ...e,
    id: e._id || e.id,
    name: e.name || 'Untitled Event',
    cat: e.cat || 'General',
    city: e.city || 'Unknown',
    venue: e.venue || 'TBD',
    price: Number(e.price || 0),
    rating: Number(e.rating || 0),
    seats: Number(e.seats || 0),
    cap: Number(e.cap || e.seats || 0),
    img: e.img || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=900&q=80',
    dateLabel: date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD',
    timeLabel: e.time || 'TBD',
    about: e.about || 'A memorable event experience.',
    org: e.org || { name: 'EventHub', company: 'EventHub', email: 'hello@eventhub.com', phone: '+1 555 010 2030', site: 'eventhub.com' },
    address: e.address || `${e.venue || 'Venue'}, ${e.city || 'City'}`,
  };
}

function formatDate(value) {
  if (!value) return 'TBD';
  const date = new Date(value);
  return isNaN(date) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function api(path, options = {}) {
  const token = AuthService.token();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }
  return data;
}

async function loadEvents(params = {}) {
  const res = await api(`/events?${new URLSearchParams(params).toString()}`);
  EVENTS = (res.events || []).map(normalizeEvent);
  return EVENTS;
}

async function loadBookings() {
  const res = await api('/bookings');
  BOOKINGS = res.bookings || [];
  return BOOKINGS;
}

async function loadPayments() {
  const res = await api('/payments');
  PAYMENTS = res.payments || [];
  return PAYMENTS;
}

async function loadUsers() {
  const res = await api('/users');
  USERS = res.users || [];
  return USERS;
}

async function loadMyBookings() {
  const res = await api('/bookings/me');
  MY_BOOKINGS = res.bookings || [];
  return MY_BOOKINGS;
}

async function loadMyTickets() {
  const res = await api('/tickets/me');
  MY_TICKETS = res.tickets || [];
  return MY_TICKETS;
}

/* ============================================
   AUTH SERVICE (backend-backed)
   ============================================ */
const AuthService = (() => {
  const KEY = 'eh_session';

  return {
    token() {
      try {
        return JSON.parse(localStorage.getItem(KEY) || 'null')?.token || null;
      } catch {
        return null;
      }
    },
    async login(email, password) {
      try {
        const res = await api('/auth/login', { method: 'POST', body: { email, password } });
        const session = { token: res.token, user: res.user };
        localStorage.setItem(KEY, JSON.stringify(session));
        return { ok: true, user: res.user };
      } catch (err) {
        return { ok: false, error: err.message || 'Invalid email or password.' };
      }
    },
    async register(payload) {
      try {
        const res = await api('/auth/register', { method: 'POST', body: payload });
        const session = { token: res.token, user: res.user };
        localStorage.setItem(KEY, JSON.stringify(session));
        return { ok: true, user: res.user };
      } catch (err) {
        return { ok: false, error: err.message || 'Unable to create account.' };
      }
    },
    current() {
      try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
    },
    logout() { localStorage.removeItem(KEY); },
  };
})();

/* ============================================
   APP STATE
   ============================================ */
const App = {
  postLoginAction: null, // optional callback after login (e.g. continue booking)
  currentEventId: null,
};

/* ============================================
   LANDING PAGE RENDERERS
   ============================================ */
function eventById(id) { return EVENTS.find(e => e.id === id || e._id === id); }

function categoryCard(c) {
  return `<button class="cat-card cat-${c.color}" onclick="filterByCategory('${c.name}')">
    <span class="cat-emoji">${c.icon}</span>
    <span class="cat-name">${c.name}</span>
  </button>`;
}
function eventCard(e) {
  const price = e.price === 0 ? 'Free' : `$${e.price}`;
  return `<article class="event-card" onclick="openEventDetails('${e.id}')">
    <div class="event-img" style="background-image:url('${e.img}')">
      <span class="event-cat-tag">${e.cat}</span>
      <span class="event-price-tag">${price}</span>
    </div>
    <div class="event-body">
      <h3 class="event-name">${e.name}</h3>
      <div class="event-meta">
        <span>📅 ${e.dateLabel || formatDate(e.date)}</span>
        <span>📍 ${e.city}</span>
      </div>
      <div class="event-foot">
        <span class="event-rating">★ ${Number(e.rating || 0).toFixed(1)}</span>
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openEventDetails('${e.id}')">View Details</button>
      </div>
    </div>
  </article>`;
}

async function renderLanding() {
  const cg = document.getElementById('catGrid');
  if (cg) cg.innerHTML = CATEGORIES.map(categoryCard).join('');

  const events = await loadEvents({ featured: true, limit: 4 });
  FEATURED_EVENTS = events;
  const featuredGrid = document.getElementById('featuredGrid');
  if (featuredGrid) featuredGrid.innerHTML = events.slice(0, 4).map(eventCard).join('');

  const upcoming = await loadEvents({ limit: 8 });
  const ug = document.getElementById('upcomingGrid');
  if (ug) ug.innerHTML = upcoming.slice(0, 8).map(eventCard).join('');

  const trending = await loadEvents({ trending: true, limit: 4 });
  TRENDING_EVENTS = trending;
  const tg = document.getElementById('trendingGrid');
  if (tg) tg.innerHTML = trending.slice(0, 4).map(eventCard).join('');
}

async function runHeroSearch() {
  const q = (document.getElementById('heroSearchName').value || '').toLowerCase();
  const city = (document.getElementById('heroSearchCity').value || '').toLowerCase();
  const cat = document.getElementById('heroSearchCat').value;
  const results = await loadEvents({ search: q, city, cat });
  toast(`${results.length} event${results.length===1?'':'s'} found`);
  document.getElementById('upcomingGrid').innerHTML =
    (results.length ? results : EVENTS).map(eventCard).join('');
  document.querySelector('#upcomingGrid').scrollIntoView({ behavior:'smooth', block:'start' });
}

function filterByCategory(cat) {
  document.getElementById('heroSearchCat').value =
    [...document.getElementById('heroSearchCat').options].some(o => o.value === cat) ? cat : '';
  runHeroSearch();
}

/* ============================================
   EVENT DETAILS MODAL
   ============================================ */
async function openEventDetails(id) {
  const e = eventById(id);
  if (!e) return;
  App.currentEventId = id;
  const gst = Math.round(e.price * 0.18);
  const fee = e.price === 0 ? 0 : 5;
  const total = e.price + gst + fee;
  const priceTxt = e.price === 0 ? 'Free' : `$${e.price}`;

  document.getElementById('eventModalCard').innerHTML = `
    <button class="modal-close light" onclick="closeModal('eventModal')" aria-label="Close">×</button>
    <div class="ev-banner" style="background-image:url('${e.img}')">
      <div class="ev-banner-overlay">
        <span class="event-cat-tag">${e.cat}</span>
        <h2>${e.name}</h2>
        <div class="ev-banner-meta">
          <span>📅 ${e.dateLabel} · ${e.timeLabel}</span>
          <span>📍 ${e.venue}, ${e.city}</span>
          <span>★ ${Number(e.rating || 0).toFixed(1)}</span>
        </div>
      </div>
    </div>
    <div class="ev-body">
      <div class="ev-main">
        <div class="ev-section">
          <h3>About this event</h3>
          <p>${e.about}</p>
        </div>
        <div class="ev-section">
          <h3>Organizer</h3>
          <div class="ev-org">
            <div class="ev-org-avatar">${(e.org?.name || 'EventHub').split(' ').map(s=>s[0]).join('').slice(0,2)}</div>
            <div>
              <strong>${e.org?.name || 'EventHub'}</strong>
              <p>${e.org?.company || 'EventHub'}</p>
              <p class="muted">${e.org?.email || 'hello@eventhub.com'} · ${e.org?.phone || '+1 555 010 2030'}</p>
              <p class="muted">🌐 ${e.org?.site || 'eventhub.com'}</p>
            </div>
          </div>
        </div>
        <div class="ev-section">
          <h3>Location</h3>
          <p>${e.address}</p>
          <div class="map-placeholder"><span>🗺️ Map preview · ${e.venue}</span></div>
        </div>
      </div>
      <aside class="ev-side">
        <div class="ev-price-card">
          <p class="seats-left">${e.seats} seats left of ${e.cap}</p>
          <div class="price-row"><span>Ticket Price</span><span>${priceTxt}</span></div>
          <div class="price-row"><span>GST (18%)</span><span>$${gst}</span></div>
          <div class="price-row"><span>Platform Fee</span><span>$${fee}</span></div>
          <div class="price-divider"></div>
          <div class="price-row total"><span>Total</span><span>$${total}</span></div>
          <button class="btn-login book-btn" onclick="handleBook('${e.id}')">
            <span>Book Ticket</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <p class="ev-side-note">Free cancellation up to 48h before the event.</p>
        </div>
      </aside>
    </div>
  `;
  openModal('eventModal');
}

async function handleBook(id) {
  const user = AuthService.current();
  if (!user) {
    App.postLoginAction = () => handleBook(id);
    openLoginModal();
    return;
  }
  const e = eventById(id);
  try {
    const response = await api('/bookings', { method: 'POST', body: { eventId: id, tickets: 1 } });
    if (response?.booking) {
      toast(`🎉 Booking confirmed for ${e?.name || 'this event'}`);
      await loadMyBookings();
      await renderAll();
      closeModal('eventModal');
    }
  } catch (err) {
    toast(err.message, 'err');
  }
}

/* ============================================
   MODALS (generic)
   ============================================ */
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('open');
  if (!document.querySelector('.modal-overlay.open')) document.body.style.overflow = '';
}
function onOverlayClick(ev, id) { if (ev.target.id === id) closeModal(id); }
function openLoginModal()    { closeModal('registerModal'); openModal('loginModal'); }
function openRegisterModal() { closeModal('loginModal');    openModal('registerModal'); }
function swapAuth(which) {
  if (which === 'login') openLoginModal();
  else openRegisterModal();
}
function fillDemo(role) {
  if (role === 'admin') {
    document.getElementById('loginEmail').value = 'admin@eventhub.com';
    document.getElementById('loginPassword').value = 'admin123';
  } else {
    document.getElementById('loginEmail').value = 'user@eventhub.com';
    document.getElementById('loginPassword').value = 'user123';
  }
}

/* ============================================
   AUTH HANDLERS
   ============================================ */
async function submitLogin() {
  const email = document.getElementById('loginEmail').value;
  const pw    = document.getElementById('loginPassword').value;
  const res = await AuthService.login(email, pw);
  if (!res.ok) { toast(res.error, 'err'); return; }
  toast(`Welcome back, ${res.user.name}!`);
  closeModal('loginModal');
  enterApp();
  if (App.postLoginAction) { const cb = App.postLoginAction; App.postLoginAction = null; setTimeout(cb, 250); }
}
async function submitRegister() {
  const res = await AuthService.register({
    name:     document.getElementById('regName').value.trim(),
    email:    document.getElementById('regEmail').value.trim(),
    phone:    document.getElementById('regPhone').value.trim(),
    password: document.getElementById('regPassword').value,
    confirm:  document.getElementById('regConfirm').value,
  });
  if (!res.ok) { toast(res.error, 'err'); return; }
  toast(`Account created — welcome, ${res.user.name}!`);
  closeModal('registerModal');
  enterApp();
  if (App.postLoginAction) { const cb = App.postLoginAction; App.postLoginAction = null; setTimeout(cb, 250); }
}
function handleLogout() {
  AuthService.logout();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('landingPage').classList.remove('hidden');
  toast('Signed out');
}

/* ============================================
   APP ENTRY (role-based)
   ============================================ */
async function enterApp() {
  const session = AuthService.current();
  const user = session?.user;
  if (!user) return;
  document.getElementById('landingPage').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  document.body.classList.remove('is-admin','is-user');
  document.body.classList.add(user.role === 'admin' ? 'is-admin' : 'is-user');

  const initials = user.name.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('sidebarAvatar').textContent = initials;
  document.getElementById('navAvatar').textContent = initials;
  document.getElementById('sidebarUserName').textContent = user.name;
  document.getElementById('sidebarUserRole').textContent = user.role === 'admin' ? 'Organizer' : 'Member';
  document.getElementById('navTagline').textContent = user.role === 'admin' ? 'Manage Events Professionally' : 'Discover · Book · Celebrate';
  const greet = document.getElementById('userGreetName');
  if (greet) greet.textContent = user.name.split(' ')[0];
  const sn = document.getElementById('settName'); if (sn) sn.value = user.name;
  const se = document.getElementById('settEmail'); if (se) se.value = user.email;

  buildSidebar(user.role);
  navigateTo(user.role === 'admin' ? 'dashboard' : 'user-home');

  await renderAll();
}

function buildSidebar(role) {
  const adminNav = [
    { label:'Workspace', items:[
      ['dashboard','Dashboard','grid'],
      ['events','Events','calendar'],
      ['create','Create Event','plus'],
      ['bookings','Bookings','ticket'],
      ['users','Users','users'],
      ['checkin','QR Check-In','qr'],
      ['payments','Payments','card'],
      ['analytics','Analytics','chart'],
    ]},
    { label:'Account', items:[
      ['settings','Settings','gear'],
    ]},
  ];
  const userNav = [
    { label:'Discover', items:[
      ['user-home','Home','home'],
      ['user-browse','Browse Events','calendar'],
    ]},
    { label:'My Activity', items:[
      ['user-bookings','My Bookings','ticket'],
      ['user-tickets','My Tickets','qr'],
    ]},
    { label:'Account', items:[
      ['settings','Profile','gear'],
    ]},
  ];
  const groups = role === 'admin' ? adminNav : userNav;
  const icons = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    plus:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
    ticket:'<path d="M2 9V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 0 0-4z"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    qr:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="21" y2="14"/><line x1="14" y1="18" x2="21" y2="18"/>',
    card:'<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
    chart:'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    home:'<path d="M3 12 12 3l9 9"/><path d="M5 10v10h14V10"/>',
  };
  const html = groups.map(g => `
    <p class="nav-label">${g.label}</p>
    ${g.items.map(([id,label,icon]) => `
      <a href="#" class="nav-item" data-section="${id}" onclick="navigateTo('${id}'); return false;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons[icon] || ''}</svg>
        ${label}
      </a>`).join('')}
  `).join('') + `
    <a href="#" class="nav-item logout-nav" onclick="handleLogout(); return false;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Logout
    </a>`;
  document.getElementById('sidebarNav').innerHTML = html;
}

/* ============================================
   NAV / UI HELPERS
   ============================================ */
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function toggleProfileMenu() { document.getElementById('profileMenu').classList.toggle('hidden'); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
function toggleMobileNav() { document.getElementById('mobileNav').classList.toggle('open'); }
function closeMobileNav() { document.getElementById('mobileNav').classList.remove('open'); }

async function navigateTo(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.section === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');

  if (id === 'user-browse') await renderUserBrowse();
  else if (id === 'dashboard') await renderAll();
}

function goLanding(ev) {
  if (ev) ev.preventDefault();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('landingPage').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================
   TOASTS
   ============================================ */
function toast(msg, kind='ok') {
  const box = document.getElementById('toastBox');
  if (!box) return alert(msg);
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 280); }, 2600);
}

/* ============================================
   DASHBOARD RENDERERS
   ============================================ */
const badge = (status) => {
  const map = { success:'success', paid:'success', active:'active', live:'live', pending:'pending', draft:'draft', failed:'failed' };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return `<span class="badge ${map[status] || 'draft'}">${label}</span>`;
};

async function renderUpcomingEvents() {
  const tb = document.getElementById('upcomingEventsTbody'); if (!tb) return;
  const events = await loadEvents({ limit: 4, sort: 'date' });
  tb.innerHTML = events.slice(0,4).map(e => `
    <tr><td><strong>${e.name}</strong></td><td>${formatDate(e.date)}</td><td>${e.venue}</td><td>${Math.max(0, e.cap - e.seats)}/${e.cap}</td><td>${badge('active')}</td></tr>`).join('');
}
async function renderRecentBookings() {
  const tb = document.getElementById('recentBookingsTbody'); if (!tb) return;
  const bookings = await loadBookings();
  tb.innerHTML = bookings.slice(0,4).map(b => `
    <tr><td><strong>${b.user?.name || 'Customer'}</strong></td><td>${b.event?.name || 'Event'}</td><td>$${Number(b.amount || 0)}</td><td>${badge(b.status)}</td></tr>`).join('');
}
async function renderEvents() {
  const tb = document.getElementById('eventsTbody'); if (!tb) return;
  const events = await loadEvents({ limit: 50 });
  tb.innerHTML = events.map(e => `
    <tr>
      <td><strong>${e.name}</strong></td><td>${e.cat}</td><td>${formatDate(e.date)}</td><td>${e.venue}</td>
      <td>${e.cap}</td><td>${e.price === 0 ? 'Free' : '$' + e.price}</td><td>${badge('active')}</td>
      <td><div class="row-actions">
        <button class="icon-action" title="Edit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="icon-action danger" title="Delete"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
      </div></td>
    </tr>`).join('');
}
async function renderBookings() {
  const tb = document.getElementById('bookingsTbody'); if (!tb) return;
  const bookings = await loadBookings();
  tb.innerHTML = bookings.map(b => `
    <tr><td><strong>${b.bookingCode || b._id}</strong></td><td>${b.user?.name || 'Customer'}</td><td>${b.event?.name || 'Event'}</td><td>${b.tickets}</td><td><strong>$${Number(b.amount || 0)}</strong></td><td>${badge(b.payment?.status || 'pending')}</td><td>${badge(b.status)}</td></tr>`).join('');
}
async function renderPayments() {
  const tb = document.getElementById('paymentsTbody'); if (!tb) return;
  const payments = await loadPayments();
  tb.innerHTML = payments.map(p => `
    <tr><td><strong>${p._id?.slice(-6)}</strong></td><td>${p.user?.name || 'Customer'}</td><td>${p.event?.name || 'Event'}</td><td><strong>$${Number(p.amount || 0)}</strong></td><td>${p.method || 'Card'}</td><td>${formatDate(p.createdAt)}</td><td>${badge(p.status)}</td></tr>`).join('');
}
async function renderUsers() {
  const tb = document.getElementById('usersTbody'); if (!tb) return;
  const users = await loadUsers();
  tb.innerHTML = users.map(u => `
    <tr><td><strong>${u.name}</strong></td><td>${u.email}</td><td>${u.phone || '—'}</td><td>${u.bookings}</td><td>${formatDate(u.joined)}</td><td>${badge(u.status)}</td></tr>`).join('');
}
function renderHeaderDate() {
  const el = document.getElementById('headerDate');
  const el2 = document.getElementById('headerDateUser');
  const d = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  if (el)  el.textContent = d;
  if (el2) el2.textContent = d;
}

/* ===== USER dashboard renderers ===== */
function userEventMiniCard(e) {
  return `<article class="event-card" onclick="openEventDetails('${e.id}')">
    <div class="event-img" style="background-image:url('${e.img}')">
      <span class="event-cat-tag">${e.cat}</span>
    </div>
    <div class="event-body">
      <h3 class="event-name">${e.name}</h3>
      <div class="event-meta"><span>📅 ${e.dateLabel}</span><span>📍 ${e.city}</span></div>
      <div class="event-foot"><span class="event-rating">★ ${Number(e.rating || 0).toFixed(1)}</span><strong>${e.price===0?'Free':'$'+e.price}</strong></div>
    </div>
  </article>`;
}
async function renderUserHome() {
  const up = document.getElementById('userUpcomingGrid');
  const events = await loadEvents({ limit: 3 });
  if (up) up.innerHTML = events.slice(0,3).map(userEventMiniCard).join('');
  const rec = document.getElementById('userRecommendedGrid');
  const recommended = await loadEvents({ limit: 4, featured: true });
  if (rec) rec.innerHTML = recommended.slice(0,4).map(userEventMiniCard).join('');
  const tb = document.getElementById('userBookingsMiniTbody');
  const bookings = await loadMyBookings();
  if (tb) tb.innerHTML = bookings.slice(0,5).map(b => `
    <tr><td><strong>${b.event?.name || 'Event'}</strong></td><td>${formatDate(b.event?.date)}</td><td>$${Number(b.amount || 0)}</td><td>${badge(b.status)}</td></tr>`).join('');
  const qb = document.getElementById('quickBookList');
  const quick = await loadEvents({ limit: 3, trending: true });
  if (qb) qb.innerHTML = quick.slice(0,3).map(e => `
    <button class="quick-book-item" onclick="openEventDetails('${e.id}')">
      <div class="qb-img" style="background-image:url('${e.img}')"></div>
      <div class="qb-info"><strong>${e.name}</strong><span>${e.dateLabel} · ${e.city}</span></div>
      <span class="qb-price">${e.price===0?'Free':'$'+e.price}</span>
    </button>`).join('');
}
async function renderUserBookings() {
  const tb = document.getElementById('userBookingsTbody'); if (!tb) return;
  const bookings = await loadMyBookings();
  tb.innerHTML = bookings.map(b => `
    <tr><td><strong>${b.bookingCode || b._id}</strong></td><td>${b.event?.name || 'Event'}</td><td>${formatDate(b.event?.date)}</td><td>${b.tickets}</td><td><strong>$${Number(b.amount || 0)}</strong></td><td>${badge(b.status)}</td></tr>`).join('');
}
async function renderUserTickets() {
  const g = document.getElementById('userTicketsGrid'); if (!g) return;
  const tickets = await loadMyTickets();
  g.innerHTML = tickets.map(t => {
    const e = t.event || {};
    return `<div class="ticket-card">
      <div class="ticket-side"></div>
      <div class="ticket-main">
        <span class="event-cat-tag">${e.cat || 'Event'}</span>
        <h3>${e.name || 'Event Ticket'}</h3>
        <div class="ticket-meta">
          <div><small>Date</small><strong>${formatDate(e.date)}</strong></div>
          <div><small>Venue</small><strong>${e.venue || 'TBD'}</strong></div>
          <div><small>Tickets</small><strong>${t.quantity || 1}</strong></div>
          <div><small>ID</small><strong>${t.ticketId || t._id}</strong></div>
        </div>
      </div>
      <div class="ticket-qr">
        <div class="qr-mock"></div>
        <small>Scan at entry</small>
      </div>
    </div>`;
  }).join('');
}
async function renderUserBrowse() {
  const g = document.getElementById('userBrowseGrid'); if (!g) return;
  const q = (document.getElementById('browseQuery')?.value || '').toLowerCase();
  const cat = document.getElementById('browseCat')?.value || '';
  const res = await loadEvents({ search: q, cat, limit: 50 });
  g.innerHTML = res.length ? res.map(eventCard).join('') : `<p class="empty">No events match your filters.</p>`;
}

async function renderAll() {
  renderHeaderDate();
  await renderUpcomingEvents();

  const session = AuthService.current();
  const user = session?.user;

  if (!user) {
    return;
  }

  if (user.role === 'admin') {
    await renderRecentBookings();
    await renderEvents();
    await renderBookings();
    await renderPayments();
    await renderUsers();
  } else {
    await renderUserHome();
    await renderUserBookings();
    await renderUserTickets();
  }
}

/* ============================================
   MISC
   ============================================ */
async function publishEvent() {
  try {
    const payload = {
      name: document.querySelector('#create input[placeholder="e.g. Vintage Wine Tasting Soirée"]').value,
      cat: document.querySelector('#create select').value,
      about: document.querySelector('#create textarea').value,
      venue: document.querySelectorAll('#create input')[3]?.value || '',
      city: document.querySelectorAll('#create input')[4]?.value || '',
      date: document.querySelectorAll('#create input')[5]?.value || '',
      time: document.querySelectorAll('#create input')[6]?.value || '',
      price: Number(document.querySelectorAll('#create input')[7]?.value || 0),
      cap: Number(document.querySelectorAll('#create input')[8]?.value || 0),
      seats: Number(document.querySelectorAll('#create input')[8]?.value || 0),
      img: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=900&q=80',
      org: { name: 'EventHub', company: 'EventHub', email: 'hello@eventhub.com', phone: '+1 555 010 2030', site: 'eventhub.com' },
    };
    await api('/events', { method: 'POST', body: payload });
    toast('🎉 Event published successfully');
    await renderAll();
    navigateTo('events');
  } catch (err) {
    toast(err.message, 'err');
  }
}
function verifyTicket() {
  const id = (document.getElementById('manualTicketId').value || '').trim();
  if (!id) { toast('Enter a ticket ID first.', 'err'); return; }
  document.getElementById('checkinName').textContent = `Verified · ${id}`;
  document.getElementById('checkinEvent').textContent = 'Vintage Wine Tasting Soirée · VIP entry';
  toast('Ticket verified');
}

// Close profile menu / mobile nav on outside click; ESC closes modals
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.profile-wrap');
  const menu = document.getElementById('profileMenu');
  if (wrap && menu && !wrap.contains(e.target)) menu.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  await renderLanding();
  const session = AuthService.current();
  if (session) await enterApp();
  await renderAll();
});
