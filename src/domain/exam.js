// Pure exam rules: validation, scoring, random selection, final result, ranking. No DB access.

const TYPES = ['mcq', 'true_false', 'fill_blank', 'multi_correct'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

function validateQuestion(q) {
  const errors = [];
  if (!TYPES.includes(q.type)) errors.push('Choose a question type: MCQ, True/False, Fill in the blank or Multiple correct');
  if (!q.text || !String(q.text).trim()) errors.push('Write the question');
  if (q.difficulty && !DIFFICULTIES.includes(q.difficulty)) errors.push('Difficulty must be easy, medium or hard');
  const marks = Number(q.marks);
  const neg = Number(q.negativeMarks || 0);
  if (!(marks > 0) || marks > 100) errors.push('Marks must be more than 0 and at most 100');
  if (neg < 0) errors.push('Negative marks cannot be below 0');
  if (neg > marks) errors.push('Negative marks cannot be more than marks');
  const options = q.options || [];
  const correct = options.filter((o) => o.isCorrect).length;
  if (q.type === 'mcq') {
    if (options.length < 2) errors.push('MCQ needs at least 2 options');
    if (correct !== 1) errors.push('MCQ needs exactly one correct option');
  }
  if (q.type === 'multi_correct') {
    if (options.length < 2) errors.push('Multiple correct needs at least 2 options');
    if (correct < 1) errors.push('Mark at least one correct option');
  }
  if (q.type === 'true_false') {
    const texts = options.map((o) => String(o.text).trim().toLowerCase()).sort();
    if (options.length !== 2 || texts[0] !== 'false' || texts[1] !== 'true') errors.push('True/False questions have the options True and False');
    else if (correct !== 1) errors.push('Mark True or False as correct');
  }
  if (['mcq', 'multi_correct', 'true_false'].includes(q.type) && options.some((o) => !String(o.text || '').trim())) errors.push('Options cannot be empty');
  if (q.type === 'fill_blank' && !(q.acceptedAnswers || []).some((a) => String(a).trim())) errors.push('Add at least one accepted answer');
  return errors;
}

const DEVANAGARI_DIGITS = '०१२३४५६७८९';
function normalizeAnswer(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const round2 = (n) => Math.round(n * 100) / 100;

// answer: { optionId } | { optionIds: [] } | { text }. Unanswered scores 0 (never negative).
function scoreAnswer(q, answer, { negativeMarking = false } = {}) {
  const marks = Number(q.marks);
  const neg = negativeMarking ? Number(q.negativeMarks || 0) : 0;
  const empty =
    !answer ||
    (q.type === 'multi_correct' ? !(answer.optionIds && answer.optionIds.length) : q.type === 'fill_blank' ? !normalizeAnswer(answer.text) : answer.optionId == null);
  if (empty) return { correct: false, marks: 0, unanswered: true };
  let correct = false;
  if (q.type === 'mcq' || q.type === 'true_false') {
    const right = q.options.find((o) => o.isCorrect);
    correct = !!right && Number(answer.optionId) === right.id;
  } else if (q.type === 'multi_correct') {
    const right = q.options.filter((o) => o.isCorrect).map((o) => o.id).sort((a, b) => a - b);
    const given = [...new Set(answer.optionIds.map(Number))].sort((a, b) => a - b);
    correct = right.length === given.length && right.every((v, i) => v === given[i]);
  } else if (q.type === 'fill_blank') {
    const g = normalizeAnswer(answer.text);
    correct = (q.acceptedAnswers || []).some((a) => normalizeAnswer(a) === g);
  }
  return { correct, marks: correct ? marks : neg ? -neg : 0 };
}

// answers: { [questionId]: answer }. Total is clamped at 0; perModule keeps raw sums.
function scoreAttempt(questions, answers, opts = {}) {
  let score = 0;
  let max = 0;
  const perModule = {};
  const perQuestion = {};
  for (const q of questions) {
    const r = scoreAnswer(q, answers[q.id], opts);
    perQuestion[q.id] = r;
    score += r.marks;
    max += Number(q.marks);
    const m = (perModule[q.moduleId] = perModule[q.moduleId] || { score: 0, max: 0 });
    m.score = round2(m.score + r.marks);
    m.max = round2(m.max + Number(q.marks));
  }
  return { score: round2(Math.max(0, score)), max: round2(max), perModule, perQuestion };
}

// Deterministic PRNG so a student's random paper can be rebuilt from its seed.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// config: [{ moduleId, easy, medium, hard }]. Pool items: { id, moduleId, difficulty, isArchived }.
function selectQuestions(pool, config, rng) {
  const ids = [];
  for (const c of config) {
    for (const d of DIFFICULTIES) {
      const need = Number(c[d] || 0);
      if (!need) continue;
      const candidates = pool.filter((p) => p.moduleId === c.moduleId && p.difficulty === d && !p.isArchived).sort((a, b) => a.id - b.id);
      if (candidates.length < need) throw new Error(`Not enough ${d} questions in module ${c.moduleId}: has ${candidates.length}, needs ${need}`);
      ids.push(...shuffle(candidates, rng).slice(0, need).map((p) => p.id));
    }
  }
  return ids;
}

// exams: [{ examId, category, weightage, passingPct }], attempts: submitted attempts { examId, score, max, perModule }.
// Best attempt per graded exam counts; practice is ignored. Pass = weighted % >= the final exam's passing % (40 if none).
function finalResult(exams, attempts) {
  const graded = exams.filter((e) => e.category !== 'practice');
  const out = [];
  const perModule = {};
  let weighted = 0;
  for (const e of graded) {
    const mine = attempts.filter((a) => a.examId === e.examId && a.max > 0);
    const best = mine.sort((a, b) => b.score / b.max - a.score / a.max)[0];
    const pct = best ? round2((best.score / best.max) * 100) : 0;
    weighted += (Number(e.weightage) * pct) / 100;
    out.push({ examId: e.examId, category: e.category, weightage: Number(e.weightage), attempted: !!best, score: best ? best.score : null, max: best ? best.max : null, pct, passed: best ? pct >= Number(e.passingPct || 0) : false });
    if (best) {
      for (const [moduleId, m] of Object.entries(best.perModule || {})) {
        const acc = (perModule[moduleId] = perModule[moduleId] || { score: 0, max: 0 });
        acc.score = round2(acc.score + m.score);
        acc.max = round2(acc.max + m.max);
      }
    }
  }
  const final = graded.find((e) => e.category === 'final');
  const passMark = final && final.passingPct != null ? Number(final.passingPct) : 40;
  const weightedPct = round2(weighted);
  return { exams: out, weightedPct, passed: weightedPct >= passMark, passMark, perModule };
}

// Higher score first; equal scores go to the earlier submission. Ranks are 1..n.
function rankRows(rows) {
  return [...rows]
    .sort((a, b) => b.score - a.score || new Date(a.submittedAt) - new Date(b.submittedAt))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

module.exports = { TYPES, DIFFICULTIES, validateQuestion, normalizeAnswer, scoreAnswer, scoreAttempt, mulberry32, shuffle, selectQuestions, finalResult, rankRows };
