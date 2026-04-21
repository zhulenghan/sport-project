/**
 * websocket相关服务（微信小程序端没有默认支持socket.io(需要自己额外处理)，这里用websocket）
 * @author Kevin
 * @Date: 2024-6-18
 */
const WebSocket = require('ws');
const _ = require("lodash");
const Utils = require("@/utils");
const stringify = require('fast-json-stable-stringify');
const GameControl = require("@services/game/GameControl");
const HackService = require("@coreServices/HackService");
const appConfig = require("@/config/AppletsConfig")
const prints = require("@utils/console");
const gameEvents = require("@core/events/GameEventEmitter");
const RoomService = require("@/core/services/RoomService");
const PlayerService = require("@/core/services/PlayerService");

class SocketService{
	constructor(){
		this.client = new WebSocket.Server({port: appConfig.wssPort});
		this.ws = null;
		this.instance = null;
	}

	/**
	 * 单例
	 * @returns {SocketService}
	 */
	static getInstance() {
		if (!this.instance) {
			this.instance = new SocketService();
		}
		return this.instance;
	}

	/**
	 * 初始化websocket服务
	 */
	init(){
		prints.printBanner(`socket服务器启动，监听${appConfig.wssPort}`);
		let _this = this;
		this.client.on('connection', function connection(ws, req) {
			ws.isAlive = true;
			let url = _.get(req, 'url');
			let urlParams = new URLSearchParams(url.replace(/^\/\??/, ''));
			let role = urlParams.get('role');
			let id = urlParams.get('id');
			let watchRoomId = urlParams.get('roomId');

			// 解说者连接
			if (role === 'commentator' && watchRoomId) {
				ws.role = 'commentator';
				ws.watchRoomId = watchRoomId;
				const listener = (event) => {
					if (event.roomId === watchRoomId && ws.readyState === 1) {
						ws.send(JSON.stringify(event));
					}
				};
				gameEvents.on('gameEvent', listener);
				ws.send(JSON.stringify({ message: '解说者连接成功', type: 'commentatorConnected', roomId: watchRoomId }));
				const roomInfo = RoomService.getRoomInfo(watchRoomId);
				const gameInfo = RoomService.getGameInfo(watchRoomId);
				if (!_.isEmpty(roomInfo) && ws.readyState === 1) {
					ws.send(JSON.stringify({
						message: 'Commentator synced to current room state',
						type: 'roomState',
						roomId: watchRoomId,
						playerId: null,
						data: {},
						roomInfo,
						gameInfo,
						timestamp: Date.now(),
					}));
				}
				ws.on('close', () => { gameEvents.removeListener('gameEvent', listener); });
				ws.on('pong', () => { ws.isAlive = true; });
				return;
			}

			// 普通玩家连接
			_this.ws = ws;
			ws.req = req;
			ws.sendJson = function (json) {
				if (this.readyState === 1) {
					_this.sendMessage(stringify(json));
				}
			};
			_this.sendMessage('连接成功');
			ws.on('message', async function (message) {
				await _this.onMessageHandle(message.toString(), ws.userId);
			});
			ws.on('close', async function(e) {
				let userId = id || ws.userId;
				await _this.onCloseHandle(e, userId);
			});
			ws.on('error', async function() {
				await _this.onErrorHandle();
			});
			ws.on('pong', () => { //收到pong帧，连接正常
				ws.isAlive = true;
			});
		})

		// 定期检查连接的心跳
		const interval = setInterval(() => {
			_this.client.clients.forEach(ws => {
				if (ws.isAlive === false) {
					return ws.terminate();
				}
				ws.isAlive = false;
				// 发送ping帧检测websocket是否还活着
				ws.ping();
			});
		}, 30000);

		this.client.on('close', () => {
			clearInterval(interval);
		});
	}


	/**
	 * 服务端回调操作
	 * @param message
	 * @param userId
	 * @returns {Promise<void>}
	 */
	async onMessageHandle(message, userId){
		if (message === 'ping') { //心跳
			console.log('心跳：来自客户端的ping');
			this.sendHeartBeat(userId);
		} else if(Utils.isJSON(message)) {  // API
			const parseMessage = JSON.parse(_.cloneDeep(message));
			if(_.isFunction(GameControl[parseMessage?.type])){
				GameControl[parseMessage?.type](parseMessage, this)
			}
		} else {

		}
	}

	/**
	 * ws关闭回调
	 * @param e
	 * @param userId
	 * @returns {Promise<void>}
	 */
	async onCloseHandle(e, userId){
		if (!userId) return;
		const roomId = PlayerService.getRoomId(userId);
		if (!roomId) return;
		RoomService.quitRoom(roomId, userId);
	}

	/**
	 * ws错误异常回调
	 */
	onErrorHandle(){
		console.log("------------------onErrorHandle---------------------")
	}
	//---------------------服务端主动操作---------------------
	/**
	 * 单发消息
	 * @param data
	 */
	sendMessage(data){
		this.ws.send(data);
	}
	
	/**
	 * 心跳 - 服务端回传
	 * @param userId
	 */
	sendHeartBeat(userId) {
		this.client.clients.forEach(ws => {
			if (ws.userId === userId) {
				ws.send('pong');
			}
		})
	}
	/**
	 * 单发消息给指定用户
	 * @param userId
	 * @param message
	 * @param data
	 * @param type
	 */
	sendToUser(userId, message, data, type) {
		this.client.clients.forEach(ws => {
			if (ws.userId === userId) {
				let newRoomInfo = {};
				if (!_.isEmpty(data.roomInfo)) {
					newRoomInfo = HackService.cleanRoomInfo(_.cloneDeep(data.roomInfo), userId);
				}
				let userData = _.cloneDeep(data);
				userData.roomInfo = newRoomInfo;
				ws.send(stringify({message, data: userData, type}));
			}
		})
	}
	
	/**
	 * 广播给房间全部玩家
	 * @param userIds
	 * @param message
	 * @param data
	 * @param type
	 */
	broadcastToRoom(userIds, message, data, type) {
		userIds.forEach(userId => {
			this.client.clients.forEach(ws => {
				if (ws.userId === userId) {
					let newRoomInfo = {};
					if (!_.isEmpty(data.roomInfo)) {
						newRoomInfo = HackService.cleanRoomInfo(_.cloneDeep(data.roomInfo), userId);
					}
					let userData = _.cloneDeep(data);
					userData.roomInfo = newRoomInfo;
					console.log("服务端返回的值", message, userData, type)
					ws.send(JSON.stringify({ message, data: userData, type }));
				}
			});
		});
	}

	/**
	 * 通过条件广播给房间内其他玩家
	 * @param otherIds
	 * @param message
	 * @param data
	 * @param type
	 */
	sendDifferenceUser(otherIds, message, data, type) {
		otherIds.forEach(userId => {
			this.client.clients.forEach(ws => {
				if (ws.userId === userId) {
					let newRoomInfo = {};
					if (!_.isEmpty(data.roomInfo)) {
						newRoomInfo = HackService.cleanRoomInfo(_.cloneDeep(data.roomInfo), userId);
					}
					let userData = _.cloneDeep(data);
					userData.roomInfo = newRoomInfo;
					console.log("服务端返回的值", message, userData, type)
					ws.send(JSON.stringify({ message, data: userData, type }));
				}
			});
		});
	}
}

module.exports =  SocketService;
