import { describe, expect, it } from 'vitest';
import { addChips, assertInteger, divideChips, formatChips, parseChips, subtractChips } from '../chips';

describe('chips', () => {
  describe('assertInteger', () => {
    it('accepts integer values', () => {
      expect(() => assertInteger(1_050)).not.toThrow();
    });

    it('throws for decimal values', () => {
      expect(() => assertInteger(10.5)).toThrow();
    });
  });

  describe('addChips', () => {
    it('adds two chip amounts using integer arithmetic', () => {
      expect(addChips(1_050, 250)).toBe(1_300);
    });

    it('prevents the 0.1 + 0.2 precision issue by staying in centimes', () => {
      expect(addChips(10, 20)).toBe(30);
    });

    it('throws when an input is negative', () => {
      expect(() => addChips(-1, 20)).toThrow();
    });
  });

  describe('subtractChips', () => {
    it('subtracts two chip amounts', () => {
      expect(subtractChips(1_050, 250)).toBe(800);
    });

    it('returns zero when subtracting equal values', () => {
      expect(subtractChips(100, 100)).toBe(0);
    });

    it('throws when subtraction would produce a negative result', () => {
      expect(() => subtractChips(100, 200)).toThrow();
    });
  });

  describe('divideChips', () => {
    it('divides chips evenly with no remainder', () => {
      expect(divideChips(2_500, 2)).toEqual({ perPlayer: 1_250, remainder: 0 });
    });

    it('returns remainder for odd chip distribution', () => {
      expect(divideChips(2_501, 2)).toEqual({ perPlayer: 1_250, remainder: 1 });
    });

    it('throws when players is not greater than zero', () => {
      expect(() => divideChips(100, 0)).toThrow();
    });
  });

  describe('formatChips', () => {
    it('formats whole euro values', () => {
      expect(formatChips(100)).toBe('1.00€');
    });

    it('formats mixed euro/centime values', () => {
      expect(formatChips(1_050)).toBe('10.50€');
    });

    it('formats small centime-only values', () => {
      expect(formatChips(5)).toBe('0.05€');
    });
  });

  describe('parseChips', () => {
    it('parses decimal user input to centimes', () => {
      expect(parseChips('10.50')).toBe(1_050);
    });

    it('parses integer user input to centimes', () => {
      expect(parseChips('10')).toBe(1_000);
    });

    it('parses euro values with a single decimal digit', () => {
      expect(parseChips('10.5')).toBe(1_050);
    });

    it('throws for malformed decimal input', () => {
      expect(() => parseChips('10.500')).toThrow();
    });
  });
});
