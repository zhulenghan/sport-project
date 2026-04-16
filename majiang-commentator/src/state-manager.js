const _ = require('./utils');

class PlayerState {
	constructor(playerId, seat) {
		this.playerId = playerId;
		this.seat = seat;
		this.name = null;
		this.handCards = [];
		this.playedCards = [];
		this.pengCards = [];
		this.gangCards = [];
	}

	updateFromRoomPlayer(roomPlayer = {}) {
		this.name = roomPlayer.name || this.name || `Player ${this.seat}`;
		this.handCards = _.sortCards(roomPlayer.handCards || []);
		this.playedCards = _.sortCards(roomPlayer.playedCards || []);
		this.pengCards = _.sortCards(roomPlayer.pengCards || []);
		this.gangCards = _.sortCards(roomPlayer.gangCards || []);
	}

	getLabel(lang = 'en') {
		return lang === 'en' ? `Player ${this.seat}` : `玩家${this.seat}`;
	}

	getHandSummary(lang = 'en') {
		const prefix = lang === 'en'
			? `${this.handCards.length}-tile hand`
			: `${this.handCards.length}张手牌`;
		return `${prefix}: ${_.cardCountSummary(this.handCards, lang)}`;
	}

	getMeldSummary(lang = 'en') {
		const parts = [];
		if (this.pengCards.length > 0) {
			parts.push(lang === 'en'
				? `peng ${_.cardCountSummary(this.pengCards, lang)}`
				: `碰牌 ${_.cardCountSummary(this.pengCards, lang)}`);
		}
		if (this.gangCards.length > 0) {
			parts.push(lang === 'en'
				? `gang ${_.cardCountSummary(this.gangCards, lang)}`
				: `杠牌 ${_.cardCountSummary(this.gangCards, lang)}`);
		}
		if (parts.length === 0) {
			return lang === 'en' ? 'no exposed melds' : '暂无副露';
		}
		return parts.join(lang === 'en' ? '; ' : '；');
	}

	getDiscardsSummary(lang = 'en') {
		const prefix = lang === 'en' ? 'discards' : '弃牌';
		return `${prefix}: ${_.cardCountSummary(this.playedCards, lang)}`;
	}

	getPromptSummary(lang = 'en') {
		return `${this.getLabel(lang)} (${this.name || this.getLabel(lang)}): ${this.getHandSummary(lang)}; ${this.getMeldSummary(lang)}; ${this.getDiscardsSummary(lang)}`;
	}

	getPengSetCount() {
		return Math.floor((this.pengCards?.length || 0) / 3);
	}

	getGangSetCount() {
		return Math.floor((this.gangCards?.length || 0) / 4);
	}

	getCompactState(lang = 'en') {
		if (lang === 'en') {
			return `${this.getLabel(lang)} hand ${this.handCards.length}, peng ${this.getPengSetCount()}, gang ${this.getGangSetCount()}`;
		}
		return `${this.getLabel(lang)}手牌${this.handCards.length}张，碰${this.getPengSetCount()}，杠${this.getGangSetCount()}`;
	}

	hasExposedMelds() {
		return this.pengCards.length > 0 || this.gangCards.length > 0;
	}

	buildCountMap(cards) {
		const counts = new Map();
		(cards || []).forEach((num) => {
			const normalized = _.normalizeCard(num);
			counts.set(normalized, (counts.get(normalized) || 0) + 1);
		});
		return counts;
	}

	getGroupedMeldsFromCards(cards, groupSize) {
		const counts = this.buildCountMap(cards);
		return Array.from(counts.entries())
			.filter(([, count]) => count >= groupSize)
			.map(([normalized]) => Array(groupSize).fill(normalized))
			.sort((a, b) => _.normalizeCard(a[0]) - _.normalizeCard(b[0]));
	}

	getOpenMeldGroups() {
		return [
			...this.getGroupedMeldsFromCards(this.pengCards, 3),
			...this.getGroupedMeldsFromCards(this.gangCards, 4),
		];
	}

