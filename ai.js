// AI features. Retrieval and matching always run locally against the scholarship DB, so answers
// are grounded in real records. If GEMINI_API_KEY is set, Gemini writes the prose on top of
// the retrieved records; otherwise a deterministic template is used. The model never sees records
// beyond the retrieved set and is told not to invent scholarships.

import { allScholarships } from './db.js';
import { matchScholarship } from './match.js';
import { COUNTRIES, FIELDS } from './data.js';

export const AI_ENABLED = !!process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

// If the main model is overloaded or rate-limited, retry once on the lighter model.
const MODELS = [MODEL, 'gemini-flash-lite-latest'];

async function llm({ system, prompt, maxTokens = 4000, schema }) {
  if (!AI_ENABLED) return null;
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(60000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: maxTokens + 4000, // thinking tokens count against this budget
            thinkingConfig: { thinkingLevel: 'low' },
            ...(schema && { responseMimeType: 'application/json', responseJsonSchema: schema }),
          },
        }),
      });
      const data = await res.json();
      if ([429, 500, 503].includes(res.status)) { console.warn(`[ai] ${model} unavailable (${res.status}), trying next model`); continue; }
      if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
      const c = data.candidates?.[0];
      if (!c || !['STOP', 'MAX_TOKENS'].includes(c.finishReason)) return null; // blocked/safety → local fallback
      return c.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('').trim() || null;
    } catch (e) {
      console.error(`[ai] Gemini request failed (${model}):`, e.message);
      return null;
    }
  }
  return null;
}

const DISCLAIMER = 'Eligibility information should always be verified through the official scholarship provider.';


// ---------- query understanding (local, deterministic) ----------
const COUNTRY_ALIASES = { 'united kingdom': 'UK', britain: 'UK', england: 'UK', 'united states': 'USA', america: 'USA', usa: 'USA', holland: 'Netherlands', europe: 'EUROPE' };
const LEVEL_WORDS = { masters: 'Masters', "master's": 'Masters', master: 'Masters', ms: 'Masters', msc: 'Masters', mba: 'MBA', phd: 'PhD', doctoral: 'PhD', undergraduate: 'Undergraduate', bachelor: 'Undergraduate', 'b.tech': 'Undergraduate', btech: 'Undergraduate', ug: 'Undergraduate' };
const FIELD_WORDS = { 'data science': 'Data Science & AI', 'machine learning': 'Data Science & AI', ' ai ': 'Data Science & AI', 'computer science': 'Computer Science', software: 'Computer Science', engineering: 'Engineering', business: 'Business & Management', management: 'Business & Management', economics: 'Economics', law: 'Law', medicine: 'Medicine & Health', 'public health': 'Medicine & Health', science: 'Natural Sciences', physics: 'Natural Sciences', biology: 'Natural Sciences', policy: 'Public Policy', environment: 'Environment', climate: 'Environment', design: 'Arts & Design', arts: 'Arts & Design', humanities: 'Humanities', history: 'Humanities' };
const EU = ['Germany', 'France', 'Netherlands', 'Sweden', 'Italy', 'Spain', 'Belgium', 'Finland', 'Denmark', 'Austria', 'Portugal', 'Ireland', 'Hungary'];

