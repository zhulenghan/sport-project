/**
 * LLM 解说模块 - Gemini Flash
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');

class Commentator {
	constructor(apiKey, lang) {
		this.lang = lang || 'zh';
		const genAI = new GoogleGenerativeAI(apiKey);
		this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
		this.lastErrorAt = 0;
	}

	/**
	 * 调用 Gemini Flash 生成解说
	 */
	async commentate(prompt) {
		try {
			// console.log(`[LLM SYSTEM]\n${prompt.system}\n[/LLM SYSTEM]`);
			// console.log(`[LLM USER]\n${prompt.user}\n[/LLM USER]`);
			const result = await this.model.generateContent({
				contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
				systemInstruction: { parts: [{ text: prompt.system }] },
				// generationConfig: {
				// 	maxOutputTokens: 220,
				// 	temperature: 0.7,
				// 	topP: 0.85,
				// },
			});
			const rawText = result.response.text();
			// console.log(`[LLM RAW]\n${rawText}\n[/LLM RAW]`);
			return rawText.replace(/\s+/g, ' ').trim();
		} catch (e) {
			// Suppress LLM errors to keep output clean.
			return null;
		}
	}
}

module.exports = Commentator;
