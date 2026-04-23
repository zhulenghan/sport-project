import * as utils from './utils';
import { getShantenNumber } from './shanten';
import type { GameEvent, Lang, LLMPrompt, RoomPlayer, EventFact, GameSnapshot } from './types';
import type { StateManager } from './state-manager';
import type { Summarizer } from './summarizer';

const WINDOW_SIZE      = 10;
const SUMMARY_INTERVAL = 8;

export class Context {
  private baseInfo: { zh: string; en: string } | null = null;
  private playerNames: Record<string, string> = {};
  private playerSeats: Record<string, number> = {};
  private snapshot: GameSnapshot = {
    moveCount: 0,
    allMoves: [],
    recentMoves: [],
    narrativeSummary: '',
    summaryUpToMove: 0,
  };

  initBaseInfo(roomInfo: Record<string, RoomPlayer>): void {
    const players = Object.keys(roomInfo);
    this.playerNames = {};
    this.playerSeats = {};
    players.forEach((id, idx) => {
      const name = roomInfo[id].name || `Player ${idx + 1}`;
      this.playerNames[id] = name;
      this.playerSeats[id] = idx + 1;
    });
    this.baseInfo = {
      zh: `${players.length}人局，座次：${players.map((id) => this.getPlayerLabel(id, 'zh')).join('、')}`,
      en: `${players.length}-player table. Seats: ${players.map((id) => this.getPlayerLabel(id, 'en')).join(', ')}`,
    };
    this.snapshot = { moveCount: 0, allMoves: [], recentMoves: [], narrativeSummary: '', summaryUpToMove: 0 };
  }

  updateFromEvent(event: GameEvent): void {
    if (!event?.roomInfo || typeof event.roomInfo !== 'object') return;
    if (!this.baseInfo) {
      this.initBaseInfo(event.roomInfo);
      return;
    }
    Object.keys(event.roomInfo).forEach((id, idx) => {
      if (!this.playerSeats[id]) this.playerSeats[id] = Object.keys(this.playerSeats).length + 1;
      if (!this.playerNames[id]) this.playerNames[id] = event.roomInfo[id].name || `Player ${idx + 1}`;
    });
  }

  getPlayerName(playerId: string): string {
    return this.playerNames[playerId] || playerId;
  }

  getPlayerLabel(playerId: string, _lang: Lang = 'en'): string {
    if (this.playerNames[playerId]) return this.playerNames[playerId];
    const seat = this.playerSeats[playerId];
    if (seat) return `Player ${seat}`;
    return playerId;
  }

  addEvent(event: GameEvent, lang: Lang = 'en'): void {
    const fact = this.extractEventFact(event, lang);
    this.snapshot.allMoves.push(fact);
    this.snapshot.recentMoves.push(fact);
    if (this.snapshot.recentMoves.length > WINDOW_SIZE) this.snapshot.recentMoves.shift();
    this.snapshot.moveCount = fact.moveIndex;
  }

  extractEventFact(event: GameEvent, lang: Lang = 'en'): EventFact {
    const moveIndex = this.snapshot.allMoves.length + 1;
    const playerLabel = this.getPlayerLabel(event.playerId ?? '', lang);
    const description = this.describeEvent(event, lang);

    const roomPlayer = event.playerId ? event.roomInfo?.[event.playerId] : null;
    const handCards: number[] = roomPlayer?.handCards ?? [];
    const pengCount = Math.floor((roomPlayer?.pengCards?.length ?? 0) / 3);
    const gangCount = Math.floor((roomPlayer?.gangCards?.length ?? 0) / 4);
    const openMelds = pengCount + gangCount;
    const actorShantenAfter = handCards.length > 0 ? getShantenNumber(handCards, openMelds) : -1;
    const remainingTiles = event.gameInfo?.remainingNum ?? 0;

    return { moveIndex, type: event.type, playerLabel, description, actorShantenAfter, remainingTiles };
  }