export function parseQuery(text) {
  const q = ` ${text.toLowerCase().replace(/[?,!]|\.(?=\s|$)/g, ' ')} `;
  const f = { countries: [] };
  for (const c of COUNTRIES) if (q.includes(` ${c.toLowerCase()} `)) f.countries.push(c);
  for (const [k, v] of Object.entries(COUNTRY_ALIASES)) if (q.includes(` ${k} `)) v === 'EUROPE' ? f.countries.push(...EU) : f.countries.push(v);
  for (const [k, v] of Object.entries(LEVEL_WORDS)) if (q.includes(` ${k} `)) { f.level = v; break; }
  for (const [k, v] of Object.entries(FIELD_WORDS)) if (q.includes(k.startsWith(' ') ? k : ` ${k}`)) { f.field = v; break; }
  if (/fully[ -]funded|full funding|full scholarship/.test(q)) f.fully = true;
  if (/need[ -]based|low income|financial need/.test(q)) f.need = true;
  if (/merit/.test(q)) f.merit = true;
  if (/\b(girls?|women|female)\b/.test(q)) f.gender = 'Female';
  if (/\b(in india|domestic|indian universit)/.test(q) && !f.countries.length) f.countries.push('India');
  if (/\bgre\b/.test(q)) f.noGre = /(don.?t|do not|without|no|not)\s+(\w+\s+)?(require|need)|without gre|no gre/.test(q);
  const inc = q.match(/income\s*(?:under|below|less than|<|of)?\s*(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d+)?)\s*(lakh|lac|l)/) || q.match(/(?:under|below)\s*(?:rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(lakh|lac)/);
  if (inc) f.income = +inc[1];
  const cg = q.match(/(\d{1,2}(?:\.\d+)?)\s*(cgpa|gpa)/) || q.match(/(cgpa|gpa)\s*(?:of)?\s*(\d{1,2}(?:\.\d+)?)/);
  if (cg) f.cgpa = +(cg[1].match(/\d/) ? cg[1] : cg[2]);
  const pc = q.match(/(\d{2}(?:\.\d+)?)\s*(%|percent)/);
  if (pc) f.percent = +pc[1];
  for (const cat of ['sc', 'st', 'obc', 'ews']) if (q.includes(` ${cat} `)) f.category = cat.toUpperCase();
  if (/\bindian\b/.test(q)) f.nationality = 'India';
  return f;
}

function contextProfile(profile, f) {
  const p = { nationality: 'India', ...(profile || {}) };
  if (f.level) p.target_level = f.level;
  if (f.field) p.target_field = f.field;
  if (f.countries.length) p.target_countries = [...new Set(f.countries)];
  if (f.cgpa) Object.assign(p, { grade: f.cgpa, grade_type: 'cgpa' });
  if (f.percent) Object.assign(p, { grade: f.percent, grade_type: 'percent' });
  if (f.gender) p.gender = f.gender;
  if (f.category) p.category = f.category;
  if (f.income) p.income_range = f.income <= 2.5 ? 'Below ₹2.5 lakh' : f.income <= 5 ? '₹2.5–5 lakh' : f.income <= 8 ? '₹5–8 lakh' : f.income <= 12 ? '₹8–12 lakh' : '₹12–20 lakh';
  return p;
}

export function search(text, profile) {
  const f = parseQuery(text);
  const p = contextProfile(profile, f);
  const hasFilters = f.level || f.field || f.countries.length || f.fully || f.need || f.merit || f.gender || f.income || f.noGre != null || f.category;
  let rows = allScholarships().filter(s => !s.closed);
  if (f.countries.length) rows = rows.filter(s => s.countries.some(c => f.countries.includes(c)));
  if (f.level) rows = rows.filter(s => s.levels.includes(f.level));
  if (f.field) rows = rows.filter(s => s.fields.includes('Any') || s.fields.includes(f.field));
  if (f.fully) rows = rows.filter(s => s.is_fully_funded);
  if (f.need) rows = rows.filter(s => s.is_need);
  if (f.merit) rows = rows.filter(s => s.is_merit);
  if (f.gender) rows = rows.filter(s => !s.gender || s.gender === 'Any' || s.gender === f.gender);
  if (f.income) rows = rows.filter(s => !s.max_income_lakh || s.max_income_lakh >= f.income);
  if (f.noGre) rows = rows.filter(s => !s.documents.some(d => /gre|gmat|test scores/i.test(d)));
  const scored = rows.map(s => ({ s, m: matchScholarship(p, s) }))
    .filter(x => hasFilters || x.m.hardFails === 0)
    .sort((a, b) => b.m.score - a.m.score || b.s.value_inr - a.s.value_inr)
    .slice(0, 6);
  return { filters: f, profile: p, results: scored, hasFilters };
}

