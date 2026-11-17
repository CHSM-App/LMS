const { validateQuestion, normalizeAnswer, scoreAnswer, scoreAttempt, selectQuestions, mulberry32, finalResult, rankRows } = require('../../../src/domain/exam');

const opt = (id, isCorrect) => ({ id, text: `o${id}`, isCorrect });

describe('validateQuestion', () => {
  test('MCQ needs 2+ options and exactly one correct', () => {
    expect(validateQuestion({ type: 'mcq', text: 'Q', options: [opt(1, true)], marks: 1, negativeMarks: 0 })).toContain('MCQ needs at least 2 options');
    expect(validateQuestion({ type: 'mcq', text: 'Q', options: [opt(1, true), opt(2, true)], marks: 1, negativeMarks: 0 })).toContain('MCQ needs exactly one correct option');
    expect(validateQuestion({ type: 'mcq', text: 'Q', options: [opt(1, true), opt(2, false)], marks: 1, negativeMarks: 0 })).toEqual([]);
  });
  test('multi-correct needs 2+ options and at least one correct', () => {
    expect(validateQuestion({ type: 'multi_correct', text: 'Q', options: [opt(1, false), opt(2, false)], marks: 2, negativeMarks: 0 })).toContain('Mark at least one correct option');
  });
  test('true/false has exactly True and False', () => {
    expect(validateQuestion({ type: 'true_false', text: 'Q', options: [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }], marks: 1, negativeMarks: 0 })).toEqual([]);
    expect(validateQuestion({ type: 'true_false', text: 'Q', options: [{ text: 'Yes', isCorrect: true }, { text: 'No', isCorrect: false }], marks: 1, negativeMarks: 0 })).toContain('True/False questions have the options True and False');
  });
  test('fill in the blank needs an accepted answer; negative marks cannot exceed marks', () => {
    expect(validateQuestion({ type: 'fill_blank', text: 'Q', acceptedAnswers: [], marks: 1, negativeMarks: 0 })).toContain('Add at least one accepted answer');
    expect(validateQuestion({ type: 'fill_blank', text: 'Q', acceptedAnswers: ['x'], marks: 1, negativeMarks: 2 })).toContain('Negative marks cannot be more than marks');
  });
});

describe('scoring', () => {
  const mcq = { id: 1, moduleId: 10, type: 'mcq', marks: 2, negativeMarks: 0.5, options: [opt(1, true), opt(2, false)] };
  const multi = { id: 2, moduleId: 10, type: 'multi_correct', marks: 3, negativeMarks: 1, options: [opt(3, true), opt(4, true), opt(5, false)] };
  const fill = { id: 3, moduleId: 11, type: 'fill_blank', marks: 1, negativeMarks: 0, acceptedAnswers: ['Mumbai', '10'] };

  test('normalizes case, spaces, Unicode form and Devanagari digits', () => {
    expect(normalizeAnswer('  Mumbai ')).toBe('mumbai');
    expect(normalizeAnswer('१०')).toBe('10');
    expect(normalizeAnswer('New   Delhi')).toBe('new delhi');
  });
  test('MCQ right / wrong / blank, with and without negative marking', () => {
    expect(scoreAnswer(mcq, { optionId: 1 }, { negativeMarking: true })).toEqual({ correct: true, marks: 2 });
    expect(scoreAnswer(mcq, { optionId: 2 }, { negativeMarking: true })).toEqual({ correct: false, marks: -0.5 });
    expect(scoreAnswer(mcq, { optionId: 2 }, { negativeMarking: false })).toEqual({ correct: false, marks: 0 });
    expect(scoreAnswer(mcq, null, { negativeMarking: true })).toEqual({ correct: false, marks: 0, unanswered: true });
  });
  test('multi-correct scores only an exact set (no partial marks)', () => {
    expect(scoreAnswer(multi, { optionIds: [4, 3] }, {}).marks).toBe(3);
    expect(scoreAnswer(multi, { optionIds: [3] }, {}).correct).toBe(false);
  });
  test('fill in the blank accepts any listed answer after normalizing', () => {
    expect(scoreAnswer(fill, { text: ' mumbai' }, {}).correct).toBe(true);
    expect(scoreAnswer(fill, { text: '१०' }, {}).correct).toBe(true);
    expect(scoreAnswer(fill, { text: 'Pune' }, {}).correct).toBe(false);
  });
  test('attempt total never goes below 0 and per-module sums to total', () => {
    const r = scoreAttempt([mcq, multi, fill], { 1: { optionId: 1 }, 2: { optionIds: [3, 4] }, 3: { text: 'mumbai' } }, { negativeMarking: true });
    expect(r).toMatchObject({ score: 6, max: 6 });
    expect(r.perModule[10].score + r.perModule[11].score).toBe(6);
    const bad = scoreAttempt([mcq, multi], { 1: { optionId: 2 }, 2: { optionIds: [5] } }, { negativeMarking: true });
    expect(bad.score).toBe(0);
  });
});