	findBestClosedMeldGroups(cards = this.handCards) {
		const counts = this.buildCountMap(cards);
		const memo = new Map();

		const serialize = (countMap) => Array.from(countMap.entries())
			.filter(([, count]) => count > 0)
			.sort((a, b) => a[0] - b[0])
			.map(([tile, count]) => `${tile}:${count}`)
			.join('|');

		const cloneCounts = (countMap) => new Map(countMap);

		const search = (countMap) => {
			const key = serialize(countMap);
			if (memo.has(key)) return memo.get(key);

			let firstTile = null;
			for (const [tile, count] of countMap.entries()) {
				if (count > 0) {
					firstTile = tile;
					break;
				}
			}

			if (firstTile == null) {
				const result = [];
				memo.set(key, result);
				return result;
			}

			let best = [];

			const withoutTile = cloneCounts(countMap);
			withoutTile.set(firstTile, (withoutTile.get(firstTile) || 0) - 1);
			best = search(withoutTile);

			if ((countMap.get(firstTile) || 0) >= 3) {
				const nextCounts = cloneCounts(countMap);
				nextCounts.set(firstTile, nextCounts.get(firstTile) - 3);
				const option = [[firstTile, firstTile, firstTile], ...search(nextCounts)];
				if (option.length > best.length) {
					best = option;
				}
			}

			if ((countMap.get(firstTile) || 0) >= 4) {
				const nextCounts = cloneCounts(countMap);
				nextCounts.set(firstTile, nextCounts.get(firstTile) - 4);
				const option = [[firstTile, firstTile, firstTile, firstTile], ...search(nextCounts)];
				if (
					option.length > best.length ||
					(option.length === best.length && option.flat().length > best.flat().length)
				) {
					best = option;
				}
			}

			const suit = _.getCardSuit(firstTile);
			const face = _.getCardFace(firstTile);
			const second = suit != null && face <= 7 ? firstTile + 1 : null;
			const third = suit != null && face <= 7 ? firstTile + 2 : null;
			if (
				second != null &&
				third != null &&
				_.getCardSuit(second) === suit &&
				_.getCardSuit(third) === suit &&
				(countMap.get(second) || 0) > 0 &&
				(countMap.get(third) || 0) > 0
			) {
				const nextCounts = cloneCounts(countMap);
				nextCounts.set(firstTile, nextCounts.get(firstTile) - 1);
				nextCounts.set(second, nextCounts.get(second) - 1);
				nextCounts.set(third, nextCounts.get(third) - 1);
				const option = [[firstTile, second, third], ...search(nextCounts)];
				if (option.length > best.length) {
					best = option;
				}
			}

			memo.set(key, best);
			return best;
		};

		return search(counts).sort((a, b) => _.normalizeCard(a[0]) - _.normalizeCard(b[0]));
	}

	getAllMeldGroups() {
		return [...this.getOpenMeldGroups(), ...this.findBestClosedMeldGroups()];
	}

	getNamedMeldGroups(lang = 'en') {
		return this.getAllMeldGroups().map((group) => group.map((tile) => _.cardName(tile, lang)));
	}

	getMeldAnalysis(lang = 'en') {
		const meldGroups = this.getAllMeldGroups();
		const namedGroups = meldGroups.map((group) => _.formatMeldGroup(group, lang));
		return {
			count: meldGroups.length,
			groups: meldGroups,
			namedGroups,
		};
	}

	getMeldReadSummary(lang = 'en') {
		const analysis = this.getMeldAnalysis(lang);
		if (analysis.count === 0) {
			return lang === 'en' ? 'Meld read: no complete melds yet.' : '面子判断：暂时还没有完整面子。';
		}
		return lang === 'en'
			? `Meld read: ${analysis.count} meld${analysis.count === 1 ? '' : 's'} ${analysis.namedGroups.join(', ')}.`
			: `面子判断：共${analysis.count}组，${analysis.namedGroups.join('、')}。`;
	}

	getPotentialPairCount() {
		return Array.from(this.buildCountMap(this.handCards).values()).filter((count) => count >= 2).length;
	}
}

