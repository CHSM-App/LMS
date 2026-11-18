jest.mock('../../src/config/env', () => ({ config: jest.fn() }));
const { config } = require('../../src/config/env');
const { generate } = require('../../src/services/otp.service');

test('uses the fixed code when configured', () => {
  config.mockReturnValue({ otpFixedCode: '123456' });
  expect(generate()).toBe('123456');
});
test('random 6-digit code otherwise', () => {
  config.mockReturnValue({ otpFixedCode: null });
  expect(generate()).toMatch(/^\d{6}$/);
});
