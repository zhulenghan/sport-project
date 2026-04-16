/**
 * Context 管理模块
 * 维护三层 context：基础信息、局势摘要、事件流
 */
const _ = require('./utils');

const EVENT_WINDOW_SIZE = 15;

class Context {
	constructor() {
		this.baseInfo = null;     // Set at game start or inferred from later events
		this.events = [];         // 事件滑动窗口
		this.playerNames = {};    // playerId -> name 映射
		this.playerSeats = {};    // playerId -> seat index
	}

	/**
	 * 开局时初始化基础信息
	 */
	initBaseInfo(roomInfo) {
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

	/**
	 * Best-effort context refresh for out-of-order events.
	 */
	updateFromEvent(event) {
		if (!event?.roomInfo || typeof event.roomInfo !== 'object') return;
		if (!this.baseInfo) {
			this.initBaseInfo(event.roomInfo);
			return;
		}
		Object.keys(event.roomInfo).forEach((id, idx) => {
			if (!this.playerSeats[id]) {
				this.playerSeats[id] = Object.keys(this.playerSeats).length + 1;
			}
			if (!this.playerNames[id]) {
				this.playerNames[id] = event.roomInfo[id].name || `Player ${idx + 1}`;
			}
		});
	}

	/**
	 * 获取玩家名称
	 */
	getPlayerName(playerId) {
		return this.playerNames[playerId] || playerId;
	}

	getPlayerLabel(playerId, lang = 'en') {
		const seat = this.playerSeats[playerId];
		if (seat) {
			return lang === 'en' ? `Player ${seat}` : `玩家${seat}`;
		}
		return this.getPlayerName(playerId);
	}

	/**
	 * 添加事件到滑动窗口
	 */
	addEvent(event, lang = 'en') {
		const desc = this.describeEvent(event, lang);
		this.events.push(desc);
		if (this.events.length > EVENT_WINDOW_SIZE) {
			this.events.shift();
		}
	}

	/**
	 * 将事件转换为可读文本
	 */
	describeEvent(event, lang = 'en') {
		const name = this.getPlayerLabel(event.playerId, lang);
		const isEnglish = lang === 'en';
		switch (event.type) {
			case 'startGame':
				return isEnglish ? 'Game started, tiles dealt.' : '游戏开始，发牌完毕';
			case 'roomState':
				return isEnglish ? 'Commentator joined and synced to the current room state.' : '解说者已加入并同步当前牌局状态。';
			case 'playCard':
				return isEnglish ? `${name} threw ${_.cardName(event.data?.cardNum, lang)}.` : `${name} 打出了 ${_.cardName(event.data?.cardNum, lang)}`;
			case 'peng':
				return isEnglish ? `${name} called peng on ${_.cardNames(event.data?.pengArr, lang)}.` : `${name} 碰了 ${_.cardNames(event.data?.pengArr, lang)}`;
			case 'gang':
				return isEnglish ? `${name} declared gang with ${_.cardNames(event.data?.gangArr, lang)}.` : `${name} 杠了 ${_.cardNames(event.data?.gangArr, lang)}`;
			case 'win':
				return isEnglish ? `${name} won the hand.` : `${name} 胡牌！`;
			default:
				return isEnglish ? `${name} ${event.type}.` : `${name} ${event.type}`;
		}
	}

	buildSpokenLine(event, lang = 'en', stateManager = null) {
		if (stateManager) {
			return stateManager.buildEventStateLine(event, lang);
		}

		const player = this.getPlayerLabel(event.playerId, lang);
		const isEnglish = lang === 'en';
		const playerCount = Object.keys(this.playerSeats).length || 4;
		switch (event.type) {
			case 'roomState':
				return isEnglish
					? 'We are synced to the current table state and ready for the next move.'
					: '已同步当前牌局状态，随时准备解说下一步。';
			case 'startGame':
				return isEnglish
					? `The hand is underway and all ${playerCount} players are settling into their opening shape.`
					: `这一局正式开始，${playerCount}家正在整理起手牌型。`;
			case 'playCard':
				return isEnglish
					? `${player} throws ${_.cardName(event.data?.cardNum, lang)}.`
					: `${player} 打出 ${_.cardName(event.data?.cardNum, lang)}。`;
			case 'peng':
				return isEnglish
					? `${player} calls peng on ${_.cardNames(event.data?.pengArr, lang)}.`
					: `${player} 碰了 ${_.cardNames(event.data?.pengArr, lang)}。`;
			case 'gang':
				return isEnglish
					? `${player} declares gang with ${_.cardNames(event.data?.gangArr, lang)}.`
					: `${player} 杠了 ${_.cardNames(event.data?.gangArr, lang)}。`;
			case 'win':
				return isEnglish
					? `${player} wins the hand.`
					: `${player} 胡牌了。`;
			default:
				return this.describeEvent(event, lang);
		}
	}

	buildFallbackAnalysis(event, lang = 'en') {
		const player = this.getPlayerLabel(event?.playerId, lang);
		const isEnglish = lang === 'en';
		switch (event?.type) {
			case 'playCard':
				return isEnglish
					? `${player} discards ${_.cardName(event?.data?.cardNum, lang)}, keeping the hand flexible.`
					: `${player}打出${_.cardName(event?.data?.cardNum, lang)}，先保持牌型灵活。`;
			case 'peng':
				return isEnglish
					? `${player} takes peng to lock in tempo and contest control of the turn.`
					: `${player}选择碰牌，先把回合节奏抓在手里。`;
			case 'gang':
				return isEnglish
					? `${player} declares gang to increase pressure and improve scoring upside.`
					: `${player}开杠提升番型，同时继续给牌桌施压。`;
			case 'win':
				return isEnglish
					? `${player} converts the setup cleanly and closes the hand.`
					: `${player}顺势成和，稳稳收下这一局。`;
			default:
				return '';
		}
	}

	finalizeCommentary(event, text, lang = 'en', fallbackText = null) {
		const fallback = fallbackText ?? this.buildSpokenLine(event, lang);
		if (!text) {
			return fallback;
		}

		const normalized = text.replace(/\s+/g, ' ').trim();
		if (!normalized) {
			return fallback;
		}

		const hasEndingPunctuation = lang === 'en'
			? /[.!?]["']?$/.test(normalized)
			: /[。！？.!?]["']?$/.test(normalized);

		if (!hasEndingPunctuation) {
			return fallback;
		}

		return normalized;
	}

	finalizeAnalysis(text, lang = 'en', fallbackText = '') {
		const fallback = fallbackText ?? '';
		if (!text) {
			return fallback;
		}

		const normalized = text
			.replace(/\s+/g, ' ')
			.replace(/^["'\s]+|["'\s]+$/g, '')
			.trim();

		if (!normalized) {
			return fallback;
		}
		return normalized;
	}

	combineCommentary(primary, secondary, lang = 'en') {
		const normalizedPrimary = (primary || '').replace(/\s+/g, ' ').trim();
		if (!secondary) return normalizedPrimary;

		const normalizedSecondary = secondary.replace(/\s+/g, ' ').trim();
		if (!normalizedSecondary) return normalizedPrimary;
		if (!normalizedPrimary) return normalizedSecondary;

		if (normalizedPrimary.toLowerCase() === normalizedSecondary.toLowerCase()) {
			return normalizedPrimary;
		}

		return lang === 'en'
			? `${normalizedPrimary} ${normalizedSecondary}`
			: `${normalizedPrimary}${normalizedSecondary}`;
	}

	/**
	 * 从 roomInfo 构建局势摘要（上帝视角，包含所有手牌）
	 */
	buildSnapshot(roomInfo, gameInfo, lang = 'en') {
		const remaining = gameInfo?.remainingNum ?? '?';
		const isEnglish = lang === 'en';
		const lines = [isEnglish ? `Tiles remaining: ${remaining}` : `剩余牌: ${remaining}张`];

		Object.keys(roomInfo).forEach(playerId => {
			const p = roomInfo[playerId];
			const label = this.getPlayerLabel(playerId, lang);
			const actualName = this.getPlayerName(playerId);
			const displayName = actualName && actualName !== label ? `${label} (${actualName})` : label;
			const handCards = _.cardNames(p.handCards || [], lang);
			const pengCards = isEnglish
				? `Peng[${_.cardNames(p.pengCards || [], lang)}]`
				: `碰[${_.cardNames(p.pengCards || [], lang)}]`;
			const gangCards = isEnglish
				? `Gang[${_.cardNames(p.gangCards || [], lang)}]`
				: `杠[${_.cardNames(p.gangCards || [], lang)}]`;
			const playedCards = isEnglish
				? `Discards[${_.cardNames(p.playedCards || [], lang)}]`
				: `已出[${_.cardNames(p.playedCards || [], lang)}]`;
			const handLabel = isEnglish ? 'Hand' : '手牌';
			lines.push(`${displayName}: ${handLabel}[${handCards}] ${pengCards} ${gangCards} ${playedCards}`);
		});

		return lines.join('\n');
	}

	/**
	 * 构建完整 prompt
	 */
	buildPrompt(event, lang, stateManager = null, segments = {}) {
		const actionLine = segments.actionLine || '(None)';
		const stateLine = segments.promptStateLine || segments.stateLine || '(None)';

		if (lang === 'en') {
			return {
				system: `You are a live Mahjong commentator.
Write exactly 1 short English sentence (max 16 words).
Be vivid and specific.`,
				user: `[Primary Focus]
React mainly to the player making the move in the action line.

[Action Line Already Spoken]
${actionLine}

[Upcoming State Line]
${stateLine}

Write exactly 1 short sentence.
Do not repeat either line verbatim.`
			};
		}

		return {
			system: `你是一位很有感染力的麻将直播解说员。请写1到2句简短但有力的中文解说。第一重点永远是动作句里的出手玩家，后续状态句只用来补充说明这一步之后的局面。先说这位玩家这一手透露了什么，再视情况带到后续局面。不要重复动作句原文，也不要照抄后面的状态句。`,
			user: `[第一重点]
请主要解说动作句里的出手玩家。

[已播报动作句]
${actionLine}

[后续状态句]
${stateLine}

请只输出夹在动作句和状态句之间的解说段落。`
		};
	}
}

module.exports = Context;
