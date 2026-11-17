const { normalizeMobile, maskMobile } = require('../../src/utils/mobile');
test.each([
  ['98765 43210', '+919876543210'],
  ['+91-9876543210', '+919876543210'],
  ['09876543210', '+919876543210'],
  ['919876543210', '+919876543210'],
  ['12345', null],
  ['5876543210', null],
  [undefined, null],
])('normalizeMobile(%p) = %p', (i, o) => expect(normalizeMobile(i)).toBe(o));
test('maskMobile', () => expect(maskMobile('+919876543210')).toBe('98XXXXXX10'));
