import { $, $$, api, ic, esc, toast, state, go, requireLogin, initials, sCard, disclaimer, inrShort, fmtDate } from './ui.js';
import * as P from './pages.js';
import { admin } from './admin.js';
import { onboarding, profilePage } from './onboarding.js';

const app = $('#app');

// ---------- layouts ----------
const publicNav = active => `
<header class="nav" id="pubnav"><div class="nav-in">
  <a class="logo" href="#/"><img src="/favicon.svg" alt="">ScholarPath<span>AI</span></a>
  <nav class="nav-links" aria-label="Main">
    ${[['#/scholarships', 'Scholarships'], ['#/match', 'AI Match'], ['#/tracker', 'Application Tracker'], ['#/resources', 'Resources'], ['#/pricing', 'Pricing']]
      .map(([h, l]) => `<a href="${h}" class="${active === h ? 'on' : ''}">${l}</a>`).join('')}
  </nav>
  <div class="nav-cta">
    ${state.user ? `<a class="btn btn-primary" href="#/dashboard">Dashboard ${ic('arrow')}</a>` : `<a class="btn btn-ghost" href="#/login">Login</a><a class="btn btn-primary" href="#/signup">Find My Scholarships</a>`}
    <button class="icon-btn menu-btn" id="pubmenu" aria-label="Menu">${ic('menu')}</button>
  </div>
</div></header>`;

const footer = () => `
<footer class="footer"><div class="wrap stack-lg">
  <div class="footer-grid">
    <div class="stack-sm"><a class="logo" href="#/"><img src="/favicon.svg" alt="">ScholarPath<span>AI</span></a>
      <p class="small muted" style="max-width:320px">AI-powered scholarship discovery and application management for students in India and abroad.</p></div>
    <div><h4>Product</h4><a href="#/scholarships">Scholarship Explorer</a><a href="#/match">AI Match</a><a href="#/tracker">Application Tracker</a><a href="#/assistant">Scholar AI</a></div>
    <div><h4>Tools</h4><a href="#/writer">Application Assistant</a><a href="#/funding">Funding Gap Calculator</a><a href="#/resources">Resources</a><a href="#/pricing">Pricing</a></div>
    <div><h4>Account</h4><a href="#/login">Login</a><a href="#/signup">Create account</a><a href="#/forgot">Forgot password</a></div>
  </div>
  ${disclaimer()}
  <p class="xs faint">© ${new Date().getFullYear()} ScholarPath AI · Prototype build. Scholarship records in this demo are sample data and are labelled as unverified until reviewed by an admin.</p>
</div></footer>`;

function shell(active) {
  const u = state.user;
  const items = [
    ['#/dashboard', 'home', 'Dashboard'], ['#/match', 'sparkles', 'AI Match'], ['#/scholarships', 'compass', 'Explore'],
    ['#/tracker', 'kanban', 'Application Tracker'], ['#/assistant', 'chat', 'Scholar AI'],
  ];
  const tools = [['#/writer', 'pen', 'Application Assistant'], ['#/funding', 'calc', 'Funding Calculator'], ['#/resources', 'book', 'Resources'], ['#/notifications', 'bell', 'Notifications']];
  const link = ([h, i, l]) => `<a class="nav-i ${active === h ? 'on' : ''}" href="${h}">${ic(i)}${l}</a>`;
  return `<div class="shell" id="shell">
    <aside class="side" aria-label="App navigation">
      <a class="logo" href="#/"><img src="/favicon.svg" alt="">ScholarPath<span>AI</span></a>
      ${items.map(link).join('')}
      <div class="lbl">Tools</div>${tools.map(link).join('')}
      ${u.role === 'admin' ? `<div class="lbl">Admin</div>${link(['#/admin', 'shield', 'Admin Console'])}` : ''}
      ${u.plan === 'free' ? `<div class="upsell"><b>Upgrade to Pro</b><span class="muted">Unlimited AI matching, SOP assistant and smart reminders.</span><a class="btn btn-ai btn-sm" href="#/pricing">See plans</a></div>`
        : `<div class="upsell" style="background:var(--ai-soft);color:var(--ai-ink)"><b>${ic('sparkles')} ScholarPath Pro</b><span style="color:var(--ink-2)">All AI features unlocked.</span></div>`}
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn side-toggle" id="sidetoggle" aria-label="Open navigation">${ic('menu')}</button>
        <form class="search" id="topsearch" role="search">${ic('search')}<input class="input" name="q" placeholder="Search scholarships, countries, universities or courses..." aria-label="Search scholarships"></form>
        <div class="row" style="margin-left:auto">
          <div class="rel"><button class="icon-btn" id="bell" aria-label="Notifications">${ic('bell')}<span class="dot" id="unread" hidden></span></button></div>
          <div class="rel"><button class="avatar" id="avatar" aria-label="Account menu">${esc(initials(u.name))}</button></div>
        </div>
      </header>
      <main class="content" id="view"></main>
    </div>
  </div>`;
}

