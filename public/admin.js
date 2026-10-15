import { $, $$, api, ic, esc, toast, state, modal, inrShort, fmtDate, field, sel, inp, area } from './ui.js';

const PTYPES = ['Indian Government', 'International Government', 'University', 'Corporate', 'Private Foundation', 'International Organisation'];
const list = v => String(v || '').split(/[,\n]/).map(x => x.trim()).filter(Boolean);

// Shared add/edit form for scholarships (also used to review AI-extracted data).
function schForm(s = {}) {
  const m = state.meta;
  const chk = (name, on, label) => `<label class="check"><input type="checkbox" name="${name}" ${on ? 'checked' : ''}>${label}</label>`;
  return `<form class="pad stack" id="schform">
    <div class="grid g2">${field('Scholarship name *', inp('name', s.name, 'required'))}${field('Provider *', inp('provider', s.provider, 'required'))}
      ${field('Provider type', sel('provider_type', PTYPES, s.provider_type || 'Private Foundation'))}${field('Official application URL', inp('official_url', s.official_url, 'type="url" placeholder="https://"'))}</div>
    ${field('Description', area('description', s.description, 'rows="3"'))}
    <div class="grid g2">${field('Countries (study destinations)', inp('countries', (s.countries || []).join(', '), 'placeholder="UK, Germany"'))}${field('Eligible nationalities', inp('nationalities', (s.nationalities || []).join(', '), 'placeholder="India (or Any)"'))}</div>
    <div class="f"><b class="small">Study levels</b><div class="chips" style="margin-top:6px">${m.levels.map(l => `<label class="chip"><input type="checkbox" name="levels" value="${l}" ${(s.levels || []).includes(l) ? 'checked' : ''}>${l}</label>`).join('')}</div></div>
    ${field('Fields of study', inp('fields', (s.fields || ['Any']).join(', ')), `comma-separated; use "Any" for all. Known: ${m.fields.join(', ')}`)}
    <div class="grid g3">${field('Value (INR, approx.)', inp('value_inr', s.value_inr || 0, 'type="number" min="0"'))}${field('Value description', inp('value_text', s.value_text))}${field('Number of awards', inp('awards', s.awards))}</div>
    ${field('Funding coverage', area('coverage', s.coverage, 'rows="2"'))}
    <div class="row wrap" style="gap:18px">${chk('is_fully_funded', s.is_fully_funded, 'Fully funded')}${chk('is_merit', s.is_merit, 'Merit based')}${chk('is_need', s.is_need, 'Need based')}${chk('renewable', s.renewable, 'Renewable')}${chk('featured', s.featured, 'Featured')}</div>
    <div class="grid g3">${field('Opening date', inp('open_date', s.open_date, 'type="date"'))}${field('Deadline', inp('deadline', s.deadline, 'type="date"'))}${field('Status', sel('status', [['active', 'Active (published)'], ['draft', 'Draft (hidden)'], ['expired', 'Expired']], s.status || 'active', { placeholder: 'Status' }))}</div>
    <b class="small" style="margin-top:6px">Eligibility criteria</b>
    <div class="grid g3">${field('Min. academic %', inp('min_pct', s.min_pct, 'type="number" min="0" max="100"'))}${field('Max family income (₹ lakh)', inp('max_income_lakh', s.max_income_lakh, 'type="number" min="0" step="0.5"'))}${field('Max age', inp('age_max', s.age_max, 'type="number" min="10" max="80"'))}
      ${field('Gender', sel('gender', ['Any', 'Female', 'Male'], s.gender || 'Any', { placeholder: 'Any' }))}${field('Categories', inp('categories', (s.categories || []).join(', '), 'placeholder="SC, ST (blank = all)"'))}${field('Min. work experience (yrs)', inp('min_work_years', s.min_work_years || 0, 'type="number" min="0" step="0.5"'))}</div>
    <div class="row wrap" style="gap:18px">${chk('requires_leadership', s.requires_leadership, 'Requires leadership')}${chk('requires_research', s.requires_research, 'Requires research')}</div>
    ${field('Required documents', area('documents', (s.documents || []).join('\n'), 'rows="4"'), 'one per line')}
    ${field('Eligibility notes', area('notes', s.notes || s.eligibility || '', 'rows="2"'))}
    <div class="form-error" role="alert"></div>
    <slot></slot>
  </form>`;
}
function readForm(form) {
  const fd = new FormData(form), g = k => fd.get(k);
  const b = k => !!fd.get(k);
  return {
    name: g('name'), provider: g('provider'), provider_type: g('provider_type'), official_url: g('official_url'), description: g('description'),
    countries: list(g('countries')), nationalities: list(g('nationalities')), levels: fd.getAll('levels'), fields: list(g('fields')),
    value_inr: +g('value_inr') || 0, value_text: g('value_text'), awards: g('awards'), coverage: g('coverage'),
    is_fully_funded: b('is_fully_funded'), is_merit: b('is_merit'), is_need: b('is_need'), renewable: b('renewable'), featured: b('featured'),
    open_date: g('open_date'), deadline: g('deadline'), status: g('status') || 'active', min_pct: g('min_pct'), max_income_lakh: g('max_income_lakh'), age_max: g('age_max'),
    gender: g('gender') || 'Any', categories: list(g('categories')), min_work_years: g('min_work_years'), requires_leadership: b('requires_leadership'), requires_research: b('requires_research'),
    documents: list(g('documents').replace(/,/g, ' ')), notes: g('notes'),
  };
}

