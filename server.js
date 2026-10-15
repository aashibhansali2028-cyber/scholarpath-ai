import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, sha256, hashPassword, verifyPassword, today, addDays, allScholarships, getScholarship, upsertScholarship,
  getProfile, saveProfile, createApplication } from './db.js';
import { matchScholarship } from './match.js';
import { chat, write, extract, AI_ENABLED, WRITER_TOOLS } from './ai.js';
import { FIELDS, LEVELS, COUNTRIES, INCOME_RANGES, CATEGORIES } from './data.js';

const PORT = +process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';
const STAGES = ['interested', 'preparing', 'ready', 'applied', 'interview', 'awarded', 'rejected'];
const SUBMITTED = ['applied', 'interview', 'awarded', 'rejected'];

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

// ---------- auth ----------
const SESSION_DAYS = 14;
// Stateless signed-cookie sessions, so any serverless instance can verify a login.
// ponytail: no server-side revocation (logout clears the cookie only); add a session_version column if needed.
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET && process.env.VERCEL) console.warn('[auth] SESSION_SECRET not set; logins will not survive across instances');
const sign = v => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
function createSession(res, userId) {
  const payload = `${userId}.${Date.now() + SESSION_DAYS * 864e5}`;
  res.setHeader('Set-Cookie', `sp_session=${payload}.${sign(payload)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${PROD ? '; Secure' : ''}`);
}
function currentUser(req) {
  const [id, exp, mac] = ((req.headers.cookie || '').match(/(?:^|;\s*)sp_session=([^;]+)/)?.[1] || '').split('.');
  if (!mac || +exp < Date.now()) return null;
  const a = Buffer.from(mac), b = Buffer.from(sign(`${id}.${exp}`));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return db.prepare('SELECT id, email, name, role, plan FROM users WHERE id = ?').get(+id) || null;
}
const failedLogins = new Map(); // ponytail: in-memory limiter, move to Redis when running >1 instance
function throttle(key) {
  const now = Date.now(), list = (failedLogins.get(key) || []).filter(t => now - t < 15 * 6e4);
  failedLogins.set(key, list);
  if (list.length >= 8) fail(429, 'Too many attempts. Please wait 15 minutes and try again.');
  return () => list.push(now);
}
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e || '');
const track = (userId, type, scholarshipId = null) => db.prepare('INSERT INTO analytics_events (user_id, type, scholarship_id) VALUES (?, ?, ?)').run(userId, type, scholarshipId);

// ---------- domain helpers ----------
const withMatch = (list, profile) => list.map(s => ({ ...s, match: profile?.completed ? matchScholarship(profile, s) : null }));
const card = s => ({ id: s.id, code: s.code, name: s.name, provider: s.provider, provider_type: s.provider_type, countries: s.countries, levels: s.levels,
  value_inr: s.value_inr, value_text: s.value_text, funding_type: s.funding_type, is_merit: s.is_merit, is_need: s.is_need, deadline: s.deadline,
  open_date: s.open_date, featured: s.featured, verified: s.verified, is_sample: s.is_sample, closed: s.closed, scope: s.scope, match: s.match ? { score: s.match.score, label: s.match.label } : null });