function bindShell() {
  $('#sidetoggle').onclick = () => $('#shell').classList.toggle('open');
  $('#shell').addEventListener('click', e => { if (e.target.id === 'shell' || e.target.closest('.side a')) $('#shell').classList.remove('open'); });
  $('#topsearch').onsubmit = e => { e.preventDefault(); go('#/scholarships?q=' + encodeURIComponent(e.target.q.value.trim())); };
  $('#avatar').onclick = e => {
    e.stopPropagation(); closePops();
    const m = document.createElement('div');
    m.className = 'menu card pop';
    m.innerHTML = `<div style="padding:8px 10px 10px"><b class="small">${esc(state.user.name)}</b><div class="xs muted ellipsis">${esc(state.user.email)}</div><div style="margin-top:6px"><span class="badge ${state.user.plan === 'pro' ? 'ai' : ''}">${state.user.plan === 'pro' ? 'Pro plan' : 'Free plan'}</span></div></div><hr class="sep" style="margin:4px 0">
      <a href="#/profile">${ic('user')}My scholarship profile</a><a href="#/pricing">${ic('zap')}Plans & billing</a><button id="logout">${ic('logout')}Log out</button>`;
    e.currentTarget.parentElement.append(m);
    $('#logout').onclick = logout;
  };
  $('#bell').onclick = async e => {
    e.stopPropagation(); closePops();
    const box = document.createElement('div');
    box.className = 'dropdown card pop';
    box.innerHTML = '<div class="pad small muted">Loading…</div>';
    e.currentTarget.parentElement.append(box);
    const { notifications } = await api('/notifications');
    box.innerHTML = `<div class="row between" style="padding:14px 16px;border-bottom:1px solid var(--line)"><b>Notifications</b><button class="btn btn-text btn-sm" id="readall">Mark all read</button></div>
      ${P.notifList(notifications.slice(0, 8))}<a class="btn btn-text btn-block" href="#/notifications" style="border-radius:0 0 14px 14px">View all</a>`;
    $('#readall').onclick = async ev => { ev.stopPropagation(); await api('/notifications/read', { method: 'POST' }); closePops(); refreshUnread(); };
  };
  refreshUnread();
}
const closePops = () => $$('.pop').forEach(p => p.remove());
document.addEventListener('click', e => { if (!e.target.closest('.pop')) closePops(); });

export async function refreshUnread() {
  const el = $('#unread');
  if (!el) return;
  const { notifications } = await api('/notifications').catch(() => ({ notifications: [] }));
  const n = notifications.filter(x => !x.read).length;
  el.hidden = !n; el.textContent = n > 9 ? '9+' : n;
}

async function logout() {
  await api('/auth/logout', { method: 'POST' });
  state.user = state.profile = null;
  toast('Logged out');
  go('#/');
}

// Delegated save/bookmark buttons on scholarship cards
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-save]');
  if (!b) return;
  e.preventDefault();
  if (!state.user) return requireLogin();
  try {
    const { saved } = await api('/saved/' + b.dataset.save, { method: 'POST' });
    $$(`[data-save="${b.dataset.save}"]`).forEach(x => {
      x.classList.toggle('on', saved);
      const l = x.querySelector('[data-save-label]');
      if (l) l.textContent = saved ? 'Saved' : 'Save Scholarship';
    });
    toast(saved ? 'Scholarship saved' : 'Removed from saved');
  } catch (err) { toast(err.message, true); }
});

