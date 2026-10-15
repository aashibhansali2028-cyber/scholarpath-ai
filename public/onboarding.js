import { $, $$, api, ic, esc, toast, state, go, field, sel, inp, area, disclaimer } from './ui.js';

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Other / Outside India'];
const EDU = ['Class 12', 'Undergraduate (in progress)', 'Undergraduate (completed)', 'Postgraduate (in progress)', 'Postgraduate (completed)', 'Working professional'];
const NATIONALITIES = ['India', 'Nepal', 'Bangladesh', 'Sri Lanka', 'Bhutan', 'Other'];
const STEPS = ['Personal', 'Academics', 'Study goals', 'Profile'];
const SAMPLE = {
  dob: '2003-08-21', gender: 'Female', nationality: 'India', state: 'Karnataka', category: 'OBC', income_range: '₹5–8 lakh',
  education_level: 'Undergraduate (in progress)', institution: 'RV College of Engineering', degree: 'B.E.', major: 'Electronics & Communication', grade: 8.7, grade_type: 'cgpa', graduation_year: 2026,
  target_level: 'Masters', target_field: 'Engineering', target_countries: ['Germany', 'Netherlands', 'UK'], target_universities: 'TU Munich, TU Delft, Imperial College', intake_year: 2027,
  work_years: 0, work_experience: 'Summer intern at an EV battery startup (2025).', leadership: 'Vice-captain, college Formula Student team.',
  sports: '', extracurricular: 'Robotics club; IEEE student branch volunteer.', awards: 'Department rank 3 (2024).', volunteering: 'Weekend STEM tutoring for government school students.', research: 'Undergraduate project on battery thermal management.',
};

