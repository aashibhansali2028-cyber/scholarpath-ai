import { $, $$, api, ic, esc, toast, state, go, requireLogin, sCard, ring, matchBadge, mClass, inr, inrShort, fmtDate, daysLeft, deadlineText,
  disclaimer, verifiedBadge, modal, md, field, sel, inp, area } from './ui.js';
import { refreshUnread } from './app.js';

const STAGE_LABELS = { interested: 'Interested', preparing: 'Preparing', ready: 'Ready to Apply', applied: 'Applied', interview: 'Interview / Assessment', awarded: 'Awarded', rejected: 'Rejected' };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const meta = async () => state.meta ||= await api('/meta');

// ---------- dashboard ----------
export async function dashboard(view) {
  view.innerHTML = '<div class="grid g4">' + '<div class="skeleton" style="min-height:96px"></div>'.repeat(4) + '</div>';
  const d = await api('/dashboard');
  const st = d.stats, first = (state.user.name || '').split(' ')[0];
  const stat = (k, v, i, sub = '') => `<div class="card stat"><div class="k">${ic(i)}${k}</div><div class="v">${v}</div>${sub ? `<div class="xs muted">${sub}</div>` : ''}</div>`;
  view.innerHTML = `
    <div class="page-head"><div><h1>${greeting()}, ${esc(first)} 👋</h1><p>Here's where your scholarship journey stands today.</p></div>
      <div class="row"><a class="btn btn-ghost" href="#/scholarships">${ic('compass')}Explore</a><a class="btn btn-ai" href="#/match">${ic('sparkles')}AI Match</a></div></div>
    ${!d.profile?.completed ? `<div class="alert ai" style="margin-bottom:16px">${ic('sparkles')}<div class="grow"><b>Complete your profile to unlock AI matching.</b> It takes about 5 minutes.</div><a class="btn btn-ai btn-sm" href="#/onboarding">Complete profile</a></div>` : ''}
    ${d.deadlines_this_week ? `<div class="alert" style="margin-bottom:16px">${ic('clock')}<div class="grow"><b>${d.deadlines_this_week} scholarship deadline${d.deadlines_this_week > 1 ? 's' : ''} this week.</b> Review your checklist before they close.</div><a class="btn btn-ghost btn-sm" href="#/tracker">Open tracker</a></div>` : ''}
    <div class="grid g4" style="margin-bottom:16px">
      ${stat('Scholarships Saved', st.saved, 'bookmark')}${stat('Applications Active', st.active, 'kanban', 'Interested → Ready')}
      ${stat('Applications Submitted', st.submitted, 'send')}${stat('Upcoming Deadlines', st.upcoming, 'calendar', 'Next 30 days')}
    </div>
    <div class="grid g2" style="margin-bottom:16px">
      ${stat('Potential Funding', inr(st.potential_inr), 'wallet', 'Across saved scholarships (not guaranteed)')}${stat('Applications Won', st.won, 'award', st.won ? `${inr(st.won_inr)} awarded` : 'Keep going!')}
    </div>
    <div class="split">
      <div class="stack">
        <div class="card"><div class="row between pad" style="padding-bottom:8px"><h3 style="font-size:16px">Upcoming deadlines</h3><a class="small" style="color:var(--ai-ink);font-weight:600" href="#/tracker">Tracker ${ic('right')}</a></div>
          ${d.deadlines.length ? `<div class="table-wrap"><table class="t"><tbody>${d.deadlines.map(s => { const n = daysLeft(s.deadline); return `<tr>
            <td><a href="#/scholarship/${s.id}"><b class="small">${esc(s.name)}</b></a><div class="xs muted">${esc(s.provider)}</div></td>
            <td class="small">${inrShort(s.value_inr)}</td>
            <td><span class="badge ${n <= 7 ? 'bad' : n <= 30 ? 'warn' : ''}">${ic('clock')}${deadlineText(s.deadline)}</span></td>
            <td class="xs muted">${s.stage ? STAGE_LABELS[s.stage] : 'Saved'}</td></tr>`; }).join('')}</tbody></table></div>` : `<div class="empty small">No upcoming deadlines. Save scholarships to track them here.</div>`}
        </div>
        <div class="card pad stack"><div class="row between"><h3 style="font-size:16px">Application readiness</h3><span class="xs muted">Documents checklist</span></div>
          ${d.readiness.length ? d.readiness.map(a => `<div class="stack-sm" style="gap:6px"><div class="row between"><a href="#/tracker?open=${a.id}" class="small"><b>${esc(a.scholarship.name)}</b></a><b class="small">${a.readiness}%</b></div>
            <div class="bar ${a.readiness === 100 ? 'ok' : ''}"><i style="width:${a.readiness}%"></i></div><div class="xs muted">${ic('right')} Next step: ${esc(a.next_step)}</div></div>`).join('')
            : '<p class="small muted">Start an application to see a readiness checklist.</p>'}
        </div>
      </div>
      <div class="stack">
        <div class="card pad stack"><div class="row between"><h3 style="font-size:16px">Top AI matches</h3><a class="small" style="color:var(--ai-ink);font-weight:600" href="#/match">All matches ${ic('right')}</a></div>
          ${d.top_matches.length ? d.top_matches.map(s => `<a class="row" href="#/scholarship/${s.id}" style="padding:10px;border:1px solid var(--line);border-radius:12px">${ring(s.match.score)}<div class="grow"><b class="small ellipsis" style="display:block">${esc(s.name)}</b><span class="xs muted">${esc(s.countries.slice(0, 2).join(', '))} · ${inrShort(s.value_inr)} · ${fmtDate(s.deadline)}</span></div>${ic('right')}</a>`).join('')
            : '<p class="small muted">Complete your profile to see matches.</p>'}
        </div>
        <div class="card pad stack"><h3 style="font-size:16px">Your activity</h3>
          <div class="mini-bars">${(() => { const a = d.analytics, max = Math.max(1, ...Object.values(a));
            return [['Scholarships viewed', a.views], ['Scholarships saved', a.saves], ['Applications started', a.started], ['Applications submitted', a.submitted], ['AI assistant usage', a.ai]]
              .map(([k, v]) => `<div class="r"><span class="muted">${k}</span><div class="bar"><i style="width:${(v / max) * 100}%"></i></div><b>${v}</b></div>`).join(''); })()}</div>
        </div>
        <a class="card pad row" href="#/assistant" style="background:linear-gradient(150deg,#FBFAFF,#F1EEFF);border-color:#E3DFFF">${ic('chat')}<div class="grow"><b class="small">Ask Scholar AI</b><div class="xs muted">“Which scholarships don't require GRE?”</div></div>${ic('arrow')}</a>
      </div>
    </div>
    <div style="margin-top:20px">${disclaimer()}</div>`;
}