// ---------- public pages ----------
async function landing(view) {
  view.innerHTML = `
  <section class="hero"><div class="wrap">
    <div class="hero-grid">
      <div>
        <span class="badge ai">${ic('sparkles')}AI scholarship matching for Indian students</span>
        <h1 style="margin-top:18px">Stop searching for scholarships.<br><em>Let AI find the ones you're eligible for.</em></h1>
        <p class="lead">Discover scholarships for undergraduate and postgraduate education across India and abroad. ScholarPath AI matches your profile with funding opportunities and helps you through the entire application journey.</p>
        <div class="ctas"><a class="btn btn-primary btn-lg" href="#/signup">Find My Scholarships ${ic('arrow')}</a><a class="btn btn-ghost btn-lg" href="#/scholarships">Explore Scholarships</a></div>
        <div class="trust-line"><span>${ic('checkc')}Free to start</span><span>${ic('checkc')}Explainable match scores</span><span>${ic('checkc')}Official source on every listing</span></div>
      </div>
      <div class="hero-visual" id="herovis"><div class="skeleton" style="height:360px"></div></div>
    </div>
    <div class="stats-band">
      <div><b>1,000+</b><span>Scholarships (platform target)</span></div>
      <div><b>₹100Cr+</b><span>Funding opportunities</span></div>
      <div><b>25+</b><span>Study destinations</span></div>
      <div><b>AI-Powered</b><span>Eligibility matching</span></div>
    </div>
    <p class="xs faint" id="livecount" style="margin-top:10px"></p>
  </div></section>

  <section class="section"><div class="wrap">
    <div class="section-head"><span class="eyebrow">How it works</span><h2>From profile to funded, in three steps</h2><p class="muted">One profile. Every relevant scholarship. A clear plan for each application.</p></div>
    <div class="steps">
      ${[['Build Your Profile', 'Tell us about your academics, goals and background.', 'user'], ['Get AI Matched', 'Our AI compares your profile against scholarship eligibility criteria.', 'sparkles'], ['Apply Smarter', 'Track deadlines, prepare documents and improve applications with AI.', 'kanban']]
        .map(([t, d], i) => `<div class="card step"><div class="num">${i + 1}</div><h3>${t}</h3><p class="muted">${d}</p></div>`).join('')}
    </div>
  </div></section>

  <section class="section" style="background:var(--surface);border-block:1px solid var(--line-2)"><div class="wrap">
    <div class="section-head"><span class="eyebrow">Platform</span><h2>Everything you need to fund your education</h2></div>
    <div class="grid g3">
      ${[['compass', 'Scholarship Explorer', 'Government, university, corporate and foundation scholarships in one searchable place, with filters that actually matter.'],
        ['sparkles', 'Explainable AI matching', 'Every match score shows why you qualify and what might hold you back — no black boxes.'],
        ['chat', 'Scholar AI assistant', 'Ask in plain English. Answers come only from our scholarship database, with sources.'],
        ['kanban', 'Application tracker', 'A Kanban board from “Interested” to “Awarded”, with readiness checklists per scholarship.'],
        ['pen', 'AI Application Assistant', 'SOP, motivation letter and essay drafts built only from your real experiences.'],
        ['calc', 'Funding gap calculator', 'See total cost, potential scholarship funding and exactly how much is left to arrange.']]
        .map(([i, t, d]) => `<div class="card feature"><div class="ic">${ic(i)}</div><h3>${t}</h3><p class="muted small">${d}</p></div>`).join('')}
    </div>
  </div></section>

  <section class="section"><div class="wrap">
    <div class="row between wrap" style="margin-bottom:24px"><div class="stack-sm"><span class="eyebrow">Featured</span><h2 style="font-size:30px">Scholarships closing soon</h2></div><a class="btn btn-ghost" href="#/scholarships">Browse all ${ic('arrow')}</a></div>
    <div class="cards" id="featured"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>
  </div></section>

  <section class="section" style="background:var(--surface);border-block:1px solid var(--line-2)" id="pricing"><div class="wrap">${pricingBlock()}</div></section>

  <section class="section"><div class="wrap stack-lg">
    <div class="grid g3">
      ${[['link', 'Official source, always', 'Every listing links to the provider’s official page so you can verify before applying.'],
        ['shield', 'Verification status', 'Each record shows whether and when it was last verified by our team.'],
        ['info', 'No guarantees, ever', 'Match scores estimate fit. They never guarantee eligibility or selection.']]
        .map(([i, t, d]) => `<div class="row" style="align-items:flex-start;gap:14px"><div class="feature" style="padding:0"><div class="ic" style="background:var(--ai-soft);color:var(--ai-ink);margin:0">${ic(i)}</div></div><div><b>${t}</b><p class="muted small">${d}</p></div></div>`).join('')}
    </div>
    ${disclaimer()}
    <div class="cta-band"><div class="stack-sm"><h2>Your scholarships are out there.</h2><p style="color:#C7CDEA">Build your profile in 5 minutes and see your matches instantly.</p></div>
      <div class="row wrap"><a class="btn btn-ai btn-lg" href="#/signup">Find My Scholarships</a><button class="btn btn-lg" style="background:rgba(255,255,255,.1);color:#fff" data-demo>Try the demo</button></div></div>
  </div></section>`;
  bindPricing(view);
  const { featured, scholarships, countries } = await api('/stats');
  $('#livecount').textContent = `Demo database: ${scholarships} sample scholarship records across ${countries} countries. Platform figures above are launch targets.`;
  $('#featured').innerHTML = featured.slice(0, 6).map(s => sCard(s)).join('');
  const demoScores = [94, 88, 79];
  $('#herovis').innerHTML = `<div class="hero-card stack">
      <div class="row between"><div><div class="xs muted">Sample profile · B.Tech CS · 8.4 CGPA</div><b>Your top matches</b></div><span class="badge ai">${ic('sparkles')}AI Match</span></div>
      ${featured.slice(0, 3).map((s, i) => `<div class="row" style="padding:12px;border:1px solid var(--line);border-radius:12px"><div class="ring m-${demoScores[i] >= 90 ? 'excellent' : demoScores[i] >= 75 ? 'strong' : 'possible'}" style="--p:${demoScores[i]}" data-v="${demoScores[i]}%"></div>
        <div class="grow"><b class="small ellipsis" style="display:block">${esc(s.name)}</b><span class="xs muted">${esc(s.countries.slice(0, 2).join(', '))} · ${inrShort(s.value_inr)} · ${fmtDate(s.deadline)}</span></div></div>`).join('')}
      <div class="xs faint">Illustrative example — scores depend on your profile.</div>
    </div>
    <div class="hero-float"><div class="row" style="gap:8px">${ic('checkc')}<b class="small">Why you match</b></div>
      <div class="xs" style="margin-top:6px">✓ Indian applicant<br>✓ Academic requirement satisfied<br>✓ Eligible Masters programme<br>⚠ Leadership evidence needed</div></div>`;
}

