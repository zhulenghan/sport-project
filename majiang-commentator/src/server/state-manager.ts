import * as utils from './utils';
import { getShantenNumber, shantenText } from './shanten';
import type { GameEvent, Lang, RoomPlayer, EventSegments } from './types';

export class PlayerState {
  playerId: string;
  seat: number;
  name: string | null = null;
  handCards: number[] = [];
  playedCards: number[] = [];
  pengCards: number[] = [];
  gangCards: number[] = [];

  constructor(playerId: string, seat: number) {
    this.playerId = playerId;
    this.seat = seat;
  }

  updateFromRoomPlayer(p: Partial<RoomPlayer> = {}): void {
    this.name = p.name ?? this.name ?? `Player ${this.seat}`;
    this.handCards = utils.sortCards(p.handCards ?? []);
    this.playedCards = utils.sortCards(p.playedCards ?? []);
    this.pengCards = utils.sortCards(p.pengCards ?? []);
    this.gangCards = utils.sortCards(p.gangCards ?? []);
  }

  getLabel(_lang: Lang = 'en'): string {
    return this.name ?? `Player ${this.seat}`;
  }

  getHandSummary(lang: Lang = 'en'): string {
    const prefix = lang === 'en' ? `${this.handCards.length}-tile hand` : `${this.handCards.length}张手牌`;
    return `${prefix}: ${utils.cardCountSummary(this.handCards, lang)}`;
  }

  getMeldSummary(lang: Lang = 'en'): string {
    const parts: string[] = [];
    if (this.pengCards.length > 0) parts.push(lang === 'en' ? `peng ${utils.cardCountSummary(this.pengCards, lang)}` : `碰牌 ${utils.cardCountSummary(this.pengCards, lang)}`);
    if (this.gangCards.length > 0) parts.push(lang === 'en' ? `gang ${utils.cardCountSummary(this.gangCards, lang)}` : `杠牌 ${utils.cardCountSummary(this.gangCards, lang)}`);
    if (parts.length === 0) return lang === 'en' ? 'no exposed melds' : '暂无副露';
    return parts.join(lang === 'en' ? '; ' : '；');
  }

  getDiscardsSummary(lang: Lang = 'en'): string {
    return `${lang === 'en' ? 'discards' : '弃牌'}: ${utils.cardCountSummary(this.playedCards, lang)}`;
  }

  getPromptSummary(lang: Lang = 'en'): string {
    return `${this.getLabel(lang)} (${this.name ?? this.getLabel(lang)}): ${this.getHandSummary(lang)}; ${this.getMeldSummary(lang)}; ${this.getDiscardsSummary(lang)}`;
  }

  getPengSetCount(): number { return Math.floor((this.pengCards?.length ?? 0) / 3); }
  getGangSetCount(): number { return Math.floor((this.gangCards?.length ?? 0) / 4); }

  getShantenText(lang: Lang = 'en'): string {
    if (this.handCards.length === 0) return lang === 'en' ? 'N/A' : 'N/A';
    const openMelds = this.getPengSetCount() + this.getGangSetCount();
    const shanten = getShantenNumber(this.handCards, openMelds);
    return shantenText(shanten, lang);
  }

  getCompactState(lang: Lang = 'en'): string {
    return lang === 'en'
      ? `${this.getLabel(lang)} hand ${this.handCards.length}, peng ${this.getPengSetCount()}, gang ${this.getGangSetCount()}`
      : `${this.getLabel(lang)}手牌${this.handCards.length}张，碰${this.getPengSetCount()}，杠${this.getGangSetCount()}`;
  }

  getHandTileNames(lang: Lang): string[] { return this.handCards.map((c) => utils.cardName(c, lang)); }
  getPengTileNames(lang: Lang): string[] { return this.pengCards.map((c) => utils.cardName(c, lang)); }
  getGangTileNames(lang: Lang): string[] { return this.gangCards.map((c) => utils.cardName(c, lang)); }

  getTilePromptLine(lang: Lang): string {
    const hand = utils.tileListForPrompt(this.handCards, lang);
    const meldParts: string[] = [];
    if (this.pengCards.length > 0) meldParts.push(lang === 'en' ? `peng ${utils.tileListForPrompt(this.pengCards, lang)}` : `碰 ${utils.tileListForPrompt(this.pengCards, lang)}`);
    if (this.gangCards.length > 0) meldParts.push(lang === 'en' ? `gang ${utils.tileListForPrompt(this.gangCards, lang)}` : `杠 ${utils.tileListForPrompt(this.gangCards, lang)}`);
    const meldStr = meldParts.length > 0 ? meldParts.join(lang === 'en' ? '; ' : '；') : (lang === 'en' ? 'no melds' : '无副露');
    return lang === 'en'
      ? `hand [${hand}] (${this.handCards.length} tiles). Melds: ${meldStr}.`
      : `手牌【${hand}】（${this.handCards.length}张）。副露：${meldStr}。`;
  }

