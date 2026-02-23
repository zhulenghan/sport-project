/**
 * 全局游戏事件发射器
 * 用于解耦游戏逻辑和解说推送
 * @author AI Commentator
 */
const EventEmitter = require('events');
const gameEvents = new EventEmitter();
module.exports = gameEvents;
