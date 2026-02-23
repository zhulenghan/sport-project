/**
 * 麻将牌号转中文名称
 *
 * 牌号编码规则（来自 GameService.cards）：
 * 个位 1-9 表示牌面数字
 * 十位区分花色：1x/6x/11x/16x = 万，2x/7x/12x/17x = 条，3x/8x/13x/18x = 筒
 * 同一张牌有4副（通过 %50 可以归一化）
 */

const SUIT_MAP = {
	1: '万', 2: '条', 3: '筒',
};

const NUM_MAP = {
	1: '一', 2: '二', 3: '三', 4: '四', 5: '五',
	6: '六', 7: '七', 8: '八', 9: '九',
};

/**
 * 单张牌号 -> 中文名称
 */
function cardName(num) {
	if (num == null) return '?';
	const normalized = num % 50;
	const suit = Math.floor(normalized / 10);
	const face = normalized % 10;
	const suitName = SUIT_MAP[suit] || '?';
	const faceName = NUM_MAP[face] || '?';
	return `${faceName}${suitName}`;
}

/**
 * 牌号数组 -> 逗号分隔的中文名称
 */
function cardNames(arr) {
	if (!arr || !Array.isArray(arr)) return '';
	return arr.map(cardName).join(',');
}

module.exports = { cardName, cardNames };
