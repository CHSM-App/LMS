const { paginate } = require('../../src/utils/paginate');
test('defaults', () => expect(paginate({})).toEqual({ page: 1, limit: 20, offset: 0 }));
test('caps limit and computes offset', () => expect(paginate({ page: '3', limit: '500' })).toEqual({ page: 3, limit: 100, offset: 200 }));
test('negative page -> 1', () => expect(paginate({ page: '-1' }).page).toBe(1));