  hasExposedMelds(): boolean { return this.pengCards.length > 0 || this.gangCards.length > 0; }

  buildCountMap(cards: number[]): Map<number, number> {
    const counts = new Map<number, number>();
    (cards ?? []).forEach((num) => {
      const normalized = utils.normalizeCard(num) ?? 0;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    });
    return counts;
  }

  getGroupedMeldsFromCards(cards: number[], groupSize: number): number[][] {
    const counts = this.buildCountMap(cards);
    return Array.from(counts.entries())
      .filter(([, count]) => count >= groupSize)
      .map(([normalized]) => Array(groupSize).fill(normalized))
      .sort((a, b) => (utils.normalizeCard(a[0]) ?? 0) - (utils.normalizeCard(b[0]) ?? 0));
  }

  getOpenMeldGroups(): number[][] {
    return [...this.getGroupedMeldsFromCards(this.pengCards, 3), ...this.getGroupedMeldsFromCards(this.gangCards, 4)];
  }

  findBestClosedMeldGroups(cards: number[] = this.handCards): number[][] {
    const counts = this.buildCountMap(cards);
    const memo = new Map<string, number[][]>();

    const serialize = (m: Map<number, number>) =>
      Array.from(m.entries()).filter(([, c]) => c > 0).sort((a, b) => a[0] - b[0]).map(([t, c]) => `${t}:${c}`).join('|');

    const clone = (m: Map<number, number>) => new Map(m);

    const search = (countMap: Map<number, number>): number[][] => {
      const key = serialize(countMap);
      if (memo.has(key)) return memo.get(key)!;

      let firstTile: number | null = null;
      for (const [tile, count] of countMap.entries()) {
        if (count > 0) { firstTile = tile; break; }
      }
      if (firstTile == null) { memo.set(key, []); return []; }

      let best: number[][] = [];

      const withoutTile = clone(countMap);
      withoutTile.set(firstTile, (withoutTile.get(firstTile) ?? 0) - 1);
      best = search(withoutTile);

      if ((countMap.get(firstTile) ?? 0) >= 3) {
        const next = clone(countMap);
        next.set(firstTile, next.get(firstTile)! - 3);
        const opt = [[firstTile, firstTile, firstTile], ...search(next)];
        if (opt.length > best.length) best = opt;
      }

      if ((countMap.get(firstTile) ?? 0) >= 4) {
        const next = clone(countMap);
        next.set(firstTile, next.get(firstTile)! - 4);
        const opt = [[firstTile, firstTile, firstTile, firstTile], ...search(next)];
        if (opt.length > best.length || (opt.length === best.length && opt.flat().length > best.flat().length)) best = opt;
      }

      const suit = utils.getCardSuit(firstTile);
      const face = utils.getCardFace(firstTile);
      const second = suit != null && face != null && face <= 7 ? firstTile + 1 : null;
      const third = suit != null && face != null && face <= 7 ? firstTile + 2 : null;
      if (second != null && third != null && utils.getCardSuit(second) === suit && utils.getCardSuit(third) === suit && (countMap.get(second) ?? 0) > 0 && (countMap.get(third) ?? 0) > 0) {
        const next = clone(countMap);
        next.set(firstTile, next.get(firstTile)! - 1);
        next.set(second, next.get(second)! - 1);
        next.set(third, next.get(third)! - 1);
        const opt = [[firstTile, second, third], ...search(next)];
        if (opt.length > best.length) best = opt;
      }

      memo.set(key, best);
      return best;
    };

    return search(counts).sort((a, b) => (utils.normalizeCard(a[0]) ?? 0) - (utils.normalizeCard(b[0]) ?? 0));
  }

  getAllMeldGroups(): number[][] { return [...this.getOpenMeldGroups(), ...this.findBestClosedMeldGroups()]; }

  getMeldAnalysis(lang: Lang = 'en'): { count: number; groups: number[][]; namedGroups: string[] } {
    const meldGroups = this.getAllMeldGroups();
    return { count: meldGroups.length, groups: meldGroups, namedGroups: meldGroups.map((g) => utils.formatMeldGroup(g, lang)) };
  }

  getMeldReadSummary(lang: Lang = 'en'): string {
    const analysis = this.getMeldAnalysis(lang);
    if (analysis.count === 0) return lang === 'en' ? 'Meld read: no complete melds yet.' : '面子判断：暂时还没有完整面子。';
    return lang === 'en'
      ? `Meld read: ${analysis.count} meld${analysis.count === 1 ? '' : 's'} ${analysis.namedGroups.join(', ')}.`
      : `面子判断：共${analysis.count}组，${analysis.namedGroups.join('、')}。`;
  }