class StateManager {
	constructor() {
		this.players = {};
		this.playerOrder = [];
		this.gameInfo = {};
		this.roomId = null;
	}

	updateFromEvent(event) {
		if (!event || typeof event !== 'object') return;
		if (event.roomId) this.roomId = event.roomId;
		if (event.gameInfo && typeof event.gameInfo === 'object') {
			this.gameInfo = { ...event.gameInfo };
		}
		if (event.roomInfo && typeof event.roomInfo === 'object') {
			this.syncRoomInfo(event.roomInfo);
		}
	}

	getPredictionScores() {
		const scores = {};
		this.playerOrder.forEach((playerId) => {
			const player = this.players[playerId];
			if (!player || (player.handCards?.length || 0) === 0) return;
			const melds = player.getMeldAnalysis('en').count;
			const pairs = player.getPotentialPairCount();
			const exposed = player.getPengSetCount() + player.getGangSetCount();
			const nearWinBonus = (player.handCards.length % 3 === 2) ? 1 : 0;
			const score = 1 + melds * 3 + pairs * 1.5 + exposed * 2 + nearWinBonus;
			scores[playerId] = score;
		});
		return scores;
	}

	getPredictedWinRateText(playerId, lang = 'en') {
		const scores = this.getPredictionScores();
		const total = Object.values(scores).reduce((sum, val) => sum + val, 0);
		if (!playerId || total <= 0 || !scores[playerId]) {
			return lang === 'en' ? 'Pred win N/A' : '预测胜率 N/A';
		}
		const rate = ((scores[playerId] / total) * 100).toFixed(1);
		return lang === 'en'
			? `Pred win ${rate}%`
			: `预测胜率 ${rate}%`;
	}

	syncRoomInfo(roomInfo) {
		Object.keys(roomInfo).forEach((playerId) => {
			const state = this.ensurePlayer(playerId);
			state.updateFromRoomPlayer(roomInfo[playerId]);
		});
	}

	ensurePlayer(playerId) {
		if (!this.players[playerId]) {
			if (!this.playerOrder.includes(playerId)) {
				this.playerOrder.push(playerId);
			}
			this.players[playerId] = new PlayerState(playerId, this.playerOrder.indexOf(playerId) + 1);
		}
		return this.players[playerId];
	}

	getPlayer(playerId) {
		if (!playerId) return null;
		return this.players[playerId] || null;
	}

	getPlayerLabel(playerId, lang = 'en') {
		const player = this.getPlayer(playerId);
		if (!player) return playerId || (lang === 'en' ? 'Unknown player' : '未知玩家');
		return player.getLabel(lang);
	}

	getActivePlayerId() {
		const tableIds = this.gameInfo?.tableIds || this.playerOrder;
		const optionPos = this.gameInfo?.optionPos;
		if (!Array.isArray(tableIds) || tableIds.length === 0) return null;
		if (typeof optionPos !== 'number' || optionPos < 0 || optionPos >= tableIds.length) {
			return tableIds[0] || null;
		}
		return tableIds[optionPos] || null;
	}

	buildStateBlock(lang = 'en') {
		return this.playerOrder
			.map((playerId) => this.players[playerId]?.getPromptSummary(lang))
			.filter(Boolean)
			.join('\n');
	}

