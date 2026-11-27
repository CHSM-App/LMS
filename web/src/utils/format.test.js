import { describe, expect, test } from 'vitest';
import { cleanMobileInput } from './format';

describe('cleanMobileInput', () => {
  test('keeps digits only and caps at 10', () => {
    expect(cleanMobileInput('98765432101234')).toBe('9876543210');
    expect(cleanMobileInput('98ab76')).toBe('9876');
  });
  test('drops a pasted +91 / 0 prefix', () => {
    expect(cleanMobileInput('+91 98765 43210')).toBe('9876543210');
    expect(cleanMobileInput('09876543210')).toBe('9876543210');
  });
  test('handles empty input', () => {
    expect(cleanMobileInput('')).toBe('');
    expect(cleanMobileInput(undefined)).toBe('');
  });
});