// ---------- explorer ----------
export async function explorer(view, _p, query) {
  const m = await meta();
  const f = { q: query.get('q') || '', level: '', country: query.get('country') || '', field: '', min_amount: '', fully: '', merit: '', need: '', deadline: '', ptype: '', scope: '', income: '', sort: '', tab: query.get('tab') || 'all' };
  const loggedIn = !!state.user, profiled = !!state.profile?.completed;
  view.innerHTML = `<div class="${loggedIn ? '' : 'wrap'}" style="${loggedIn ? '' : 'padding-top:32px;padding-bottom:40px'}">
    <div class="page-head"><div><h1>Scholarship Explorer</h1><p>Government, university, corporate and international scholarships — in one place.</p></div>
      ${loggedIn ? `<div class="toggle"><button data-tab="all" class="${f.tab === 'all' ? 'on' : ''}">All</button><button data-tab="saved" class="${f.tab === 'saved' ? 'on' : ''}">${ic('bookmark')} Saved</button></div>` : ''}</div>
    <form class="big-search" id="qform" role="search" style="margin-bottom:16px">${ic('search')}<input class="input" name="q" value="${esc(f.q)}" placeholder="Search scholarships, countries, universities or courses..." aria-label="Search"></form>
    ${!loggedIn ? `<div class="alert ai" style="margin-bottom:16px">${ic('sparkles')}<div class="grow">Create a free profile to see your personal <b>match score</b> on every scholarship.</div><a class="btn btn-ai btn-sm" href="#/signup">Get my match scores</a></div>`
      : !profiled ? `<div class="alert ai" style="margin-bottom:16px">${ic('sparkles')}<div class="grow">Complete your profile to see AI match scores.</div><a class="btn btn-ai btn-sm" href="#/onboarding">Complete profile</a></div>` : ''}
    <div class="explorer">
      <form class="card filters collapsed" id="filters">
        <button type="button" class="btn btn-ghost btn-block filters-toggle">${ic('filter')}Filters</button>
        ${field('Study level', sel('level', m.levels, '', { placeholder: 'Any level' }))}
        ${field('Country', sel('country', m.countries, f.country, { placeholder: 'Any country' }))}
        ${field('Course / field', sel('field', m.fields, '', { placeholder: 'Any field' }))}
        ${field('Scholarship amount', sel('min_amount', [[100000, '₹1 lakh+'], [1000000, '₹10 lakh+'], [2500000, '₹25 lakh+'], [5000000, '₹50 lakh+']], '', { placeholder: 'Any amount' }))}
        <div><h4>Funding</h4><div class="stack-sm"><label class="check"><input type="checkbox" name="fully" value="1">Fully funded</label><label class="check"><input type="checkbox" name="merit" value="1">Merit based</label><label class="check"><input type="checkbox" name="need" value="1">Need based</label></div></div>
        ${field('Deadline', sel('deadline', [[7, 'Within 7 days'], [30, 'Within 30 days'], [90, 'Within 3 months']], '', { placeholder: 'Any time' }))}
        ${field('Provider type', sel('ptype', [], '', { placeholder: 'All providers' }))}
        <div><h4>Destination</h4><div class="chips">${[['', 'All'], ['domestic', 'Domestic'], ['international', 'International']].map(([v, l]) => `<label class="chip"><input type="radio" name="scope" value="${v}" ${v === '' ? 'checked' : ''}>${l}</label>`).join('')}</div></div>
        ${field('Income eligibility', sel('income', [[2.5, 'Family income ≤ ₹2.5L'], [5, '≤ ₹5L'], [8, '≤ ₹8L'], [12, '≤ ₹12L'], [20, '≤ ₹20L']], '', { placeholder: 'Any income' }), 'Show scholarships open to')}
        <button type="reset" class="btn btn-text btn-sm">Clear filters</button>
      </form>
      <div class="stack">
        <div class="row between wrap"><span class="small muted" id="count">Loading…</span>
          ${sel('sort', [...(profiled ? [['match', 'Best match']] : []), ['featured', 'Featured'], ['deadline', 'Deadline (soonest)'], ['amount', 'Amount (highest)']], profiled ? 'match' : 'featured', { placeholder: 'Sort' }).replace('class="input"', 'class="input" style="width:200px" form="filters"')}</div>
        <div class="cards" id="results"></div>
      </div>
    </div></div>`;
  const form = $('#filters'), results = $('#results');
  $('.filters-toggle', form).onclick = () => form.classList.toggle('collapsed');
  let seq = 0;
  async function load() {
    const my = ++seq;
    results.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    let data;
    if (f.tab === 'saved') data = await api('/saved').then(r => ({ results: r.results, total: r.results.length }));
    else {
      const params = new URLSearchParams(Object.entries(f).filter(([k, v]) => v && k !== 'tab'));
      data = await api('/scholarships?' + params);
      const pt = form.ptype;
      if (pt.options.length <= 1) data.provider_types.forEach(t => pt.add(new Option(t, t)));
    }
    if (my !== seq) return;
    $('#count').textContent = `${data.total} scholarship${data.total === 1 ? '' : 's'}${f.tab === 'saved' ? ' saved' : ' found'}`;
    results.innerHTML = data.results.length ? data.results.map(s => sCard(s)).join('')
      : `<div class="empty card" style="grid-column:1/-1">${ic('search')}<h3>No scholarships match</h3><p class="small">Try removing a filter or searching a broader term.</p></div>`;
  }
  const sync = () => {
    const fd = new FormData(form);
    for (const k of ['level', 'country', 'field', 'min_amount', 'deadline', 'ptype', 'scope', 'income', 'sort']) f[k] = fd.get(k) || '';
    for (const k of ['fully', 'merit', 'need']) f[k] = fd.get(k) ? '1' : '';
    load();
  };
  form.addEventListener('change', sync);
  form.addEventListener('reset', () => setTimeout(sync));
  let t;
  $('#qform').oninput = e => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value.trim(); load(); }, 250); };
  $('#qform').onsubmit = e => e.preventDefault();
  $$('[data-tab]').forEach(b => b.onclick = () => { f.tab = b.dataset.tab; $$('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); load(); });
  load();
}

// ---------- detail ----------
export async function detail(view, { id }) {
  view.innerHTML = '<div class="skeleton" style="height:420px"></div>';
  const { scholarship: s, match: m, saved, application: app, profile_completed } = await api('/scholarships/' + id);
  const dl = daysLeft(s.deadline);
  const crit = [
    ['Nationality', s.nationalities.includes('Any') ? 'Open to all nationalities' : s.nationalities.join(', ')],
    ['Study level', s.levels.join(', ')], ['Fields of study', s.fields.includes('Any') ? 'All fields' : s.fields.join(', ')],
    s.min_pct && ['Academic', `Typically ~${s.min_pct}% / ${(s.min_pct / 10).toFixed(1)} CGPA or above`],
    s.max_income_lakh && ['Family income', `Below ₹${s.max_income_lakh} lakh per year`], s.age_max && ['Age', `Up to ${s.age_max} years`],
    s.gender && s.gender !== 'Any' && ['Gender', `${s.gender} applicants`], s.categories?.length && ['Category', s.categories.join(', ')],
    s.min_work_years && ['Work experience', `At least ${s.min_work_years} years`], s.requires_leadership && ['Leadership', 'Demonstrated leadership potential'],
    s.requires_research && ['Research', 'Research proposal / prior research expected'],
  ].filter(Boolean);
  const steps = ['Check eligibility on the official website', 'Prepare the required documents', s.documents.some(d => /offer|admission/i.test(d)) ? 'Secure admission / offer from an eligible university' : 'Shortlist eligible programmes',
    'Draft essays / SOP and request references early', 'Submit on the official portal before the deadline', 'Shortlisting, interviews or assessments (if any)'];
  const ask = encodeURIComponent(`Tell me about ${s.name}. Am I a good fit, and what should I prepare?`);
  view.innerHTML = `
    <a class="small muted row" href="#/scholarships" style="margin-bottom:14px;gap:6px">${ic('back')}Back to scholarships</a>
    <div class="detail">
      <div class="stack">
        <div class="card detail-hero">
          <div class="row wrap" style="gap:6px">${s.featured ? `<span class="badge navy">${ic('star')}Featured</span>` : ''}<span class="badge">${esc(s.provider_type)}</span><span class="badge">${esc(s.funding_type)}</span>${s.is_merit ? '<span class="badge outline">Merit</span>' : ''}${s.is_need ? '<span class="badge outline">Need-based</span>' : ''}${verifiedBadge(s)}${s.closed ? '<span class="badge bad">Closed</span>' : ''}</div>
          <div class="row between" style="align-items:flex-start;gap:20px"><div class="stack-sm"><h1>${esc(s.name)}</h1><p class="muted">${esc(s.provider)}</p></div>${m ? ring(m.score, true) : ''}</div>
          <div class="kv">
            ${[['Funding', inrShort(s.value_inr)], ['Deadline', fmtDate(s.deadline)], ['Country', s.countries.length > 3 ? `${s.countries.slice(0, 2).join(', ')} +${s.countries.length - 2}` : s.countries.join(', ')], ['Study level', s.levels.join(', ')],
              ['Number of awards', s.awards || '—'], ['Funding type', s.funding_type], ['Renewable', s.renewable ? 'Yes' : 'No'], ['Scholarship ID', s.code]]
              .map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`).join('')}
          </div>
        </div>
        <div class="card sec"><h2>About the Scholarship</h2><p class="muted">${esc(s.description)}</p><p class="small"><b>Value:</b> ${esc(s.value_text)}</p></div>
        <div class="card sec"><h2>Eligibility</h2><ul class="ticks">${crit.map(([k, v]) => `<li class="ok">${ic('check')}<span><b>${esc(k)}:</b> ${esc(v)}</span></li>`).join('')}</ul></div>
        <div class="card sec"><h2>Funding Coverage</h2><p class="muted">${esc(s.coverage)}</p></div>
        <div class="card sec"><h2>Required Documents</h2><ul class="ticks">${s.documents.map(d => `<li class="ok">${ic('file')}<span>${esc(d)}</span></li>`).join('')}</ul></div>
        <div class="card sec"><h2>Application Timeline</h2><div class="timeline">
          ${[['Applications open', s.open_date], ['Application deadline', s.deadline], ['Shortlisting & interviews', 'Typically 1–3 months after the deadline'], ['Results announced', 'As published by the provider']]
            .map(([k, v], i) => `<div><span class="pt ${i === 0 && v <= new Date().toISOString().slice(0, 10) ? 'done' : ''}"></span><div><b class="small">${k}</b><div class="small muted">${/^\d{4}-/.test(v) ? fmtDate(v) : esc(v)}</div></div></div>`).join('')}</div></div>
        <div class="card sec"><h2>Application Process</h2><ol class="small" style="margin:0;padding-left:20px;display:grid;gap:8px">${steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>
        <div class="card sec analysis" id="analysis"><div class="row between"><h2>${ic('sparkles')} AI Eligibility Analysis</h2>${m ? matchBadge(m) : ''}</div>
          ${m ? `<p><b>${esc(m.summary)}</b></p>
            <div class="grid g2"><div class="stack-sm"><span class="xs muted">REASONS YOU QUALIFY</span><ul class="ticks small">${m.reasons.map(r => `<li class="ok">${ic('checkc')}<span>${esc(r)}</span></li>`).join('') || '<li class="muted">—</li>'}</ul></div>
            <div class="stack-sm"><span class="xs muted">POTENTIAL CONCERNS</span><ul class="ticks small">${m.concerns.map(r => `<li class="warn">${ic('alert')}<span>${esc(r)}</span></li>`).join('') || '<li class="muted">No concerns detected.</li>'}</ul></div></div>
            <p class="xs muted">An AI match is an estimate. It does not guarantee eligibility or selection.</p>`
          : `<p class="muted">${state.user ? (profile_completed ? '' : 'Complete your profile to get a personalised eligibility analysis.') : 'Log in and build your profile to get a personalised eligibility analysis.'}</p><a class="btn btn-ai" href="${state.user ? '#/onboarding' : '#/signup'}" style="justify-self:start">${ic('sparkles')}Get my analysis</a>`}
          ${disclaimer('Eligibility information should always be verified through the official scholarship provider.')}
        </div>
        <div class="card sec"><h2>Official Scholarship Link</h2><p class="small muted">Always apply through the official provider. ScholarPath never charges for applications.</p>
          <a class="btn btn-ghost" style="justify-self:start" href="${esc(s.official_url)}" target="_blank" rel="noopener noreferrer">${ic('external')}${esc(s.official_url.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 60))}</a></div>
      </div>
      <aside class="sticky stack">
        <div class="card pad stack">
          ${m ? `<div class="row">${ring(m.score)}<div><b>${esc(m.label)}</b><div class="xs muted">${esc(m.summary)}</div></div></div>` : ''}
          <div class="row between"><span class="muted small">Deadline</span><b class="small" style="color:${dl <= 7 && dl >= 0 ? 'var(--bad)' : 'inherit'}">${fmtDate(s.deadline)} · ${deadlineText(s.deadline)}</b></div>
          <div class="row between"><span class="muted small">Funding</span><b class="small">${inr(s.value_inr)}</b></div>
          <button class="btn btn-ghost btn-block ${saved ? 'on' : ''}" data-save="${s.id}">${ic('bookmark')}<span data-save-label>${saved ? 'Saved' : 'Save Scholarship'}</span></button>
          ${app ? `<a class="btn btn-primary btn-block" href="#/tracker?open=${app.id}">${ic('kanban')}View application · ${app.readiness}% ready</a>`
            : `<button class="btn btn-primary btn-block" id="startapp" ${s.closed ? 'disabled' : ''}>${ic('plus')}Start Application</button>`}
          <a class="btn btn-ai btn-block" href="${state.user ? `#/assistant?ask=${ask}` : '#/login'}">${ic('chat')}Ask AI About This Scholarship</a>
          <a class="btn btn-text btn-block" href="${esc(s.official_url)}" target="_blank" rel="noopener noreferrer">${ic('external')}Official website</a>
        </div>
        <div class="card pad stack-sm small"><b>Source & verification</b>
          <div class="row between"><span class="muted">Source</span><a href="${esc(s.official_url)}" target="_blank" rel="noopener noreferrer" style="color:var(--ai-ink);font-weight:600">Official provider ${ic('external')}</a></div>
          <div class="row between"><span class="muted">Last verified</span><b>${s.verified ? fmtDate(s.last_verified) : 'Not yet verified'}</b></div>
          ${s.is_sample ? '<p class="xs" style="color:var(--warn)">Prototype sample record. Amounts, criteria and dates are illustrative — confirm everything on the official website.</p>' : ''}
        </div>
      </aside>
    </div>`;
  const start = $('#startapp');
  if (start) start.onclick = async () => {
    if (!state.user) return requireLogin();
    const { id: appId } = await api('/applications', { method: 'POST', body: { scholarship_id: s.id } });
    toast('Application started — checklist created');
    go(`#/tracker?open=${appId}`);
  };
}

