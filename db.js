import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import crypto from 'node:crypto';
import { SCHOLARSHIPS, DEMO_PROFILE } from './data.js';

// On Vercel the only writable disk is /tmp, which is per-instance and wiped on cold start: the demo data resets.
const DB_PATH = process.env.DB_PATH || (process.env.VERCEL ? '/tmp/scholarpath.db' : 'data/scholarpath.db');
if (!process.env.VERCEL) mkdirSync('data', { recursive: true });
export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

export const PROFILE_COLUMNS = {
  full_name: 'TEXT', email: 'TEXT', dob: 'TEXT', gender: 'TEXT', nationality: 'TEXT', state: 'TEXT', category: 'TEXT', income_range: 'TEXT',
  education_level: 'TEXT', institution: 'TEXT', degree: 'TEXT', major: 'TEXT', grade: 'REAL', grade_type: 'TEXT', graduation_year: 'INTEGER',
  target_level: 'TEXT', target_field: 'TEXT', target_countries: 'TEXT', target_universities: 'TEXT', intake_year: 'INTEGER',
  work_years: 'REAL', work_experience: 'TEXT', leadership: 'TEXT', sports: 'TEXT', extracurricular: 'TEXT', awards: 'TEXT', volunteering: 'TEXT', research: 'TEXT',
};

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')), plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS password_resets (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS student_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ${Object.entries(PROFILE_COLUMNS).map(([k, t]) => `${k} ${t}`).join(', ')},
  completed INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS scholarships (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, provider TEXT NOT NULL, provider_type TEXT NOT NULL, description TEXT,
  countries TEXT NOT NULL DEFAULT '[]', study_levels TEXT NOT NULL DEFAULT '[]', fields TEXT NOT NULL DEFAULT '["Any"]',
  value_inr INTEGER NOT NULL DEFAULT 0, value_text TEXT, is_fully_funded INTEGER NOT NULL DEFAULT 0, is_merit INTEGER NOT NULL DEFAULT 0, is_need INTEGER NOT NULL DEFAULT 0,
  coverage TEXT, required_documents TEXT NOT NULL DEFAULT '[]', deadline TEXT, open_date TEXT, official_url TEXT, awards TEXT,
  renewable INTEGER NOT NULL DEFAULT 0, featured INTEGER NOT NULL DEFAULT 0, verified INTEGER NOT NULL DEFAULT 0, last_verified TEXT,
  is_sample INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','draft')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS eligibility_criteria (
  scholarship_id INTEGER PRIMARY KEY REFERENCES scholarships(id) ON DELETE CASCADE,
  nationalities TEXT NOT NULL DEFAULT '["Any"]', min_pct REAL, max_income_lakh REAL, age_max INTEGER, gender TEXT DEFAULT 'Any',
  categories TEXT, min_work_years REAL DEFAULT 0, requires_leadership INTEGER DEFAULT 0, requires_research INTEGER DEFAULT 0, notes TEXT);
CREATE TABLE IF NOT EXISTS saved_scholarships (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, scholarship_id INTEGER NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (user_id, scholarship_id));
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, scholarship_id INTEGER NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'interested' CHECK (stage IN ('interested','preparing','ready','applied','interview','awarded','rejected')),
  notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (user_id, scholarship_id));
