import i18n from './index';
import en from './en.json';
import mr from './mr.json';
import hi from './hi.json';

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

test('app.name exists in all three languages', () => {
  for (const lng of ['en', 'mr', 'hi']) {
    expect(i18n.getFixedT(lng)('app.name')).toBeTruthy();
  }
});

test('mr and hi have every key that en has', () => {
  const keys = flatten(en);
  expect(keys.filter((k) => !flatten(mr).includes(k))).toEqual([]);
  expect(keys.filter((k) => !flatten(hi).includes(k))).toEqual([]);
});