	buildEventSegments(event, lang = 'en') {
		const player = this.getPlayer(event?.playerId);
		const activePlayer = this.getPlayer(this.getActivePlayerId());
		const remaining = this.gameInfo?.remainingNum;
		const remainingText = typeof remaining === 'number'
			? (lang === 'en' ? ` Tiles remaining: ${remaining}.` : ` 剩余牌 ${remaining} 张。`)
			: '';
		const remainingCompact = typeof remaining === 'number'
			? (lang === 'en' ? `, ${remaining} tiles left` : `，剩余${remaining}张`)
			: '';

		if (event?.type === 'roomState' || event?.type === 'startGame') {
			const hasVisibleHands = this.playerOrder.some((playerId) => {
				const currentPlayer = this.players[playerId];
				return (currentPlayer?.handCards?.length || 0) > 0;
			});
			if (!hasVisibleHands) {
			return {
				actionLine: '',
				stateLine: lang === 'en'
					? `Table state synced. Waiting for the next deal.${remainingText}`.trim()
					: `牌桌状态已同步，等待下一局发牌。${remainingText}`.trim(),
				analysisPlayer: null,
			};
		}

		const scores = this.getPredictionScores();
		const totalScore = Object.values(scores).reduce((sum, val) => sum + val, 0);
		const tableSummary = this.playerOrder
			.map((playerId) => {
				const currentPlayer = this.players[playerId];
				if (!currentPlayer) return null;
				const rate = totalScore > 0 && scores[playerId]
					? ((scores[playerId] / totalScore) * 100).toFixed(1)
					: null;
				const odds = rate ? (lang === 'en' ? ` (${rate}%)` : `（${rate}%）`) : '';
				return lang === 'en'
					? `${currentPlayer.getCompactState(lang)}${odds}`
					: `${currentPlayer.getCompactState(lang)}${odds}`;
			})
			.filter(Boolean)
			.join(lang === 'en' ? '; ' : '；');
			if (!tableSummary) {
				return {
					actionLine: '',
					stateLine: lang === 'en'
						? 'Table state synced and ready for commentary.'
						: '牌桌状态已同步，可以开始解说。',
					analysisPlayer: null,
			};
		}
			return {
				actionLine: '',
				stateLine: lang === 'en'
					? `${tableSummary}${remainingCompact}.`.trim()
					: `${tableSummary}${remainingCompact}。`.trim(),
				promptStateLine: lang === 'en'
					? `${tableSummary}${remainingCompact}.`.trim()
					: `${tableSummary}${remainingCompact}。`.trim(),
				analysisPlayer: null,
			};
		}

		if (!player) {
			return {
				actionLine: '',
				stateLine: lang === 'en'
					? `State updated after ${event?.type || 'the move'}.${remainingText}`.trim()
					: `${event?.type || '当前动作'}后状态已更新。${remainingText}`.trim(),
				promptStateLine: lang === 'en'
					? `State updated after ${event?.type || 'the move'}.${remainingText}`.trim()
					: `${event?.type || '当前动作'}后状态已更新。${remainingText}`.trim(),
				analysisPlayer: null,
			};
		}

		const handSummary = player.getHandSummary(lang);
		const activePlayerStateSuffix = activePlayer?.hasExposedMelds()
			? (lang === 'en'
				? `; melds: ${activePlayer.getMeldSummary(lang)}`
				: `；副露为${activePlayer.getMeldSummary(lang)}`)
			: '';
		switch (event?.type) {
			case 'playCard': {
				const focusPlayer = player;
				const focusWinRate = this.getPredictedWinRateText(player.playerId, lang);
				const actorStateLine = lang === 'en'
					? `Now ${player.getLabel(lang)} shows ${player.getHandSummary(lang)}.${remainingText} ${player.getMeldReadSummary(lang)}`.trim()
					: `现在${player.getLabel(lang)}为${player.getHandSummary(lang)}。${remainingText} ${player.getMeldReadSummary(lang)}`.trim();
				return {
					actionLine: lang === 'en'
						? `${player.getLabel(lang)} throws ${_.cardName(event.data?.cardNum, lang)}.`
						: `${player.getLabel(lang)}打出${_.cardName(event.data?.cardNum, lang)}。`,
					stateLine: lang === 'en'
						? `${focusPlayer.getCompactState(lang)}${remainingCompact}. ${focusWinRate}.`.trim()
						: `现在${focusPlayer.getLabel(lang)}为${focusPlayer.getHandSummary(lang)}${activePlayerStateSuffix}。${remainingText} ${focusPlayer.getMeldReadSummary(lang)} ${focusWinRate}`.trim(),
					promptStateLine: actorStateLine,
					analysisPlayer: player,
				};
			}
			case 'peng': {
				const playerWinRate = this.getPredictedWinRateText(player.playerId, lang);
				const playerStateLine = lang === 'en'
					? `Now ${player.getLabel(lang)} shows ${handSummary}; melds: ${player.getMeldSummary(lang)}.${remainingText} ${player.getMeldReadSummary(lang)}`.trim()
					: `现在${player.getLabel(lang)}为${handSummary}；副露为${player.getMeldSummary(lang)}。${remainingText} ${player.getMeldReadSummary(lang)}`.trim();
				return {
					actionLine: lang === 'en'
						? `${player.getLabel(lang)} calls peng on ${_.cardNames(event.data?.pengArr, lang)}.`
						: `${player.getLabel(lang)}碰了${_.cardNames(event.data?.pengArr, lang)}。`,
					stateLine: lang === 'en'
						? `${player.getCompactState(lang)}${remainingCompact}. ${playerWinRate}.`.trim()
						: `${playerStateLine} ${playerWinRate}`.trim(),
					promptStateLine: playerStateLine,
					analysisPlayer: player,
				};
			}
			case 'gang': {
				const playerWinRate = this.getPredictedWinRateText(player.playerId, lang);
				const playerStateLine = lang === 'en'
					? `Now ${player.getLabel(lang)} shows ${handSummary}; melds: ${player.getMeldSummary(lang)}.${remainingText} ${player.getMeldReadSummary(lang)}`.trim()
					: `现在${player.getLabel(lang)}为${handSummary}；副露为${player.getMeldSummary(lang)}。${remainingText} ${player.getMeldReadSummary(lang)}`.trim();
				return {
					actionLine: lang === 'en'
						? `${player.getLabel(lang)} declares gang with ${_.cardNames(event.data?.gangArr, lang)}.`
						: `${player.getLabel(lang)}杠了${_.cardNames(event.data?.gangArr, lang)}。`,
					stateLine: lang === 'en'
						? `${player.getCompactState(lang)}${remainingCompact}. ${playerWinRate}.`.trim()
						: `${playerStateLine} ${playerWinRate}`.trim(),
					promptStateLine: playerStateLine,
					analysisPlayer: player,
				};
			}
			case 'win': {
				const playerWinRate = this.getPredictedWinRateText(player.playerId, lang);
				const playerStateLine = lang === 'en'
					? `${player.getLabel(lang)} now shows ${handSummary}.${remainingText} ${player.getMeldReadSummary(lang)}`.trim()
					: `现在${player.getLabel(lang)}为${handSummary}。${remainingText} ${player.getMeldReadSummary(lang)}`.trim();
				return {
					actionLine: lang === 'en'
						? `${player.getLabel(lang)} wins the hand.`
						: `${player.getLabel(lang)}胡牌。`,
					stateLine: lang === 'en'
						? `${player.getCompactState(lang)}${remainingCompact}. ${playerWinRate}.`.trim()
						: `${playerStateLine} ${playerWinRate}`.trim(),
					promptStateLine: playerStateLine,
					analysisPlayer: player,
				};
			}
			default: {
				const playerWinRate = this.getPredictedWinRateText(player.playerId, lang);
				const playerStateLine = lang === 'en'
					? `Now ${player.getLabel(lang)} shows ${handSummary}.${remainingText} ${player.getMeldReadSummary(lang)}`.trim()
					: `现在${player.getLabel(lang)}为${handSummary}。${remainingText} ${player.getMeldReadSummary(lang)}`.trim();
				return {
					actionLine: lang === 'en'
						? `${player.getLabel(lang)} completes ${event?.type || 'the move'}.`
						: `${player.getLabel(lang)}完成${event?.type || '当前动作'}。`,
					stateLine: lang === 'en'
						? `${player.getCompactState(lang)}${remainingCompact}. ${playerWinRate}.`.trim()
						: `${playerStateLine} ${playerWinRate}`.trim(),
					promptStateLine: playerStateLine,
					analysisPlayer: player,
				};
			}
		}
	}

	buildEventStateLine(event, lang = 'en') {
		const { actionLine, stateLine } = this.buildEventSegments(event, lang);
		return [actionLine, stateLine].filter(Boolean).join(' ').trim();
	}
}

module.exports = StateManager;
