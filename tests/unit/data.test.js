import { describe, expect, it } from 'vitest';
import cards from '../../src/data/cards.json';
import nobles from '../../src/data/nobles.json';
import { COLORS } from '../../src/engine/constants.js';
import { getCard, getNoble } from '../../src/engine/cards.js';

describe('intégrité des données', () => {
  it('contient 90 cartes : 40 / 30 / 20 par niveau', () => {
    expect(cards).toHaveLength(90);
    expect(cards.filter((c) => c.level === 1)).toHaveLength(40);
    expect(cards.filter((c) => c.level === 2)).toHaveLength(30);
    expect(cards.filter((c) => c.level === 3)).toHaveLength(20);
  });

  it('contient 18 cartes par couleur de bonus (8/6/4 par niveau)', () => {
    for (const color of COLORS) {
      const ofColor = cards.filter((c) => c.bonus === color);
      expect(ofColor).toHaveLength(18);
      expect(ofColor.filter((c) => c.level === 1)).toHaveLength(8);
      expect(ofColor.filter((c) => c.level === 2)).toHaveLength(6);
      expect(ofColor.filter((c) => c.level === 3)).toHaveLength(4);
    }
  });

  it('a des identifiants uniques et des coûts valides', () => {
    expect(new Set(cards.map((c) => c.id)).size).toBe(90);
    for (const card of cards) {
      expect(Object.keys(card.cost).every((k) => COLORS.includes(k))).toBe(true);
      const total = Object.values(card.cost).reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThan(0);
      expect(card.points).toBeGreaterThanOrEqual(0);
      expect(card.points).toBeLessThanOrEqual(5);
    }
  });

  it('a des points cohérents par niveau', () => {
    const sum = (lvl) => cards.filter((c) => c.level === lvl).reduce((a, c) => a + c.points, 0);
    expect(sum(1)).toBe(5);
    expect(sum(2)).toBe(55);
    expect(sum(3)).toBe(80);
  });

  it('contient 10 nobles à 3 points', () => {
    expect(nobles).toHaveLength(10);
    expect(new Set(nobles.map((n) => n.id)).size).toBe(10);
    for (const noble of nobles) {
      expect(noble.points).toBe(3);
      const values = Object.values(noble.requirement).sort();
      expect([JSON.stringify([3, 3, 3]), JSON.stringify([4, 4])]).toContain(JSON.stringify(values));
    }
  });

  it('getCard / getNoble signalent les identifiants inconnus', () => {
    expect(getCard('L1-white-1').bonus).toBe('white');
    expect(getNoble('N1').points).toBe(3);
    expect(() => getCard('nope')).toThrow(/inconnue/);
    expect(() => getNoble('nope')).toThrow(/inconnu/);
  });
});