CREATE TABLE IF NOT EXISTS application_documents (
  id INTEGER PRIMARY KEY, application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE, name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'missing' CHECK (status IN ('missing','ready')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT, link TEXT,
  dedupe_key TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (user_id, dedupe_key));
CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL DEFAULT 'chat', role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL, scholarship_ids TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, scholarship_id INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_apps_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON analytics_events(user_id, type);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);
`);

// ---------- helpers ----------
const J = v => JSON.stringify(v ?? null);
const P = s => { try { return JSON.parse(s); } catch { return null; } };
export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (d, n) => new Date(new Date(d).getTime() + n * 864e5).toISOString().slice(0, 10);

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
export function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = crypto.scryptSync(pw, salt, 64), b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

const SCH_SQL = `SELECT s.*, e.nationalities, e.min_pct, e.max_income_lakh, e.age_max, e.gender, e.categories, e.min_work_years,
  e.requires_leadership, e.requires_research, e.notes FROM scholarships s LEFT JOIN eligibility_criteria e ON e.scholarship_id = s.id`;

export function toScholarship(r) {
  if (!r) return null;
  const s = { ...r, countries: P(r.countries) || [], levels: P(r.study_levels) || [], fields: P(r.fields) || ['Any'],
    documents: P(r.required_documents) || [], nationalities: P(r.nationalities) || ['Any'], categories: P(r.categories) || null };
  delete s.study_levels; delete s.required_documents;
  for (const k of ['is_fully_funded', 'is_merit', 'is_need', 'renewable', 'featured', 'verified', 'is_sample', 'requires_leadership', 'requires_research']) s[k] = !!s[k];
  s.code = `SP-${1000 + s.id}`;
  s.funding_type = s.is_fully_funded ? 'Fully funded' : 'Partially funded';
  s.scope = s.countries.length === 1 && s.countries[0] === 'India' ? 'Domestic' : s.countries.includes('India') ? 'Domestic & International' : 'International';
  s.closed = s.status === 'expired' || (s.deadline && s.deadline < today());
  return s;
}
export const allScholarships = (includeInactive = false) =>
  db.prepare(`${SCH_SQL} ${includeInactive ? '' : "WHERE s.status = 'active'"} ORDER BY s.featured DESC, s.deadline`).all().map(toScholarship);
export const getScholarship = id => toScholarship(db.prepare(`${SCH_SQL} WHERE s.id = ?`).get(id));

export function upsertScholarship(d, id = null) {
  const row = {
    name: String(d.name || '').trim(), provider: String(d.provider || '').trim(), provider_type: d.provider_type || 'Private Foundation', description: d.description || '',
    countries: J(d.countries || []), study_levels: J(d.levels || []), fields: J(d.fields?.length ? d.fields : ['Any']),
    value_inr: Math.max(0, Math.round(+d.value_inr || 0)), value_text: d.value_text || '', is_fully_funded: d.is_fully_funded ? 1 : 0,
    is_merit: d.is_merit ? 1 : 0, is_need: d.is_need ? 1 : 0, coverage: d.coverage || '', required_documents: J(d.documents || []),
    deadline: d.deadline || null, open_date: d.open_date || null, official_url: d.official_url || '', awards: d.awards || '',
    renewable: d.renewable ? 1 : 0, featured: d.featured ? 1 : 0, status: ['active', 'expired', 'draft'].includes(d.status) ? d.status : 'active',
  };
  if (!row.name || !row.provider) throw Object.assign(new Error('Name and provider are required'), { status: 400 });
  if (row.official_url && !/^https?:\/\//i.test(row.official_url)) throw Object.assign(new Error('Official URL must start with http(s)://'), { status: 400 });
  const cols = Object.keys(row);
  if (id) db.prepare(`UPDATE scholarships SET ${cols.map(c => `${c} = :${c}`).join(', ')} WHERE id = :id`).run({ ...row, id });
  else id = Number(db.prepare(`INSERT INTO scholarships (${cols}, is_sample) VALUES (${cols.map(c => ':' + c)}, :is_sample)`).run({ ...row, is_sample: d.is_sample === false ? 0 : 1 }).lastInsertRowid);
  const e = {
    scholarship_id: id, nationalities: J(d.nationalities?.length ? d.nationalities : ['Any']), min_pct: d.min_pct ? +d.min_pct : null,
    max_income_lakh: d.max_income_lakh ? +d.max_income_lakh : null, age_max: d.age_max ? +d.age_max : null, gender: d.gender || 'Any',
    categories: d.categories?.length ? J(d.categories) : null, min_work_years: +d.min_work_years || 0,
    requires_leadership: d.requires_leadership ? 1 : 0, requires_research: d.requires_research ? 1 : 0, notes: d.notes || null,
  };
  db.prepare(`INSERT OR REPLACE INTO eligibility_criteria (${Object.keys(e)}) VALUES (${Object.keys(e).map(c => ':' + c)})`).run(e);
  return id;
}

export function getProfile(userId) {
  const r = db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(userId);
  if (!r) return null;
  return { ...r, target_countries: P(r.target_countries) || [], completed: !!r.completed };
}
export function saveProfile(userId, data, completed) {
  const row = {};
  for (const [k, t] of Object.entries(PROFILE_COLUMNS)) {
    if (!(k in data)) continue;
    let v = data[k];
    if (k === 'target_countries') v = J(Array.isArray(v) ? v.map(String).slice(0, 30) : []);
    else if (t !== 'TEXT') v = v === '' || v == null || isNaN(+v) ? null : +v;
    else v = v == null ? null : String(v).slice(0, 2000);
    row[k] = v;
  }
  const cols = Object.keys(row);
  db.prepare(`INSERT INTO student_profiles (user_id${cols.map(c => ', ' + c).join('')}) VALUES (:user_id${cols.map(c => ', :' + c).join('')})
    ON CONFLICT(user_id) DO UPDATE SET ${[...cols.map(c => `${c} = excluded.${c}`), "updated_at = datetime('now')"].join(', ')}`).run({ ...row, user_id: userId });
  if (completed) db.prepare('UPDATE student_profiles SET completed = 1 WHERE user_id = ?').run(userId);
}

export function createApplication(userId, scholarshipId, stage = 'interested') {
  const s = getScholarship(scholarshipId);
  if (!s) throw Object.assign(new Error('Scholarship not found'), { status: 404 });
  const existing = db.prepare('SELECT id FROM applications WHERE user_id = ? AND scholarship_id = ?').get(userId, scholarshipId);
  if (existing) return existing.id;
  const id = Number(db.prepare('INSERT INTO applications (user_id, scholarship_id, stage) VALUES (?, ?, ?)').run(userId, scholarshipId, stage).lastInsertRowid);
  const ins = db.prepare('INSERT INTO application_documents (application_id, name) VALUES (?, ?)');
  for (const doc of s.documents) ins.run(id, doc);
  db.prepare('INSERT OR IGNORE INTO saved_scholarships (user_id, scholarship_id) VALUES (?, ?)').run(userId, scholarshipId);
  return id;
}

// ---------- seed ----------
function seed() {
  if (db.prepare('SELECT COUNT(*) n FROM users').get().n) return;
  const t = today();
  db.exec('BEGIN');
  try {
    for (const s of SCHOLARSHIPS) upsertScholarship({
      name: s.name, provider: s.provider, provider_type: s.ptype, description: s.desc, countries: s.countries, levels: s.levels, fields: s.fields,
      value_inr: s.value, value_text: s.valueText, is_fully_funded: s.fully, is_merit: s.merit, is_need: s.need, coverage: s.coverage,
      documents: s.docs, deadline: addDays(t, s.deadline), open_date: addDays(t, s.open), official_url: s.url, awards: s.awards,
      renewable: s.renewable, featured: s.featured, nationalities: s.nat, min_pct: s.minPct, max_income_lakh: s.maxIncome, age_max: s.ageMax,
      gender: s.gender, categories: s.categories, min_work_years: s.minWork, requires_leadership: s.leadership, requires_research: s.researchReq,
      status: s.deadline < 0 ? 'expired' : 'active',
    });
    const addUser = (email, name, pw, role = 'student', plan = 'free') =>
      Number(db.prepare('INSERT INTO users (email, name, password_hash, role, plan) VALUES (?, ?, ?, ?, ?)').run(email, name, hashPassword(pw), role, plan).lastInsertRowid);

    addUser('admin@scholarpath.ai', 'Priya Nair (Admin)', 'admin1234', 'admin', 'pro');
    const demo = addUser('demo@scholarpath.ai', DEMO_PROFILE.full_name, 'demo1234', 'student', 'pro');
    saveProfile(demo, { ...DEMO_PROFILE, email: 'demo@scholarpath.ai' }, true);

    const byName = n => SCHOLARSHIPS.findIndex(s => s.name.startsWith(n)) + 1;
    const plan = [
      ['Chevening', 'ready', 0.85], ['Commonwealth Master', 'preparing', 0.5], ['DAAD Study', 'preparing', 0.6], ['Gates Cambridge', 'interested', 0.2],
      ['Erasmus Mundus', 'applied', 1], ['Eiffel', 'interview', 1], ['GREAT', 'awarded', 1], ['TU Delft', 'interested', 0],
      ['Knight-Hennessy', 'preparing', 0.4], ['Reliance Foundation Postgraduate', 'rejected', 1],
    ];
    for (const [n, stage, frac] of plan) {
      const appId = createApplication(demo, byName(n), stage);
      const docs = db.prepare('SELECT id FROM application_documents WHERE application_id = ? ORDER BY id').all(appId);
      docs.slice(0, Math.round(docs.length * frac)).forEach(d => db.prepare("UPDATE application_documents SET status = 'ready' WHERE id = ?").run(d.id));
    }
    for (const n of ['Inlaks', 'JN Tata', 'K.C. Mahindra', 'Swedish Institute']) db.prepare('INSERT OR IGNORE INTO saved_scholarships (user_id, scholarship_id) VALUES (?, ?)').run(demo, byName(n));

    const ev = db.prepare("INSERT INTO analytics_events (user_id, type, scholarship_id, created_at) VALUES (?, ?, ?, datetime('now', ?))");
    const counts = { view: 46, save: 14, app_start: 10, app_submit: 4, ai_chat: 23 };
    for (const [type, n] of Object.entries(counts)) for (let i = 0; i < n; i++) ev.run(demo, type, (i % SCHOLARSHIPS.length) + 1, `-${(i * 7) % 28} days`);
    db.prepare('INSERT INTO ai_conversations (user_id, role, content) VALUES (?, ?, ?)').run(demo, 'assistant',
      "Hi Aarav — I'm Scholar AI. I search ScholarPath's scholarship database and explain how each result fits your profile. What are you looking for?");

    // Other students, for the admin views
    const others = [['Ananya Iyer', 'Female', 'Karnataka', 'OBC', '₹2.5–5 lakh', 'Undergraduate', 'Engineering', 9.1], ['Rohan Gupta', 'Male', 'Delhi', 'General', '₹12–20 lakh', 'MBA', 'Business & Management', 7.6],
      ['Meera Krishnan', 'Female', 'Kerala', 'General', '₹8–12 lakh', 'PhD', 'Natural Sciences', 8.8], ['Kabir Singh', 'Male', 'Punjab', 'SC', 'Below ₹2.5 lakh', 'Masters', 'Public Policy', 7.9],
      ['Zoya Khan', 'Female', 'Uttar Pradesh', 'EWS', '₹5–8 lakh', 'Masters', 'Medicine & Health', 8.2], ['Arjun Reddy', 'Male', 'Telangana', 'ST', '₹2.5–5 lakh', 'Undergraduate', 'Computer Science', 8.9]];
    others.forEach(([name, gender, state, category, income, level, field, cgpa], i) => {
      const email = name.toLowerCase().replace(' ', '.') + '@example.com';
      const id = addUser(email, name, crypto.randomBytes(12).toString('hex'));
      saveProfile(id, { full_name: name, email, gender, state, category, income_range: income, nationality: 'India', target_level: level, target_field: field, grade: cgpa, grade_type: 'cgpa', dob: `200${i}-06-1${i}`, target_countries: i % 2 ? ['India'] : ['UK', 'Germany'] }, true);
      for (let k = 0; k < 3; k++) createApplication(id, ((i * 5 + k * 3) % SCHOLARSHIPS.length) + 1, ['interested', 'preparing', 'applied'][k]);
    });
    db.exec('COMMIT');
    console.log(`Seeded ${SCHOLARSHIPS.length} sample scholarships, demo + admin accounts.`);
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
seed();
