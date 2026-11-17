// Overridable clock so tests can move time (OTP expiry, exam deadlines, subscriptions).
let offsetMs = 0;
let fixed = null;

const clock = {
  now: () => (fixed ? new Date(fixed.getTime()) : new Date(Date.now() + offsetMs)),
  advance: (ms) => {
    if (fixed) fixed = new Date(fixed.getTime() + ms);
    else offsetMs += ms;
  },
  set: (date) => {
    fixed = date ? new Date(date) : null;
  },
  reset: () => {
    offsetMs = 0;
    fixed = null;
  },
};

// Today's date in India (IST, UTC+5:30) as YYYY-MM-DD; subscriptions compare against this.
function todayIST(now = clock.now()) {
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

module.exports = { clock, todayIST };