function userApplications(userId) {
  const profile = getProfile(userId);
  const apps = db.prepare('SELECT * FROM applications WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
  const docs = db.prepare('SELECT d.* FROM application_documents d JOIN applications a ON a.id = d.application_id WHERE a.user_id = ? ORDER BY d.id').all(userId);
  return apps.map(a => {
    const s = getScholarship(a.scholarship_id);
    const ds = docs.filter(d => d.application_id === a.id);
    const ready = ds.filter(d => d.status === 'ready').length;
    const readiness = ds.length ? Math.round((ready / ds.length) * 100) : 100;
    const missing = ds.find(d => d.status === 'missing');
    return { ...a, scholarship: card({ ...s, match: profile?.completed ? matchScholarship(profile, s) : null }), documents: ds, readiness,
      next_step: missing ? `Upload your ${missing.name.toLowerCase()}.` : SUBMITTED.includes(a.stage) ? 'All documents ready.' : 'All documents ready — review and submit on the official portal.' };
  });
}

function refreshNotifications(userId) {
  const add = db.prepare('INSERT OR IGNORE INTO notifications (user_id, type, title, body, link, dedupe_key) VALUES (?, ?, ?, ?, ?, ?)');
  const t = today(), week = addDays(t, 7);
  const saved = db.prepare('SELECT scholarship_id id FROM saved_scholarships WHERE user_id = ?').all(userId).map(r => getScholarship(r.id)).filter(Boolean);
  const apps = userApplications(userId);
  const submitted = new Set(apps.filter(a => SUBMITTED.includes(a.stage)).map(a => a.scholarship_id));
  for (const s of saved) {
    if (!s.closed && s.deadline <= week && !submitted.has(s.id)) {
      const days = Math.round((new Date(s.deadline) - new Date(t)) / 864e5);
      add.run(userId, 'deadline', `Deadline ${days <= 0 ? 'today' : `in ${days} day${days > 1 ? 's' : ''}`}: ${s.name}`, `Applications close on ${s.deadline}.`, `#/scholarship/${s.id}`, `deadline-${s.id}-${s.deadline}`);
    }
    if (s.open_date > t && s.open_date <= addDays(t, 30)) add.run(userId, 'opening', `Applications opening soon: ${s.name}`, `Expected to open on ${s.open_date}.`, `#/scholarship/${s.id}`, `opening-${s.id}-${s.open_date}`);
  }
  for (const a of apps) {
    const s = a.scholarship;
    if (['preparing', 'ready'].includes(a.stage) && a.readiness < 100 && s.deadline <= addDays(t, 30))
      add.run(userId, 'incomplete', `Application incomplete: ${s.name}`, `Readiness ${a.readiness}%. ${a.next_step}`, '#/tracker', `incomplete-${a.id}-${s.deadline}`);
    const missing = a.documents.filter(d => d.status === 'missing');
    if (missing.length && !SUBMITTED.includes(a.stage))
      add.run(userId, 'documents', `${missing.length} document${missing.length > 1 ? 's' : ''} missing for ${s.name}`, missing.slice(0, 3).map(d => d.name).join(', '), '#/tracker', `docs-${a.id}-${missing.length}`);
  }
  const profile = getProfile(userId);
  if (profile?.completed) {
    const savedIds = new Set(saved.map(s => s.id));
    withMatch(allScholarships(), profile).filter(s => !s.closed && !savedIds.has(s.id) && s.match.score >= 85).slice(0, 3)
      .forEach(s => add.run(userId, 'match', `New ${s.match.score}% match: ${s.name}`, `${s.match.label} · ${s.value_text}`, `#/scholarship/${s.id}`, `match-${s.id}`));
  }
}

// ---------- routes ----------
const routes = [];
const route = (method, pattern, handler, opts = {}) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), handler, ...opts });
const AUTH = { auth: true }, ADMIN = { auth: true, admin: true };

route('GET', '/api/meta', () => ({ fields: FIELDS, levels: LEVELS, countries: COUNTRIES, income_ranges: INCOME_RANGES.map(r => r[0]), categories: CATEGORIES,
  stages: STAGES, ai_enabled: AI_ENABLED, writer_tools: WRITER_TOOLS }));
route('GET', '/api/stats', () => {
  const all = allScholarships();
  return { scholarships: all.length, funding_inr: all.reduce((a, s) => a + s.value_inr, 0), countries: new Set(all.flatMap(s => s.countries)).size,
    featured: withMatch(all.filter(s => s.featured && !s.closed).slice(0, 6)).map(card) };
});

