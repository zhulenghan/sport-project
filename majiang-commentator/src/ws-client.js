/**
 * WebSocket 客户端，连接游戏服务端作为解说者
 */
const WebSocket = require('ws');

class WsClient {
	constructor(host, port, roomId, onEvent) {
		this.host = host;
		this.port = port;
		this.roomId = roomId;
		this.onEvent = onEvent;
		this.ws = null;
		this.reconnectInterval = 3000;
	}

	connect() {
		const url = `ws://${this.host}:${this.port}?role=commentator&roomId=${this.roomId}`;
		console.log(`[WS] 正在连接: ${url}`);
		this.ws = new WebSocket(url);

		this.ws.on('open', () => {
			console.log(`[WS] 已连接到游戏服务端，观战房间: ${this.roomId}`);
		});

		this.ws.on('message', (data) => {
			try {
				const event = JSON.parse(data.toString());
				this.onEvent(event);
			} catch (e) {
				console.error('[WS] 消息解析失败:', e.message);
			}
		});

		this.ws.on('close', () => {
			console.log('[WS] 连接断开，尝试重连...');
			setTimeout(() => this.connect(), this.reconnectInterval);
		});

		this.ws.on('error', (err) => {
			console.error('[WS] 连接错误:', err.message);
		});
	}
}

module.exports = WsClient;