export function pricingBlock() {
  return `<div class="section-head"><span class="eyebrow">Pricing</span><h2>Start free. Go Pro when you apply.</h2>
    <div style="margin-top:8px"><div class="toggle" role="group" aria-label="Billing period"><button class="on" data-bill="m">Monthly</button><button data-bill="y">Yearly · save 30%</button></div></div></div>
  <div class="pricing">
    <div class="card plan"><div><h3>Free</h3><p class="muted small">For exploring your options</p></div><div class="price"><b>₹0</b> <span class="muted">/ forever</span></div>
      <ul>${['Scholarship discovery', 'Basic filters', 'Limited AI matches (15 Scholar AI messages/day)', 'Save scholarships', 'Application tracking'].map(f => `<li>${ic('check')}${f}</li>`).join('')}</ul>
      <a class="btn btn-ghost btn-block" href="#/signup">Get started</a></div>
    <div class="card plan pro"><div class="row between"><h3>ScholarPath Pro</h3><span class="badge" style="background:rgba(255,255,255,.12);color:#fff">Most popular</span></div>
      <div class="price"><b data-price>₹299</b> <span class="muted" data-per>/ month</span></div>
      <ul>${['Unlimited AI scholarship matching', 'AI SOP Assistant', 'AI Essay Review', 'AI Application Checker', 'Smart Deadline Reminders', 'Advanced Filters'].map(f => `<li>${ic('check')}${f}</li>`).join('')}</ul>
      <button class="btn btn-ai btn-block" data-upgrade>${state.user?.plan === 'pro' ? 'You’re on Pro' : 'Upgrade to Pro'}</button>
      <p class="xs muted" data-note>Billed monthly. Cancel anytime.</p></div>
  </div>`;
}
function bindPricing(root) {
  $$('[data-bill]', root).forEach(b => b.onclick = () => {
    $$('[data-bill]', root).forEach(x => x.classList.toggle('on', x === b));
    const y = b.dataset.bill === 'y';
    $('[data-price]', root).textContent = y ? '₹2,499' : '₹299';
    $('[data-per]', root).textContent = y ? '/ year' : '/ month';
    $('[data-note]', root).textContent = y ? '≈ ₹208/month, billed yearly.' : 'Billed monthly. Cancel anytime.';
  });
  const up = $('[data-upgrade]', root);
  if (up) up.onclick = async () => {
    if (!state.user) return go('#/signup');
    if (state.user.plan === 'pro') return toast('You are already on Pro');
    await api('/plan', { method: 'POST', body: { plan: 'pro' } });
    state.user.plan = 'pro';
    toast('Pro activated (demo — no payment taken)');
    route();
  };
}

