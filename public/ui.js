// Shared UI helpers and components.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export async function api(path, { method = 'GET', body } = {}) {
  if (method !== 'GET') body ??= {};
  const r = await fetch('/api' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: r.status });
  return data;
}

const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  home: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  kanban: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  calc: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 6h6M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01M9 18h6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkc: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  xc: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18"/>',
  cap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',
  wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><path d="M16 14h.01"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M8.2 13.2 7 22l5-3 5 3-1.2-8.8"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-4-6.3"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};
export const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;

export const inr = n => '₹' + Math.round(+n || 0).toLocaleString('en-IN');
export const inrShort = n => n >= 1e7 ? `₹${(n / 1e7).toFixed(n >= 1e8 ? 0 : 1)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(n >= 1e6 ? 0 : 1)}L` : inr(n);
export const fmtDate = d => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const daysLeft = d => Math.round((new Date(d + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5);
export const deadlineText = d => { const n = daysLeft(d); return n < 0 ? 'Closed' : n === 0 ? 'Closes today' : n === 1 ? '1 day left' : `${n} days left`; };
export const mClass = s => s >= 90 ? 'excellent' : s >= 75 ? 'strong' : s >= 50 ? 'possible' : 'low';
export const ring = (score, lg = false) => `<div class="ring ${lg ? 'lg' : ''} m-${mClass(score)}" style="--p:${score}" data-v="${score}%" role="img" aria-label="${score}% match"></div>`;
export const matchBadge = m => m ? `<span class="badge lbl-${mClass(m.score)}">${m.score}% · ${esc(m.label)}</span>` : '';
export const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

export const DISCLAIMER = 'ScholarPath AI helps students discover and evaluate funding opportunities. Scholarship availability, eligibility criteria and deadlines may change. Always confirm details on the official provider website before applying.';
export const disclaimer = (text = DISCLAIMER) => `<div class="disclaimer">${ic('info')}<div>${esc(text)}</div></div>`;
export const verifiedBadge = s => s.verified ? `<span class="badge ok">${ic('checkc')}Verified ${esc(fmtDate(s.last_verified))}</span>` : `<span class="badge warn" title="Prototype sample record — details not verified">${ic('alert')}Sample · unverified</span>`;

export function toast(msg, err = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.innerHTML = `${ic(err ? 'alert' : 'checkc')}<span>${esc(msg)}</span>`;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 3800);
}

export function modal(title, html, { wide = false } = {}) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal card ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-h"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Close">${ic('x')}</button></div><div class="modal-b">${html}</div></div>`;
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => e.key === 'Escape' && close();
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(bg);
  bg.close = close;
  return bg;
}

// Tiny markdown subset for AI replies: **bold**, _italic_, "- " lists, paragraphs. Input is escaped first.
export function md(text) {
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\s)_(.+?)_(?=\s|$|[.,])/g, '$1<em>$2</em>');
  return text.split(/\n{2,}/).map(block => {
    const lines = block.split('\n');
    if (lines.every(l => /^\s*[-•]\s/.test(l))) return `<ul>${lines.map(l => `<li>${inline(l.replace(/^\s*[-•]\s/, ''))}</li>`).join('')}</ul>`;
    return `<p>${lines.map(inline).join('<br>')}</p>`;
  }).join('');
}

export function sCard(s, { compact = false } = {}) {
  const dl = daysLeft(s.deadline);
  return `<article class="card s-card">
    <div class="row between" style="align-items:flex-start">
      <div class="grow stack-sm" style="gap:4px">
        <div class="row wrap" style="gap:6px">${s.featured ? `<span class="badge navy">${ic('star')}Featured</span>` : ''}<span class="badge">${esc(s.funding_type)}</span>${s.is_need ? '<span class="badge outline">Need-based</span>' : s.is_merit ? '<span class="badge outline">Merit</span>' : ''}</div>
        <h3><a href="#/scholarship/${s.id}">${esc(s.name)}</a></h3>
        <div class="prov ellipsis">${esc(s.provider)}</div>
      </div>
      ${s.match ? ring(s.match.score) : ''}
    </div>
    ${s.match ? `<div>${matchBadge(s.match)}</div>` : ''}
    <div class="s-meta">
      <div>${ic('globe')}<span class="ellipsis">${esc(s.countries.slice(0, 3).join(', '))}${s.countries.length > 3 ? ` +${s.countries.length - 3}` : ''}</span></div>
      <div>${ic('cap')}<span class="ellipsis">${esc(s.levels.join(', '))}</span></div>
      <div>${ic('calendar')}<span>${fmtDate(s.deadline)}</span></div>
      <div>${ic('clock')}<span style="color:${dl < 0 ? 'var(--faint)' : dl <= 7 ? 'var(--bad)' : 'inherit'};font-weight:${dl <= 7 ? 600 : 400}">${deadlineText(s.deadline)}</span></div>
    </div>
    <div class="s-foot">
      <div class="grow"><div class="amount ellipsis" title="${esc(s.value_text)}">${inrShort(s.value_inr)}</div><div class="xs muted ellipsis">${esc(s.value_text)}</div></div>
      ${compact ? '' : `<button class="save-btn ${s.saved ? 'on' : ''}" data-save="${s.id}" aria-label="${s.saved ? 'Unsave' : 'Save'} scholarship">${ic('bookmark')}</button>`}
      <a class="btn btn-ghost btn-sm" href="#/scholarship/${s.id}">View</a>
    </div>
  </article>`;
}

export const field = (label, input, hint = '') => `<label class="f">${esc(label)}${hint ? ` <span class="hint">${esc(hint)}</span>` : ''}${input}</label>`;
export const sel = (name, options, value = '', { placeholder = 'Select…', required = false } = {}) =>
  `<select class="input" name="${name}" ${required ? 'required' : ''}><option value="">${esc(placeholder)}</option>${options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
export const inp = (name, value = '', attrs = '') => `<input class="input" name="${name}" value="${esc(value ?? '')}" ${attrs}>`;
export const area = (name, value = '', attrs = '') => `<textarea class="input" name="${name}" ${attrs}>${esc(value ?? '')}</textarea>`;
export const formData = form => Object.fromEntries(new FormData(form));

export const state = { user: null, profile: null, meta: null };
export const go = hash => { location.hash = hash; };
export const requireLogin = () => { sessionStorage.setItem('sp_next', location.hash); go('#/login'); };
