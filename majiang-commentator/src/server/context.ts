import * as utils from './utils';
import type { GameEvent, Lang, LLMPrompt, RoomPlayer } from './types';
import type { StateManager } from './state-manager';

const EVENT_WINDOW_SIZE = 15;

export class Context {
  private baseInfo: { zh: string; en: string } | null = null;
  private events: string[] = [];
  private playerNames: Record<string, string> = {};
  private playerSeats: Record<string, number> = {};

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
    this.events = [];
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

  getPlayerLabel(playerId: string, lang: Lang = 'en'): string {
    const seat = this.playerSeats[playerId];
    if (seat) return lang === 'en' ? `Player ${seat}` : `玩家${seat}`;
    return this.getPlayerName(playerId);
  }

  addEvent(event: GameEvent, lang: Lang = 'en'): void {
    this.events.push(this.describeEvent(event, lang));
    if (this.events.length > EVENT_WINDOW_SIZE) this.events.shift();
  }

  describeEvent(event: GameEvent, lang: Lang = 'en'): string {
    const name = this.getPlayerLabel(event.playerId ?? '', lang);
    const isEn = lang === 'en';
    switch (event.type) {
      case 'startGame': return isEn ? 'Game started, tiles dealt.' : '游戏开始，发牌完毕';
      case 'roomState': return isEn ? 'Commentator joined and synced.' : '解说者已加入并同步当前牌局状态。';
      case 'playCard': return isEn ? `${name} threw ${utils.cardName(event.data?.cardNum, lang)}.` : `${name} 打出了 ${utils.cardName(event.data?.cardNum, lang)}`;
      case 'peng': return isEn ? `${name} called peng on ${utils.cardNames(event.data?.pengArr, lang)}.` : `${name} 碰了 ${utils.cardNames(event.data?.pengArr, lang)}`;
      case 'gang': return isEn ? `${name} declared gang with ${utils.cardNames(event.data?.gangArr, lang)}.` : `${name} 杠了 ${utils.cardNames(event.data?.gangArr, lang)}`;
      case 'win': return isEn ? `${name} won the hand.` : `${name} 胡牌！`;
      default: return isEn ? `${name} ${event.type}.` : `${name} ${event.type}`;
    }
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
      default: return this.describeEvent(event, lang);
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

    if (lang === 'en') {
      return {
        system: 'You are a live Mahjong commentator.\nWrite exactly 1 short English sentence (max 16 words).\nBe vivid and specific.',
        user: `[Primary Focus]\nReact mainly to the player making the move in the action line.\n\n[Action Line Already Spoken]\n${actionLine}\n\n[Upcoming State Line]\n${stateLine}\n\nWrite exactly 1 short sentence.\nDo not repeat either line verbatim.`,
      };
    }

    return {
      system: '你是一位很有感染力的麻将直播解说员。请写1到2句简短但有力的中文解说。第一重点永远是动作句里的出手玩家，后续状态句只用来补充说明这一步之后的局面。先说这位玩家这一手透露了什么，再视情况带到后续局面。不要重复动作句原文，也不要照抄后面的状态句。',
      user: `[第一重点]\n请主要解说动作句里的出手玩家。\n\n[已播报动作句]\n${actionLine}\n\n[后续状态句]\n${stateLine}\n\n请只输出夹在动作句和状态句之间的解说段落。`,
    };
  }
}