// ---------- Scholar AI chat ----------
export async function chat(message, profile, history = []) {
  const { filters, results, hasFilters } = search(message, profile);
  const records = results.map(({ s, m }) => ({
    id: s.id, name: s.name, provider: s.provider, countries: s.countries, levels: s.levels, fields: s.fields, value: s.value_text,
    funding: s.funding_type, deadline: s.deadline, documents: s.documents, match_score: m.score, reasons: m.reasons, concerns: m.concerns,
    official_url: s.official_url, verified: s.verified,
  }));
  const system = `You are Scholar AI, the assistant inside ScholarPath AI, a scholarship discovery platform for Indian students.
Rules:
- Only discuss scholarships that appear in the RECORDS JSON. Never invent scholarships, amounts, deadlines or criteria.
- If RECORDS is empty or does not answer the question, say so and suggest how to broaden the search or what to verify.
- For each scholarship you mention, explain briefly why it may fit the student, using the reasons/concerns provided.
- Match scores are estimates; never guarantee eligibility or selection. Records marked verified=false are prototype sample data.
- General guidance (e.g. about GRE, SOPs) is fine, but flag that requirements vary by university and must be checked.
- Be concise: short intro, then a bullet per scholarship (bold name), then one closing line. Plain markdown, no tables, no headings.`;
  const prompt = `Student profile: ${JSON.stringify(profile ? { nationality: profile.nationality, level: profile.target_level, field: profile.target_field, countries: profile.target_countries, grade: profile.grade, grade_type: profile.grade_type, income: profile.income_range, work_years: profile.work_years } : 'not provided')}
Detected filters: ${JSON.stringify(filters)}
Recent conversation: ${JSON.stringify(history.slice(-6).map(h => ({ role: h.role, content: h.content.slice(0, 600) })))}
RECORDS: ${JSON.stringify(records)}

Student question: ${message}`;

  let reply = await llm({ system, prompt, maxTokens: 2000 });
  if (!reply) reply = templateReply(message, filters, results, hasFilters);
  if (!reply.includes('verified through the official')) reply += `\n\n_${DISCLAIMER}_`;
  return { reply, scholarshipIds: results.map(r => r.s.id) };
}

function templateReply(message, f, results, hasFilters) {
  if (!results.length) {
    return `I searched ScholarPath's database but couldn't find open scholarships matching that request${f.countries.length ? ` for ${[...new Set(f.countries)].slice(0, 4).join(', ')}` : ''}. Try removing a filter (for example funding type or country), or check the provider's website directly — I won't guess at scholarships that aren't in our database.`;
  }
  const bits = [];
  if (f.level) bits.push(f.level); if (f.field) bits.push(f.field);
  if (f.countries.length) bits.push('in ' + [...new Set(f.countries)].slice(0, 4).join(', '));
  if (f.fully) bits.push('fully funded'); if (f.income) bits.push(`family income under ₹${f.income} lakh`);
  const intro = hasFilters
    ? `I searched the ScholarPath database for **${bits.join(' · ') || 'your request'}** and found ${results.length} open scholarship${results.length > 1 ? 's' : ''} worth a look:`
    : `Here are the open scholarships that best match your profile right now:`;
  const lines = results.map(({ s, m }) => {
    const why = [...m.reasons.filter(r => !/nationality|all fields/.test(r)), ...m.reasons].slice(0, 3).join('; ');
    const concern = m.concerns[0] ? ` ⚠ ${m.concerns[0]}.` : '';
    return `- **${s.name}** (${s.provider}) — ${s.value_text}. ${m.score}% match: ${why || 'partial fit'}.${concern} Deadline ${new Date(s.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`;
  });
  let extra = '';
  if (f.noGre) extra = '\n\nNote: none of these scholarships list GRE scores as a scholarship requirement, but your **target universities** may still require GRE/GMAT for admission — check each programme page.';
  return `${intro}\n\n${lines.join('\n')}${extra}`;
}

