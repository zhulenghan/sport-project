/**
 * LLM 解说模块 - Gemini Flash
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');

class Commentator {
	constructor(apiKey, lang) {
		this.lang = lang || 'zh';
		const genAI = new GoogleGenerativeAI(apiKey);
		this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
	}

	/**
	 * 调用 Gemini Flash 生成解说
	 */
	async commentate(prompt) {
		try {
			const result = await this.model.generateContent({
				contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
				systemInstruction: { parts: [{ text: prompt.system }] },
				generationConfig: {
					maxOutputTokens: 150,
					temperature: 0.9,
				},
			});
			return result.response.text().trim();
		} catch (e) {
			console.error('[LLM] 调用失败:', e.message);
			return null;
		}
	}
}

module.exports = Commentator;