// auth
route('POST', '/api/auth/signup', ({ body, res }) => {
  const name = String(body.name || '').trim(), email = String(body.email || '').trim().toLowerCase(), pw = String(body.password || '');
  if (name.length < 2) fail(400, 'Please enter your full name');
  if (!emailOk(email)) fail(400, 'Please enter a valid email address');
  if (pw.length < 8) fail(400, 'Password must be at least 8 characters');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) fail(409, 'An account with this email already exists');
  const id = Number(db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)').run(email, name, hashPassword(pw)).lastInsertRowid);
  saveProfile(id, { full_name: name, email, nationality: 'India' }, false);
  createSession(res, id);
  return { ok: true };
});
route('POST', '/api/auth/login', ({ body, res }) => {
  const email = String(body.email || '').trim().toLowerCase();
  const recordFail = throttle(email);
  const u = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
  if (!u || !verifyPassword(String(body.password || ''), u.password_hash)) { recordFail(); fail(401, 'Incorrect email or password'); }
  createSession(res, u.id);
  return { ok: true };
});
route('POST', '/api/auth/demo', ({ body, res }) => {
  const u = db.prepare('SELECT id FROM users WHERE email = ?').get(body.role === 'admin' ? 'admin@scholarpath.ai' : 'demo@scholarpath.ai');
  if (!u) fail(404, 'Demo account missing — reset the database');
  createSession(res, u.id);
  return { ok: true };
});
route('POST', '/api/auth/logout', ({ res }) => {
  res.setHeader('Set-Cookie', 'sp_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  return { ok: true };
});
route('POST', '/api/auth/forgot', ({ body }) => {
  const u = db.prepare('SELECT id FROM users WHERE email = ?').get(String(body.email || '').trim().toLowerCase());
  const out = { ok: true, message: 'If an account exists for that email, a reset link has been sent.' };
  if (u) {
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))").run(sha256(token), u.id);
    // ponytail: no email provider wired up; in dev the link is returned so the flow is testable. Plug in SES/Resend for production.
    if (!PROD) out.dev_reset_link = `#/reset/${token}`;
    else console.log(`[auth] password reset requested for user ${u.id}`);
  }
  return out;
});
route('POST', '/api/auth/reset', ({ body }) => {
  const r = db.prepare("SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > datetime('now')").get(sha256(String(body.token || '')));
  if (!r) fail(400, 'This reset link is invalid or has expired');
  if (String(body.password || '').length < 8) fail(400, 'Password must be at least 8 characters');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(body.password), r.user_id);
  db.prepare('UPDATE password_resets SET used = 1 WHERE token_hash = ?').run(r.token_hash);
  return { ok: true };
});
route('GET', '/api/me', ({ user }) => ({ user, profile: user ? getProfile(user.id) : null }));
route('POST', '/api/plan', ({ user, body }) => {
  // ponytail: demo-only plan switch; replace with a payment provider checkout + webhook before charging anyone.
  db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(body.plan === 'pro' ? 'pro' : 'free', user.id);
  return { ok: true };
}, AUTH);

// profile
route('PUT', '/api/profile', ({ user, body }) => {
  if (body.completed) {
    const p = { ...getProfile(user.id), ...body };
    for (const k of ['full_name', 'nationality', 'target_level', 'target_field']) if (!p[k]) fail(400, `Missing required field: ${k.replace('_', ' ')}`);
  }
  if (body.full_name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(body.full_name).slice(0, 120), user.id);
  saveProfile(user.id, body, !!body.completed);
  return { profile: getProfile(user.id) };
}, AUTH);