export async function admin(view) {
  state.meta ||= await api('/meta');
  let tab = 'scholarships', data, q = '';
  const load = async () => { data = await api('/admin/overview'); render(); };

  function editModal(s, onSaved) {
    const m = modal(s?.id ? 'Edit scholarship' : 'Add scholarship', schForm(s || {}), { wide: true });
    $('slot', m).outerHTML = `<div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" type="submit">${s?.id ? 'Save changes' : 'Create scholarship'}</button></div>`;
    $('#schform', m).onsubmit = async e => {
      e.preventDefault();
      try {
        const body = readForm(e.target);
        if (s?.id) await api('/admin/scholarships/' + s.id, { method: 'PUT', body }); else await api('/admin/scholarships', { method: 'POST', body: { ...body, is_sample: false } });
        m.close(); toast(s?.id ? 'Scholarship updated' : 'Scholarship created'); onSaved?.();
      } catch (ex) { $('.form-error', m).textContent = ex.message; }
    };
  }

  const tabs = [['scholarships', 'Scholarships'], ['extract', 'AI Data Extraction'], ['users', 'Users'], ['applications', 'Applications'], ['analytics', 'Analytics']];
  function render() {
    const S = data.scholarships;
    const counts = { total: S.length, verified: S.filter(s => s.verified).length, expired: S.filter(s => s.status === 'expired').length, featured: S.filter(s => s.featured).length };
    view.innerHTML = `<div class="page-head"><div><h1 class="row">${ic('shield')} Admin Console</h1><p>Manage scholarship data, verification and platform activity.</p></div>
        <button class="btn btn-primary" id="add">${ic('plus')}Add scholarship</button></div>
      <div class="grid g4" style="margin-bottom:18px">${[['Scholarships', counts.total, 'book'], ['Verified', `${counts.verified} / ${counts.total}`, 'checkc'], ['Students', data.users.filter(u => u.role === 'student').length, 'users'], ['Applications', data.applications.length, 'kanban']]
        .map(([k, v, i]) => `<div class="card stat"><div class="k">${ic(i)}${k}</div><div class="v">${v}</div></div>`).join('')}</div>
      <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="tab"></div>`;
    $$('[data-tab]', view).forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
    $('#add').onclick = () => editModal(null, load);
    const el = $('#tab');
    if (tab === 'scholarships') {
      const rows = S.filter(s => !q || (s.name + s.provider).toLowerCase().includes(q.toLowerCase()));
      el.innerHTML = `<div class="row between wrap" style="margin-bottom:12px"><input class="input" id="aq" placeholder="Filter by name or provider" value="${esc(q)}" style="max-width:320px"><span class="xs muted">${counts.featured} featured · ${counts.expired} expired</span></div>
        <div class="card table-wrap"><table class="t"><thead><tr><th>ID</th><th>Scholarship</th><th>Value</th><th>Deadline</th><th>Status</th><th>Verification</th><th style="text-align:right">Actions</th></tr></thead><tbody>
        ${rows.map(s => `<tr><td class="xs muted">${s.code}</td>
          <td style="min-width:240px"><a href="#/scholarship/${s.id}"><b class="small">${esc(s.name)}</b></a><div class="xs muted">${esc(s.provider_type)} · ${esc(s.countries.slice(0, 3).join(', '))}</div></td>
          <td class="small">${inrShort(s.value_inr)}</td>
          <td><input type="date" class="input" style="height:32px;width:145px;font-size:12px" value="${esc(s.deadline || '')}" data-deadline="${s.id}" aria-label="Deadline"></td>
          <td><span class="badge ${s.status === 'active' ? (s.closed ? 'warn' : 'ok') : s.status === 'draft' ? '' : 'bad'}">${s.status === 'active' && s.closed ? 'past deadline' : s.status}</span>${s.featured ? ` <span class="badge navy">${ic('star')}</span>` : ''}</td>
          <td>${s.verified ? `<span class="badge ok">${ic('checkc')}${fmtDate(s.last_verified)}</span>` : '<span class="badge warn">Sample · unverified</span>'}</td>
          <td style="text-align:right;white-space:nowrap">
            <button class="btn btn-text btn-sm" data-act="${s.verified ? 'unverify' : 'verify'}" data-id="${s.id}">${s.verified ? 'Unverify' : 'Verify'}</button>
            <button class="btn btn-text btn-sm" data-act="feature" data-id="${s.id}">${s.featured ? 'Unfeature' : 'Feature'}</button>
            <button class="btn btn-text btn-sm" data-act="${s.status === 'expired' ? 'activate' : 'expire'}" data-id="${s.id}">${s.status === 'expired' ? 'Reactivate' : 'Expire'}</button>
            <button class="btn btn-ghost btn-sm" data-edit="${s.id}" aria-label="Edit">${ic('edit')}</button>
            <button class="btn btn-danger btn-sm" data-del="${s.id}" aria-label="Delete">${ic('trash')}</button></td></tr>`).join('')}
        </tbody></table></div>`;
      $('#aq').oninput = e => { q = e.target.value; const pos = e.target.selectionStart; render(); const n = $('#aq'); n.focus(); n.setSelectionRange(pos, pos); };
      $$('[data-act]', el).forEach(b => b.onclick = async () => { await api(`/admin/scholarships/${b.dataset.id}/${b.dataset.act}`, { method: 'POST' }); toast('Updated'); load(); });
      $$('[data-deadline]', el).forEach(i => i.onchange = async () => { await api(`/admin/scholarships/${i.dataset.deadline}/deadline`, { method: 'POST', body: { deadline: i.value } }); toast('Deadline updated'); load(); });
      $$('[data-edit]', el).forEach(b => b.onclick = () => editModal(S.find(s => s.id === +b.dataset.edit), load));
      $$('[data-del]', el).forEach(b => b.onclick = async () => {
        const s = S.find(x => x.id === +b.dataset.del);
        if (!confirm(`Delete “${s.name}”? This also removes it from students' saved lists and trackers.`)) return;
        await api('/admin/scholarships/' + s.id, { method: 'DELETE' }); toast('Scholarship deleted'); load();
      });
    }
    if (tab === 'extract') {
      el.innerHTML = `<div class="split">
        <form class="card pad stack" id="exf"><div><b>${ic('sparkles')} AI Scholarship Data Extraction</b><p class="small muted">Enter a scholarship webpage URL or paste its text. AI drafts a structured record — <b>you must review it before publishing</b>.</p></div>
          ${field('Scholarship webpage URL', inp('url', '', 'type="url" placeholder="https://provider.org/scholarship"'))}
          <div class="divider">or</div>
          ${field('Paste scholarship text', area('text', '', 'rows="10" placeholder="Paste the scholarship description, eligibility, deadline, documents…"'))}
          <div class="form-error" role="alert"></div>
          <button class="btn btn-ai" type="submit">${ic('sparkles')}Extract details</button>
          <p class="xs faint">${data.ai_enabled ? 'Using Claude for extraction.' : 'AI key not configured — using rule-based extraction. Expect more fields to fill manually.'}</p></form>
        <div class="card" id="exout"><div class="empty">${ic('file')}<div class="small">Extracted fields will appear here for review.</div></div></div></div>`;
      $('#exf').onsubmit = async e => {
        e.preventDefault();
        const btn = $('button[type=submit]', e.target), err = $('.form-error', e.target);
        btn.disabled = true; err.textContent = ''; $('#exout').innerHTML = '<div class="pad"><div class="skeleton" style="height:300px"></div></div>';
        try {
          const { data: d, ai, chars } = await api('/admin/extract', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
          const out = $('#exout');
          out.innerHTML = `<div class="pad" style="padding-bottom:0"><div class="alert">${ic('alert')}<div><b>Review required.</b> ${ai ? 'AI-extracted' : 'Rule-extracted'} from ${chars.toLocaleString()} characters. Check every field against the source before publishing. Empty fields were not found in the source.</div></div></div>${schForm({ ...d, status: 'draft' })}`;
          $('slot', out).outerHTML = `<label class="check"><input type="checkbox" name="reviewed" required>I have reviewed this information against the official source.</label>
            <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" type="submit">Save scholarship</button></div>`;
          $('#schform', out).onsubmit = async ev => {
            ev.preventDefault();
            if (!ev.target.reviewed.checked) return ($('.form-error', out).textContent = 'Please confirm you have reviewed the extracted data.');
            try { await api('/admin/scholarships', { method: 'POST', body: { ...readForm(ev.target), is_sample: false } }); toast('Scholarship saved'); tab = 'scholarships'; load(); }
            catch (ex) { $('.form-error', out).textContent = ex.message; }
          };
        } catch (ex) { err.textContent = ex.message; $('#exout').innerHTML = ''; } finally { btn.disabled = false; }
      };
    }
    if (tab === 'users') el.innerHTML = `<div class="card table-wrap"><table class="t"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Plan</th><th>Goal</th><th>Profile</th><th>Saved</th><th>Applications</th><th>Joined</th></tr></thead><tbody>
      ${data.users.map(u => `<tr><td><b class="small">${esc(u.name)}</b></td><td class="small muted">${esc(u.email)}</td><td><span class="badge ${u.role === 'admin' ? 'navy' : ''}">${u.role}</span></td><td><span class="badge ${u.plan === 'pro' ? 'ai' : ''}">${u.plan}</span></td>
        <td class="small">${esc([u.target_level, u.target_field].filter(Boolean).join(' · ') || '—')}</td><td>${u.completed ? '<span class="badge ok">Complete</span>' : '<span class="badge">Incomplete</span>'}</td><td>${u.saved}</td><td>${u.apps}</td><td class="xs muted">${fmtDate(u.created_at)}</td></tr>`).join('')}</tbody></table></div>`;
    if (tab === 'applications') el.innerHTML = `<div class="card table-wrap"><table class="t"><thead><tr><th>Student</th><th>Scholarship</th><th>Stage</th><th>Deadline</th><th>Updated</th></tr></thead><tbody>
      ${data.applications.map(a => `<tr><td class="small"><b>${esc(a.user_name)}</b></td><td class="small">${esc(a.scholarship_name)}</td><td><span class="badge">${esc(a.stage)}</span></td><td class="small">${fmtDate(a.deadline)}</td><td class="xs muted">${fmtDate(a.updated_at)}</td></tr>`).join('')}</tbody></table></div>`;
    if (tab === 'analytics') {
      const e = data.events, rows = [['Scholarships viewed', e.view || 0], ['Scholarships saved', e.save || 0], ['Applications started', e.app_start || 0], ['Applications submitted', e.app_submit || 0], ['AI assistant usage', e.ai_chat || 0]];
      const max = Math.max(1, ...rows.map(r => r[1]));
      const byStage = data.applications.reduce((o, a) => (o[a.stage] = (o[a.stage] || 0) + 1, o), {});
      el.innerHTML = `<div class="grid g2"><div class="card pad stack"><b>Platform engagement</b><div class="mini-bars">${rows.map(([k, v]) => `<div class="r"><span class="muted">${k}</span><div class="bar"><i style="width:${(v / max) * 100}%"></i></div><b>${v}</b></div>`).join('')}</div></div>
        <div class="card pad stack"><b>Applications by stage</b><div class="mini-bars">${Object.entries(byStage).map(([k, v]) => `<div class="r"><span class="muted">${esc(k)}</span><div class="bar"><i style="width:${(v / data.applications.length) * 100}%"></i></div><b>${v}</b></div>`).join('')}</div></div></div>`;
    }
  }
  view.innerHTML = '<div class="skeleton" style="height:400px"></div>';
  await load();
}
