const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const DOMPurify = createDOMPurify(new JSDOM('').window);

// Removes scripts, event handlers and dangerous URLs from user text before it is stored.
function sanitize(html) {
  if (html === null || html === undefined) return null;
  return DOMPurify.sanitize(String(html));
}

module.exports = { sanitize };