  getPotentialPairCount(): number {
    return Array.from(this.buildCountMap(this.handCards).values()).filter((c) => c >= 2).length;
  }
}

export class StateManager {
  players: Record<string, PlayerState> = {};
  playerOrder: string[] = [];
  gameInfo: Partial<{ remainingNum: number; tableIds: string[]; optionPos: number }> = {};
  roomId: string | null = null;

  updateFromEvent(event: GameEvent): void {
    if (!event || typeof event !== 'object') return;
    if (event.roomId) this.roomId = event.roomId;
    if (event.gameInfo && typeof event.gameInfo === 'object') this.gameInfo = { ...event.gameInfo };
    if (event.roomInfo && typeof event.roomInfo === 'object') this.syncRoomInfo(event.roomInfo);
  }

  getPredictedWinRateText(playerId: string | null, lang: Lang = 'en'): string {
    if (!playerId) return lang === 'en' ? 'N/A' : 'N/A';
    const player = this.players[playerId];
    if (!player) return lang === 'en' ? 'N/A' : 'N/A';
    return player.getShantenText(lang);
  }

  syncRoomInfo(roomInfo: Record<string, Partial<RoomPlayer>>): void {
    Object.keys(roomInfo).forEach((pid) => {
      const state = this.ensurePlayer(pid);
      state.updateFromRoomPlayer(roomInfo[pid]);
    });
  }

  ensurePlayer(playerId: string): PlayerState {
    if (!this.players[playerId]) {
      if (!this.playerOrder.includes(playerId)) this.playerOrder.push(playerId);
      this.players[playerId] = new PlayerState(playerId, this.playerOrder.indexOf(playerId) + 1);
    }
    return this.players[playerId];
  }

  getPlayer(playerId: string | null | undefined): PlayerState | null {
    if (!playerId) return null;
    return this.players[playerId] ?? null;
  }

  getActivePlayerId(): string | null {
    const tableIds = this.gameInfo?.tableIds ?? this.playerOrder;
    const optionPos = this.gameInfo?.optionPos;
    if (!Array.isArray(tableIds) || tableIds.length === 0) return null;
    if (typeof optionPos !== 'number' || optionPos < 0 || optionPos >= tableIds.length) return tableIds[0] ?? null;
    return tableIds[optionPos] ?? null;
  }