function pricingPage(view) {
  view.innerHTML = `<div class="${state.user ? '' : 'wrap section'}">${pricingBlock()}
    <div class="grid g2" style="max-width:800px;margin:40px auto 0">
      ${[['Is ScholarPath free?', 'Discovery, saving and tracking are free forever. Pro unlocks unlimited AI and writing tools.'],
        ['Do you guarantee scholarships?', 'No. We help you find and prepare for opportunities; selection decisions are made by providers.'],
        ['Is payment live?', 'Not yet — in this prototype, upgrading switches your plan instantly without charging you.'],
        ['Can I cancel?', 'Yes, anytime. You keep access until the end of the billing period.']]
        .map(([q, a]) => `<div class="card pad"><b>${q}</b><p class="muted small" style="margin-top:6px">${a}</p></div>`).join('')}
    </div></div>`;
  bindPricing(view);
}

function resources(view) {
  const guides = [
    ['Statement of Purpose basics', ['Open with a specific moment or problem, not a quote.', 'Show evidence: what you did, how, and the result.', 'Explain why this programme — name modules, labs or faculty.', 'Close with concrete plans, ideally linked to impact in India.']],
    ['Document checklist', ['Transcripts and degree certificate (attested copies)', 'Passport valid 6+ months beyond your course', 'Two to three academic/professional references', 'Income certificate (for need-based scholarships) from a competent authority', 'English test score (IELTS/TOEFL/PTE) where required']],
    ['Avoiding scholarship scams', ['Genuine scholarships never ask for a fee to “release” funds.', 'Check the URL is the provider’s official domain.', 'Be wary of guaranteed-selection promises.', 'Cross-check deadlines on the official page.']],
  ];
  view.innerHTML = `<div class="${state.user ? '' : 'wrap section'}">
    <div class="page-head"><div><h1>Resources</h1><p>Tools and guides to plan, fund and write stronger applications.</p></div></div>
    <div class="grid g3">
      ${[['#/funding', 'calc', 'Funding Gap Calculator', 'Estimate total cost and how much scholarships could cover.'], ['#/writer', 'pen', 'AI Application Assistant', 'SOPs, motivation letters, essays and resume feedback.'], ['#/assistant', 'chat', 'Ask Scholar AI', 'Plain-English questions answered from our database.']]
        .map(([h, i, t, d]) => `<a class="card feature" href="${h}"><div class="ic">${ic(i)}</div><h3>${t}</h3><p class="muted small">${d}</p></a>`).join('')}
    </div>
    <h2 style="font-size:20px;margin:32px 0 14px">Guides</h2>
    <div class="grid g3">${guides.map(([t, tips]) => `<div class="card pad stack-sm"><b>${t}</b><ul class="ticks small">${tips.map(x => `<li class="ok">${ic('check')}<span>${x}</span></li>`).join('')}</ul></div>`).join('')}</div>
    <div style="margin-top:24px">${disclaimer()}</div></div>`;
}