export async function onboarding(view, _p, query) {
  const meta = state.meta ||= await api('/meta');
  const data = { ...(state.profile || {}), email: state.profile?.email || state.user.email, full_name: state.profile?.full_name || state.user.name };
  let step = Math.min(3, +query.get('step') || 0);

  const stepHtml = [
    () => `<div class="grid g2">
      ${field('Full name', inp('full_name', data.full_name, 'required autocomplete="name"'))}${field('Email', inp('email', data.email, 'type="email" required'))}
      ${field('Date of birth', inp('dob', data.dob, 'type="date" max="' + new Date().toISOString().slice(0, 10) + '"'))}${field('Gender', sel('gender', ['Female', 'Male', 'Non-binary', 'Prefer not to say'], data.gender))}
      ${field('Nationality', sel('nationality', NATIONALITIES, data.nationality || 'India', { required: true }))}${field('State', sel('state', STATES, data.state))}
      ${field('Category', sel('category', meta.categories, data.category, { placeholder: 'Prefer not to say' }), '(optional)')}${field('Family annual income', sel('income_range', meta.income_ranges, data.income_range), 'Used for need-based eligibility')}
    </div>`,
    () => `<div class="grid g2">
      ${field('Current education level', sel('education_level', EDU, data.education_level))}${field('Institution', inp('institution', data.institution, 'placeholder="e.g. Delhi University"'))}
      ${field('Degree', inp('degree', data.degree, 'placeholder="e.g. B.Tech, B.Com, BA"'))}${field('Course / major', inp('major', data.major, 'placeholder="e.g. Computer Science"'))}
      <label class="f">CGPA or percentage<div class="row"><input class="input" name="grade" type="number" step="0.01" min="0" max="100" value="${esc(data.grade ?? '')}" style="flex:1"><select class="input" name="grade_type" style="width:150px">${[['cgpa', 'CGPA (/10)'], ['percent', 'Percentage']].map(([v, l]) => `<option value="${v}" ${data.grade_type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></label>
      ${field('Graduation year', inp('graduation_year', data.graduation_year, 'type="number" min="1990" max="2040"'))}
    </div>`,
    () => `<div class="stack">
      <div class="f"><b class="small">Desired study level *</b><div class="chips" style="margin-top:6px">${meta.levels.map(l => `<label class="chip"><input type="radio" name="target_level" value="${l}" ${data.target_level === l ? 'checked' : ''}>${l === 'Undergraduate' ? 'Undergraduate' : l}</label>`).join('')}</div></div>
      <div class="grid g2">${field('Preferred field of study *', sel('target_field', meta.fields, data.target_field, { required: true }))}${field('Intended intake year', sel('intake_year', [2026, 2027, 2028, 2029], data.intake_year))}</div>
      <div class="f"><b class="small">Preferred countries</b><div class="chips" style="margin-top:6px">${meta.countries.slice(0, 16).map(c => `<label class="chip"><input type="checkbox" name="target_countries" value="${c}" ${(data.target_countries || []).includes(c) ? 'checked' : ''}>${c}</label>`).join('')}</div></div>
      ${field('Target universities', inp('target_universities', data.target_universities, 'placeholder="e.g. University of Edinburgh, TU Munich"'))}
    </div>`,
    () => `<p class="small muted" style="margin-bottom:16px">Only include real experiences — this is what the matching engine and AI assistant use. Leave blank anything that doesn't apply.</p>
      <div class="grid g2">
      ${field('Work experience (years)', inp('work_years', data.work_years ?? 0, 'type="number" min="0" max="40" step="0.5"'))}${field('Work experience', area('work_experience', data.work_experience, 'rows="2" placeholder="Role, organisation, what you did"'))}
      ${field('Leadership experience', area('leadership', data.leadership, 'rows="2"'))}${field('Sports achievements', area('sports', data.sports, 'rows="2"'))}
      ${field('Extracurricular activities', area('extracurricular', data.extracurricular, 'rows="2"'))}${field('Awards', area('awards', data.awards, 'rows="2"'))}
      ${field('Volunteering', area('volunteering', data.volunteering, 'rows="2"'))}${field('Research experience', area('research', data.research, 'rows="2"'))}
    </div>`,
  ];

  const render = () => {
    view.innerHTML = `<div style="background:var(--surface);border-bottom:1px solid var(--line)"><div class="nav-in" style="max-width:760px"><a class="logo" href="#/"><img src="/favicon.svg" alt="">ScholarPath<span>AI</span></a>
      <div class="nav-cta">${state.profile?.completed ? '<a class="btn btn-text" href="#/profile">Cancel</a>' : '<a class="btn btn-text" href="#/dashboard">Skip for now</a>'}</div></div></div>
      <div class="onb">
        <span class="eyebrow">Step ${step + 1} of 4</span>
        <div class="row between wrap" style="margin-top:6px"><h1 style="font-size:28px">${['Tell us about yourself', 'Your academics', 'Where do you want to study?', 'Your experience & achievements'][step]}</h1>
          <button class="btn btn-text btn-sm" id="sample">${ic('zap')}Fill sample data</button></div>
        <div class="progress">${STEPS.map((s, i) => `<div class="${i <= step ? 'on' : ''}">${s}</div>`).join('')}</div>
        <form class="card pad-lg" id="onbform" novalidate>${stepHtml[step]()}
          <div class="form-error" role="alert" style="margin-top:12px"></div>
          <div class="row between" style="margin-top:16px">
            <button type="button" class="btn btn-ghost" id="back" ${step ? '' : 'style="visibility:hidden"'}>${ic('back')}Back</button>
            <button class="btn ${step === 3 ? 'btn-ai' : 'btn-primary'}" type="submit">${step === 3 ? `${ic('sparkles')}Generate my scholarship profile` : `Continue ${ic('arrow')}`}</button>
          </div>
        </form>
        <p class="xs faint" style="margin-top:14px">${ic('lock')} Your profile is private and only used to match scholarships and personalise AI help.</p>
      </div>`;
    const form = $('#onbform');
    const collect = () => {
      const fd = new FormData(form), out = {};
      for (const [k, v] of fd) out[k] = v;
      if (step === 2) out.target_countries = fd.getAll('target_countries');
      Object.assign(data, out);
      return out;
    };
    $('#back').onclick = () => { collect(); step--; render(); };
    $('#sample').onclick = () => { Object.assign(data, SAMPLE); render(); toast('Sample data filled — edit anything you like'); };
    form.onsubmit = async e => {
      e.preventDefault();
      const body = collect(), err = $('.form-error', form);
      if (step === 0 && (!data.full_name || !data.nationality)) return err.textContent = 'Name and nationality are required.';
      if (step === 1 && data.grade && data.grade_type === 'cgpa' && +data.grade > 10) return err.textContent = 'CGPA should be on a 10-point scale — or switch to percentage.';
      if (step === 2 && (!data.target_level || !data.target_field)) return err.textContent = 'Choose a study level and field so we can match you.';
      try {
        const r = await api('/profile', { method: 'PUT', body: step === 3 ? { ...body, completed: true } : body });
        state.profile = r.profile;
        if (step < 3) { step++; render(); window.scrollTo(0, 0); }
        else { toast('Profile complete — running AI matching'); go('#/profile?new=1'); }
      } catch (ex) { err.textContent = ex.message; }
    };
  };
  render();
}

export function strength(p) {
  const keys = ['dob', 'gender', 'state', 'income_range', 'institution', 'degree', 'major', 'grade', 'graduation_year', 'target_countries', 'target_universities', 'intake_year', 'work_experience', 'leadership', 'extracurricular', 'awards', 'volunteering', 'research', 'sports'];
  const done = keys.filter(k => Array.isArray(p[k]) ? p[k].length : p[k] != null && String(p[k]).trim() !== '').length;
  return Math.round(40 + (done / keys.length) * 60);
}

export async function profilePage(view, _p, query) {
  const p = state.profile;
  if (!p?.completed) return go('#/onboarding');
  view.innerHTML = '<div class="skeleton" style="height:400px"></div>';
  const { results } = await api('/match');
  const count = l => results.filter(r => r.explanation.label === l).length;
  const pct = p.grade == null ? null : p.grade_type === 'percent' ? `${p.grade}%` : `${p.grade} CGPA`;
  const strengths = [
    p.grade_type === 'cgpa' ? p.grade >= 8 && 'Strong academic record' : p.grade >= 75 && 'Strong academic record',
    p.work_years >= 2 && `${p.work_years} years of work experience`, p.leadership && 'Leadership experience', p.research && 'Research exposure',
    p.awards && 'Awards & recognition', p.volunteering && 'Community impact', p.sports && 'Sports achievements',
  ].filter(Boolean);
  const gaps = [!p.leadership && 'Add leadership roles — many international scholarships weigh them heavily', !p.income_range && 'Add family income to unlock need-based matches',
    !p.research && p.target_level === 'PhD' && 'Add research experience for PhD funding', !p.dob && 'Add date of birth for age-limited scholarships'].filter(Boolean);
  const s = strength(p);
  view.innerHTML = `
    ${query.get('new') ? `<div class="alert ai" style="margin-bottom:20px">${ic('sparkles')}<div><b>Your Student Scholarship Profile is ready.</b> We analysed ${results.length} open scholarships against it.</div></div>` : ''}
    <div class="page-head"><div><h1>Student Scholarship Profile</h1><p>This is what our matching engine uses. Keep it accurate and up to date.</p></div>
      <div class="row"><a class="btn btn-ghost" href="#/onboarding">${ic('edit')}Edit profile</a><a class="btn btn-ai" href="#/match">${ic('sparkles')}See my matches</a></div></div>
    <div class="split">
      <div class="stack">
        <div class="card pad-lg profile-card stack">
          <div class="row between wrap"><div><span class="xs muted">SCHOLARSHIP PROFILE</span><h3 style="font-size:24px;margin-top:4px">${esc(p.full_name)}</h3>
            <p class="muted small">${esc([p.degree, p.major].filter(Boolean).join(' · '))}${p.institution ? ` · ${esc(p.institution)}` : ''}</p></div>
            <div class="ring lg m-${s >= 90 ? 'excellent' : 'strong'}" style="--p:${s};--c:#A79BFF" data-v="${s}%"></div></div>
          <div class="row wrap">${[p.target_level, p.target_field, ...(p.target_countries || []).slice(0, 4), p.intake_year && `Intake ${p.intake_year}`].filter(Boolean).map(x => `<span class="badge" style="background:rgba(255,255,255,.1);color:#fff">${esc(x)}</span>`).join('')}</div>
          <div class="grid g4" style="gap:12px">${[['Nationality', p.nationality], ['Academics', pct || '—'], ['Income', p.income_range || '—'], ['Experience', `${p.work_years || 0} yrs`]].map(([k, v]) => `<div><div class="xs muted">${k}</div><b class="small">${esc(v)}</b></div>`).join('')}</div>
          <p class="xs muted">Profile strength ${s}% · based on completeness of your academic and achievement details</p>
        </div>
        <div class="grid g2">
          <div class="card pad stack-sm"><b>Strengths we detected</b><ul class="ticks small">${strengths.length ? strengths.map(x => `<li class="ok">${ic('checkc')}<span>${esc(x)}</span></li>`).join('') : '<li class="muted">Add achievements to surface strengths.</li>'}</ul></div>
          <div class="card pad stack-sm"><b>Improve your matches</b><ul class="ticks small">${gaps.length ? gaps.map(x => `<li class="warn">${ic('alert')}<span>${esc(x)}</span></li>`).join('') : '<li class="ok">' + ic('checkc') + '<span>Your profile is complete.</span></li>'}</ul></div>
        </div>
      </div>
      <div class="stack">
        <div class="card pad stack"><b>Match overview</b>
          ${[['Excellent Match', 'excellent'], ['Strong Match', 'strong'], ['Possible Match', 'possible'], ['Low Match', 'low']].map(([l, c]) => `<div class="row between"><span class="badge lbl-${c}">${l}</span><b>${count(l)}</b></div>`).join('')}
          <a class="btn btn-primary btn-block" href="#/match">View ranked matches ${ic('arrow')}</a></div>
        <div class="card pad stack-sm"><b>Experience on file</b>${['work_experience', 'leadership', 'extracurricular', 'awards', 'volunteering', 'research', 'sports'].filter(k => p[k]).map(k => `<div class="small"><span class="xs muted">${k.replace('_', ' ').toUpperCase()}</span><div>${esc(p[k])}</div></div>`).join('') || '<p class="small muted">Nothing added yet.</p>'}</div>
      </div>
    </div>
    <div style="margin-top:20px">${disclaimer('Match scores are estimates based on the information you provide. Eligibility information should always be verified through the official scholarship provider.')}</div>`;
}