// scholarships
route('GET', '/api/scholarships', ({ user, query }) => {
  const profile = user && getProfile(user.id);
  const q = (query.get('q') || '').toLowerCase().trim();
  const f = k => query.get(k) || '';
  let list = withMatch(allScholarships(), profile);
  if (q) list = list.filter(s => [s.name, s.provider, s.description, s.provider_type, ...s.countries, ...s.levels, ...s.fields].join(' ').toLowerCase().includes(q));
  if (f('level')) list = list.filter(s => s.levels.includes(f('level')));
  if (f('country')) list = list.filter(s => s.countries.includes(f('country')));
  if (f('field')) list = list.filter(s => s.fields.includes('Any') || s.fields.includes(f('field')));
  if (f('min_amount')) list = list.filter(s => s.value_inr >= +f('min_amount'));
  if (f('fully')) list = list.filter(s => s.is_fully_funded);
  if (f('merit')) list = list.filter(s => s.is_merit);
  if (f('need')) list = list.filter(s => s.is_need);
  if (f('ptype')) list = list.filter(s => s.provider_type === f('ptype'));
  if (f('scope') === 'domestic') list = list.filter(s => s.countries.includes('India'));
  if (f('scope') === 'international') list = list.filter(s => s.countries.some(c => c !== 'India'));
  if (f('income')) list = list.filter(s => !s.max_income_lakh || s.max_income_lakh >= +f('income'));
  if (f('deadline')) list = list.filter(s => !s.closed && s.deadline <= addDays(today(), +f('deadline')));
  if (!f('include_closed')) list = list.filter(s => !s.closed);
  const sort = f('sort') || (profile?.completed ? 'match' : 'featured');
  if (sort === 'match' && profile?.completed) list.sort((a, b) => b.match.score - a.match.score);
  if (sort === 'deadline') list.sort((a, b) => a.deadline.localeCompare(b.deadline));
  if (sort === 'amount') list.sort((a, b) => b.value_inr - a.value_inr);
  const saved = user ? new Set(db.prepare('SELECT scholarship_id id FROM saved_scholarships WHERE user_id = ?').all(user.id).map(r => r.id)) : new Set();
  return { total: list.length, results: list.map(s => ({ ...card(s), saved: saved.has(s.id) })), provider_types: [...new Set(allScholarships().map(s => s.provider_type))] };
});
route('GET', '/api/scholarships/:id', ({ user, params }) => {
  const s = getScholarship(+params.id);
  if (!s || (s.status === 'draft' && user?.role !== 'admin')) fail(404, 'Scholarship not found');
  const profile = user && getProfile(user.id);
  if (user) track(user.id, 'view', s.id);
  const app = user && userApplications(user.id).find(a => a.scholarship_id === s.id);
  return { scholarship: s, match: profile?.completed ? matchScholarship(profile, s) : null, profile_completed: !!profile?.completed,
    saved: !!(user && db.prepare('SELECT 1 FROM saved_scholarships WHERE user_id = ? AND scholarship_id = ?').get(user.id, s.id)), application: app || null };
});
route('GET', '/api/match', ({ user }) => {
  const profile = getProfile(user.id);
  if (!profile?.completed) return { profile_completed: false, results: [] };
  const list = withMatch(allScholarships().filter(s => !s.closed), profile).sort((a, b) => b.match.score - a.match.score);
  return { profile_completed: true, profile, results: list.map(s => ({ ...card(s), explanation: s.match })) };
}, AUTH);