// ---------- AI match ----------
export async function matchPage(view) {
  if (!state.profile?.completed) {
    view.innerHTML = `<div class="card empty">${ic('sparkles')}<h3>Build your profile to run AI matching</h3><p class="small" style="margin:6px 0 16px">We compare your academics, goals and background with each scholarship's eligibility criteria.</p><a class="btn btn-ai" href="#/onboarding">Start profile</a></div>`;
    return;
  }
  view.innerHTML = `<div class="card pad-lg stack" style="text-align:center;place-items:center;min-height:300px;align-content:center">
    <div class="ring lg m-strong" id="scan" style="--p:0" data-v="0%"></div><h3>Analysing scholarships against your profile…</h3><p class="muted small">Checking nationality, study level, academics, income, country and more.</p></div>`;
  const [data] = await Promise.all([api('/match'), new Promise(r => { let p = 0; const iv = setInterval(() => { p = Math.min(100, p + 12); const el = $('#scan'); if (el) { el.style.setProperty('--p', p); el.dataset.v = p + '%'; } if (p >= 100) { clearInterval(iv); r(); } }, 70); })]);
  const p = data.profile, groups = ['Excellent Match', 'Strong Match', 'Possible Match', 'Low Match'];
  let filter = 'all';
  const render = () => {
    const list = data.results.filter(s => filter === 'all' || s.explanation.label === filter);
    view.innerHTML = `
      <div class="page-head"><div><h1>AI Scholarship Matching</h1><p>${data.results.length} open scholarships ranked for you · ${esc(p.target_level)} · ${esc(p.target_field)} · ${esc((p.target_countries || []).join(', ') || 'Any country')}</p></div>
        <a class="btn btn-ghost" href="#/profile">${ic('user')}View profile</a></div>
      <div class="grid g4" style="margin-bottom:18px">${groups.map(g => { const n = data.results.filter(s => s.explanation.label === g).length; const c = mClass({ 'Excellent Match': 95, 'Strong Match': 80, 'Possible Match': 60, 'Low Match': 10 }[g]);
        return `<button class="card stat" data-f="${g}" style="text-align:left;cursor:pointer;${filter === g ? 'outline:2px solid var(--ai)' : ''}"><span class="badge lbl-${c}" style="justify-self:start">${g}</span><div class="v">${n}</div></button>`; }).join('')}</div>
      <div class="row between" style="margin-bottom:12px"><span class="small muted">${filter === 'all' ? 'All matches' : filter} · ${list.length}</span>${filter !== 'all' ? '<button class="btn btn-text btn-sm" data-f="all">Show all</button>' : ''}</div>
      <div class="stack">${list.map(s => `<div class="card pad">
        <div class="row" style="align-items:flex-start;gap:16px">${ring(s.explanation.score)}
          <div class="grow stack-sm" style="gap:6px">
            <div class="row between wrap"><div><a href="#/scholarship/${s.id}"><b>${esc(s.name)}</b></a><div class="small muted">${esc(s.provider)} · ${esc(s.countries.slice(0, 3).join(', '))} · ${inrShort(s.value_inr)} · Deadline ${fmtDate(s.deadline)}</div></div>
              <div class="row">${matchBadge(s.explanation)}<button class="save-btn" data-save="${s.id}" aria-label="Save">${ic('bookmark')}</button></div></div>
            <p class="small"><b>${esc(s.explanation.summary)}</b></p>
            <details><summary class="small" style="cursor:pointer;color:var(--ai-ink);font-weight:600">Why this score?</summary>
              <div class="grid g2" style="margin-top:10px"><ul class="ticks small">${s.explanation.reasons.map(r => `<li class="ok">${ic('checkc')}<span>${esc(r)}</span></li>`).join('')}</ul>
              <ul class="ticks small">${s.explanation.concerns.map(r => `<li class="warn">${ic('alert')}<span>${esc(r)}</span></li>`).join('') || '<li class="muted">No concerns detected.</li>'}</ul></div></details>
          </div></div></div>`).join('')}</div>
      <div style="margin-top:20px">${disclaimer('Match scores are estimates and never guarantee eligibility or selection. Eligibility information should always be verified through the official scholarship provider.')}</div>`;
    $$('[data-f]', view).forEach(b => b.onclick = () => { filter = b.dataset.f; render(); });
  };
  render();
  api('/saved').then(r => r.results.forEach(s => $$(`[data-save="${s.id}"]`).forEach(b => b.classList.add('on'))));
}

