// Mirrors api/src/services/teacherSubscription.service.js planEndDate.
const PLAN_MONTHS = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12 };
export const PLANS = ['monthly', 'quarterly', 'half_yearly', 'yearly', 'custom'];

export function planEndDate(planType, startDate) {
  const months = PLAN_MONTHS[planType];
  if (!months || !/^\d{4}-\d{2}-\d{2}$/.test(startDate || '')) return '';
  const [y, m, d] = startDate.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  const end = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day));
  if (day === d) end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}
