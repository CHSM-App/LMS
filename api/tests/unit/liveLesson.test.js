const { liveStage, JOIN_EARLY_MIN } = require('../../src/domain/liveLesson');
const at = (iso) => new Date(iso);
const base = { status: 'scheduled', startsAt: at('2026-12-01T12:30:00Z'), durationMin: 60, hasRecording: false };

test('join window opens 10 minutes early', () => expect(JOIN_EARLY_MIN).toBe(10));
test('upcoming before the join window', () => expect(liveStage(base, at('2026-12-01T12:19:00Z'))).toBe('upcoming'));
test('live from 10 minutes before start', () => expect(liveStage(base, at('2026-12-01T12:20:00Z'))).toBe('live'));
test('live until the end', () => expect(liveStage(base, at('2026-12-01T13:29:59Z'))).toBe('live'));
test('ended after the end, no recording', () => expect(liveStage(base, at('2026-12-01T13:30:00Z'))).toBe('ended'));
test('recorded once a recording exists, even before the end', () =>
  expect(liveStage({ ...base, hasRecording: true }, at('2026-12-01T13:00:00Z'))).toBe('recorded'));
test('cancelled wins', () => expect(liveStage({ ...base, status: 'cancelled', hasRecording: true }, at('2026-12-01T12:25:00Z'))).toBe('cancelled'));
test('teacher-marked completed counts as ended', () => expect(liveStage({ ...base, status: 'completed' }, at('2026-12-01T12:40:00Z'))).toBe('ended'));
