require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_PROMPT = `You are an electrifying live Mahjong commentator. Write exactly one vivid English commentary paragraph, using 3 to 5 full sentences. Sound energetic, specific, and imaginative, like a real broadcast analyst reacting in the moment. Do not repeat the action line verbatim. Do not repeat the upcoming state line verbatim. Base your reaction only on the two lines you are given, and make the commentary feel sharp, immediate, and exciting rather than over-explained.`;

const USER_PROMPT = `[Action Line Already Spoken]
Player 1 throws 7 dots.

[Upcoming State Line]
Now Player 1 shows 12-tile hand: 1x 1 characters, 1x 2 characters, 1x 7 characters, 1x 8 characters, 1x 2 bamboo, 1x 4 bamboo, 1x 7 bamboo, 1x 9 bamboo, 1x 1 dots, 1x 5 dots, 1x 6 dots, 1x 7 dots. Tiles remaining: 28. Meld read: 1 meld [5 dots, 6 dots, 7 dots].

Write only the commentary paragraph that should be inserted between the action line and the upcoming state line.`;

async function main() {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		console.error('Please set GEMINI_API_KEY before running this script.');
		process.exit(1);
	}

	const genAI = new GoogleGenerativeAI(apiKey);
	const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

	console.log(`[LLM SYSTEM]\n${SYSTEM_PROMPT}\n[/LLM SYSTEM]`);
	console.log(`[LLM USER]\n${USER_PROMPT}\n[/LLM USER]`);

	const result = await model.generateContent({
		contents: [{ role: 'user', parts: [{ text: USER_PROMPT }] }],
		systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
		generationConfig: {
			maxOutputTokens: 500,
			temperature: 0.8,
			topP: 0.8,
		},
	});

	// print the raw result
	console.log(`[LLM RAW RESULT]\n${JSON.stringify(result, null, 2)}\n[/LLM RAW RESULT]`);
	const rawText = result.response.text();
	console.log(`[LLM RAW]\n${rawText}\n[/LLM RAW]`);
}

main().catch((error) => {
	console.error('[debug-gemini] Request failed:', error.message);
	process.exit(1);
});