describe('selectQuestions', () => {
  const pool = [];
  let id = 1;
  for (const moduleId of [10, 11]) {
    for (const difficulty of ['easy', 'easy', 'easy', 'medium', 'medium', 'hard', 'hard']) pool.push({ id: id++, moduleId, difficulty, isArchived: false });
  }
  pool.push({ id: 999, moduleId: 10, difficulty: 'easy', isArchived: true });
  const config = [{ moduleId: 10, easy: 2, medium: 1, hard: 1 }, { moduleId: 11, easy: 1, medium: 0, hard: 2 }];

  test('returns exactly the requested mix and never archived questions', () => {
    const ids = selectQuestions(pool, config, mulberry32(42));
    expect(ids).toHaveLength(7);
    expect(ids).not.toContain(999);
    const picked = ids.map((x) => pool.find((p) => p.id === x));
    expect(picked.filter((p) => p.moduleId === 10 && p.difficulty === 'easy')).toHaveLength(2);
    expect(picked.filter((p) => p.moduleId === 11 && p.difficulty === 'hard')).toHaveLength(2);
  });
  test('same seed gives the same set; different seeds differ', () => {
    expect(selectQuestions(pool, config, mulberry32(7))).toEqual(selectQuestions(pool, config, mulberry32(7)));
    const sets = new Set([1, 2, 3, 4, 5, 6].map((s) => selectQuestions(pool, config, mulberry32(s)).join(',')));
    expect(sets.size).toBeGreaterThan(1);
  });
  test('throws when a module bank is too small', () => {
    expect(() => selectQuestions(pool, [{ moduleId: 10, easy: 0, medium: 0, hard: 5 }], mulberry32(1))).toThrow(/not enough/i);
  });
});

describe('finalResult and ranking', () => {
  const exams = [
    { examId: 1, category: 'unit_test_1', weightage: 20, passingPct: 40 },
    { examId: 2, category: 'unit_test_2', weightage: 20, passingPct: 40 },
    { examId: 3, category: 'final', weightage: 60, passingPct: 40 },
    { examId: 4, category: 'practice', weightage: 0 },
  ];
  test('weighted total uses the best attempt and ignores practice', () => {
    const attempts = [
      { examId: 1, score: 8, max: 10, perModule: { 10: { score: 8, max: 10 } } },
      { examId: 1, score: 6, max: 10, perModule: {} },
      { examId: 2, score: 6, max: 10, perModule: { 11: { score: 6, max: 10 } } },
      { examId: 3, score: 70, max: 100, perModule: { 10: { score: 30, max: 50 }, 11: { score: 40, max: 50 } } },
      { examId: 4, score: 0, max: 10, perModule: {} },
    ];
    const r = finalResult(exams, attempts);
    expect(r.weightedPct).toBeCloseTo(70.0, 5);
    expect(r.exams.find((e) => e.examId === 1).pct).toBe(80);
    expect(r.exams.find((e) => e.examId === 4)).toBeUndefined();
    expect(r.passed).toBe(true);
    expect(r.perModule[10]).toEqual({ score: 38, max: 60 });
  });
  test('ranks by score, ties go to the earlier submission', () => {
    const rows = rankRows([
      { id: 'a', score: 8, submittedAt: '2026-01-01T10:05:00Z' },
      { id: 'b', score: 9, submittedAt: '2026-01-01T10:10:00Z' },
      { id: 'c', score: 8, submittedAt: '2026-01-01T10:01:00Z' },
    ]);
    expect(rows.map((r) => [r.id, r.rank])).toEqual([['b', 1], ['c', 2], ['a', 3]]);
  });
});
