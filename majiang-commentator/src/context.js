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
	}

	/**
	 * 开局时初始化基础信息
	 */
	initBaseInfo(roomInfo) {
		const players = Object.keys(roomInfo);
		this.playerNames = {};
		players.forEach((id, idx) => {
			const name = roomInfo[id].name || `Player ${idx + 1}`;
			this.playerNames[id] = name;
		});
		this.baseInfo = {
			zh: `${players.length}人局，玩家：${Object.values(this.playerNames).join('、')}`,
			en: `${players.length}-player table. Players: ${Object.values(this.playerNames).join(', ')}`,
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
		const name = this.getPlayerName(event.playerId);
		const isEnglish = lang === 'en';
		switch (event.type) {
			case 'startGame':
				return isEnglish ? 'Game started, tiles dealt.' : '游戏开始，发牌完毕';
			case 'roomState':
				return isEnglish ? 'Commentator joined and synced to the current room state.' : '解说者已加入并同步当前牌局状态。';
			case 'playCard':
				return isEnglish ? `${name} played ${_.cardName(event.data?.cardNum)}.` : `${name} 打出了 ${_.cardName(event.data?.cardNum)}`;
			case 'peng':
				return isEnglish ? `${name} called peng on ${_.cardNames(event.data?.pengArr)}.` : `${name} 碰了 ${_.cardNames(event.data?.pengArr)}`;
			case 'gang':
				return isEnglish ? `${name} declared gang with ${_.cardNames(event.data?.gangArr)}.` : `${name} 杠了 ${_.cardNames(event.data?.gangArr)}`;
			case 'win':
				return isEnglish ? `${name} won the hand.` : `${name} 胡牌！`;
			default:
				return isEnglish ? `${name} ${event.type}.` : `${name} ${event.type}`;
		}
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
			const name = this.getPlayerName(playerId);
			const handCards = _.cardNames(p.handCards || []);
			const pengCards = isEnglish
				? `Peng[${_.cardNames(p.pengCards || [])}]`
				: `碰[${_.cardNames(p.pengCards || [])}]`;
			const gangCards = isEnglish
				? `Gang[${_.cardNames(p.gangCards || [])}]`
				: `杠[${_.cardNames(p.gangCards || [])}]`;
			const playedCards = isEnglish
				? `Discards[${_.cardNames(p.playedCards || [])}]`
				: `已出[${_.cardNames(p.playedCards || [])}]`;
			const handLabel = isEnglish ? 'Hand' : '手牌';
			lines.push(`${name}: ${handLabel}[${handCards}] ${pengCards} ${gangCards} ${playedCards}`);
		});

		return lines.join('\n');
	}

	/**
	 * 构建完整 prompt
	 */
	buildPrompt(event, lang) {
		const snapshot = this.buildSnapshot(event.roomInfo || {}, event.gameInfo || {}, lang);
		const currentEvent = this.describeEvent(event, lang);
		const baseInfo = this.baseInfo?.[lang] || (lang === 'en' ? 'Match info is partial because the game-start event was not observed.' : '由于未观测到开局事件，对局信息不完整。');
		const recentEvents = this.events.length > 0
			? this.events.map((e, i) => `${i + 1}. ${e}`).join('\n')
			: (lang === 'en' ? '(No prior events captured.)' : '（尚无历史事件）');

		if (lang === 'en') {
			return {
				system: `You are a professional Mahjong commentator with a god-view perspective. You can see all players' hands. Be concise, witty, and insightful. Respond in 1-2 sentences. Analyze strategy and game flow.`,
				user: `[Match Info]\n${baseInfo}\n\n[Current State]\n${snapshot}\n\n[Recent Events]\n${recentEvents}\n\n[Current Event]\n${currentEvent}\n\nCommentate on this move. If context is partial, still provide the best live reaction possible.`
			};
		}

		return {
			system: `你是一位专业的麻将解说员，拥有上帝视角，能看到所有玩家的手牌。风格幽默生动，言简意赅。请用1-2句话解说当前这一步，可以分析牌局走势和玩家策略。`,
			user: `[对局信息]\n${baseInfo}\n\n[当前局势]\n${snapshot}\n\n[最近事件]\n${recentEvents}\n\n[当前事件]\n${currentEvent}\n\n请解说这一步。如果上下文不完整，也请基于当前事件给出即时解说。`
		};
	}
}

module.exports = Context;