// ---------- auth pages ----------
const authLayout = (inner) => `<div class="auth">
  <div class="auth-side"><a class="logo" href="#/"><img src="/favicon.svg" alt="">ScholarPath<span>AI</span></a>
    <div class="stack"><h2>One profile. Every scholarship you're eligible for.</h2><p style="color:#C7CDEA;max-width:420px">Government, university, corporate and international scholarships — matched to you with clear, explainable reasons.</p>
      <div class="card" style="background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.12);padding:16px;max-width:420px;box-shadow:none">
        <div class="row">${ic('sparkles')}<b>You are a strong match for this scholarship.</b></div>
        <div class="small" style="color:#C7CDEA;margin-top:8px">✓ Indian applicant &nbsp; ✓ Academic requirement satisfied<br>✓ Eligible Masters program &nbsp; ✓ Target country eligible</div></div></div>
    <p class="xs" style="color:#9AA3C7">Match scores are estimates. Always verify eligibility with the official provider.</p></div>
  <div class="auth-main"><div class="auth-box">${inner}</div></div></div>`;

const demoButtons = `<div class="divider">or explore instantly</div>
  <div class="grid g2" style="gap:10px"><button class="btn btn-ghost" data-demo>${ic('user')}Demo student</button><button class="btn btn-ghost" data-demo="admin">${ic('shield')}Demo admin</button></div>`;

async function afterLogin() {
  await loadMe();
  const next = sessionStorage.getItem('sp_next');
  sessionStorage.removeItem('sp_next');
  go(!state.profile?.completed && state.user.role !== 'admin' ? '#/onboarding' : next || '#/dashboard');
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-demo]');
  if (!b) return;
  await api('/auth/demo', { method: 'POST', body: { role: b.dataset.demo || 'student' } });
  toast(b.dataset.demo === 'admin' ? 'Signed in as demo admin' : 'Signed in as demo student');
  afterLogin();
});

function authForm(view, html, submit) {
  view.innerHTML = authLayout(html);
  const form = $('form', view);
  form.onsubmit = async e => {
    e.preventDefault();
    const btn = $('button[type=submit]', form), err = $('.form-error', form);
    btn.disabled = true; err.textContent = '';
    try { await submit(Object.fromEntries(new FormData(form)), form); } catch (ex) { err.textContent = ex.message; } finally { btn.disabled = false; }
  };
}

const login = view => authForm(view, `<div class="stack-sm"><h1>Welcome back</h1><p class="muted">Log in to see your matches and applications.</p></div>
  <form class="stack" novalidate>
    <label class="f">Email<input class="input" name="email" type="email" autocomplete="email" required></label>
    <label class="f"><span class="row between">Password <a href="#/forgot" class="xs" style="color:var(--ai-ink);font-weight:600">Forgot password?</a></span><input class="input" name="password" type="password" autocomplete="current-password" required></label>
    <div class="form-error" role="alert"></div>
    <button class="btn btn-primary btn-lg btn-block" type="submit">Log in</button>
  </form>${demoButtons}<p class="small muted" style="text-align:center">New to ScholarPath? <a href="#/signup" style="color:var(--ai-ink);font-weight:600">Create an account</a></p>`,
  async d => { await api('/auth/login', { method: 'POST', body: d }); toast('Welcome back!'); afterLogin(); });

const signup = view => authForm(view, `<div class="stack-sm"><h1>Create your account</h1><p class="muted">Free forever. Takes under a minute.</p></div>
  <form class="stack" novalidate>
    <label class="f">Full name<input class="input" name="name" autocomplete="name" required></label>
    <label class="f">Email<input class="input" name="email" type="email" autocomplete="email" required></label>
    <label class="f">Password <span class="hint">At least 8 characters</span><input class="input" name="password" type="password" autocomplete="new-password" minlength="8" required></label>
    <div class="form-error" role="alert"></div>
    <button class="btn btn-primary btn-lg btn-block" type="submit">Create account</button>
    <p class="xs faint">By continuing you agree to our Terms and Privacy Policy.</p>
  </form>${demoButtons}<p class="small muted" style="text-align:center">Already have an account? <a href="#/login" style="color:var(--ai-ink);font-weight:600">Log in</a></p>`,
  async d => { await api('/auth/signup', { method: 'POST', body: d }); toast('Account created'); await loadMe(); go('#/onboarding'); });