// ---------- Application writing assistant ----------
export const WRITER_TOOLS = {
  sop: { label: 'SOP Assistant', draft: true },
  motivation: { label: 'Motivation Letter', draft: true },
  essay: { label: 'Scholarship Essay', draft: true },
  resume_feedback: { label: 'Resume Feedback', draft: false },
  essay_feedback: { label: 'Essay Feedback', draft: false },
};

export async function write({ tool, background = '', goals = '', target = '', prompt: essayPrompt = '', text = '' }) {
  const t = WRITER_TOOLS[tool];
  if (!t) throw Object.assign(new Error('Unknown tool'), { status: 400 });
  if (t.draft && background.trim().length < 80)
    throw Object.assign(new Error('Please describe your real background (education, experience, achievements) in at least a few sentences. Scholar AI only uses facts you provide.'), { status: 400 });
  if (!t.draft && text.trim().length < 100) throw Object.assign(new Error('Paste at least 100 characters of your document for feedback.'), { status: 400 });

  const system = `You help students write scholarship applications. Hard rules:
- Use ONLY facts the student provided. Never invent achievements, grades, employers, publications, awards, numbers or experiences.
- Where a strong application needs a detail the student hasn't given, insert a clearly marked placeholder like [ADD: a specific example of ...].
- Write in the student's voice, first person, plain and specific; avoid clichés ("since childhood", "passionate", "dream").
- Output plain text only (no markdown headings). Paragraphs separated by blank lines.`;
  const userPrompt = t.draft
    ? `Write a ${t.label} draft (~450-600 words) for: ${target || 'a postgraduate scholarship'}.
${essayPrompt ? `Essay prompt: ${essayPrompt}\n` : ''}Student's background (facts only): ${background}
Goals: ${goals || '[not provided]'}`
    : `Give ${t.label.toLowerCase()} for the document below. Structure: "Overall", "What works", "What to improve" (numbered, specific, quote the line), "Suggested rewrite of the weakest paragraph" (no invented facts; use [ADD: ...] placeholders).
Target: ${target || 'scholarship application'}

DOCUMENT:
${text}`;

  const out = await llm({ system, prompt: userPrompt, maxTokens: 3000 });
  return { text: out || (t.draft ? templateDraft(tool, { background, goals, target, essayPrompt }) : heuristicFeedback(tool, text)), ai: !!out };
}

function templateDraft(tool, { background, goals, target, essayPrompt }) {
  const sentences = background.split(/(?<=[.!?])\s+/).filter(Boolean);
  const open = {
    sop: `I am applying for ${target || '[ADD: programme and university]'} because ${goals ? goals.replace(/\.$/, '') : '[ADD: the specific problem or question you want to work on]'}.`,
    motivation: `I am writing to apply for ${target || '[ADD: scholarship name]'}. ${goals ? `My goal is ${goals.replace(/^i\s+/i, '').replace(/\.$/, '')}.` : '[ADD: what you want to achieve with this scholarship]'}`,
    essay: essayPrompt ? `In response to the question "${essayPrompt}":` : '[ADD: the essay prompt you are answering]',
  }[tool];
  return [
    open,
    `My background so far: ${sentences.slice(0, 3).join(' ')}`,
    sentences.length > 3 ? `Beyond this, ${sentences.slice(3).join(' ')}` : '[ADD: one concrete achievement with a measurable result — what you did, how, and what changed.]',
    `What I learned from this: [ADD: a specific skill or insight, tied to an example above.]`,
    `Why this programme / scholarship: [ADD: two specific features — modules, faculty, labs, alumni network — and why they matter to your plan.]`,
    `After completing my studies, ${goals ? goals.replace(/\.$/, '') : '[ADD: your short-term and long-term plans, especially how you will contribute in India]'}. [ADD: how this connects back to the scholarship's mission.]`,
    `— Draft generated from the details you provided. Fill every [ADD: …] with real, verifiable information before submitting.`,
  ].join('\n\n');
}

