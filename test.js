// Smallest check that fails if matching logic breaks. Run: npm test
import assert from 'node:assert/strict';
import { matchScholarship, label } from './match.js';
import { DEMO_PROFILE } from './data.js';

const base = { nationalities: ['India'], levels: ['Masters'], fields: ['Any'], countries: ['UK'], min_pct: 60, min_work_years: 2, requires_leadership: true, is_merit: true };
const strong = matchScholarship(DEMO_PROFILE, base);
assert.ok(strong.score >= 90 && strong.hardFails === 0, `expected excellent match, got ${strong.score}`);
assert.ok(strong.reasons.includes('Indian applicant — nationality eligible'));

const girlsUG = matchScholarship(DEMO_PROFILE, { ...base, levels: ['Undergraduate'], gender: 'Female', countries: ['India'], min_work_years: 0 });
assert.ok(girlsUG.score < 50 && girlsUG.hardFails === 2, `expected low match, got ${girlsUG.score}`);

const income = matchScholarship({ ...DEMO_PROFILE, income_range: 'Above ₹20 lakh' }, { ...base, max_income_lakh: 8 });
assert.ok(income.concerns.some(c => c.includes('₹8 lakh')) && income.score < 50);

assert.equal(label(92), 'Excellent Match'); assert.equal(label(80), 'Strong Match'); assert.equal(label(60), 'Possible Match'); assert.equal(label(30), 'Low Match');
console.log('match.js ok', { strong: strong.score, girlsUG: girlsUG.score, income: income.score });

// Query parser used by Scholar AI retrieval
import('./ai.js').then(({ parseQuery }) => {
  const q = parseQuery("I'm an Indian student with an 8.2 CGPA looking for Data Science programs in Germany.");
  assert.equal(q.cgpa, 8.2); assert.deepEqual(q.countries, ['Germany']); assert.equal(q.field, 'Data Science & AI');
  assert.equal(parseQuery('family income under ₹8 lakh').income, 8);
  assert.equal(parseQuery("Which scholarships don't require GRE?").noGre, true);
  assert.equal(parseQuery('Find fully funded Masters scholarships in the UK.').fully, true);
  console.log('ai.js parseQuery ok');
});