// saved + applications
route('POST', '/api/saved/:id', ({ user, params }) => {
  const id = +params.id;
  if (!getScholarship(id)) fail(404, 'Scholarship not found');
  const exists = db.prepare('SELECT 1 FROM saved_scholarships WHERE user_id = ? AND scholarship_id = ?').get(user.id, id);
  if (exists) db.prepare('DELETE FROM saved_scholarships WHERE user_id = ? AND scholarship_id = ?').run(user.id, id);
  else { db.prepare('INSERT INTO saved_scholarships (user_id, scholarship_id) VALUES (?, ?)').run(user.id, id); track(user.id, 'save', id); }
  return { saved: !exists };
}, AUTH);
route('GET', '/api/saved', ({ user }) => {
  const profile = getProfile(user.id);
  const rows = db.prepare('SELECT scholarship_id id FROM saved_scholarships WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  return { results: withMatch(rows.map(r => getScholarship(r.id)).filter(Boolean), profile).map(s => ({ ...card(s), saved: true })) };
}, AUTH);
route('GET', '/api/applications', ({ user }) => ({ applications: userApplications(user.id), stages: STAGES }), AUTH);
route('POST', '/api/applications', ({ user, body }) => {
  const id = createApplication(user.id, +body.scholarship_id, 'preparing');
  track(user.id, 'app_start', +body.scholarship_id);
  return { id };
}, AUTH);
const ownApp = (user, id) => db.prepare('SELECT * FROM applications WHERE id = ? AND user_id = ?').get(id, user.id) || fail(404, 'Application not found');
route('PATCH', '/api/applications/:id', ({ user, params, body }) => {
  const a = ownApp(user, +params.id);
  if (body.stage) {
    if (!STAGES.includes(body.stage)) fail(400, 'Invalid stage');
    if (body.stage === 'applied' && !SUBMITTED.includes(a.stage)) track(user.id, 'app_submit', a.scholarship_id);
    db.prepare("UPDATE applications SET stage = ?, updated_at = datetime('now') WHERE id = ?").run(body.stage, a.id);
  }
  if (typeof body.notes === 'string') db.prepare("UPDATE applications SET notes = ?, updated_at = datetime('now') WHERE id = ?").run(body.notes.slice(0, 5000), a.id);
  return { ok: true };
}, AUTH);
route('DELETE', '/api/applications/:id', ({ user, params }) => {
  db.prepare('DELETE FROM applications WHERE id = ?').run(ownApp(user, +params.id).id);
  return { ok: true };
}, AUTH);
route('PATCH', '/api/documents/:id', ({ user, params, body }) => {
  const d = db.prepare('SELECT d.id FROM application_documents d JOIN applications a ON a.id = d.application_id WHERE d.id = ? AND a.user_id = ?').get(+params.id, user.id);
  if (!d) fail(404, 'Document not found');
  db.prepare("UPDATE application_documents SET status = ?, updated_at = datetime('now') WHERE id = ?").run(body.status === 'ready' ? 'ready' : 'missing', d.id);
  return { ok: true };
}, AUTH);

// dashboard + notifications
route('GET', '/api/dashboard', ({ user }) => {
  refreshNotifications(user.id);
  const profile = getProfile(user.id);
  const apps = userApplications(user.id);
  const saved = db.prepare('SELECT scholarship_id id FROM saved_scholarships WHERE user_id = ?').all(user.id).map(r => getScholarship(r.id)).filter(Boolean);
  const t = today(), week = addDays(t, 7), month = addDays(t, 30);
  const appBySch = new Map(apps.map(a => [a.scholarship_id, a]));
  const live = saved.filter(s => !s.closed && !SUBMITTED.includes(appBySch.get(s.id)?.stage));
  const potential = saved.filter(s => appBySch.get(s.id)?.stage !== 'rejected').reduce((n, s) => n + s.value_inr, 0);
  const events = Object.fromEntries(db.prepare('SELECT type, COUNT(*) n FROM analytics_events WHERE user_id = ? GROUP BY type').all(user.id).map(r => [r.type, r.n]));
  const top = profile?.completed ? withMatch(allScholarships().filter(s => !s.closed), profile).sort((a, b) => b.match.score - a.match.score).slice(0, 4).map(card) : [];
  return {
    profile, top_matches: top,
    stats: { saved: saved.length, active: apps.filter(a => ['interested', 'preparing', 'ready'].includes(a.stage)).length,
      submitted: apps.filter(a => SUBMITTED.includes(a.stage)).length, upcoming: live.filter(s => s.deadline <= month).length,
      potential_inr: potential, won: apps.filter(a => a.stage === 'awarded').length,
      won_inr: apps.filter(a => a.stage === 'awarded').reduce((n, a) => n + a.scholarship.value_inr, 0) },
    deadlines_this_week: live.filter(s => s.deadline <= week).length,
    deadlines: live.filter(s => s.deadline <= addDays(t, 60)).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 6).map(s => ({ ...card(s), stage: appBySch.get(s.id)?.stage || null })),
    readiness: apps.filter(a => ['preparing', 'ready'].includes(a.stage)).slice(0, 5),
    analytics: { views: events.view || 0, saves: events.save || 0, started: events.app_start || 0, submitted: events.app_submit || 0, ai: events.ai_chat || 0 },
  };
}, AUTH);
route('GET', '/api/notifications', ({ user }) => {
  refreshNotifications(user.id);
  return { notifications: db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY read, created_at DESC, id DESC LIMIT 50').all(user.id) };
}, AUTH);
route('POST', '/api/notifications/read', ({ user, body }) => {
  if (body.id) db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(+body.id, user.id);
  else db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(user.id);
  return { ok: true };
}, AUTH);

// AI
const aiLimit = user => {
  if (user.plan === 'pro') return;
  const n = db.prepare("SELECT COUNT(*) n FROM analytics_events WHERE user_id = ? AND type = 'ai_chat' AND created_at > datetime('now', '-1 day')").get(user.id).n;
  if (n >= 15) fail(402, 'Free plan includes 15 Scholar AI messages per day. Upgrade to Pro for unlimited AI.');
};
route('GET', '/api/ai/history', ({ user }) => ({
  messages: db.prepare("SELECT role, content, scholarship_ids, created_at FROM ai_conversations WHERE user_id = ? AND kind = 'chat' ORDER BY id DESC LIMIT 40").all(user.id).reverse()
    .map(m => ({ ...m, scholarships: m.scholarship_ids ? JSON.parse(m.scholarship_ids).map(getScholarship).filter(Boolean).map(card) : [] })),
}), AUTH);
route('POST', '/api/ai/chat', async ({ user, body }) => {
  const message = String(body.message || '').trim().slice(0, 2000);
  if (!message) fail(400, 'Message is empty');
  aiLimit(user);
  const profile = getProfile(user.id);
  const history = db.prepare("SELECT role, content FROM ai_conversations WHERE user_id = ? AND kind = 'chat' ORDER BY id DESC LIMIT 6").all(user.id).reverse();
  const { reply, scholarshipIds } = await chat(message, profile?.completed ? profile : null, history);
  const ins = db.prepare("INSERT INTO ai_conversations (user_id, kind, role, content, scholarship_ids) VALUES (?, 'chat', ?, ?, ?)");
  ins.run(user.id, 'user', message, null);
  ins.run(user.id, 'assistant', reply, JSON.stringify(scholarshipIds));
  track(user.id, 'ai_chat');
  const list = withMatch(scholarshipIds.map(getScholarship), profile?.completed ? profile : null).map(card);
  return { reply, scholarships: list };
}, AUTH);
route('POST', '/api/ai/clear', ({ user }) => { db.prepare("DELETE FROM ai_conversations WHERE user_id = ? AND kind = 'chat'").run(user.id); return { ok: true }; }, AUTH);
route('POST', '/api/ai/write', async ({ user, body }) => {
  if (user.plan !== 'pro') fail(402, 'The AI Application Assistant is a ScholarPath Pro feature.');
  const out = await write(body);
  db.prepare("INSERT INTO ai_conversations (user_id, kind, role, content) VALUES (?, 'writer', 'assistant', ?)").run(user.id, out.text.slice(0, 20000));
  track(user.id, 'ai_chat');
  return out;
}, AUTH);

// admin
route('GET', '/api/admin/overview', () => {
  const users = db.prepare(`SELECT u.id, u.name, u.email, u.role, u.plan, u.created_at, p.target_level, p.target_field, p.completed,
    (SELECT COUNT(*) FROM applications a WHERE a.user_id = u.id) apps, (SELECT COUNT(*) FROM saved_scholarships s WHERE s.user_id = u.id) saved
    FROM users u LEFT JOIN student_profiles p ON p.user_id = u.id ORDER BY u.id`).all();
  const applications = db.prepare(`SELECT a.id, a.stage, a.updated_at, u.name user_name, s.name scholarship_name, s.deadline
    FROM applications a JOIN users u ON u.id = a.user_id JOIN scholarships s ON s.id = a.scholarship_id ORDER BY a.updated_at DESC LIMIT 200`).all();
  const events = Object.fromEntries(db.prepare('SELECT type, COUNT(*) n FROM analytics_events GROUP BY type').all().map(r => [r.type, r.n]));
  return { users, applications, scholarships: allScholarships(true), events, ai_enabled: AI_ENABLED };
}, ADMIN);
route('POST', '/api/admin/scholarships', ({ body }) => ({ id: upsertScholarship(body) }), ADMIN);
route('PUT', '/api/admin/scholarships/:id', ({ params, body }) => {
  if (!getScholarship(+params.id)) fail(404, 'Not found');
  upsertScholarship(body, +params.id);
  return { ok: true };
}, ADMIN);
route('DELETE', '/api/admin/scholarships/:id', ({ params }) => { db.prepare('DELETE FROM scholarships WHERE id = ?').run(+params.id); return { ok: true }; }, ADMIN);
route('POST', '/api/admin/scholarships/:id/:action', ({ params, body }) => {
  const id = +params.id, s = getScholarship(id) || fail(404, 'Not found');
  const sql = {
    verify: ["UPDATE scholarships SET verified = 1, is_sample = 0, last_verified = date('now') WHERE id = ?"],
    unverify: ['UPDATE scholarships SET verified = 0 WHERE id = ?'],
    expire: ["UPDATE scholarships SET status = 'expired' WHERE id = ?"],
    activate: ["UPDATE scholarships SET status = 'active' WHERE id = ?"],
    feature: [`UPDATE scholarships SET featured = ${s.featured ? 0 : 1} WHERE id = ?`],
  }[params.action];
  if (params.action === 'deadline') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.deadline || '')) fail(400, 'Deadline must be YYYY-MM-DD');
    db.prepare("UPDATE scholarships SET deadline = ?, status = 'active' WHERE id = ?").run(body.deadline, id);
  } else if (sql) db.prepare(sql[0]).run(id);
  else fail(400, 'Unknown action');
  return { ok: true };
}, ADMIN);
route('POST', '/api/admin/extract', ({ body }) => extract({ url: body.url, text: body.text }), ADMIN);

