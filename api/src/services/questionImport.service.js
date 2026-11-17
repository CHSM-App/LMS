const ExcelJS = require('exceljs');
const { withTransaction } = require('../db/tx');
const questions = require('./question.service');
const storage = require('../providers/storage');
const { badRequest } = require('../utils/APIError');

const HEADERS = ['type', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'correct', 'difficulty', 'marks', 'negative_marks', 'explanation'];
const MAX_ROWS = 2000;
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

async function template() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Questions');
  ws.addRow(HEADERS);
  ws.addRow(['mcq', 'What is 7 × 8?', '54', '56', '64', '', '', 'B', 'easy', 1, 0.25, '7 × 8 = 56']);
  ws.addRow(['true_false', 'The Sun rises in the east.', 'True', 'False', '', '', '', 'True', 'easy', 1, 0, '']);
  ws.addRow(['fill_blank', 'The capital of Maharashtra is ____.', '', '', '', '', '', 'Mumbai;Bombay', 'medium', 1, 0, 'Separate accepted answers with ;']);
  ws.addRow(['multi_correct', 'Which are prime numbers?', '2', '4', '5', '9', '', 'A,C', 'hard', 2, 0.5, 'Write all correct letters, separated by commas']);
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((c) => { c.width = 18; });
  const notes = wb.addWorksheet('How to fill');
  [
    ['type', 'mcq, true_false, fill_blank or multi_correct'],
    ['correct', 'mcq: one letter (B). multi_correct: letters with commas (A,C). true_false: True or False. fill_blank: answers separated by ; (Mumbai;Bombay)'],
    ['difficulty', 'easy, medium or hard (default medium)'],
    ['marks / negative_marks', 'Numbers. Negative marks cannot be more than marks.'],
    ['Limit', `At most ${MAX_ROWS} rows per file. Delete the example rows before importing.`],
  ].forEach((r) => notes.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Cell values: formulas and rich text are kept as plain text and never evaluated.
function cellText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.formula) return `=${v.formula}`;
    if (v.sharedFormula) return `=${v.sharedFormula}`;
    if (v.richText) return v.richText.map((p) => p.text).join('');
    if (v.text) return String(v.text);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (v.result !== undefined) return String(v.result);
  }
  return String(v);
}

const fieldFor = (message) => {
  if (/type/i.test(message)) return 'type';
  if (/correct|True or False/i.test(message)) return 'correct';
  if (/option/i.test(message)) return 'options';
  if (/accepted answer/i.test(message)) return 'correct';
  if (/negative/i.test(message)) return 'negative_marks';
  if (/marks/i.test(message)) return 'marks';
  if (/difficulty/i.test(message)) return 'difficulty';
  if (/question/i.test(message)) return 'question';
  return 'row';
};

function rowToBody(values) {
  const get = (name) => cellText(values[HEADERS.indexOf(name) + 1]).trim();
  const type = get('type').toLowerCase();
  const optionTexts = LETTERS.map((l) => get(`option_${l.toLowerCase()}`));
  const correct = get('correct');
  const body = {
    type,
    text: get('question'),
    difficulty: (get('difficulty') || 'medium').toLowerCase(),
    marks: get('marks') === '' ? 1 : Number(get('marks')),
    negativeMarks: get('negative_marks') === '' ? 0 : Number(get('negative_marks')),
    explanation: get('explanation') || null,
  };
  if (type === 'fill_blank') {
    body.acceptedAnswers = correct.split(';').map((s) => s.trim()).filter(Boolean);
  } else if (type === 'true_false') {
    const c = correct.toLowerCase();
    body.options = [{ text: 'True', isCorrect: c === 'true' }, { text: 'False', isCorrect: c === 'false' }];
  } else {
    const letters = correct.toUpperCase().split(/[,\s]+/).filter(Boolean);
    body.options = optionTexts
      .map((text, i) => ({ text, isCorrect: letters.includes(LETTERS[i]) }))
      .filter((o) => o.text);
  }
  return body;
}

async function errorWorkbook(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Errors');
  ws.addRow(['row', 'field', 'problem', ...HEADERS]);
  for (const r of rows) ws.addRow([r.row, r.field, r.message, ...r.values]);
  ws.getRow(1).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Valid rows are imported in one transaction; invalid rows are skipped and reported.
async function importFile(mod, buffer) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw badRequest('Upload the Excel template (.xlsx)');
  }
  const ws = wb.getWorksheet('Questions') || wb.worksheets[0];
  if (!ws) throw badRequest('The file has no sheet');
  const dataRows = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n > 1) dataRows.push({ n, values: row.values });
  });
  if (dataRows.length > MAX_ROWS) throw badRequest(`Maximum ${MAX_ROWS} rows per import`);
  const errors = [];
  const valid = [];
  for (const r of dataRows) {
    try {
      valid.push(questions.parse(rowToBody(r.values)));
    } catch (e) {
      const message = (e.details && e.details.errors && e.details.errors[0]) || e.message;
      errors.push({ row: r.n, field: fieldFor(message), message, values: HEADERS.map((h, i) => cellText(r.values[i + 1])) });
    }
  }
  await withTransaction(async (tx) => {
    for (const q of valid) await questions.insert(mod, q, tx);
  });
  let errorFileUrl = null;
  if (errors.length) {
    const key = await storage.save(await errorWorkbook(errors), 'import_errors', 'xlsx');
    errorFileUrl = storage.signedUrl(key, 3600);
  }
  return { imported: valid.length, errors: errors.map(({ row, field, message }) => ({ row, field, message })), errorFileUrl };
}

module.exports = { template, importFile, HEADERS, MAX_ROWS };