// ---------- tracker ----------
export async function tracker(view, _p, query) {
  let { applications: apps, stages } = await api('/applications');
  const render = () => {
    view.innerHTML = `
      <div class="page-head"><div><h1>Application Tracker</h1><p>Drag cards between stages. Click a card for its readiness checklist.</p></div>
        <a class="btn btn-ghost" href="#/scholarships">${ic('plus')}Add from explorer</a></div>
      ${apps.length ? '' : `<div class="card empty" style="margin-bottom:16px">${ic('kanban')}<h3>No applications yet</h3><p class="small">Open a scholarship and click “Start Application”.</p></div>`}
      <div class="board">${stages.map(st => { const list = apps.filter(a => a.stage === st); return `
        <div class="col" data-stage="${st}"><div class="col-h"><span>${STAGE_LABELS[st]}</span><span class="badge">${list.length}</span></div>
        ${list.map(a => { const s = a.scholarship; const n = daysLeft(s.deadline); return `
          <div class="card k-card" draggable="true" data-app="${a.id}">
            <h4>${esc(s.name)}</h4>
            <div class="row between xs"><b class="amount" style="font-size:13px">${inrShort(s.value_inr)}</b>${s.match ? `<span class="badge lbl-${mClass(s.match.score)}" style="height:20px">${s.match.score}% match</span>` : ''}</div>
            <div class="xs" style="color:${n <= 7 && n >= 0 ? 'var(--bad)' : 'var(--muted)'}">${ic('calendar')} ${fmtDate(s.deadline)} · ${deadlineText(s.deadline)}</div>
            <div class="stack-sm" style="gap:4px"><div class="row between xs muted"><span>Application completion</span><b>${a.readiness}%</b></div><div class="bar ${a.readiness === 100 ? 'ok' : ''}"><i style="width:${a.readiness}%"></i></div></div>
            <select class="input stage-sel" data-move="${a.id}" aria-label="Move to stage">${stages.map(x => `<option value="${x}" ${x === st ? 'selected' : ''}>${STAGE_LABELS[x]}</option>`).join('')}</select>
          </div>`; }).join('')}</div>`; }).join('')}</div>`;
    $$('.k-card', view).forEach(c => {
      c.ondragstart = e => { e.dataTransfer.setData('text/plain', c.dataset.app); c.classList.add('dragging'); };
      c.ondragend = () => c.classList.remove('dragging');
      c.onclick = e => { if (!e.target.closest('select')) openApp(+c.dataset.app); };
    });
    $$('.col', view).forEach(col => {
      col.ondragover = e => { e.preventDefault(); col.classList.add('over'); };
      col.ondragleave = () => col.classList.remove('over');
      col.ondrop = e => { e.preventDefault(); col.classList.remove('over'); move(+e.dataTransfer.getData('text/plain'), col.dataset.stage); };
    });
    $$('[data-move]', view).forEach(s => s.onchange = () => move(+s.dataset.move, s.value));
  };
  async function reload() { ({ applications: apps } = await api('/applications')); render(); }
  async function move(id, stage) {
    const a = apps.find(x => x.id === id);
    if (!a || a.stage === stage) return;
    a.stage = stage; render();
    try { await api('/applications/' + id, { method: 'PATCH', body: { stage } }); toast(`Moved to ${STAGE_LABELS[stage]}`); if (stage === 'awarded') toast('Congratulations! 🎉'); }
    catch (e) { toast(e.message, true); reload(); }
  }
  function openApp(id) {
    const a = apps.find(x => x.id === id);
    if (!a) return;
    const ready = a.documents.filter(d => d.status === 'ready').length;
    const m = modal(a.scholarship.name, `<div class="pad stack">
      <div class="row between wrap"><div class="row"><div class="ring m-${a.readiness >= 90 ? 'excellent' : a.readiness >= 60 ? 'strong' : 'possible'}" style="--p:${a.readiness}" data-v="${a.readiness}%"></div><div><b>Application Readiness: ${a.readiness}%</b><div class="xs muted">${ready} of ${a.documents.length} documents ready</div></div></div>
        <select class="input" id="stage" style="width:210px">${stages.map(x => `<option value="${x}" ${x === a.stage ? 'selected' : ''}>${STAGE_LABELS[x]}</option>`).join('')}</select></div>
      <div class="alert ${a.readiness === 100 ? 'ai' : ''}">${ic(a.readiness === 100 ? 'checkc' : 'right')}<div><b>Next step:</b> ${esc(a.next_step)}</div></div>
      <div class="stack-sm"><b class="small">Readiness checklist</b>
        ${a.documents.map(d => `<label class="row between" style="padding:10px 12px;border:1px solid var(--line);border-radius:10px;cursor:pointer">
          <span class="row small">${d.status === 'ready' ? `<span style="color:var(--ok)">${ic('checkc')}</span>` : `<span style="color:var(--warn)">${ic('alert')}</span>`}${esc(d.name)}</span>
          <span class="row xs muted">${d.status === 'ready' ? 'Ready' : 'Missing'}<input type="checkbox" data-doc="${d.id}" ${d.status === 'ready' ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--ok)"></span></label>`).join('')}</div>
      ${field('Notes', area('notes', a.notes || '', 'rows="3" placeholder="Referee contacts, portal login hints, essay ideas…"'))}
      <div class="row between wrap"><button class="btn btn-danger btn-sm" id="del">${ic('trash')}Remove</button>
        <div class="row"><a class="btn btn-ghost btn-sm" href="#/scholarship/${a.scholarship_id}">${ic('eye')}Scholarship</a><a class="btn btn-ai btn-sm" href="#/writer?target=${encodeURIComponent(a.scholarship.name)}">${ic('pen')}Write with AI</a><button class="btn btn-primary btn-sm" id="savenotes">Save</button></div></div>
      <p class="xs faint">Document status is tracked here for your planning — upload the actual files on the provider's official portal.</p></div>`);
    $$('[data-doc]', m).forEach(cb => cb.onchange = async () => {
      await api('/documents/' + cb.dataset.doc, { method: 'PATCH', body: { status: cb.checked ? 'ready' : 'missing' } });
      await reload(); m.close(); openApp(id);
    });
    $('#stage', m).onchange = e => { move(id, e.target.value); };
    $('#savenotes', m).onclick = async () => { await api('/applications/' + id, { method: 'PATCH', body: { notes: $('[name=notes]', m).value } }); a.notes = $('[name=notes]', m).value; toast('Saved'); m.close(); };
    $('#del', m).onclick = async () => { if (!confirm('Remove this application from your tracker?')) return; await api('/applications/' + id, { method: 'DELETE' }); m.close(); toast('Application removed'); reload(); };
  }
  render();
  const open = +query.get('open');
  if (open) openApp(open);
}

// ---------- Scholar AI ----------
const EXAMPLES = ['Find fully funded Masters scholarships in the UK.', "I'm an Indian student with an 8.2 CGPA looking for Data Science programs in Germany. What scholarships could I qualify for?",
  "Which scholarships don't require GRE?", 'What scholarships are available for students with family income under ₹8 lakh?'];
export async function assistant(view, _p, query) {
  view.innerHTML = `<div class="page-head"><div><h1 class="row">${ic('sparkles')} Scholar AI</h1><p>Answers come from the ScholarPath scholarship database — never made up.</p></div>
      <div class="row"><span class="badge ${(await meta()).ai_enabled ? 'ai' : ''}">${(await meta()).ai_enabled ? 'Gemini-powered' : 'Database search mode'}</span><button class="btn btn-ghost btn-sm" id="clear">${ic('trash')}Clear chat</button></div></div>
    <div class="card chat"><div class="msgs" id="msgs"></div>
      <div class="composer"><div class="prompts" id="prompts">${EXAMPLES.map(e => `<button type="button">${esc(e)}</button>`).join('')}</div>
        <form id="chatf"><input class="input" name="m" placeholder="Ask anything about scholarships..." autocomplete="off" aria-label="Message" maxlength="2000"><button class="btn btn-ai" type="submit" aria-label="Send">${ic('send')}Send</button></form></div></div>`;
  const msgs = $('#msgs');
  const bubble = (role, html, cards = []) => {
    const el = document.createElement('div');
    el.className = `msg ${role === 'user' ? 'me' : 'ai'}`;
    el.innerHTML = `<div class="who">${role === 'user' ? esc((state.user.name || 'U')[0]) : ic('sparkles')}</div><div class="body">${html}${cards.length ? `<div class="cards">${cards.map(c => sCard(c)).join('')}</div>` : ''}</div>`;
    msgs.append(el); msgs.scrollTop = msgs.scrollHeight;
    return el;
  };
  const { messages } = await api('/ai/history');
  if (!messages.length) bubble('assistant', md(`Hi ${(state.user.name || '').split(' ')[0]} — I'm **Scholar AI**. I search ScholarPath's scholarship database and explain how each result fits your profile. Try one of the prompts below.`));
  messages.forEach(m => bubble(m.role, m.role === 'user' ? esc(m.content) : md(m.content), m.scholarships));
  async function send(text) {
    text = text.trim();
    if (!text) return;
    bubble('user', esc(text));
    const t = bubble('assistant', '<div class="typing" aria-label="Scholar AI is typing"><span></span><span></span><span></span></div>');
    $('#chatf button').disabled = true;
    try {
      const r = await api('/ai/chat', { method: 'POST', body: { message: text } });
      t.remove(); bubble('assistant', md(r.reply), r.scholarships);
    } catch (e) {
      t.remove(); bubble('assistant', `<p style="color:var(--bad)">${esc(e.message)}</p>${e.status === 402 ? '<a class="btn btn-ai btn-sm" href="#/pricing">Upgrade to Pro</a>' : ''}`);
    } finally { $('#chatf button').disabled = false; }
  }
  $('#chatf').onsubmit = e => { e.preventDefault(); const v = e.target.m.value; e.target.m.value = ''; send(v); };
  $$('#prompts button').forEach(b => b.onclick = () => send(b.textContent));
  $('#clear').onclick = async () => { await api('/ai/clear', { method: 'POST' }); assistant(view, _p, new URLSearchParams()); };
  if (query.get('ask')) { history.replaceState(null, '', '#/assistant'); send(query.get('ask')); }
}

// ---------- AI application assistant ----------
const TOOLS = [['sop', 'SOP Assistant', 'pen'], ['motivation', 'Motivation Letter', 'file'], ['essay', 'Scholarship Essay', 'book'], ['resume_feedback', 'Resume Feedback', 'user'], ['essay_feedback', 'Essay Feedback', 'checkc']];
export async function writer(view, _p, query) {
  const m = await meta();
  let tool = query.get('tool') || 'sop';
  const target = query.get('target') || '';
  if (state.user.plan !== 'pro') {
    view.innerHTML = `<div class="page-head"><div><h1>AI Application Assistant</h1><p>SOPs, motivation letters, essays and feedback — grounded in your real experience.</p></div></div>
      <div class="card pad-lg stack" style="max-width:640px;text-align:center;justify-items:center;margin:20px auto">${ic('lock')}<h3>A ScholarPath Pro feature</h3><p class="muted">Upgrade to unlock the SOP Assistant, essay review, resume feedback and the AI application checker.</p><a class="btn btn-ai" href="#/pricing">See Pro plans</a></div>`;
    return;
  }
  const p = state.profile || {};
  const fromProfile = () => [p.degree && p.major && `I studied ${p.degree} in ${p.major}${p.institution ? ` at ${p.institution}` : ''}${p.grade ? ` (${p.grade}${p.grade_type === 'percent' ? '%' : ' CGPA'})` : ''}.`,
    p.work_experience && `Work: ${p.work_experience}`, p.leadership && `Leadership: ${p.leadership}`, p.research && `Research: ${p.research}`, p.awards && `Awards: ${p.awards}`,
    p.volunteering && `Volunteering: ${p.volunteering}`, p.extracurricular && `Activities: ${p.extracurricular}`].filter(Boolean).join('\n');
  const render = () => {
    const isDraft = m.writer_tools[tool].draft;
    view.innerHTML = `<div class="page-head"><div><h1>AI Application Assistant</h1><p>Help that improves your application — without inventing anything about you.</p></div><span class="badge ${m.ai_enabled ? 'ai' : ''}">${m.ai_enabled ? 'Gemini-powered' : 'Template mode (AI key not configured)'}</span></div>
      <div class="tabs" role="tablist">${TOOLS.map(([k, l, i]) => `<button role="tab" data-tool="${k}" class="${k === tool ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="grid g2" style="align-items:start">
        <form class="card pad stack" id="wform">
          <div class="alert ai small">${ic('shield')}<div>Scholar AI only uses facts you provide. Where details are missing it inserts <b>[ADD: …]</b> placeholders instead of making things up.</div></div>
          ${field('Scholarship / programme', inp('target', target, 'placeholder="e.g. Chevening Scholarship — MSc Data Science, University of Edinburgh"'))}
          ${isDraft ? `
            <label class="f"><span class="row between">Your real background * <button type="button" class="btn btn-text btn-sm" id="prefill">${ic('user')}Use my profile</button></span>${area('background', '', 'rows="7" required placeholder="Education, work, projects, leadership, achievements — real facts only."')}</label>
            ${field('Your goals', area('goals', '', 'rows="3" placeholder="What do you want to study, and what will you do afterwards?"'))}
            ${tool === 'essay' ? field('Essay prompt', area('prompt', '', 'rows="2" placeholder="Paste the question you need to answer"')) : ''}`
          : field(tool === 'resume_feedback' ? 'Paste your resume text *' : 'Paste your essay / SOP *', area('text', '', 'rows="14" required'))}
          <div class="form-error" role="alert"></div>
          <button class="btn btn-ai" type="submit">${ic('sparkles')}${isDraft ? 'Generate editable draft' : 'Get feedback'}</button>
        </form>
        <div class="card pad stack"><div class="row between"><b>${isDraft ? 'Your draft' : 'Feedback'}</b><div class="row"><span class="xs muted" id="wc"></span><button class="btn btn-ghost btn-sm" id="copy">${ic('copy')}Copy</button></div></div>
          <textarea class="input writer-out" id="out" placeholder="Your ${isDraft ? 'draft' : 'feedback'} will appear here. It's fully editable."></textarea>
          <p class="xs faint">Review every sentence. You are responsible for the accuracy of anything you submit.</p></div>
      </div>`;
    $$('[data-tool]').forEach(b => b.onclick = () => { tool = b.dataset.tool; render(); });
    const out = $('#out'), wc = () => { $('#wc').textContent = `${out.value.trim().split(/\s+/).filter(Boolean).length} words`; };
    out.oninput = wc;
    $('#copy').onclick = () => navigator.clipboard.writeText(out.value).then(() => toast('Copied to clipboard'));
    const pre = $('#prefill');
    if (pre) pre.onclick = () => { $('[name=background]').value = fromProfile() || ''; if (!fromProfile()) toast('Your profile has no experience details yet', true); };
    $('#wform').onsubmit = async e => {
      e.preventDefault();
      const btn = $('button[type=submit]', e.target), err = $('.form-error', e.target);
      btn.disabled = true; err.textContent = ''; out.value = 'Working on it…';
      try {
        const body = { tool, ...Object.fromEntries(new FormData(e.target)) };
        const r = await api('/ai/write', { method: 'POST', body });
        out.value = r.text; wc();
        toast(r.ai ? 'Draft ready — edit freely' : 'Template draft ready — fill the [ADD] placeholders');
      } catch (ex) { err.textContent = ex.message; out.value = ''; } finally { btn.disabled = false; }
    };
  };
  render();
}

// ---------- funding gap calculator ----------
export async function funding(view) {
  const saved = (await api('/saved')).results;
  const KEY = 'sp_funding';
  let v = { tuition: 3200000, living: 1200000, travel: 150000, other: 150000, picks: saved.filter(s => s.funding_type !== 'Fully funded' && s.value_inr <= 2500000).slice(0, 3).map(s => s.id) };
  try { v = { ...v, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
  view.innerHTML = `<div class="page-head"><div><h1>Funding Gap Calculator</h1><p>Estimate your total cost and how much scholarships could cover.</p></div></div>
    <div class="split">
      <form class="card pad stack" id="calc">
        <b>Education costs (total for the course)</b>
        <div class="grid g2">${[['tuition', 'Tuition fees'], ['living', 'Living expenses'], ['travel', 'Travel expenses'], ['other', 'Other costs']].map(([k, l]) => field(l, `<input class="input" name="${k}" type="number" min="0" step="1000" value="${+v[k] || 0}">`)).join('')}</div>
        <hr class="sep"><div class="row between"><b>Scholarships to include</b><span class="xs muted">From your saved list</span></div>
        <div class="stack-sm">${saved.length ? saved.map(s => `<label class="check" style="justify-content:space-between;padding:8px 10px;border:1px solid var(--line);border-radius:10px"><span class="row"><input type="checkbox" name="pick" value="${s.id}" ${v.picks.includes(s.id) ? 'checked' : ''}><span class="small">${esc(s.name)}</span></span><b class="small">${inrShort(s.value_inr)}</b></label>`).join('') : '<p class="small muted">Save scholarships to include them here.</p>'}</div>
      </form>
      <div class="card pad-lg calc-out" id="res"></div>
    </div>
    <div style="margin-top:16px">${disclaimer('Scholarship amounts are indicative. Many awards are competitive, may not stack, or are paid in instalments — treat potential funding as a best case, not a guarantee.')}</div>`;
  const form = $('#calc');
  const calc = () => {
    const fd = new FormData(form);
    const cost = ['tuition', 'living', 'travel', 'other'].reduce((n, k) => n + (+fd.get(k) || 0), 0);
    const picks = fd.getAll('pick').map(Number);
    const fundingAmt = saved.filter(s => picks.includes(s.id)).reduce((n, s) => n + s.value_inr, 0);
    const covered = Math.min(fundingAmt, cost), gap = Math.max(0, cost - fundingAmt);
    try { localStorage.setItem(KEY, JSON.stringify({ ...Object.fromEntries(['tuition', 'living', 'travel', 'other'].map(k => [k, +fd.get(k) || 0])), picks })); } catch {}
    $('#res').innerHTML = `
      <div><span class="xs muted">TOTAL EDUCATION COST</span><div class="big">${inr(cost)}</div></div>
      <div class="stacked" aria-hidden="true"><i style="width:${cost ? (covered / cost) * 100 : 0}%;background:var(--ok)"></i></div>
      <div class="row small"><span class="row" style="gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:var(--ok);display:inline-block"></i>Covered</span><span class="row" style="gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:var(--bad-soft);display:inline-block;border:1px solid #F3C5CB"></i>Gap</span></div>
      <div class="line"><span class="muted">Scholarships selected</span><b>${picks.length} of ${saved.length} saved</b></div>
      <div class="line"><span class="muted">Estimated scholarship funding</span><b style="color:var(--ok)">${inr(fundingAmt)}</b></div>
      <div class="line"><span class="muted">Coverage</span><b>${cost ? Math.round((covered / cost) * 100) : 0}%</b></div>
      <div><span class="xs muted">REMAINING FUNDING GAP</span><div class="big" style="color:${gap ? 'var(--bad)' : 'var(--ok)'}">${inr(gap)}</div></div>
      ${gap ? `<div class="alert ai small">${ic('sparkles')}<div>Close the gap: explore <a href="#/scholarships?" style="text-decoration:underline">more scholarships</a>, education loans, assistantships or part-time work allowed on your visa.</div></div>` : `<div class="alert ai small">${ic('checkc')}<div>Selected scholarships could cover your estimated costs — if awarded.</div></div>`}`;
  };
  form.addEventListener('input', calc);
  calc();
}

// ---------- notifications ----------
const N_ICON = { deadline: ['clock', 'bad'], match: ['sparkles', 'ai'], incomplete: ['alert', 'warn'], opening: ['calendar', 'ok'], documents: ['file', 'warn'] };
export const notifList = list => list.length ? list.map(n => { const [i, c] = N_ICON[n.type] || ['bell', '']; return `
  <a href="${esc(n.link || '#/notifications')}" data-notif="${n.id}" class="row" style="align-items:flex-start;padding:12px 16px;border-bottom:1px solid var(--line-2);${n.read ? '' : 'background:#FBFAFF'}">
    <span class="badge ${c}" style="width:30px;height:30px;padding:0;justify-content:center;border-radius:9px">${ic(i)}</span>
    <div class="grow"><div class="small" style="font-weight:${n.read ? 500 : 650}">${esc(n.title)}</div><div class="xs muted">${esc(n.body || '')}</div><div class="xs faint">${fmtDate(n.created_at)}</div></div>
    ${n.read ? '' : '<span style="width:8px;height:8px;border-radius:50%;background:var(--ai);margin-top:6px"></span>'}</a>`; }).join('')
  : `<div class="empty small">${ic('bell')}<div>You're all caught up.</div></div>`;
document.addEventListener('click', e => { const n = e.target.closest('[data-notif]'); if (n) api('/notifications/read', { method: 'POST', body: { id: +n.dataset.notif } }).then(refreshUnread); });

export async function notifications(view) {
  const { notifications: list } = await api('/notifications');
  view.innerHTML = `<div class="page-head"><div><h1>Notifications</h1><p>Deadlines, new matches, openings and missing documents.</p></div><button class="btn btn-ghost" id="all">Mark all as read</button></div>
    <div class="card" style="overflow:hidden">${notifList(list)}</div>`;
  $('#all').onclick = async () => { await api('/notifications/read', { method: 'POST' }); notifications(view); refreshUnread(); };
}
