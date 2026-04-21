import type { Lang } from './types';

// Shanten number: how many tiles away from tenpai.
// 0 = tenpai, -1 = already won, 8 = worst case for 13-tile hand.
// Rules: 3 suits (man 11-19, bamboo 21-29, circles 31-39 after %50), no honor tiles.
// Win condition: 1 pair (head) + 4 melds (triplet AAA or sequence ABC).

export function getShantenNumber(handCards: number[]): number {
  const counts: number[][] = [
    new Array(11).fill(0), // man: face 1-9
    new Array(11).fill(0), // bamboo
    new Array(11).fill(0), // circles
  ];

  for (const raw of handCards) {
    const t = raw % 50;
    const suit = Math.floor(t / 10) - 1; // 0/1/2
    const face = t % 10;                  // 1-9
    if (suit >= 0 && suit < 3 && face >= 1 && face <= 9) {
      counts[suit][face]++;
    }
  }

  let min = 8;

  // Without head
  min = Math.min(min, evalHand(counts, false));

  // Try each tile as the head (pair)
  for (let s = 0; s < 3; s++) {
    for (let f = 1; f <= 9; f++) {
      if (counts[s][f] >= 2) {
        counts[s][f] -= 2;
        min = Math.min(min, evalHand(counts, true));
        counts[s][f] += 2;
      }
    }
  }

  return min;
}

function evalHand(counts: number[][], hasHead: boolean): number {
  // Get Pareto frontier of (mentsu, taatsu) for each suit independently,
  // then combine across suits.
  let combined: [number, number][] = [[0, 0]];
  for (const c of counts) {
    const frontier = suitSearch([...c], 1);
    const next: [number, number][] = [];
    for (const [m1, t1] of combined) {
      for (const [m2, t2] of frontier) {
        next.push([m1 + m2, t1 + t2]);
      }
    }
    combined = paretoFrontier(next);
  }

  const j = hasHead ? 1 : 0;
  let best = 8;
  for (const [m, t] of combined) {
    const s = 8 - 2 * m - Math.min(t, 4 - m) - j;
    if (s < best) best = s;
  }
  return best;
}

// Recursive search for a single suit's count array c[1..9].
// Returns Pareto-optimal (mentsu, taatsu) pairs achievable from position i onwards.
function suitSearch(c: number[], i: number): [number, number][] {
  while (i <= 9 && c[i] === 0) i++;
  if (i > 9) return [[0, 0]];

  const out: [number, number][] = [];

  const add = (sub: [number, number][], dm: number, dt: number) => {
    for (const [m, t] of sub) out.push([m + dm, t + dt]);
  };

  // Complete meld: triplet
  if (c[i] >= 3) {
    c[i] -= 3;
    add(suitSearch(c, i), 1, 0);
    c[i] += 3;
  }

  // Complete meld: sequence (needs i <= 7 so i+2 <= 9)
  if (i <= 7 && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--; c[i + 1]--; c[i + 2]--;
    add(suitSearch(c, i), 1, 0);
    c[i]++; c[i + 1]++; c[i + 2]++;
  }

  // Partial meld (taatsu): pair
  if (c[i] >= 2) {
    c[i] -= 2;
    add(suitSearch(c, i + 1), 0, 1);
    c[i] += 2;
  }

  // Partial meld: kanchan (i, i+2) — needs i <= 7
  if (i <= 7 && c[i + 2] > 0) {
    c[i]--; c[i + 2]--;
    add(suitSearch(c, i + 1), 0, 1);
    c[i]++; c[i + 2]++;
  }

  // Partial meld: sequential pair (i, i+1)
  if (i <= 8 && c[i + 1] > 0) {
    c[i]--; c[i + 1]--;
    add(suitSearch(c, i + 1), 0, 1);
    c[i]++; c[i + 1]++;
  }

  // Isolated: discard one tile at i and continue at same position
  c[i]--;
  add(suitSearch(c, i), 0, 0);
  c[i]++;

  return paretoFrontier(out);
}

// Keep only Pareto-optimal (m, t) pairs: no other pair has both higher m and higher t.
function paretoFrontier(pairs: [number, number][]): [number, number][] {
  if (pairs.length === 0) return [[0, 0]];
  pairs.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const result: [number, number][] = [];
  let maxT = -1;
  for (const [m, t] of pairs) {
    if (t > maxT) {
      result.push([m, t]);
      maxT = t;
    }
  }
  return result;
}

export function shantenText(shanten: number, lang: Lang = 'en'): string {
  if (shanten < 0) return lang === 'en' ? 'Won' : '已胡';
  if (shanten === 0) return lang === 'en' ? 'Tenpai' : '听牌';
  return lang === 'en' ? `${shanten} from tenpai` : `差${shanten}张`;
}
