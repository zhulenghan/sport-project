/**
 * 麻将牌号转中文名称
 *
 * 牌号编码规则（来自 GameService.cards）：
 * 个位 1-9 表示牌面数字
 * 十位区分花色：1x/6x/11x/16x = 万，2x/7x/12x/17x = 条，3x/8x/13x/18x = 筒
 * 同一张牌有4副（通过 %50 可以归一化）
 */

const SUIT_MAP = {
	zh: { 1: '万', 2: '条', 3: '筒' },
	en: { 1: 'characters', 2: 'bamboo', 3: 'dots' },
};

const NUM_MAP = {
	zh: {
		1: '一', 2: '二', 3: '三', 4: '四', 5: '五',
		6: '六', 7: '七', 8: '八', 9: '九',
	},
	en: {
		1: '1', 2: '2', 3: '3', 4: '4', 5: '5',
		6: '6', 7: '7', 8: '8', 9: '9',
	},
};

/**
 * 单张牌号 -> 中文名称
 */
function cardName(num, lang = 'zh') {
	if (num == null) return '?';
	const normalized = num % 50;
	const suit = Math.floor(normalized / 10);
	const face = normalized % 10;
	const suitName = SUIT_MAP[lang]?.[suit] || '?';
	const faceName = NUM_MAP[lang]?.[face] || '?';
	return lang === 'en' ? `${faceName} ${suitName}` : `${faceName}${suitName}`;
}

/**
 * 牌号数组 -> 逗号分隔的中文名称
 */
function cardNames(arr, lang = 'zh') {
	if (!arr || !Array.isArray(arr)) return '';
	return arr.map((num) => cardName(num, lang)).join(lang === 'en' ? ', ' : '、');
}

function normalizeCard(num) {
	if (num == null) return null;
	return num % 50;
}

function getCardSuit(num) {
	const normalized = normalizeCard(num);
	if (normalized == null) return null;
	return Math.floor(normalized / 10);
}

function getCardFace(num) {
	const normalized = normalizeCard(num);
	if (normalized == null) return null;
	return normalized % 10;
}

function sortCards(cards) {
	if (!Array.isArray(cards)) return [];
	return cards
		.filter((num) => num != null)
		.slice()
		.sort((a, b) => normalizeCard(a) - normalizeCard(b));
}

function cardCountSummary(cards, lang = 'zh') {
	const sortedCards = sortCards(cards);
	if (sortedCards.length === 0) {
		return lang === 'en' ? 'no tiles' : '空';
	}

	const counts = new Map();
	sortedCards.forEach((num) => {
		const normalized = normalizeCard(num);
		counts.set(normalized, (counts.get(normalized) || 0) + 1);
	});

	return Array.from(counts.entries()).map(([normalized, count]) => {
		const label = cardName(normalized, lang);
		return lang === 'en' ? `${count}x ${label}` : `${count}张${label}`;
	}).join(lang === 'en' ? ', ' : '、');
}

function formatMeldGroup(cards, lang = 'zh') {
	if (!Array.isArray(cards) || cards.length === 0) {
		return lang === 'en' ? '[]' : '[]';
	}
	const names = cards.map((num) => cardName(num, lang));
	return `[${names.join(lang === 'en' ? ', ' : '、')}]`;
}

module.exports = {
	cardName,
	cardNames,
	normalizeCard,
	sortCards,
	cardCountSummary,
	getCardSuit,
	getCardFace,
	formatMeldGroup,
};