function heuristicFeedback(tool, text) {
  const words = text.trim().split(/\s+/).length;
  const cliches = ['passionate', 'since childhood', 'since my childhood', 'dream', 'always wanted', 'hard-working', 'team player', 'out of the box', 'make a difference'].filter(c => text.toLowerCase().includes(c));
  const numbers = (text.match(/\d+/g) || []).length;
  const iCount = (text.match(/\bI\b/g) || []).length;
  const longSent = text.split(/(?<=[.!?])\s+/).filter(s => s.split(/\s+/).length > 35).length;
  const passive = (text.match(/\b(was|were|been|being)\s+\w+ed\b/gi) || []).length;
  const out = ['Overall', `${words} words. ${tool === 'resume_feedback' ? 'Resumes for scholarships should be one page with impact-first bullets.' : words < 400 ? 'This is on the short side for most scholarship essays (often 500–1000 words) — check the word limit.' : words > 1100 ? 'This is long; most scholarship essays cap at ~1,000 words.' : 'Length is in a typical range for scholarship essays.'}`, '', 'What works'];
  if (numbers >= 3) out.push('- You use concrete numbers — good evidence of impact.');
  if (!cliches.length) out.push('- No common clichés detected.');
  if (words > 250) out.push('- Enough material to build a clear narrative.');
  out.push('', 'What to improve');
  let n = 1;
  if (cliches.length) out.push(`${n++}. Replace clichés (${cliches.map(c => `"${c}"`).join(', ')}) with a specific moment or result.`);
  if (numbers < 3) out.push(`${n++}. Quantify outcomes (people reached, % improvement, scale) — only with figures you can verify.`);
  if (longSent) out.push(`${n++}. ${longSent} sentence(s) exceed 35 words; split them for readability.`);
  if (passive > 2) out.push(`${n++}. ${passive} passive constructions found — use active verbs ("I built", "I led").`);
  if (tool !== 'resume_feedback' && iCount < 5) out.push(`${n++}. Make your own role clearer — reviewers need to know what *you* did.`);
  if (tool === 'resume_feedback' && !/lead|led|managed|organi[sz]ed|president|captain/i.test(text)) out.push(`${n++}. Add leadership evidence if you have it — many scholarships weigh it heavily.`);
  out.push(`${n++}. Close by linking your plan to the scholarship's mission (development impact, leadership, return to India, etc.).`);
  out.push('', 'Note: Detailed AI rewrite suggestions are available when the AI service is configured. These checks are automated heuristics.');
  return out.join('\n');
}

// ---------- Admin data extraction ----------
const EXTRACT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    name: { type: 'string' }, provider: { type: 'string' }, description: { type: 'string' }, value_text: { type: 'string' },
    value_inr: { type: 'number' }, is_fully_funded: { type: 'boolean' }, countries: { type: 'array', items: { type: 'string' } },
    levels: { type: 'array', items: { type: 'string', enum: ['Undergraduate', 'Masters', 'MBA', 'PhD'] } },
    fields: { type: 'array', items: { type: 'string' } }, nationalities: { type: 'array', items: { type: 'string' } },
    eligibility: { type: 'string' }, deadline: { type: 'string', description: 'YYYY-MM-DD or empty if not stated' },
    documents: { type: 'array', items: { type: 'string' } }, official_url: { type: 'string' },
  },
  required: ['name', 'provider', 'description', 'value_text', 'value_inr', 'is_fully_funded', 'countries', 'levels', 'fields', 'nationalities', 'eligibility', 'deadline', 'documents', 'official_url'],
};

export async function fetchPageText(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw Object.assign(new Error('Only http(s) URLs are supported'), { status: 400 });
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$)/i.test(u.hostname))
    throw Object.assign(new Error('Private or local addresses are not allowed'), { status: 400 });
  const res = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'ScholarPathBot/0.1 (+admin extraction)' } });
  if (!res.ok) throw Object.assign(new Error(`Fetch failed: HTTP ${res.status}`), { status: 400 });
  const html = (await res.text()).slice(0, 600000);
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 40000);
}

