import type { Lang } from './types';

const SUIT_MAP: Record<Lang, Record<number, string>> = {
  zh: { 1: '万', 2: '条', 3: '筒' },
  en: { 1: 'characters', 2: 'bamboo', 3: 'dots' },
};

const NUM_MAP: Record<Lang, Record<number, string>> = {
  zh: { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九' },
  en: { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9' },
};

export function cardName(num: number | null | undefined, lang: Lang = 'zh'): string {
  if (num == null) return '?';
  const normalized = num % 50;
  const suit = Math.floor(normalized / 10);
  const face = normalized % 10;
  const suitName = SUIT_MAP[lang]?.[suit] ?? '?';
  const faceName = NUM_MAP[lang]?.[face] ?? '?';
  return lang === 'en' ? `${faceName} ${suitName}` : `${faceName}${suitName}`;
}

export function cardNames(arr: number[] | null | undefined, lang: Lang = 'zh'): string {
  if (!arr || !Array.isArray(arr)) return '';
  return arr.map((num) => cardName(num, lang)).join(lang === 'en' ? ', ' : '、');
}

export function normalizeCard(num: number | null | undefined): number | null {
  if (num == null) return null;
  return num % 50;
}

export function getCardSuit(num: number | null | undefined): number | null {
  const normalized = normalizeCard(num);
  if (normalized == null) return null;
  return Math.floor(normalized / 10);
}

export function getCardFace(num: number | null | undefined): number | null {
  const normalized = normalizeCard(num);
  if (normalized == null) return null;
  return normalized % 10;
}

export function sortCards(cards: number[]): number[] {
  if (!Array.isArray(cards)) return [];
  return cards
    .filter((num) => num != null)
    .slice()
    .sort((a, b) => (normalizeCard(a) ?? 0) - (normalizeCard(b) ?? 0));
}

export function cardCountSummary(cards: number[], lang: Lang = 'zh'): string {
  const sortedCards = sortCards(cards);
  if (sortedCards.length === 0) return lang === 'en' ? 'no tiles' : '空';

  const counts = new Map<number, number>();
  sortedCards.forEach((num) => {
    const normalized = normalizeCard(num) ?? 0;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([normalized, count]) => {
      const label = cardName(normalized, lang);
      return lang === 'en' ? `${count}x ${label}` : `${count}张${label}`;
    })
    .join(lang === 'en' ? ', ' : '、');
}

export function formatMeldGroup(cards: number[], lang: Lang = 'zh'): string {
  if (!Array.isArray(cards) || cards.length === 0) return '[]';
  const names = cards.map((num) => cardName(num, lang));
  return `[${names.join(lang === 'en' ? ', ' : '、')}]`;
}

// Human-readable English tile name for LLM prompts: "2-dot", "1-char", "5-bam"
const SUIT_READABLE: Record<number, string> = { 1: 'char', 2: 'bam', 3: 'dot' };
export function readableCardName(num: number): string {
  const normalized = num % 50;
  const suit = Math.floor(normalized / 10);
  const face = normalized % 10;
  return `${face}-${SUIT_READABLE[suit] ?? '?'}`;
}

// Suit-grouped tile list for LLM prompts
// EN: "1-char 2-char 3-char | 1-dot 5-dot | 2-bam"
// ZH: "一万二万三万 | 一筒五筒 | 二条"
export function tileListForPrompt(cards: number[], lang: Lang): string {
  const sorted = sortCards(cards);
  if (sorted.length === 0) return lang === 'en' ? '(none)' : '（无）';
  const groups = new Map<number, number[]>();
  sorted.forEach((num) => {
    const suit = Math.floor((num % 50) / 10);
    if (!groups.has(suit)) groups.set(suit, []);
    groups.get(suit)!.push(num);
  });
  if (lang === 'zh') {
    return Array.from(groups.values()).map((g) => g.map((c) => cardName(c, 'zh')).join('')).join(' | ');
  }
  return Array.from(groups.values()).map((g) => g.map(readableCardName).join(' ')).join(' | ');
}
