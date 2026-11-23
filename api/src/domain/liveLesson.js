// Stage of a live lesson. Computed from the live class row and the clock, never stored.
const JOIN_EARLY_MIN = 10;
const MIN = 60 * 1000;

function liveStage({ status, startsAt, durationMin, hasRecording }, now = new Date()) {
  if (status === 'cancelled') return 'cancelled';
  // A live lesson with no session yet (template row, or another batch's session shown as a placeholder).
  if (!startsAt) return 'unscheduled';
  if (hasRecording) return 'recorded';
  const start = new Date(startsAt).getTime();
  const end = start + durationMin * MIN;
  const t = now.getTime();
  if (status === 'completed' || t >= end) return 'ended';
  if (t >= start - JOIN_EARLY_MIN * MIN) return 'live';
  return 'upcoming';
}

module.exports = { liveStage, JOIN_EARLY_MIN };