  buildEventSegments(event: GameEvent, lang: Lang = 'en'): EventSegments {
    const player = this.getPlayer(event?.playerId);
    const activePlayer = this.getPlayer(this.getActivePlayerId());
    const remaining = this.gameInfo?.remainingNum;
    const remainingText = typeof remaining === 'number' ? (lang === 'en' ? ` Tiles remaining: ${remaining}.` : ` 剩余牌 ${remaining} 张。`) : '';
    const remainingCompact = typeof remaining === 'number' ? (lang === 'en' ? `, ${remaining} tiles left` : `，剩余${remaining}张`) : '';

    if (event?.type === 'roomState' || event?.type === 'startGame') {
      const hasHands = this.playerOrder.some((pid) => (this.players[pid]?.handCards?.length ?? 0) > 0);
      if (!hasHands) {
        return { actionLine: '', stateLine: lang === 'en' ? `Table state synced. Waiting for deal.${remainingText}`.trim() : `牌桌状态已同步，等待下一局发牌。${remainingText}`.trim(), analysisPlayer: null };
      }
      const tableSummary = this.playerOrder.map((pid) => {
        const p = this.players[pid];
        if (!p) return null;
        const shanten = p.getShantenText(lang);
        const odds = lang === 'en' ? ` (${shanten})` : `（${shanten}）`;
        return `${p.getCompactState(lang)}${odds}`;
      }).filter(Boolean).join(lang === 'en' ? '; ' : '；');
      if (!tableSummary) return { actionLine: '', stateLine: lang === 'en' ? 'Table state synced.' : '牌桌状态已同步。', analysisPlayer: null };
      return { actionLine: '', stateLine: `${tableSummary}${remainingCompact}.`.trim(), promptStateLine: `${tableSummary}${remainingCompact}.`.trim(), analysisPlayer: null };
    }

    if (!player) {
      const fallback = lang === 'en' ? `State updated after ${event?.type ?? 'the move'}.${remainingText}`.trim() : `${event?.type ?? '当前动作'}后状态已更新。${remainingText}`.trim();
      return { actionLine: '', stateLine: fallback, promptStateLine: fallback, analysisPlayer: null };
    }

    const handSummary = player.getHandSummary(lang);
    const activePlayerSuffix = activePlayer?.hasExposedMelds()
      ? (lang === 'en' ? `; melds: ${activePlayer.getMeldSummary(lang)}` : `；副露为${activePlayer.getMeldSummary(lang)}`)
      : '';

    switch (event?.type) {
      case 'playCard': {
        const winRate = this.getPredictedWinRateText(player.playerId, lang);
        const tileLine = player.getTilePromptLine(lang);
        const promptStateLine = lang === 'en'
          ? `${tileLine} ${winRate}.${remainingText}`.trim()
          : `${tileLine} ${winRate}。${remainingText}`.trim();
        return {
          actionLine: lang === 'en' ? `${player.getLabel(lang)} throws ${utils.cardName(event.data?.cardNum, lang)}.` : `${player.getLabel(lang)}打出${utils.cardName(event.data?.cardNum, lang)}。`,
          stateLine: lang === 'en' ? `${player.getCompactState(lang)}${remainingCompact}. ${winRate}.`.trim() : `现在${player.getLabel(lang)}为${handSummary}${activePlayerSuffix}。${remainingText} ${winRate}`.trim(),
          promptStateLine,
          analysisPlayer: player,
        };
      }
      case 'peng': {
        const winRate = this.getPredictedWinRateText(player.playerId, lang);
        const tileLine = player.getTilePromptLine(lang);
        const promptStateLine = lang === 'en'
          ? `${tileLine} ${winRate}.${remainingText}`.trim()
          : `${tileLine} ${winRate}。${remainingText}`.trim();
        return {
          actionLine: lang === 'en' ? `${player.getLabel(lang)} calls peng on ${utils.cardNames(event.data?.pengArr, lang)}.` : `${player.getLabel(lang)}碰了${utils.cardNames(event.data?.pengArr, lang)}。`,
          stateLine: lang === 'en' ? `${player.getCompactState(lang)}${remainingCompact}. ${winRate}.`.trim() : `现在${player.getLabel(lang)}为${handSummary}；${player.getMeldSummary(lang)}。${remainingText} ${winRate}`.trim(),
          promptStateLine,
          analysisPlayer: player,
        };
      }
      case 'gang': {
        const winRate = this.getPredictedWinRateText(player.playerId, lang);
        const tileLine = player.getTilePromptLine(lang);
        const promptStateLine = lang === 'en'
          ? `${tileLine} ${winRate}.${remainingText}`.trim()
          : `${tileLine} ${winRate}。${remainingText}`.trim();
        return {
          actionLine: lang === 'en' ? `${player.getLabel(lang)} declares gang with ${utils.cardNames(event.data?.gangArr, lang)}.` : `${player.getLabel(lang)}杠了${utils.cardNames(event.data?.gangArr, lang)}。`,
          stateLine: lang === 'en' ? `${player.getCompactState(lang)}${remainingCompact}. ${winRate}.`.trim() : `现在${player.getLabel(lang)}为${handSummary}；${player.getMeldSummary(lang)}。${remainingText} ${winRate}`.trim(),
          promptStateLine,
          analysisPlayer: player,
        };
      }
      case 'win': {
        const winRate = this.getPredictedWinRateText(player.playerId, lang);
        const tileLine = player.getTilePromptLine(lang);
        const promptStateLine = lang === 'en'
          ? `${tileLine} ${winRate}.${remainingText}`.trim()
          : `${tileLine} ${winRate}。${remainingText}`.trim();
        return {
          actionLine: lang === 'en' ? `${player.getLabel(lang)} wins the hand.` : `${player.getLabel(lang)}胡牌。`,
          stateLine: lang === 'en' ? `${player.getCompactState(lang)}${remainingCompact}. ${winRate}.`.trim() : `现在${player.getLabel(lang)}为${handSummary}。${remainingText} ${winRate}`.trim(),
          promptStateLine,
          analysisPlayer: player,
        };
      }
      default: {
        const winRate = this.getPredictedWinRateText(player.playerId, lang);
        const tileLine = player.getTilePromptLine(lang);
        const promptStateLine = lang === 'en'
          ? `${tileLine} ${winRate}.${remainingText}`.trim()
          : `${tileLine} ${winRate}。${remainingText}`.trim();
        return {
          actionLine: lang === 'en' ? `${player.getLabel(lang)} completes ${event?.type ?? 'the move'}.` : `${player.getLabel(lang)}完成${event?.type ?? '当前动作'}。`,
          stateLine: lang === 'en' ? `${player.getCompactState(lang)}${remainingCompact}. ${winRate}.`.trim() : `现在${player.getLabel(lang)}为${handSummary}。${remainingText} ${winRate}`.trim(),
          promptStateLine,
          analysisPlayer: player,
        };
      }
    }
  }

  buildEventStateLine(event: GameEvent, lang: Lang = 'en'): string {
    const { actionLine, stateLine } = this.buildEventSegments(event, lang);
    return [actionLine, stateLine].filter(Boolean).join(' ').trim();
  }
}
