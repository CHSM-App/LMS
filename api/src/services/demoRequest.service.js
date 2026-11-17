const { query, one, T } = require('../db/query');
const meet = require('../providers/meet');
const whatsapp = require('../providers/whatsapp');
const { msg } = require('../i18n/messages');
const { clock } = require('../utils/clock');
const { APIError, badRequest, notFound } = require('../utils/APIError');

const out = (r) => ({
  id: r.demo_request_id,
  course: { id: r.course_id, title: r.course_title },
  name: r.name,
  mobile: r.mobile,
  education: r.education,
  classStandard: r.class_standard,
  preferredTime: r.preferred_time,
  message: r.message,
  whatsappOptIn: r.whatsapp_opt_in,
  status: r.status,
  scheduledAt: r.scheduled_at,
  meetLink: r.meet_link,
  whatsappSentAt: r.whatsapp_sent_at,
  whatsappError: r.whatsapp_error,
  createdAt: r.created_at,
});

const SELECT = 'SELECT d.*, c.title AS course_title FROM dbo.demo_requests d JOIN dbo.courses c ON c.course_id = d.course_id';

async function owned(id, teacherId) {
  const r = await one(`${SELECT} WHERE d.demo_request_id = @id AND d.teacher_id = @t`, { id: T.int(Number(id)), t: T.int(teacherId) });
  if (!r) throw notFound('Request not found');
  return r;
}

async function list(teacherId, { status, courseId }) {
  const rows = await query(
    `${SELECT} WHERE d.teacher_id = @t AND (@s IS NULL OR d.status = @s) AND (@c IS NULL OR d.course_id = @c) ORDER BY d.created_at DESC`,
    { t: T.int(teacherId), s: T.varchar(status || null, 10), c: T.int(courseId ? Number(courseId) : null) },
  );
  return rows.map(out);
}

async function schedule(id, teacherId, { scheduledAt, meetLink }) {
  const r = await owned(id, teacherId);
  if (['rejected', 'completed'].includes(r.status)) throw badRequest(`This request is already ${r.status}`);
  const when = new Date(scheduledAt);
  if (!scheduledAt || Number.isNaN(when.getTime())) throw badRequest('scheduledAt: choose a date and time');
  if (when <= clock.now()) throw badRequest('Choose a time in the future');
  let link = meetLink ? String(meetLink).trim() : null;
  if (link && !meet.isMeetLink(link)) throw badRequest('Enter a Google Meet link like https://meet.google.com/abc-defg-hij', 'INVALID_MEET_LINK');
  if (!link) link = await meet.createLink({ title: `Demo: ${r.course_title}`, start: when, durationMin: 30 });
  if (!link) throw badRequest('Paste a Meet link', 'MEET_LINK_REQUIRED');
  await query(
    "UPDATE dbo.demo_requests SET status = 'scheduled', scheduled_at = @at, meet_link = @l, whatsapp_sent_at = NULL, whatsapp_error = NULL WHERE demo_request_id = @id",
    { at: T.datetime(when), l: T.varchar(link, 300), id: T.int(r.demo_request_id) },
  );
  return out(await owned(id, teacherId));
}

function istParts(date) {
  const ist = new Date(new Date(date).getTime() + 330 * 60000);
  return { date: ist.toISOString().slice(0, 10), time: ist.toISOString().slice(11, 16) };
}

async function sendWhatsApp(id, teacherId) {
  const r = await owned(id, teacherId);
  if (r.status !== 'scheduled' || !r.meet_link) throw badRequest('Schedule the demo first');
  const { date, time } = istParts(r.scheduled_at);
  const text = msg('en', 'wa.demo_scheduled', { name: r.name, course: r.course_title, date, time, link: r.meet_link });
  const fallbackUrl = whatsapp.fallbackUrl(r.mobile, text);
  if (!r.whatsapp_opt_in) throw new APIError(409, "This student hasn't agreed to WhatsApp messages", 'WHATSAPP_NO_OPT_IN', { fallbackUrl });
  try {
    await whatsapp.send(r.mobile, text, { template: 'demo_scheduled' });
  } catch (err) {
    await query('UPDATE dbo.demo_requests SET whatsapp_error = @e WHERE demo_request_id = @id', { e: T.nvarchar(String(err.message).slice(0, 300), 300), id: T.int(r.demo_request_id) });
    throw new APIError(502, 'WhatsApp message not sent. Try again.', 'WHATSAPP_FAILED', { fallbackUrl });
  }
  await query('UPDATE dbo.demo_requests SET whatsapp_sent_at = @now, whatsapp_error = NULL WHERE demo_request_id = @id', { now: T.datetime(clock.now()), id: T.int(r.demo_request_id) });
  return { ...out(await owned(id, teacherId)), fallbackUrl };
}

async function setStatus(id, teacherId, status) {
  const r = await owned(id, teacherId);
  await query('UPDATE dbo.demo_requests SET status = @s WHERE demo_request_id = @id', { s: T.varchar(status, 10), id: T.int(r.demo_request_id) });
  return out(await owned(id, teacherId));
}

module.exports = { list, schedule, sendWhatsApp, setStatus, out, istParts };
