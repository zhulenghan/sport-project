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
const StateManager = require('./src/state-manager');

// 解析命令行参数
function parseArgs() {
	const args = process.argv.slice(2);
	const config = {
		host: '127.0.0.1',
		port: 8082,
		room: null,
		lang: 'en',
		verbose: true,
		audio: false,
		analyze: true,
	};
	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--room': config.room = args[++i]; break;
			case '--host': config.host = args[++i]; break;
			case '--port': config.port = parseInt(args[++i]); break;
			case '--lang': config.lang = args[++i]; break;
			case '--verbose': config.verbose = true; break;
			case '--audio': config.audio = true; break;
			case '--llm': config.analyze = true; break;
		}
	}
	return config;
}

// 默认解说事件
const COMMENTED_EVENTS = ['startGame', 'roomState', 'playCard', 'peng', 'gang', 'win'];
function shouldComment(event, verbose) {
	if (verbose) return true;
	return COMMENTED_EVENTS.includes(event.type);
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
	const stateManager = new StateManager();
	const pendingItems = [];
	let processing = false;

	console.log(`\nMahjong AI Commentator`);
	console.log(`   Room: ${config.room}`);
	console.log(`   Language: ${config.lang === 'zh' ? 'Chinese' : 'English'}`);
	console.log(`   Mode: ${config.verbose ? 'Verbose template commentary' : 'Move-by-move template commentary'}`);
	console.log(`   Audio: ${config.audio ? 'On' : 'Off'}`);
	console.log(`   LLM Analysis: ${config.analyze ? 'On' : 'Off'}`);
	console.log(`   Server: ${config.host}:${config.port}\n`);

	async function processQueue() {
		if (processing) return;
		processing = true;

		while (pendingItems.length > 0) {
			const item = pendingItems.shift();
			try {
				console.log(`--- [${item.event.type}] ${item.eventDescription} ---`);

				let commentaryParts = [item.actionLine];
				let spokenAnalysis = '';
				if (item.shouldAnalyze) {
					const rawAnalysis = await commentator.commentate(item.prompt);
					const analysis = context.finalizeAnalysis(
						rawAnalysis,
						config.lang,
						'',
					);
					if (analysis) {
						spokenAnalysis = analysis;
						commentaryParts.push(analysis);
					}
				}
				commentaryParts.push(item.stateLine);
				const commentary = commentaryParts.filter(Boolean).join('\n\n').trim();

				if (commentary) {
					console.log(`🎙️  ${commentary}\n`);
					if (config.audio && spokenAnalysis) {
						tts.speak(spokenAnalysis);
					}
				}
			} catch (e) {
				console.error('[Commentary] Error:', e.message);
			}
		}

		processing = false;
	}

	const client = new WsClient(config.host, config.port, config.room, async (event) => {
		// 连接确认
		if (event.type === 'commentatorConnected') {
			console.log(`[System] Commentator connected. Waiting for live events...\n`);
			return;
		}

		context.updateFromEvent(event);
		stateManager.updateFromEvent(event);

		// 记录所有事件到滑动窗口
		context.addEvent(event, config.lang);

		// 判断是否需要解说
		if (!shouldComment(event, config.verbose)) return;

		const segments = stateManager.buildEventSegments(event, config.lang);
		const actionLine = segments.actionLine || '';
		const stateLine = segments.stateLine || context.buildSpokenLine(event, config.lang, stateManager);
		pendingItems.push({
			event,
			eventDescription: context.describeEvent(event, config.lang),
			prompt: context.buildPrompt(event, config.lang, stateManager, segments),
			actionLine,
			stateLine,
			shouldAnalyze: config.verbose && config.analyze && Boolean(actionLine),
		});

		processQueue();
	});

	client.connect();
}

main();
