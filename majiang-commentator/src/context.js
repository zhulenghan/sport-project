/**
 * Context 管理模块
 * 维护三层 context：基础信息、局势摘要、事件流
 */
const _ = require('./utils');

const EVENT_WINDOW_SIZE = 15;

class Context {
	constructor() {
		this.baseInfo = null;     // 开局时设定
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
			const name = roomInfo[id].name || `玩家${idx + 1}`;
			this.playerNames[id] = name;
		});
		this.baseInfo = `${players.length}人局，玩家：${Object.values(this.playerNames).join('、')}`;
		this.events = [];
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
	addEvent(event) {
		const desc = this.describeEvent(event);
		this.events.push(desc);
		if (this.events.length > EVENT_WINDOW_SIZE) {
			this.events.shift();
		}
	}

	/**
	 * 将事件转换为可读文本
	 */
	describeEvent(event) {
		const name = this.getPlayerName(event.playerId);
		switch (event.type) {
			case 'startGame':
				return '游戏开始，发牌完毕';
			case 'playCard':
				return `${name} 打出了 ${_.cardName(event.data?.cardNum)}`;
			case 'peng':
				return `${name} 碰了 ${_.cardNames(event.data?.pengArr)}`;
			case 'gang':
				return `${name} 杠了 ${_.cardNames(event.data?.gangArr)}`;
			case 'win':
				return `${name} 胡牌！`;
			default:
				return `${name} ${event.type}`;
		}
	}

	/**
	 * 从 roomInfo 构建局势摘要（上帝视角，包含所有手牌）
	 */
	buildSnapshot(roomInfo, gameInfo) {
		const remaining = gameInfo?.remainingNum ?? '?';
		const lines = [`剩余牌: ${remaining}张`];

		Object.keys(roomInfo).forEach(playerId => {
			const p = roomInfo[playerId];
			const name = this.getPlayerName(playerId);
			const handCards = _.cardNames(p.handCards || []);
			const pengCards = p.pengCards ? `碰[${_.cardNames(p.pengCards)}]` : '碰[]';
			const gangCards = p.gangCards ? `杠[${_.cardNames(p.gangCards)}]` : '杠[]';
			const playedCards = `已出[${_.cardNames(p.playedCards || [])}]`;
			lines.push(`${name}: 手牌[${handCards}] ${pengCards} ${gangCards} ${playedCards}`);
		});

		return lines.join('\n');
	}

	/**
	 * 构建完整 prompt
	 */
	buildPrompt(event, lang) {
		const snapshot = this.buildSnapshot(event.roomInfo || {}, event.gameInfo || {});
		const currentEvent = this.describeEvent(event);
		const recentEvents = this.events.length > 0
			? this.events.map((e, i) => `${i + 1}. ${e}`).join('\n')
			: '（刚开局）';

		if (lang === 'en') {
			return {
				system: `You are a professional Mahjong commentator with a god-view perspective. You can see all players' hands. Be concise, witty, and insightful. Respond in 1-2 sentences. Analyze strategy and game flow.`,
				user: `[Match Info]\n${this.baseInfo}\n\n[Current State]\n${snapshot}\n\n[Recent Events]\n${recentEvents}\n\n[Current Event]\n${currentEvent}\n\nCommentate on this move.`
			};
		}

		return {
			system: `你是一位专业的麻将解说员，拥有上帝视角，能看到所有玩家的手牌。风格幽默生动，言简意赅。请用1-2句话解说当前这一步，可以分析牌局走势和玩家策略。`,
			user: `[对局信息]\n${this.baseInfo}\n\n[当前局势]\n${snapshot}\n\n[最近事件]\n${recentEvents}\n\n[当前事件]\n${currentEvent}\n\n请解说这一步。`
		};
	}
}

module.exports = Context;