// ---------- server ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const PUBLIC = path.resolve('public');
const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'" };

async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 1e6) fail(413, 'Request too large'); chunks.push(c); }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, 'Invalid JSON'); }
}

export async function handler(req, res) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) {
      const r = routes.find(r => r.method === req.method && r.re.test(url.pathname));
      if (!r) fail(404, 'Not found');
      if (req.method !== 'GET' && !(req.headers['content-type'] || '').includes('application/json')) fail(415, 'Expected application/json'); // CSRF guard
      const user = currentUser(req);
      if (r.auth && !user) fail(401, 'Please log in');
      if (r.admin && user.role !== 'admin') fail(403, 'Admins only');
      const body = req.method === 'GET' ? {} : await readBody(req);
      const data = await r.handler({ req, res, user, body, query: url.searchParams, params: url.pathname.match(r.re).groups || {} });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(data));
      return;
    }
    let file = path.join(PUBLIC, decodeURIComponent(url.pathname));
    if (!file.startsWith(PUBLIC) || !path.extname(file)) file = path.join(PUBLIC, 'index.html');
    const content = await readFile(file).catch(() => null);
    if (!content) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }).end(content);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: status === 500 ? 'Something went wrong' : e.message }));
  }
}

if (!process.env.VERCEL) http.createServer(handler).listen(PORT, () => console.log(`ScholarPath AI running at http://localhost:${PORT}  (AI: ${AI_ENABLED ? 'Claude' : 'local fallback'})`));
