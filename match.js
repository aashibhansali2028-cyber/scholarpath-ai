// AI matching engine: transparent, rule-based scoring of a student profile against a
// scholarship's eligibility criteria. Every score comes with human-readable reasons/concerns.
// ponytail: deterministic weighted rules, not a learned model; swap in embeddings/LLM re-ranking
// once there is real outcome data to train against.

import { INCOME_RANGES } from './data.js';

export const incomeLakh = range => INCOME_RANGES.find(([label]) => label === range)?.[1] ?? null;
export const gradePct = p => p?.grade == null || p.grade === '' ? null : (p.grade_type === 'percent' ? +p.grade : +p.grade * 10);
export const age = dob => dob ? Math.floor((Date.now() - new Date(dob)) / 3.15576e10) : null;

export function label(score) {
  return score >= 90 ? 'Excellent Match' : score >= 75 ? 'Strong Match' : score >= 50 ? 'Possible Match' : 'Low Match';
}

const has = v => typeof v === 'string' ? v.trim().length > 2 : !!v;

export function matchScholarship(p, s) {
  const checks = []; // [weight, ok (true/false/0.5), hard, reason, concern]
  const add = (weight, ok, hard, reason, concern, credit) => checks.push({ weight, ok, hard, reason, concern, credit });
  const nat = p.nationality || 'India';
  const natLabel = nat === 'India' ? 'Indian applicant' : `${nat} national`;

  add(15, s.nationalities.includes('Any') || s.nationalities.includes(nat), true, `${natLabel} — nationality eligible`, `Open to ${s.nationalities.join(', ')} nationals only`);
  add(15, s.levels.includes(p.target_level), true, `Eligible ${p.target_level} programme`, `Funds ${s.levels.join(' / ')} study, not ${p.target_level || 'your chosen level'}`);
  if (!s.fields.includes('Any')) add(10, s.fields.includes(p.target_field), true, `${p.target_field} is an eligible field`, `Limited to ${s.fields.join(', ')}`);
  else add(5, true, false, 'Open to all fields of study');

  const prefs = p.target_countries || [];
  if (prefs.length) {
    const overlap = s.countries.filter(c => prefs.includes(c));
    add(10, overlap.length > 0, false, `Target country eligible (${overlap.slice(0, 3).join(', ')})`, `Study destination (${s.countries.slice(0, 4).join(', ')}${s.countries.length > 4 ? '…' : ''}) is not among your preferred countries`);
  }

  const pct = gradePct(p);
  if (s.min_pct) {
    const ok = pct == null ? 0.5 : pct >= s.min_pct ? true : pct >= s.min_pct - 5 ? 0.5 : false;
    // Competitive margin: clearing the bar comfortably scores higher than just meeting it.
    const margin = pct == null || ok !== true ? 1 : 0.6 + 0.4 * Math.min(1, (pct - s.min_pct) / Math.max(10, 100 - s.min_pct));
    add(15, ok, ok === false, margin < 0.75 ? 'Meets the academic requirement (limited margin)' : 'Academic requirement satisfied',
      pct == null ? 'Add your CGPA/percentage to check the academic requirement' : `Typically expects ~${s.min_pct}% (≈${(s.min_pct / 10).toFixed(1)} CGPA); yours is ${pct.toFixed(0)}%`, ok === true ? margin : undefined);
  }

  const inc = incomeLakh(p.income_range);
  if (s.max_income_lakh) {
    const ok = inc == null ? 0.5 : inc <= s.max_income_lakh;
    add(10, ok, ok === false, 'Income requirement satisfied', inc == null ? 'Add your family income range to check the income criterion' : `Family income must be under ₹${s.max_income_lakh} lakh/year`);
  }

  const a = age(p.dob);
  if (s.age_max) add(5, a == null ? 0.5 : a <= s.age_max, a != null && a > s.age_max, `Within age limit (≤${s.age_max})`, `Age limit is ${s.age_max}${a != null ? `; you are ${a}` : ''}`);
  if (s.gender && s.gender !== 'Any') add(10, p.gender === s.gender, true, `Open to ${s.gender.toLowerCase()} applicants`, `Restricted to ${s.gender.toLowerCase()} applicants`);
  if (s.categories?.length) add(10, s.categories.includes(p.category), true, `${p.category} category eligible`, `Reserved for ${s.categories.join('/')} category students`);
  if (s.min_work_years) {
    const w = +p.work_years || 0;
    add(10, w >= s.min_work_years ? true : w >= s.min_work_years - 1 ? 0.5 : false, w < s.min_work_years - 1, `${w}+ years of work experience`, `Requires at least ${s.min_work_years} years of work experience (you have ${w})`);
  }
  if (s.requires_leadership) add(8, has(p.leadership), false, 'Leadership experience demonstrated', 'Selection weighs demonstrated leadership — add leadership roles to your profile');
  if (s.requires_research) add(6, has(p.research), false, 'Research experience on profile', 'A strong research proposal / prior research is expected');
  if (s.is_merit) {
    const extras = ['awards', 'extracurricular', 'volunteering', 'sports'].filter(k => has(p[k])).length;
    add(5, extras >= 2 ? true : extras ? 0.5 : false, false, 'Strong extracurricular / awards profile', 'Merit panels value awards, extracurriculars and impact — strengthen this section');
  }

  let total = 0, earned = 0, hardFails = 0;
  for (const c of checks) {
    total += c.weight;
    earned += c.weight * (c.credit ?? (c.ok === true ? 1 : c.ok === 0.5 ? 0.6 : 0));
    if (c.ok === false && c.hard) hardFails++;
  }
  let score = Math.round((earned / total) * 100);
  if (hardFails) score = Math.min(score, 48 - 8 * (hardFails - 1));
  score = Math.max(5, Math.min(97, score)); // never present a match as certain

  const reasons = checks.filter(c => c.ok === true).map(c => c.reason);
  const concerns = checks.filter(c => c.ok !== true).map(c => c.concern);
  const summary = hardFails ? 'You may not meet one or more core eligibility criteria for this scholarship.'
    : score >= 90 ? 'You are a strong match for this scholarship.'
    : score >= 75 ? 'You meet the core criteria — a few areas could strengthen your application.'
    : score >= 50 ? 'You may be eligible, but there are gaps worth checking.'
    : 'This scholarship looks like a weak fit for your current profile.';
  return { score, label: label(score), summary, reasons, concerns, hardFails };
}
