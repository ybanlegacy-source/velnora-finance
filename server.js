// server.js
// Demo banking website - SCHOOL PROJECT ONLY.
// No real payment processor is connected. No real money moves.
// The admin panel edits the "balance" field directly, which is fine here
// because this is a closed classroom demo with fabricated data only.

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({
  secret: 'demo-school-project-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 4 } // 4 hours
}));

// ---------- helpers ----------
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.role !== 'admin') return res.redirect('/login');
  next();
}
function fmtMoney(n) {
  return '€' + Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------- auth ----------
app.get('/', (req, res) => res.redirect(req.session.userId ? '/dashboard' : '/login'));

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.render('login', { error: 'Invalid username or password.' });
  }
  req.session.userId = user.id;
  req.session.role = user.role;
  res.redirect(user.role === 'admin' ? '/admin' : '/dashboard');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ---------- user dashboard ----------
app.get('/dashboard', requireLogin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user || user.role !== 'user') return res.redirect('/login');
  const requests = db.prepare('SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(user.id);
  res.render('dashboard', { user, requests, fmtMoney });
});

// Non-functional demo transfer / withdrawal forms — just log a "request" row,
// no money actually moves anywhere.
app.post('/request', requireLogin, (req, res) => {
  const { type, amount, note } = req.body;
  db.prepare(`INSERT INTO requests (user_id, type, amount, note) VALUES (?, ?, ?, ?)`)
    .run(req.session.userId, type, parseFloat(amount) || 0, note || '');
  res.redirect('/dashboard');
});

// ---------- about / contact ----------
app.get('/about', requireLogin, (req, res) => {
  res.render('about', {});
});

app.get('/contact', requireLogin, (req, res) => {
  res.render('contact', { sent: false });
});

app.post('/contact', requireLogin, (req, res) => {
  const { subject, message } = req.body;
  db.prepare('INSERT INTO contact_messages (user_id, subject, message) VALUES (?, ?, ?)')
    .run(req.session.userId, subject, message);
  res.render('contact', { sent: true });
});

// ---------- request loan ----------
app.get('/request-loan', requireLogin, (req, res) => {
  const loans = db.prepare('SELECT * FROM loan_requests WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.session.userId);
  res.render('request-loan', { loans, fmtMoney, sent: false });
});

app.post('/request-loan', requireLogin, (req, res) => {
  const { amount, term, purpose } = req.body;
  db.prepare('INSERT INTO loan_requests (user_id, amount, term, purpose) VALUES (?, ?, ?, ?)')
    .run(req.session.userId, parseFloat(amount) || 0, term, purpose);
  const loans = db.prepare('SELECT * FROM loan_requests WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.session.userId);
  res.render('request-loan', { loans, fmtMoney, sent: true });
});

// ---------- settings ----------
app.get('/settings', requireLogin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  res.render('settings', { user, msg: null });
});

app.post('/settings/profile', requireLogin, (req, res) => {
  db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(req.body.full_name, req.session.userId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  res.render('settings', { user, msg: 'Name updated.' });
});

app.post('/settings/password', requireLogin, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.render('settings', { user, msg: 'Current password is incorrect.' });
  }
  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.session.userId);
  res.render('settings', { user, msg: 'Password updated.' });
});

// ---------- notifications ----------
app.get('/notifications', requireLogin, (req, res) => {
  const balanceEvents = db.prepare('SELECT * FROM balance_log WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.session.userId)
    .map(b => ({
      icon: '💰',
       text: `Your ${b.field === 'savings_balance' ? 'savings' : 'checking'} balance was updated to ${fmtMoney(b.new_balance)}${b.reason ? ' — ' + b.reason : ''}`,
      date: b.created_at
    }));

  const requestEvents = db.prepare('SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.session.userId)
    .map(r => ({
      icon: '↗',
      text: `${r.type.replace('_', ' ')} request submitted for ${fmtMoney(r.amount)}`,
      date: r.created_at
    }));

  const loanEvents = db.prepare('SELECT * FROM loan_requests WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.session.userId)
    .map(l => ({
      icon: '▤',
      text: `Loan request submitted for ${fmtMoney(l.amount)} (${l.term})`,
      date: l.created_at
    }));

  const items = [...balanceEvents, ...requestEvents, ...loanEvents]
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  res.render('notifications', { items });
});

// ---------- admin ----------
app.get('/admin', requireAdmin, (req, res) => {
  const users = db.prepare(`SELECT * FROM users WHERE role = 'user' ORDER BY id`).all();
  const requests = db.prepare(`
    SELECT requests.*, users.username, users.full_name
    FROM requests JOIN users ON requests.user_id = users.id
    ORDER BY requests.created_at DESC LIMIT 20
  `).all();
  res.render('admin', { users, requests, fmtMoney, msg: req.query.msg || null });
});

// Admin directly edits a user's balance (demo-only mechanism).
// Every change is written to balance_log for a visible audit trail.
app.post('/admin/set-balance', requireAdmin, (req, res) => {
  const { userId, newBalance, reason } = req.body;
  const field = req.body.field === 'savings_balance' ? 'savings_balance' : 'balance';

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.redirect('/admin?msg=User not found');

  const oldBalance = user[field];
  const nb = parseFloat(newBalance);
  if (isNaN(nb)) return res.redirect('/admin?msg=Invalid amount');

  const admin = db.prepare('SELECT username FROM users WHERE id = ?').get(req.session.userId);

  db.prepare(`UPDATE users SET ${field} = ? WHERE id = ?`).run(nb, userId);
  db.prepare(`
    INSERT INTO balance_log (user_id, changed_by, field, old_balance, new_balance, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, admin.username, field, oldBalance, nb, reason || '');

  res.redirect('/admin?msg=' + (field === 'savings_balance' ? 'Savings balance' : 'Balance') + ' updated for ' + user.username);
});

app.get('/admin/log/:userId', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
  const log = db.prepare('SELECT * FROM balance_log WHERE user_id = ? ORDER BY created_at DESC').all(req.params.userId);
  res.render('log', { user, log, fmtMoney });
});

app.listen(PORT, () => {
  console.log(`Demo bank running at http://localhost:${PORT}`);
  console.log('Login as admin: admin / admin123');
  console.log('Login as demo user: demo / demo123');
});