const forgot = view => authForm(view, `<div class="stack-sm"><h1>Reset your password</h1><p class="muted">We'll email you a link to set a new password.</p></div>
  <form class="stack" novalidate>
    <label class="f">Email<input class="input" name="email" type="email" required></label>
    <div class="form-error" role="alert"></div><div id="fp-out"></div>
    <button class="btn btn-primary btn-lg btn-block" type="submit">Send reset link</button>
  </form><a class="small muted" href="#/login">${ic('back')} Back to login</a>`,
  async (d, form) => {
    const r = await api('/auth/forgot', { method: 'POST', body: d });
    $('#fp-out', form).innerHTML = `<div class="alert ai">${ic('checkc')}<div>${esc(r.message)}${r.dev_reset_link ? `<br><span class="xs">Development mode — no email service configured: <a href="${esc(r.dev_reset_link)}" style="font-weight:600;text-decoration:underline">open reset link</a></span>` : ''}</div></div>`;
  });

const reset = (view, { token }) => authForm(view, `<div class="stack-sm"><h1>Choose a new password</h1></div>
  <form class="stack" novalidate>
    <label class="f">New password<input class="input" name="password" type="password" minlength="8" autocomplete="new-password" required></label>
    <div class="form-error" role="alert"></div>
    <button class="btn btn-primary btn-lg btn-block" type="submit">Update password</button></form>`,
  async d => { await api('/auth/reset', { method: 'POST', body: { ...d, token } }); toast('Password updated — please log in'); go('#/login'); });

// ---------- router ----------
const ROUTES = [
  ['/', landing, { layout: 'public' }], ['/login', login, { layout: 'auth' }], ['/signup', signup, { layout: 'auth' }],
  ['/forgot', forgot, { layout: 'auth' }], ['/reset/:token', reset, { layout: 'auth' }],
  ['/onboarding', onboarding, { auth: true, layout: 'bare' }], ['/profile', profilePage, { auth: true }],
  ['/dashboard', P.dashboard, { auth: true }], ['/scholarships', P.explorer, { layout: 'auto' }], ['/scholarship/:id', P.detail, { layout: 'auto' }],
  ['/match', P.matchPage, { auth: true }], ['/tracker', P.tracker, { auth: true }], ['/assistant', P.assistant, { auth: true }],
  ['/writer', P.writer, { auth: true }], ['/funding', P.funding, { auth: true }], ['/notifications', P.notifications, { auth: true }],
  ['/pricing', pricingPage, { layout: 'auto' }], ['/resources', resources, { layout: 'auto' }], ['/admin', admin, { auth: true, admin: true }],
].map(([path, fn, opts]) => ({ re: new RegExp(`^${path.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), fn, layout: 'app', ...opts, path }));

async function loadMe() {
  const r = await api('/me');
  state.user = r.user; state.profile = r.profile;
}

async function route() {
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const r = ROUTES.find(r => r.re.test(path)) || ROUTES[0];
  if (r.auth && !state.user) return requireLogin();
  if (r.admin && state.user.role !== 'admin') return go('#/dashboard');
  if (['/login', '/signup'].includes(r.path) && state.user) return go('#/dashboard');
  const layout = r.layout === 'auto' ? (state.user ? 'app' : 'public') : r.layout;
  const active = '#' + path.replace(/\/\d+$/, '');
  closePops();
  $$('.modal-bg').forEach(m => m.remove());
  if (layout === 'app') { app.innerHTML = shell(active === '#/scholarship' ? '#/scholarships' : active); bindShell(); }
  else if (layout === 'public') {
    app.innerHTML = publicNav(active) + '<main id="view"></main>' + footer();
    $('#pubmenu').onclick = () => $('#pubnav').classList.toggle('open');
  } else app.innerHTML = '<main id="view"></main>';
  const view = $('#view');
  window.scrollTo(0, 0);
  document.title = `${(r.path === '/' ? '' : r.path.split('/')[1].replace(/^\w/, c => c.toUpperCase()) + ' · ')}ScholarPath AI`;
  try { await r.fn(view, r.re.exec(path).groups || {}, new URLSearchParams(qs || '')); }
  catch (e) {
    if (e.status === 401) return requireLogin();
    view.innerHTML = `<div class="empty card">${ic('alert')}<h3>Something went wrong</h3><p class="small">${esc(e.message)}</p></div>`;
  }
}

window.addEventListener('hashchange', route);
loadMe().catch(() => {}).finally(route);