  describeEvent(event: GameEvent, lang: Lang = 'en'): string {
    const isEn = lang === 'en';
    switch (event.type) {
      case 'startGame': return isEn ? 'Game started, tiles dealt.' : '游戏开始，发牌完毕';
      case 'roomState': return isEn ? 'Commentator joined and synced.' : '解说者已加入并同步当前牌局状态。';
      case 'playCard': return isEn ? `discards ${utils.cardName(event.data?.cardNum, lang)}.` : `打出了${utils.cardName(event.data?.cardNum, lang)}`;
      case 'peng': return isEn ? `calls peng on ${utils.cardNames(event.data?.pengArr, lang)}.` : `碰了${utils.cardNames(event.data?.pengArr, lang)}`;
      case 'gang': return isEn ? `declares gang with ${utils.cardNames(event.data?.gangArr, lang)}.` : `杠了${utils.cardNames(event.data?.gangArr, lang)}`;
      case 'win': return isEn ? `wins the hand.` : `胡牌！`;
      default: return isEn ? `${event.type}.` : `${event.type}`;
    }
  }

  getSnapshot(): GameSnapshot {
    return this.snapshot;
  }

  maybeRefreshSummary(
    summarizer: Summarizer,
    lang: Lang = 'en',
    onStart?: () => void,
    onDone?: () => void,
  ): void {
    const { moveCount, summaryUpToMove, allMoves } = this.snapshot;
    if (summarizer.isBusy) return;
    if (moveCount - summaryUpToMove < SUMMARY_INTERVAL) return;

    const factsToSummarize = [...allMoves];
    const targetMove = moveCount;

    onStart?.();
    summarizer.summarize(factsToSummarize, lang).then((summary) => {
      if (summary) {
        this.snapshot.narrativeSummary = summary;
        this.snapshot.summaryUpToMove = targetMove;
      }
      onDone?.();
    });
  }

  buildSpokenLine(event: GameEvent, lang: Lang = 'en', stateManager: StateManager | null = null): string {
    if (stateManager) return stateManager.buildEventStateLine(event, lang);
    const player = this.getPlayerLabel(event.playerId ?? '', lang);
    const isEn = lang === 'en';
    const playerCount = Object.keys(this.playerSeats).length || 4;
    switch (event.type) {
      case 'roomState': return isEn ? 'Synced to current table state.' : '已同步当前牌局状态，随时准备解说下一步。';
      case 'startGame': return isEn ? `The hand is underway — ${playerCount} players settling in.` : `这一局正式开始，${playerCount}家正在整理起手牌型。`;
      case 'playCard': return isEn ? `${player} throws ${utils.cardName(event.data?.cardNum, lang)}.` : `${player} 打出 ${utils.cardName(event.data?.cardNum, lang)}。`;
      case 'peng': return isEn ? `${player} calls peng on ${utils.cardNames(event.data?.pengArr, lang)}.` : `${player} 碰了 ${utils.cardNames(event.data?.pengArr, lang)}。`;
      case 'gang': return isEn ? `${player} declares gang with ${utils.cardNames(event.data?.gangArr, lang)}.` : `${player} 杠了 ${utils.cardNames(event.data?.gangArr, lang)}。`;
      case 'win': return isEn ? `${player} wins the hand.` : `${player} 胡牌了。`;
      default: return `${player} ${this.describeEvent(event, lang)}`;
    }
  }

  buildFallbackAnalysis(event: GameEvent, lang: Lang = 'en'): string {
    const player = this.getPlayerLabel(event?.playerId ?? '', lang);
    const isEn = lang === 'en';
    switch (event?.type) {
      case 'playCard': return isEn ? `${player} discards ${utils.cardName(event?.data?.cardNum, lang)}, keeping the hand flexible.` : `${player}打出${utils.cardName(event?.data?.cardNum, lang)}，先保持牌型灵活。`;
      case 'peng': return isEn ? `${player} takes peng to lock in tempo.` : `${player}选择碰牌，先把回合节奏抓在手里。`;
      case 'gang': return isEn ? `${player} declares gang to increase pressure.` : `${player}开杠提升番型，同时继续给牌桌施压。`;
      case 'win': return isEn ? `${player} converts the setup cleanly.` : `${player}顺势成和，稳稳收下这一局。`;
      default: return '';
    }
  }