export async function extract({ url, text }) {
  let source = text?.trim() || '';
  if (url && !source) source = await fetchPageText(url);
  if (source.length < 40) throw Object.assign(new Error('Provide a URL or paste at least a paragraph of scholarship text.'), { status: 400 });
  const out = await llm({
    system: 'Extract scholarship details from the source text. Use empty strings/arrays or 0 for anything not explicitly stated — never guess. Nationalities and countries must be country names (e.g. India, not Indian; UK, USA). Convert amounts to an approximate INR number in value_inr (0 if unknown). Countries are study destinations.',
    prompt: `Source URL: ${url || 'n/a'}\n\nSOURCE TEXT:\n${source.slice(0, 40000)}`,
    maxTokens: 3000, schema: EXTRACT_SCHEMA,
  });
  let data = null;
  try { data = out && JSON.parse(out); } catch { data = null; }
  return { data: { ...(data || heuristicExtract(source)), official_url: data?.official_url || url || '' }, ai: !!data, chars: source.length };
}

function heuristicExtract(src) {
  const lower = src.toLowerCase();
  const first = src.split(/[.\n|]/).map(s => s.trim()).find(s => /scholarship|fellowship|award|grant/i.test(s) && s.length < 140) || src.slice(0, 80);
  const months = 'january|february|march|april|may|june|july|august|september|october|november|december';
  const dl = src.match(new RegExp(`(?:deadline|last date|closes?|apply by)[^.]{0,40}?(\\d{1,2}\\s+(?:${months})\\s+\\d{4}|(?:${months})\\s+\\d{1,2},?\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2})`, 'i'));
  let deadline = '';
  if (dl) { const d = new Date(dl[1]); if (!isNaN(d)) deadline = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  const amt = src.match(/(₹|rs\.?|inr|£|\$|usd|€|eur)\s?([\d,]+(?:\.\d+)?)\s*(lakh|crore|k)?/i);
  const rate = { '₹': 1, rs: 1, 'rs.': 1, inr: 1, '£': 110, $: 85, usd: 85, '€': 95, eur: 95 };
  let value_inr = 0;
  if (amt) {
    const mult = { lakh: 1e5, crore: 1e7, k: 1e3 }[amt[3]?.toLowerCase()] || 1;
    value_inr = Math.round(parseFloat(amt[2].replace(/,/g, '')) * mult * (rate[amt[1].toLowerCase()] || 1));
  }
  const docs = ['transcript', 'passport', 'resume', 'cv', 'statement of purpose', 'reference letter', 'recommendation letter', 'income certificate', 'caste certificate', 'motivation letter', 'research proposal', 'english test', 'ielts', 'toefl', 'aadhaar']
    .filter(d => lower.includes(d)).map(d => d.replace(/\b\w/g, c => c.toUpperCase()));
  return {
    name: first, provider: (src.match(/(?:[Oo]ffered|[Ff]unded|[Pp]rovided|[Aa]warded|[Ss]ponsored) by ([A-Z][\w&.,' -]{3,80}?)(?:[.,;]| to | for )/) || [])[1] || '',
    description: src.slice(0, 400), value_text: amt ? amt[0] : '', value_inr, is_fully_funded: /fully[- ]funded|full tuition|covers all/i.test(src),
    countries: COUNTRIES.filter(c => new RegExp(`\\b${c}\\b`, 'i').test(src) || (c === 'UK' && /united kingdom/i.test(src)) || (c === 'USA' && /united states/i.test(src))),
    levels: ['Undergraduate', 'Masters', 'MBA', 'PhD'].filter(l => new RegExp({ Undergraduate: 'undergraduate|bachelor', Masters: "master|postgraduate|msc|\\bma\\b", MBA: '\\bmba\\b', PhD: 'phd|doctoral' }[l], 'i').test(src)),
    fields: FIELDS.filter(f => lower.includes(f.toLowerCase().split(' ')[0])).slice(0, 6), nationalities: /indian (students|nationals|citizens)/i.test(src) ? ['India'] : [],
    eligibility: (src.match(/eligib[^.]{0,300}\./i) || [''])[0], deadline, documents: docs, official_url: '',
  };
}

