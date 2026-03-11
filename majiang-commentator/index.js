/**
 * 麻将 AI 解说服务入口
 *
 * 用法：
 *   node index.js --room 123456
 *   node index.js --room 123456 --lang en
 *   node index.js --room 123456 --host 192.168.1.5
 */
require('dotenv').config();
const WsClient = require('./src/ws-client');
const Context = require('./src/context');
const Commentator = require('./src/commentator');
const TTS = require('./src/tts');

// 解析命令行参数
function parseArgs() {
	const args = process.argv.slice(2);
	const config = { host: '127.0.0.1', port: 8082, room: null, lang: 'en', verbose: false };
	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--room': config.room = args[++i]; break;
			case '--host': config.host = args[++i]; break;
			case '--port': config.port = parseInt(args[++i]); break;
			case '--lang': config.lang = args[++i]; break;
			case '--verbose': config.verbose = true; break;
		}
	}
	return config;
}

// 关键动作判断
const ALWAYS_COMMENT = ['startGame', 'roomState', 'peng', 'gang', 'win'];
function shouldComment(event, verbose) {
	if (verbose) return true;
	if (ALWAYS_COMMENT.includes(event.type)) return true;
	// playCard 仅残局时解说
	if (event.type === 'playCard') {
		const remaining = event.gameInfo?.remainingNum;
		if (typeof remaining !== 'number') return true;
		return remaining < 20;
	}
	return false;
}

async function main() {
	const config = parseArgs();
	if (!config.room) {
		console.error('Please specify a room id: node index.js --room <roomId>');
		process.exit(1);
	}

	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		console.error('Please set the GEMINI_API_KEY environment variable.');
		process.exit(1);
	}

	const context = new Context();
	const commentator = new Commentator(apiKey, config.lang);
	const tts = new TTS(config.lang);
	let processing = false;

	console.log(`\nMahjong AI Commentator`);
	console.log(`   Room: ${config.room}`);
	console.log(`   Language: ${config.lang === 'zh' ? 'Chinese' : 'English'}`);
	console.log(`   Mode: ${config.verbose ? 'Verbose commentary' : 'Key-event commentary'}`);
	console.log(`   Server: ${config.host}:${config.port}\n`);

	const client = new WsClient(config.host, config.port, config.room, async (event) => {
		// 连接确认
		if (event.type === 'commentatorConnected') {
			console.log(`[System] Commentator connected. Waiting for live events...\n`);
			return;
		}

		context.updateFromEvent(event);

		// 记录所有事件到滑动窗口
		context.addEvent(event, config.lang);

		// 判断是否需要解说
		if (!shouldComment(event, config.verbose)) return;

		// 防止并发调用 LLM
		if (processing) return;
		processing = true;

		try {
			const prompt = context.buildPrompt(event, config.lang);
			console.log(`--- [${event.type}] ${context.describeEvent(event, config.lang)} ---`);
			const commentary = await commentator.commentate(prompt);
			if (commentary) {
				console.log(`🎙️  ${commentary}\n`);
				tts.speak(commentary);
			}
		} catch (e) {
			console.error('[Commentary] Error:', e.message);
		} finally {
			processing = false;
		}
	});

	client.connect();
}

main();