  finalizeAnalysis(text: string | null, lang: Lang = 'en', fallback = ''): string {
    if (!text) return fallback;
    const normalized = text.replace(/\s+/g, ' ').replace(/^["'\s]+|["'\s]+$/g, '').trim();
    return normalized || fallback;
  }

  buildPrompt(event: GameEvent, lang: Lang, stateManager: StateManager | null = null, segments: { actionLine?: string; promptStateLine?: string; stateLine?: string } = {}): LLMPrompt {
    const actionLine = segments.actionLine || '(None)';
    const stateLine = segments.promptStateLine || segments.stateLine || '(None)';
    const { narrativeSummary, summaryUpToMove, recentMoves, moveCount } = this.snapshot;

    if (lang === 'zh') {
      const part1 = narrativeSummary
        ? `[叙事摘要（前${summaryUpToMove}步）]\n${narrativeSummary}`
        : '[叙事摘要]\n（对局刚开始，暂无摘要）';

      const part2 = recentMoves.length > 0
        ? `[最近${recentMoves.length}步]\n${recentMoves.map(formatFactLineZh).join('\n')}`
        : '[最近步骤]\n（暂无历史步骤）';

      const part3 = `[当前动作（第${moveCount}步）]\n${actionLine}\n\n[出牌后局面]\n${stateLine}`;

      return {
        system: `你是有二十年经验的职业麻将解说员，曾解说过世界级比赛。请用你的专业判断写一句不超过20字的解说。不要重复动作句的字面内容。

选择最有料的角度，二选一：
A) 解读这步棋的战略意图
B) 点评当前手牌的整体态势与机会

示例A："李明忍住五条搭子拆掉九万，显然在为断幺路线让路，向听降至1。"
示例B："Dean手牌两面搭子齐整，清一色边缘已成，只差一张六万或八万即可听牌。"`,
        user: `${part1}\n\n${part2}\n\n${part3}\n\n请只输出解说句，不加任何标签或说明。`,
      };
    }

    const part1 = narrativeSummary
      ? `[Narrative summary (moves 1–${summaryUpToMove})]\n${narrativeSummary}`
      : '[Narrative summary]\n(Hand just started, no summary yet.)';

    const part2 = recentMoves.length > 0
      ? `[Last ${recentMoves.length} moves]\n${recentMoves.map(formatFactLineEn).join('\n')}`
      : '[Recent moves]\n(No history yet.)';

    const part3 = `[Current action (move ${moveCount})]\n${actionLine}\n\n[Hand state after discard]\n${stateLine}`;

    return {
      system: `You are a professional Mahjong commentator with decades of top-level tournament experience. Write ONE sentence, max 14 words. Do not restate the action verbatim.

Choose whichever angle has more insight — pick one:
A) Read the strategic intent behind this specific move
B) Assess the current hand shape and its opportunity

Example A: "Dean holds the 5-dot pair over the 9-character, signaling a clear push toward tenpai on the bamboo side."
Example B: "li's hand is one tile away from tenpai — two-sided wait on the 4 and 7-bamboo, with 38 tiles left."`,
      user: `${part1}\n\n${part2}\n\n${part3}\n\nOutput only the commentary sentence, no labels or explanation.`,
    };
  }
}

function formatFactLineEn(fact: EventFact): string {
  return `#${fact.moveIndex} ${fact.playerLabel} ${fact.description} | shanten:${fact.actorShantenAfter} | remaining:${fact.remainingTiles}`;
}

function formatFactLineZh(fact: EventFact): string {
  return `#${fact.moveIndex} ${fact.playerLabel} ${fact.description} | 向听:${fact.actorShantenAfter} | 剩余:${fact.remainingTiles}张`;
}
