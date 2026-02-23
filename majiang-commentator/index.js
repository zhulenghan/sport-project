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
	const config = { host: '127.0.0.1', port: 8082, room: null, lang: 'zh', verbose: false };
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
const ALWAYS_COMMENT = ['startGame', 'peng', 'gang', 'win'];
function shouldComment(event, verbose) {
	if (verbose) return true;
	if (ALWAYS_COMMENT.includes(event.type)) return true;
	// playCard 仅残局时解说
	if (event.type === 'playCard') {
		const remaining = event.gameInfo?.remainingNum;
		return typeof remaining === 'number' && remaining < 20;
	}
	return false;
}

async function main() {
	const config = parseArgs();
	if (!config.room) {
		console.error('请指定房间号: node index.js --room <roomId>');
		process.exit(1);
	}

	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		console.error('请设置 GEMINI_API_KEY 环境变量');
		process.exit(1);
	}

	const context = new Context();
	const commentator = new Commentator(apiKey, config.lang);
	const tts = new TTS(config.lang);
	let processing = false;

	console.log(`\n🀄 麻将 AI 解说系统`);
	console.log(`   房间: ${config.room}`);
	console.log(`   语言: ${config.lang === 'zh' ? '中文' : 'English'}`);
	console.log(`   模式: ${config.verbose ? '全量解说 (verbose)' : '关键动作解说'}`);
	console.log(`   服务端: ${config.host}:${config.port}\n`);

	const client = new WsClient(config.host, config.port, config.room, async (event) => {
		// 连接确认
		if (event.type === 'commentatorConnected') {
			console.log(`[系统] 解说者已连接，等待游戏开始...\n`);
			return;
		}

		// 开局初始化 context
		if (event.type === 'startGame' && event.roomInfo) {
			context.initBaseInfo(event.roomInfo);
		}

		// 如果基础信息未初始化，跳过
		if (!context.baseInfo) {
			console.log(`[系统] 收到事件 ${event.type}，但游戏尚未开始，跳过`);
			return;
		}

		// 记录所有事件到滑动窗口
		context.addEvent(event);

		// 判断是否需要解说
		if (!shouldComment(event, config.verbose)) return;

		// 防止并发调用 LLM
		if (processing) return;
		processing = true;

		try {
			const prompt = context.buildPrompt(event, config.lang);
			console.log(`--- [${event.type}] ${context.describeEvent(event)} ---`);
			const commentary = await commentator.commentate(prompt);
			if (commentary) {
				console.log(`🎙️  ${commentary}\n`);
				tts.speak(commentary);
			}
		} catch (e) {
			console.error('[解说] 错误:', e.message);
		} finally {
			processing = false;
		}
	});

	client.connect();
}

main();
