"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
  var __decorateClass = (decorators, target, key, kind) => {
    var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
    for (var i = decorators.length - 1, decorator; i >= 0; i--)
      if (decorator = decorators[i])
        result = (kind ? decorator(target, key, result) : decorator(result)) || result;
    if (kind && result) __defProp(target, key, result);
    return result;
  };

  // src/HallRT.generated.ts
  var _HallRTBase = class _HallRTBase extends Laya.Scene {
  };
  __name(_HallRTBase, "HallRTBase");
  var HallRTBase = _HallRTBase;

  // src/HallRT.ts
  var { regClass } = Laya;
  var HallRT = class extends HallRTBase {
    /**
     * 上个场景的参数
     * @param params
     */
    onOpened(params) {
      if (params && params === "oldPlayer") {
        this.reconnect.visible = true;
      }
    }
  };
  __name(HallRT, "HallRT");
  HallRT = __decorateClass([
    regClass("20bbf52b-3aa9-482d-9cc9-aeec28e18fc7", "../src/HallRT.ts")
  ], HallRT);

  // src/configs/index.ts
  var env = "dev";
  var hostname = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
  var appConfig = {
    dev: {
      "host": `http://${hostname}`,
      "port": 4e3,
      "ws": `ws://${hostname}:8082`
    },
    test: {
      "host": `http://${hostname}`,
      "port": 4e3,
      "ws": `ws://${hostname}:8082`
    },
    prod: {
      "host": `http://${hostname}`,
      "port": 4e3,
      "ws": `ws://${hostname}:8082`
    }
  };
  var configs_default = appConfig[env];

  // src/configs/tempDataMap.ts
  var tempDataMap = /* @__PURE__ */ new Map();
  var tempDataMap_default = tempDataMap;

  // src/configs/mapManager.ts
  var _DataManager = class _DataManager {
    // 设置数据
    setData(key, value) {
      tempDataMap_default.set(key, value);
    }
    // 获取数据
    getData(key) {
      return tempDataMap_default.get(key);
    }
    // 删除数据
    deleteData(key) {
      tempDataMap_default.delete(key);
    }
    // 清空所有数据
    clearData() {
      tempDataMap_default.clear();
    }
  };
  __name(_DataManager, "DataManager");
  var DataManager = _DataManager;
  var mapManager_default = DataManager;

  // src/utils/HttpHelper.ts
  var _a, _b;
  var _HttpHelper = class _HttpHelper {
    constructor() {
      this.httpUrl = `${(_a = configs_default) == null ? void 0 : _a.host}:${(_b = configs_default) == null ? void 0 : _b.port}`;
    }
    get(data, cb) {
      let http = new Laya.HttpRequest();
      http.http.timeout = 1e4;
      http.send(this.httpUrl, "", "get", "text");
      http.once(Laya.Event.COMPLETE, this, this.completeHandler);
      http.once(Laya.Event.ERROR, this, this.errorHandler);
      http.on(Laya.Event.PROGRESS, this, this.processHandler);
    }
    post(url, data, cb) {
      let http = new Laya.HttpRequest();
      this.cb = cb;
      http.http.timeout = 1e4;
      http.send(`${this.httpUrl}${url}`, data, "post", "json");
      http.once(Laya.Event.COMPLETE, this, this.completeHandler);
      http.once(Laya.Event.ERROR, this, this.errorHandler);
      http.on(Laya.Event.PROGRESS, this, this.processHandler);
    }
    processHandler(data) {
      console.log("===processHandler=======");
    }
    errorHandler(error) {
      console.log("===errorHandler===");
    }
    /**
     * 请求回调
     * @param data
     * @private
     */
    completeHandler(data) {
      this.cb(data);
    }
  };
  __name(_HttpHelper, "HttpHelper");
  var HttpHelper = _HttpHelper;
  var HttpHelper_default = HttpHelper;

  // src/Main.ts
  var Sprite = Laya.Sprite;
  var Handler = Laya.Handler;
  var VBox = Laya.VBox;
  var Stage = Laya.Stage;
  var Event = Laya.Event;
  var Image = Laya.Image;
  var HBox = Laya.HBox;
  var Tween = Laya.Tween;
  var { regClass: regClass2, property } = Laya;
  var dataManager = new mapManager_default();
  var Main = class extends Laya.Script {
    constructor() {
      super(...arguments);
      /** 游戏开始状态**/
      this._started = false;
      // 指示灯资源数组
      this.timesArr = [0, 1, 2, 3];
      // 每次打牌后最多20秒倒计时
      this.countdownNum = 20;
      this.avatarBg = "resources/apes/avatar/avatarBg.png";
      this.avatarCommon = "resources/apes/avatar/avatarCommon.png";
      this.bankerImg = "resources/apes/avatar/banker.png";
      this.avatarImg = "resources/apes/avatar/avatar.png";
      this.avatarImg2 = "resources/apes/avatar/avatar2.png";
      this.avatarImg3 = "resources/apes/avatar/avatar3.png";
      this.avatarImg4 = "resources/apes/avatar/avatar4.png";
      this.rightInHand = "resources/apes/cardBack/right_inhand_0.png";
      this.oppositeInHand = "resources/apes/cardBack/opposite_inhand_0.png";
      this.leftInHand = "resources/apes/cardBack/left_inhand_0.png";
      this.playerNum = 0;
      this.viewPos = [];
      this.tableCards = [];
      this.myCardImgs = [];
      this.allUiCards = [];
      // 存储所有牌的UI节点，方便特殊操作
      // 一局允许的玩家数量
      this.allowPlayerCount = 1;
      // layaAir 引擎会在场景或网页失焦和最小化时，timer会置为0帧，timer.frameloop 会停止
      // 兼容方案： 1、用JS的setInterval  2、使用 onUpdate 生命周期
      // 一般来说也无需兼容，laya默认推荐开发者场景失焦就降为0帧，这个视情况而定
      this.timeInterval = 1e3;
      /** 开始时间 **/
      this.startTime = 0;
    }
    onStart() {
    }
    /**
     * 场景启动
     */
    onAwake() {
      var _a3;
      const userInfo = dataManager.getData("userInfo");
      const roomInfo = dataManager.getData("roomInfo");
      const gameInfo = dataManager.getData("gameInfo");
      const tableIds = gameInfo == null ? void 0 : gameInfo.tableIds;
      this._socket = SocketHelper_default.getInstance("");
      if (roomInfo && (userInfo == null ? void 0 : userInfo.id) === tableIds[0]) {
        this.startBtn.visible = true;
      }
      this.roomNum.visible = true;
      this.roomNum.text = "房号:" + ((_a3 = roomInfo[userInfo == null ? void 0 : userInfo.id]) == null ? void 0 : _a3.roomId);
      this.startBtn.on(Event.CLICK, this, this.startGame);
      this.passBtn.on(Event.CLICK, this, this.pass);
      this.bumpBtn.on(Event.CLICK, this, this.peng);
      this.gangBtn.on(Event.CLICK, this, this.gang);
      this.winningBtn.on(Event.CLICK, this, this.win);
      this.backHall.on(Event.CLICK, this, this.backToHall);
    }
    /**
     * 绘制头像
     * @param viewPos
     * @param idx
     * @private
     */
    renderAvatar(viewPos, idx) {
      let avatarBg = new Image(this.avatarBg);
      let avatarCommon = new Image(this.avatarCommon);
      let avatar = new Image(this.avatarImg);
      let bankerImg = new Image(this.bankerImg);
      bankerImg.name = "banker";
      avatarCommon.zOrder = 1;
      bankerImg.zOrder = 2;
      avatarBg.width = 108;
      avatarBg.height = 108;
      avatar.width = 100;
      avatar.height = 100;
      avatarCommon.width = 100;
      avatarCommon.height = 100;
      let x, y = 0;
      if (viewPos[idx] === 0) {
        x = 40;
        y = Laya.stage.designHeight - avatar.height - 30;
        avatar.skin = this.avatarImg2;
      } else if (viewPos[idx] === 1) {
        x = Laya.stage.designWidth - avatar.width - 30;
        y = 90;
        avatar.skin = this.avatarImg3;
      } else if (viewPos[idx] === 2) {
        x = 240;
        y = 30;
        avatar.skin = this.avatarImg4;
      } else if (viewPos[idx] === 3) {
        x = 30;
        y = 70;
      }
      avatarBg.pos(x - 1, y - 1);
      avatar.pos(x, y);
      avatarCommon.pos(x, y);
      bankerImg.pos(x + 100 - 25, y + 100 - 25);
      this.owner.addChild(avatarCommon);
      if (idx === 0) {
        this.owner.addChild(bankerImg);
      }
    }
    /**
     * 玩家视角的座位算法
     * 原理如下
     * 玩家A、B、C、D 座位如下
       A-0 B-1 -2 D-3
    		
    		首先获取所有玩家的服务器位置：Index = 0，1，2，3
    		加入现在是B的视角
    		则：移位 = B.index 1 - 0 = 1 ，说明移动一个位置
    		新座位的序号：
    		B = B.index - 移位 = 1-1 = 0
    		C = C.index - 移位 = 2-1 = 1
    		D = D.index - 移位 = 3-1 = 2
    		A = A.index - 移位 = 0 - 1 = -1，如果是负数，则+总人数4：-1+4=3
    		
    		同理：C的视角
    		移位= C.index 2-0 = 2
    		C = C.index - 移位 = 2-2 = 0
    		D = D.index - 移位 = 3-2 = 1
    		A = A.index - 移位 = 0 - 2 = -2，如果是负数，则+总人数4：-2+4=2
    		B = B.index - 移位 = 1 - 2 = -1，如果是负数，则+总人数4：-1+4=3
    		
    		同理：D的视角
    		移位= D.index 3-0 = 3
    		D = D.index - 移位 = 3 - 3 = 0
    		A = A.index - 移位 = 0 - 3 = -3，如果是负数，则+总人数4：-3+4=1
    		B = B.index - 移位 = 1 - 3 = -2，如果是负数，则+总人数4：-2+4=2
    		C = C.index - 移位 = 2 - 3 = -1，如果是负数，则+总人数4：-1+4=3
     */
    getPlayerViewPos(move, keys) {
      return keys.map((k, idx) => {
        return this.getViewPos(idx, move, keys.length);
      });
    }
    /**
     * 获取单个客户端位置（参照视角玩家）
     * @param pos 视角玩家的服务端位置
     * @param move 视角玩家调整到靠显示器一侧的移位
     * @param len 玩家数量
     */
    getViewPos(pos, move, len) {
      return pos - move >= 0 ? pos - move : pos - move + len;
    }
    /**
     * 绘制全部玩家头像
     * @private
     */
    renderAllPlayer(roomInfo) {
      const userInfo = dataManager.getData("userInfo");
      const gameInfo = dataManager.getData("gameInfo");
      const tableIds = gameInfo == null ? void 0 : gameInfo.tableIds;
      if (!roomInfo || JSON.stringify(roomInfo) === "{}") return;
      this.playerNum = tableIds == null ? void 0 : tableIds.length;
      const meIdx = tableIds.findIndex((o) => o == (userInfo == null ? void 0 : userInfo.id));
      const viewPos = this.viewPos = this.getPlayerViewPos(meIdx, tableIds);
      const banker = this.owner.getChildByName("banker");
      banker == null ? void 0 : banker.removeSelf();
      tableIds.map((o, idx) => {
        this.renderAvatar(viewPos, idx);
      });
    }
    /**
     * 有玩家进入房间
     */
    joinRoom(roomInfo) {
      if (!roomInfo) {
        roomInfo = dataManager.getData("roomInfo");
      }
      this.renderAllPlayer(roomInfo);
    }
    /**
     * 开始游戏
     * @private
     */
    startGame() {
      var _a3;
      const roomInfo = dataManager.getData("roomInfo");
      const userInfo = dataManager.getData("userInfo");
      const gameInfo = dataManager.getData("gameInfo");
      const tableIds = gameInfo == null ? void 0 : gameInfo.tableIds;
      const room = roomInfo[userInfo == null ? void 0 : userInfo.id];
      if (tableIds.length < this.allowPlayerCount) {
        return;
      }
      if (!(room == null ? void 0 : room.isHomeOwner)) {
        return;
      }
      this.playerNum = tableIds == null ? void 0 : tableIds.length;
      const meIdx = tableIds.findIndex((o) => o == (userInfo == null ? void 0 : userInfo.id));
      const viewPos = this.viewPos = this.getPlayerViewPos(meIdx, tableIds);
      const roomId = (_a3 = roomInfo[userInfo == null ? void 0 : userInfo.id]) == null ? void 0 : _a3.roomId;
      this._socket.sendMessage(JSON.stringify({ type: "startGame", roomId }));
      this.startBtn.visible = false;
    }
    /**
     * 断线重连，获取全部数据
     */
    getDataByPlayerId() {
      const userInfo = dataManager.getData("userInfo");
      this._socket.sendMessage(JSON.stringify({ type: "reconnect", data: { userId: userInfo == null ? void 0 : userInfo.id } }));
    }
    /**
     * 初始化玩家视角位置
     */
    initViewPos() {
      const userInfo = dataManager.getData("userInfo");
      const gameInfo = dataManager.getData("gameInfo");
      const tableIds = gameInfo == null ? void 0 : gameInfo.tableIds;
      this.playerNum = tableIds == null ? void 0 : tableIds.length;
      const meIdx = tableIds.findIndex((o) => o == (userInfo == null ? void 0 : userInfo.id));
      const viewPos = this.viewPos = this.getPlayerViewPos(meIdx, tableIds);
    }
    /**
     * 获取手牌的图片资源
     */
    getHandCardImageUrl(num) {
      let unit = num % 50 > 30 ? "b" : num % 50 > 20 ? "t" : num % 50 > 10 ? "w" : "";
      let unitNum = num % 50 % 10;
      return `resources/apes/myCard/${unit}${unitNum}.png`;
    }
    /**
     * 获取打出去的牌的图片资源
     * @param num
     * @param viewPosNum
     */
    getPlayedCardsImageUrl(num, viewPosNum) {
      const unit = num % 50 > 30 ? "b" : num % 50 > 20 ? "t" : num % 50 > 10 ? "w" : "";
      const unitNum = num % 50 % 10;
      const posFolder = viewPosNum === 0 ? "first" : viewPosNum === 1 ? "second" : viewPosNum === 2 ? "third" : viewPosNum === 3 ? "fourth" : "";
      return `resources/apes/${posFolder}/b${unit}${unitNum}.png`;
    }
    /**
     * 绘制手牌
     */
    renderHandCards(idx, handCards, pengCards = [], gangCards = []) {
      this.myCardImgs = [];
      if (this.viewPos[idx] === 0) {
        let hbox = this.owner.getChildByName(`frontInHand`);
        if (hbox) {
          hbox.destroyChildren();
        } else {
          hbox = new HBox();
          hbox.name = "frontInHand";
        }
        let firstX = (Laya.stage.designWidth - handCards.length * 65) / 2 + (pengCards.length / 3 + gangCards.length / 4) * 46, firstY = Laya.stage.designHeight - 99 - 30;
        const operateCards = pengCards.concat(gangCards);
        operateCards == null ? void 0 : operateCards.map((p, childIdx) => {
          let imgUrl = this.getPlayedCardsImageUrl(p, this.viewPos[idx]);
          let img = new Image(imgUrl);
          img.pos(146 + childIdx * 42, firstY + 20);
          img.name = `pengCard`;
          this.owner.addChild(img);
        });
        handCards == null ? void 0 : handCards.map((h, childIdx) => {
          let imgUrl = this.getHandCardImageUrl(h);
          let img = new Image(imgUrl);
          img.name = `myCard`;
          this.myCardImgs.push(img);
          hbox.name = "frontInHand";
          img.on(Event.CLICK, this, this.handleCardClick, [firstY, `frontInHand`, childIdx, h]);
          hbox.size(handCards.length * 65, 99);
          hbox.pos(firstX, firstY);
          hbox.addChild(img);
          return img;
        });
        this.owner.addChild(hbox);
      } else if (this.viewPos[idx] === 1) {
        let vbox = this.owner.getChildByName(`rightInHand`);
        const firstX = Laya.stage.designWidth - 30 - 30 - 26, firstY = 200;
        if (vbox) {
          vbox.destroyChildren();
        } else {
          vbox = new VBox();
          vbox.name = `rightInHand`;
          vbox.pos(firstX, firstY);
          vbox.space = -36;
        }
        const operateCards = pengCards.concat(gangCards);
        operateCards == null ? void 0 : operateCards.map((p, childIdx) => {
          let imgUrl = this.getPlayedCardsImageUrl(p, this.viewPos[idx]);
          let img = new Image(imgUrl);
          img.pos(firstX - 59 - 30, firstY + 36 * childIdx);
          img.name = `pengCard`;
          this.owner.addChild(img);
        });
        handCards == null ? void 0 : handCards.map((h, childIdx) => {
          let img = new Image(this.rightInHand);
          img.name = `rightInHand${childIdx}`;
          img.pos(0, 20 * childIdx);
          vbox.addChild(img);
        });
        this.owner.addChild(vbox);
      } else if (this.viewPos[idx] === 2) {
        const firstX = 370, firstY = 30;
        const operateCards = pengCards.concat(gangCards);
        let hbox = this.owner.getChildByName(`oppositeInHand`);
        if (hbox) {
          hbox == null ? void 0 : hbox.destroyChildren();
        } else {
          hbox = new HBox();
          hbox.name = `oppositeInHand`;
          hbox.pos(firstX, firstY);
        }
        operateCards == null ? void 0 : operateCards.map((p, childIdx) => {
          let imgUrl = this.getPlayedCardsImageUrl(p, this.viewPos[idx]);
          let img = new Image(imgUrl);
          img.pos(Laya.stage.designWidth - 200 - childIdx * 40, firstY);
          img.name = `pengCard`;
          this.owner.addChild(img);
        });
        handCards == null ? void 0 : handCards.map((h, childIdx) => {
          let img = new Image(this.oppositeInHand);
          img.pos(childIdx * 44, 0);
          img.name = `handCard-${idx}-${childIdx}`;
          hbox.size((handCards == null ? void 0 : handCards.length) * 44, 72);
          hbox.addChild(img);
        });
        this.owner.addChild(hbox);
      } else if (this.viewPos[idx] === 3) {
        let vbox = this.owner.getChildByName(`leftInHand`);
        const firstX = 30 + 20, firstY = 200;
        if (vbox) {
          vbox.destroyChildren();
        } else {
          vbox = new VBox();
          vbox.name = `leftInHand`;
          vbox.pos(firstX, firstY);
          vbox.space = -36;
        }
        const operateCards = pengCards.concat(gangCards);
        operateCards == null ? void 0 : operateCards.map((p, childIdx) => {
          let imgUrl = this.getPlayedCardsImageUrl(p, this.viewPos[idx]);
          let img = new Image(imgUrl);
          img.pos(firstX + 40, firstY + 32 * childIdx);
          img.name = `pengCard`;
          this.owner.addChild(img);
        });
        handCards == null ? void 0 : handCards.map((h, childIdx) => {
          let img = new Image(this.leftInHand);
          vbox.addChild(img);
        });
        this.owner.addChild(vbox);
      }
    }
    /**
     * 选中牌
     * @param y
     * @param name
     * @param childIdx
     * @param cardNum
     * @private
     */
    handleCardClick(y, name, childIdx, cardNum) {
      let permission = this.checkCanOperate();
      if (!permission) return;
      const hbox = this.owner.getChildByName(name);
      const cardNode = hbox.getChildAt(childIdx);
      if (cardNode.y === 0) {
        cardNode.y = cardNode.y - 50;
        hbox == null ? void 0 : hbox._children.map((node, idx) => {
          if (childIdx !== idx) node.y = 0;
        });
        this.playAudio("牌点击");
      } else {
        this.activeCard = cardNode;
        this.handleCardPlay(cardNum);
      }
    }
    /**
     * 出牌
     */
    handleCardPlay(cardNum) {
      var _a3;
      const roomInfo = dataManager.getData("roomInfo");
      const userInfo = dataManager.getData("userInfo");
      const roomId = (_a3 = roomInfo[userInfo == null ? void 0 : userInfo.id]) == null ? void 0 : _a3.roomId;
      this._socket.sendMessage(JSON.stringify({ type: "playCard", data: { roomId, cardNum, userId: userInfo == null ? void 0 : userInfo.id } }));
      this.activeCardNum = cardNum;
      if (this.bumpBtn.visible) this.bumpBtn.visible = false;
      if (this.gangBtn.visible) this.gangBtn.visible = false;
      if (this.winningBtn.visible) this.winningBtn.visible = false;
      this.playAudio("出牌");
    }
    /**
     * 20秒倒计时之后，玩家仍未出牌，则系统AI直接辅助出牌
     */
    handleCardPlayByAI() {
      var _a3, _b2;
      if (this.winningBtn.visible) {
        this.win();
        this.winningBtn.visible = false;
        this.passBtn.visible = false;
        return;
      }
      if (this.gangBtn.visible) {
        this.gang();
        this.gangBtn.visible = false;
        this.passBtn.visible = false;
        return;
      }
      if (this.bumpBtn.visible) {
        this.peng();
        this.bumpBtn.visible = false;
        this.passBtn.visible = false;
        return;
      }
      let permission = this.checkCanOperate();
      if (!permission) return;
      const roomInfo = dataManager.getData("roomInfo");
      const userInfo = dataManager.getData("userInfo");
      const roomId = (_a3 = roomInfo[userInfo == null ? void 0 : userInfo.id]) == null ? void 0 : _a3.roomId;
      const handCards = (_b2 = roomInfo[userInfo == null ? void 0 : userInfo.id]) == null ? void 0 : _b2.handCards;
      const len = handCards == null ? void 0 : handCards.length;
      const randomIdx = Math.floor(Math.random() * len);
      const cardNum = handCards[randomIdx];
      this._socket.sendMessage(JSON.stringify({ type: "playCard", data: { roomId, cardNum, userId: userInfo == null ? void 0 : userInfo.id } }));
      this.activeCardNum = cardNum;
      if (this.passBtn.visible) this.passBtn.visible = false;
      if (this.bumpBtn.visible) this.bumpBtn.visible = false;
      if (this.gangBtn.visible) this.gangBtn.visible = false;
    }
    /**
     * 绘制打出去的牌
     */
    renderPlayedCards(cardNum, playerId, roomInfo, gameInfo) {
      var _a3;
      if (typeof cardNum === "number") this.activeCardNum = cardNum;
      const tableIds = gameInfo == null ? void 0 : gameInfo.tableIds;
      const playerCards = (_a3 = roomInfo[playerId]) == null ? void 0 : _a3.playedCards;
      const idx = tableIds == null ? void 0 : tableIds.findIndex((o) => o === playerId);
      if (this.viewPos[idx] === 0) {
        const hCount = 12;
        let rowNum = 1;
        let colNum = 1;
        this.playedCards0.removeChildren();
        playerCards == null ? void 0 : playerCards.map((k, childIdx) => {
          let imgUrl = this.getPlayedCardsImageUrl(k, this.viewPos[idx]);
          let img = new Image(imgUrl);
          img.name = `playedCard-${idx}-${childIdx}`;
          rowNum = Math.floor(childIdx / hCount) % 3;
          colNum = childIdx % hCount;
          img.pos(colNum * 44, rowNum * 46);
          this.playedCards0.addChild(img);
          if (k === cardNum) {
            this.activePlayedImg.visible = true;
            this.activePlayedImg.pos(this.playedCards0.x + colNum * 44 + 15, this.playedCards0.y + rowNum * 52 - 35);
            this.createTween(this.playedCards0.y + rowNum * 52 - 35);
          }
        });
      } else if (this.viewPos[idx] === 1) {
        const vCount = 9;
        let rowNum = 1;
        let colNum = 1;
        this.playedCards1.removeChildren();
        playerCards == null ? void 0 : playerCards.map((k, childIdx) => {
          let oldImg = this.owner.getChildByName(`playedCard-${idx}-${childIdx}`);
          if (oldImg) oldImg.removeSelf();
          let imgUrl = this.getPlayedCardsImageUrl(k, this.viewPos[idx]);
          let img = new Image(imgUrl);
          img.name = `playedCard-${idx}-${childIdx}`;
          rowNum = childIdx % vCount;
          colNum = Math.floor(childIdx / vCount) % 4;
          img.pos(colNum * 54, rowNum * 36);
          this.playedCards1.addChild(img);
          if (k === cardNum) {
            this.activePlayedImg.visible = true;
            this.activePlayedImg.pos(this.playedCards1.x + colNum * 54 + 22, this.playedCards1.y + rowNum * 36 - 30);
            this.createTween(this.playedCards1.y + rowNum * 36 - 30);
          }
        });
      } else if (this.viewPos[idx] === 2) {
        const hCount = 12;
        let rowNum = 1;
        let colNum = 1;
        this.playedCards2.removeChildren();
        playerCards == null ? void 0 : playerCards.map((k, childIdx) => {
          let oldImg = this.owner.getChildByName(`playedCard-${idx}-${childIdx}`);
          if (oldImg) oldImg.removeSelf();
          let imgUrl = this.getPlayedCardsImageUrl(k, this.viewPos[idx]);
          let img = new Image(imgUrl);
          img.name = `playedCard-${idx}-${childIdx}`;
          rowNum = Math.floor(childIdx / hCount) % 3;
          colNum = childIdx % hCount;
          img.zOrder = 2 - rowNum;
          img.pos(colNum * 40, (2 - rowNum) * 44);
          this.playedCards2.addChild(img);
          if (k === cardNum) {
            this.activePlayedImg.visible = true;
            this.activePlayedImg.pos(this.playedCards2.x + colNum * 40 + 12, this.playedCards2.y + (2 - rowNum) * 54 - 30);
            this.createTween(this.playedCards2.y + (2 - rowNum) * 54 - 30);
          }
        });
      } else if (this.viewPos[idx] === 3) {
        const vCount = 9;
        let rowNum = 1;
        let colNum = 1;
        this.playedCards3.removeChildren();
        playerCards == null ? void 0 : playerCards.map((k, childIdx) => {
          let oldImg = this.owner.getChildByName(`playedCard-${idx}-${childIdx}`);
          if (oldImg) oldImg.removeSelf();
          let imgUrl = this.getPlayedCardsImageUrl(k, this.viewPos[idx]);
          let img = new Image(imgUrl);
          img.name = `playedCard-${idx}-${childIdx}`;
          rowNum = childIdx % vCount;
          colNum = Math.floor(childIdx / vCount) % 4;
          img.pos((3 - colNum) * 54, rowNum * 32);
          this.playedCards3.addChild(img);
          if (k === cardNum) {
            this.activePlayedImg.visible = true;
            this.activePlayedImg.pos(this.playedCards3.x + (3 - colNum) * 54 + 20, this.playedCards3.y + rowNum * 32 - 35);
            this.createTween(this.playedCards3.y + rowNum * 32 - 35);
          }
        });
      }
    }
    /**
     * 创建指示logo漂浮动画
     * @private
     */
    createTween(y) {
      Laya.timer.frameLoop(1, this, this.createTweenFn, [y]);
    }
    /**
     * 创建指示logo漂浮动画函数
     * @param y
     * @private
     */
    createTweenFn(y) {
      Tween.to(this.activePlayedImg, { "y": y - 10 }, 400, Laya.Ease.sineInOut, Laya.Handler.create(this, () => {
        Tween.to(this.activePlayedImg, { "y": y + 10 }, 400, Laya.Ease.sineInOut);
      }));
    }
    /**
     * todo 绘制桌上未开的牌
     */
    renderTableCards() {
    }
    /**
     * 暂停游戏
     */
    pauseGame() {
      Laya.timer.pause();
    }
    /**
     * 停止游戏
     */
    stopGame() {
      this._started = false;
      Laya.timer.clearAll(this);
    }
    /**
     * 渲染牌桌状态（出牌人指向等）
     */
    renderTimeStatus() {
      const userInfo = dataManager.getData("userInfo");
      const roomInfo = dataManager.getData("roomInfo");
      const gameInfo = dataManager.getData("gameInfo");
      const tableIds = gameInfo == null ? void 0 : gameInfo.tableIds;
      this.playerNum = tableIds == null ? void 0 : tableIds.length;
      const move = tableIds.findIndex((o) => o == (userInfo == null ? void 0 : userInfo.id));
      const optionPos = gameInfo == null ? void 0 : gameInfo.optionPos;
      let optionIdx = 0;
      optionIdx = optionPos - move >= 0 ? optionPos - move : optionPos - move + this.viewPos.length;
      this.timesArr.map((tmp) => {
        if (optionIdx === tmp) {
          this[`time${tmp}`].visible = true;
        } else {
          this[`time${tmp}`].visible = false;
        }
      });
      this.startTime = Date.now();
    }
    /**
     * 渲染牌桌中间的倒计时
     * 每次出牌自定义20秒杠碰胡考虑时间
     */
    renderCountdown() {
      const gameInfo = dataManager.getData("gameInfo");
      const optionTime = gameInfo == null ? void 0 : gameInfo.optionTime;
      const currentTime = Date.now();
      const elapsedMillis = currentTime - optionTime;
      let remainingTime = this.countdownNum - Math.floor(elapsedMillis / 1e3);
      if (remainingTime < 0) {
        remainingTime = 0;
      }
      let firstDigit = Math.floor(remainingTime / 10);
      let secondDigit = remainingTime % 10;
      const imgUrl1 = `resources/apes/number/${firstDigit}.png`;
      const imgUrl2 = `resources/apes/number/${secondDigit}.png`;
      this.countdown0.skin = imgUrl1;
      this.countdown1.skin = imgUrl2;
      this.countdown0.visible = true;
      this.countdown1.visible = true;
      if (remainingTime <= 0) {
        this.handleCardPlayByAI();
        Laya.timer.clear(this, this.renderCountdown);
        this.countdown0.visible = false;
        this.countdown1.visible = false;
      }
    }
    /**
     * 倒计时定时器方法
     */
    renderCountdownInterval() {
      Laya.timer.clear(this, this.renderCountdown);
      Laya.timer.frameLoop(60, this, this.renderCountdown);
    }
    /**
     * 已经准备好，开始游戏
     */
    readyGameStart() {
      const userInfo = dataManager.getData("userInfo");
      const roomInfo = dataManager.getData("roomInfo");
      const gameInfo = dataManager.getData("gameInfo");
      const remainingNum = gameInfo == null ? void 0 : gameInfo.remainingNum;
      const tableIds = gameInfo == null ? void 0 : gameInfo.tableIds;
      this.playerNum = tableIds == null ? void 0 : tableIds.length;
      const meIdx = tableIds.findIndex((o) => o == (userInfo == null ? void 0 : userInfo.id));
      this.viewPos = this.getPlayerViewPos(meIdx, tableIds);
      this.renderTimeStatus();
      tableIds.map((o, idx) => {
        var _a3;
        this.renderHandCards(idx, (_a3 = roomInfo[o]) == null ? void 0 : _a3.handCards);
      });
      this.renderAllPlayer(roomInfo);
      this._started = true;
      this.playAudio("背景音乐");
      this.remainingLabel.text = remainingNum == null ? void 0 : remainingNum.toString();
    }
    /**
     * 服务器下发一张牌（摸一张新牌）
     * @param cardNum
     * @param playerId
     */
    deliverCard(cardNum, playerId) {
      const userInfo = dataManager.getData("userInfo");
      const gameInfo = dataManager.getData("gameInfo");
      if ((userInfo == null ? void 0 : userInfo.id) === playerId) {
        this.activeCardNum = cardNum;
      }
      const remainingNum = gameInfo == null ? void 0 : gameInfo.remainingNum;
      this.remainingLabel.text = remainingNum == null ? void 0 : remainingNum.toString();
    }
    /**
     * 检测我当前状态是否轮到我操作
     */
    checkCanOperate() {
      const userInfo = dataManager.getData("userInfo");
      const gameInfo = dataManager.getData("gameInfo");
      const optionPos = gameInfo == null ? void 0 : gameInfo.optionPos;
      const tableIds = gameInfo == null ? void 0 : gameInfo.tableIds;
      if (tableIds[optionPos] === (userInfo == null ? void 0 : userInfo.id)) {
        return true;
      } else {
        return false;
      }
    }
    /**
     * 检测道可以执行操作（碰杠胡）
     */
    checkOperate(operateType, playerId) {
      const userInfo = dataManager.getData("userInfo");
      if ((userInfo == null ? void 0 : userInfo.id) !== playerId) return;
      if (operateType === "peng") {
        this.bumpBtn.visible = true;
        this.passBtn.visible = true;
      } else if (operateType === "gang") {
        this.gangBtn.visible = true;
        this.passBtn.visible = true;
      } else if (operateType === "win") {
        this.winningBtn.visible = true;
      } else {
      }
    }
    /**
     * 过
     * 【不执行任何操作，隐藏 杠/碰 】
     */
    pass() {
      this.passBtn.visible = false;
      this.bumpBtn.visible = false;
      this.gangBtn.visible = false;
    }
    /**
     * 碰
     * 【打出2张牌】
     */
    peng() {
      var _a3, _b2;
      const userInfo = dataManager.getData("userInfo");
      const roomInfo = dataManager.getData("roomInfo");
      const handCards = (_a3 = roomInfo[userInfo == null ? void 0 : userInfo.id]) == null ? void 0 : _a3.handCards;
      const roomId = (_b2 = roomInfo[userInfo == null ? void 0 : userInfo.id]) == null ? void 0 : _b2.roomId;
      let pengArr = [];
      handCards.map((m) => {
        if (m % 50 === this.activeCardNum % 50) {
          pengArr.push(m);
        }
      });
      this._socket.sendMessage(JSON.stringify({ type: "peng", data: { roomId, pengArr, userId: userInfo == null ? void 0 : userInfo.id, cardNum: this.activeCardNum } }));
      this.bumpBtn.visible = false;
      this.passBtn.visible = false;
      this.playAudio("碰");
    }
    /**
     * 杠
     * 【打出3张牌】
     */
    gang() {
      var _a3, _b2;
      const userInfo = dataManager.getData("userInfo");
      const roomInfo = dataManager.getData("roomInfo");
      const handCards = (_a3 = roomInfo[userInfo == null ? void 0 : userInfo.id]) == null ? void 0 : _a3.handCards;
      const roomId = (_b2 = roomInfo[userInfo == null ? void 0 : userInfo.id]) == null ? void 0 : _b2.roomId;
      let gangArr = [];
      handCards.map((m) => {
        if (m % 50 === this.activeCardNum % 50) {
          gangArr.push(m);
        }
      });
      this._socket.sendMessage(JSON.stringify({ type: "gang", data: { roomId, gangArr, userId: userInfo == null ? void 0 : userInfo.id, cardNum: this.activeCardNum } }));
      this.gangBtn.visible = false;
      this.passBtn.visible = false;
      this.playAudio("杠");
    }
    /**
     * 点击选择胡牌
     * 【告诉服务端，玩家选择胡牌操作】
     */
    win() {
      const userInfo = dataManager.getData("userInfo");
      const roomInfo = dataManager.getData("roomInfo");
      const roomId = roomInfo[userInfo == null ? void 0 : userInfo.id].roomId;
      this._socket.sendMessage(JSON.stringify({ type: "win", data: { roomId, cardNum: this.activeCardNum, userId: userInfo == null ? void 0 : userInfo.id } }));
      this.playAudio("胡");
    }
    /**
     * 胡牌之后的结算
     * 服务端统一计算
     */
    winning(result, type) {
      if (!result) return;
      if (type === "winning") {
        this.playAnimation();
      }
      this.activePlayedImg.visible = false;
      this.settlementDialog.visible = true;
      this.settlementDialog.zOrder = 1e3;
      const userInfo = dataManager.getData("userInfo");
      const gameInfo = dataManager.getData("gameInfo");
      const tableIds = gameInfo == null ? void 0 : gameInfo.tableIds;
      if (result[userInfo == null ? void 0 : userInfo.id].isFlow) {
        this.status.skin = `resources/apes/settlement/draw.png`;
      } else if (result[userInfo == null ? void 0 : userInfo.id].isWinner) {
        this.status.skin = `resources/apes/settlement/win.png`;
      } else {
        this.status.skin = `resources/apes/settlement/lost.png`;
      }
      tableIds.map((o, idx) => {
        var _a3;
        const info = result[o];
        const cards = (info == null ? void 0 : info.cards) || [];
        cards.map((c, cardIdx) => {
          let imgUrl = this.getPlayedCardsImageUrl(c, 0);
          const img = new Image(imgUrl);
          img.scale(0.8, 0.8);
          const hBox = this[`playerCards${idx}`].getChildByName("HBox");
          hBox.addChild(img);
        });
        const txt = this[`playerCards${idx}`].getChildByName("score");
        txt.text = (info == null ? void 0 : info.score) >= 0 ? "+" + (info == null ? void 0 : info.score) : (_a3 = info == null ? void 0 : info.score) == null ? void 0 : _a3.toString();
      });
      this.winningBtn.visible = false;
      this.passBtn.visible = false;
      this.backHall.visible = true;
    }
    /**
     * 返回大厅
     */
    backToHall() {
      Laya.Scene.open("Hall.ls");
      const userInfo = dataManager.getData("userInfo");
      let http = new HttpHelper_default();
      http.post("/room/quitRoom", { userId: userInfo == null ? void 0 : userInfo.id, roomId: userInfo == null ? void 0 : userInfo.roomId }, () => {
      });
    }
    /**
     * 播放动画
     */
    playAnimation() {
      let ani = new Laya.Animation();
      ani.pos(590, 230);
      ani.source = "resources/animations/win.atlas";
      ani.play(0, false);
      this.owner.addChild(ani);
      ani.on(Event.COMPLETE, this, () => {
        ani.destroy();
      });
    }
    /**
     * 播放音频
     */
    playAudio(type) {
      let sound = new Laya.SoundNode();
      sound.source = this.getAudioRes(type);
      sound.loop = 0;
      sound.autoPlay = true;
      sound.isMusic = type === "背景音乐";
      sound.play(type === "背景音乐" ? 0 : 1, Handler.create(this, this.playAudioCb, [sound]));
      this.owner.addChild(sound);
    }
    /**
     * 获取音效资源
     */
    getAudioRes(type) {
      let audioUrl;
      if (type === "背景音乐") {
        audioUrl = `resources/sound/背景音乐.mp3`;
      } else if (type === "牌点击") {
        audioUrl = `resources/sound/牌点击音效.mp3`;
      } else if (type === "出牌") {
        audioUrl = `resources/sound/出牌音效.mp3`;
      } else if (type === "碰") {
        audioUrl = `resources/sound/碰音效.mp3`;
      } else if (type === "杠") {
        audioUrl = `resources/sound/杠音效.mp3`;
      } else if (type === "胡") {
        audioUrl = `resources/sound/胡音效.mp3`;
      }
      return audioUrl;
    }
    /**
     * 播放音频handle回调
     * @param sound
     */
    playAudioCb(sound) {
      sound.destroy();
    }
    //每帧更新时执行，尽量不要在这里写大循环逻辑或者使用getComponent方法
    onUpdate() {
      let now = Date.now();
      if (now - this.startTime > this.timeInterval && this._started) {
        this.startTime = now;
        this.renderCountdown();
      }
    }
  };
  __name(Main, "Main");
  __decorateClass([
    property({ type: Sprite })
  ], Main.prototype, "gameLayout", 2);
  __decorateClass([
    property({ type: Laya.Label })
  ], Main.prototype, "roomNum", 2);
  __decorateClass([
    property({ type: Laya.Image })
  ], Main.prototype, "startBtn", 2);
  __decorateClass([
    property({ type: Laya.Sprite })
  ], Main.prototype, "optionsSpe", 2);
  __decorateClass([
    property({ type: Laya.Image })
  ], Main.prototype, "passBtn", 2);
  __decorateClass([
    property({ type: Laya.Image })
  ], Main.prototype, "bumpBtn", 2);
  __decorateClass([
    property({ type: Laya.Image })
  ], Main.prototype, "gangBtn", 2);
  __decorateClass([
    property({ type: Laya.Image })
  ], Main.prototype, "winningBtn", 2);
  __decorateClass([
    property({ type: Laya.Image })
  ], Main.prototype, "time0", 2);
  __decorateClass([
    property({ type: Laya.Image })
  ], Main.prototype, "time1", 2);
  __decorateClass([
    property({ type: Laya.Image })
  ], Main.prototype, "time2", 2);
  __decorateClass([
    property({ type: Laya.Image })
  ], Main.prototype, "time3", 2);
  __decorateClass([
    property({ type: Laya.Image })
  ], Main.prototype, "countdown0", 2);
  __decorateClass([
    property({ type: Laya.Image })
  ], Main.prototype, "countdown1", 2);
  __decorateClass([
    property({ type: Laya.Label })
  ], Main.prototype, "remainingLabel", 2);
  __decorateClass([
    property({ type: Sprite })
  ], Main.prototype, "playedCards0", 2);
  __decorateClass([
    property({ type: Sprite })
  ], Main.prototype, "playedCards1", 2);
  __decorateClass([
    property({ type: Sprite })
  ], Main.prototype, "playedCards2", 2);
  __decorateClass([
    property({ type: Sprite })
  ], Main.prototype, "playedCards3", 2);
  __decorateClass([
    property({ type: Laya.Image })
  ], Main.prototype, "activePlayedImg", 2);
  __decorateClass([
    property({ type: Laya.Dialog })
  ], Main.prototype, "settlementDialog", 2);
  __decorateClass([
    property({ type: Laya.Image })
  ], Main.prototype, "status", 2);
  __decorateClass([
    property({ type: Laya.Sprite })
  ], Main.prototype, "playerCards0", 2);
  __decorateClass([
    property({ type: Laya.Sprite })
  ], Main.prototype, "playerCards1", 2);
  __decorateClass([
    property({ type: Laya.Sprite })
  ], Main.prototype, "playerCards2", 2);
  __decorateClass([
    property({ type: Laya.Sprite })
  ], Main.prototype, "playerCards3", 2);
  __decorateClass([
    property({ type: Laya.Image })
  ], Main.prototype, "backHall", 2);
  Main = __decorateClass([
    regClass2("7bad1742-6eed-4d8d-81c0-501dc5bf03d6", "../src/Main.ts")
  ], Main);

  // src/MainRT.ts
  var dataManager2 = new mapManager_default();
  var { regClass: regClass3, property: property2 } = Laya;
  var MainRT = class extends Laya.Scene {
    // declare owner : Laya.Sprite;
    constructor() {
      super();
      MainRT.instance = this;
    }
    static getInstance() {
      if (!MainRT.instance) {
        MainRT.instance = new MainRT();
      }
      return MainRT.instance;
    }
    /**
     * 上个场景的参数
     * @param params
     */
    onOpened(params) {
      var _a3;
      if (params && params === "oldPlayer") {
        this._control.getDataByPlayerId();
      } else {
        (_a3 = this._control) == null ? void 0 : _a3.joinRoom(null);
      }
    }
    /**
     * 有时候onEnable执行的太慢，长连接的回调先于onEnable执行，导致this._control还没初始化
     */
    init() {
      this._control = this.getComponent(Main);
    }
    onEnable() {
      this._control = this.getComponent(Main);
    }
    /**
     * 初始化玩家视角位置
     */
    initViewPos() {
      this._control.initViewPos();
    }
    /**
     * 开始游戏
     */
    startGame() {
      this._control.startGame();
    }
    /**
     * 结束游戏
     */
    stopGame() {
      this._control.stopGame();
    }
    /**
     * 有玩家加入了房间
     */
    joinRoom(roomInfo) {
      var _a3;
      (_a3 = this._control) == null ? void 0 : _a3.joinRoom(roomInfo);
    }
    /**
     * 准备绘制游戏牌和人物
     */
    readyGameStart() {
      this._control.readyGameStart();
    }
    /**
     * 绘制打出去的牌
     */
    renderPlayedCards(cardNum, playerId, roomInfo, gameInfo) {
      this._control.renderPlayedCards(cardNum, playerId, roomInfo, gameInfo);
    }
    /**
     * 绘制手牌
     */
    renderHandCards(idx, handCards, pengCards, gangCards) {
      this._control.renderHandCards(idx, handCards, pengCards, gangCards);
    }
    /**
     * 服务器下发一张牌
     */
    deliverCard(cardNum, playerId) {
      this._control.deliverCard(cardNum, playerId);
    }
    /**
     * 绘制操作人指示图标
     */
    renderTimeStatus() {
      this._control.renderTimeStatus();
    }
    /**
     * 可以操作
     */
    checkOperate(operateType, playerId) {
      this._control.checkOperate(operateType, playerId);
    }
    /**
     * 胡牌结算
     */
    winning(result, type) {
      this._control.winning(result, type);
    }
    /**
     * 进入游戏场景
     */
    enterGameScene() {
      console.log("加入游戏");
      Laya.Scene.open("Game.ls");
    }
  };
  __name(MainRT, "MainRT");
  MainRT = __decorateClass([
    regClass3("cb0e7602-93a5-40c9-ad93-5acbccef11f0", "../src/MainRT.ts")
  ], MainRT);

  // src/utils/HandleReceivedMessage.ts
  var { regClass: regClass4, property: property3 } = Laya;
  var dataManager3 = new mapManager_default();
  var HandleReceivedMessage = class {
    isJSON(str) {
      if (typeof str == "string") {
        try {
          JSON.parse(str);
          return true;
        } catch (e) {
          return false;
        }
      } else {
        return false;
      }
    }
    /**
     * Object.fromEntries 的兼容替代（Object.fromEntries是ES2019的语法）
     * @param entries
     */
    fromEntries(entries) {
      return entries.reduce((accumulator, [key, value]) => {
        accumulator[key] = value;
        return accumulator;
      }, {});
    }
    /**
     * websocket接收服务端消息后 - 回调操作
     */
    onMessageReceived(message) {
      var _a3, _b2, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
      let data;
      if (!this.isJSON(message)) {
        data = message;
      } else {
        data = JSON.parse(message);
      }
      console.log("处理来自服务端的消息:", data);
      const type = data == null ? void 0 : data.type;
      const gameInfo = (_a3 = data == null ? void 0 : data.data) == null ? void 0 : _a3.gameInfo;
      const roomInfo = (_b2 = data == null ? void 0 : data.data) == null ? void 0 : _b2.roomInfo;
      const playerInfo = (_c = data == null ? void 0 : data.data) == null ? void 0 : _c.playerInfo;
      roomInfo && dataManager3.setData("roomInfo", roomInfo);
      gameInfo && dataManager3.setData("gameInfo", gameInfo);
      playerInfo && dataManager3.setData("playerInfo", playerInfo);
      if (type === "create") {
        if (roomInfo && typeof roomInfo === "object" && JSON.stringify(roomInfo) !== "{}") {
          MainRT.getInstance().enterGameScene();
        }
      } else if (type === "join") {
        MainRT.getInstance().joinRoom(roomInfo);
      } else if (type === "startGame") {
        MainRT.getInstance().readyGameStart();
      } else if (type === "reconnect") {
        MainRT.getInstance().initViewPos();
        MainRT.getInstance().renderTimeStatus();
        (_d = gameInfo == null ? void 0 : gameInfo.tableIds) == null ? void 0 : _d.map((o, idx) => {
          var _a4;
          MainRT.getInstance().renderHandCards(idx, (_a4 = roomInfo[o]) == null ? void 0 : _a4.handCards, roomInfo[o].pengCards, roomInfo[o].gangCards);
          MainRT.getInstance().renderPlayedCards(null, o, roomInfo, gameInfo);
        });
      } else if (type === "playCard") {
        const playerId = (_e = data == null ? void 0 : data.data) == null ? void 0 : _e.playerId;
        const cardNum = (_f = data == null ? void 0 : data.data) == null ? void 0 : _f.cardNum;
        MainRT.getInstance().renderPlayedCards(cardNum, playerId, roomInfo, gameInfo);
        const idx = (_g = gameInfo == null ? void 0 : gameInfo.tableIds) == null ? void 0 : _g.findIndex((o) => o === playerId);
        MainRT.getInstance().renderHandCards(idx, roomInfo[playerId].handCards, roomInfo[playerId].pengCards, roomInfo[playerId].gangCards);
        MainRT.getInstance().renderTimeStatus();
      } else if (type === "operate") {
        const playerId = (_h = data == null ? void 0 : data.data) == null ? void 0 : _h.playerId;
        const operateType = (_i = data == null ? void 0 : data.data) == null ? void 0 : _i.operateType;
        if (operateType === 4) {
          MainRT.getInstance().checkOperate("win", playerId);
          MainRT.getInstance().renderTimeStatus();
        } else if (operateType === 3) {
          MainRT.getInstance().checkOperate("gang", playerId);
          MainRT.getInstance().renderTimeStatus();
        } else if (operateType === 2) {
          MainRT.getInstance().checkOperate("peng", playerId);
          MainRT.getInstance().renderTimeStatus();
        }
      } else if (type === "peng" || type === "gang") {
        (_j = gameInfo == null ? void 0 : gameInfo.tableIds) == null ? void 0 : _j.map((o, idx) => {
          MainRT.getInstance().renderPlayedCards(null, o, roomInfo, gameInfo);
          MainRT.getInstance().renderHandCards(idx, roomInfo[o].handCards, roomInfo[o].pengCards, roomInfo[o].gangCards);
          MainRT.getInstance().renderTimeStatus();
        });
      } else if (type === "winning") {
        const result = (_k = data.data) == null ? void 0 : _k.result;
        MainRT.getInstance().winning(result, type);
        MainRT.getInstance().stopGame();
      } else if (type === "deliverCard") {
        const playerId = (_l = data == null ? void 0 : data.data) == null ? void 0 : _l.playerId;
        const cardNum = (_m = data == null ? void 0 : data.data) == null ? void 0 : _m.cardNum;
        const tableIds = gameInfo == null ? void 0 : gameInfo.tableIds;
        const idx = tableIds == null ? void 0 : tableIds.findIndex((o) => o === playerId);
        MainRT.getInstance().deliverCard(cardNum, playerId);
        MainRT.getInstance().renderHandCards(idx, roomInfo[playerId].handCards, roomInfo[playerId].pengCards, roomInfo[playerId].gangCards);
      } else if (type === "flow") {
        const result = (_n = data.data) == null ? void 0 : _n.result;
        MainRT.getInstance().winning(result, type);
        MainRT.getInstance().stopGame();
      }
    }
  };
  __name(HandleReceivedMessage, "HandleReceivedMessage");
  HandleReceivedMessage = __decorateClass([
    regClass4("b65fca61-2818-4bb0-a638-79ad0ffe0b09", "../src/utils/HandleReceivedMessage.ts")
  ], HandleReceivedMessage);
  var handleReceivedMessage = new HandleReceivedMessage();
  var HandleReceivedMessage_default = handleReceivedMessage;

  // src/utils/SocketHelper.ts
  var _a2;
  var _SocketHelper = class _SocketHelper {
    // 当前重连次数
    constructor(url) {
      this.websocket = null;
      this.wsUrl = `${(_a2 = configs_default) == null ? void 0 : _a2.ws}`;
      this.heartbeatMsg = "ping";
      // 心跳消息，可以根据需要修改
      this.heartbeatInterval = null;
      // 心跳定时器ID
      this.heartbeatTimeoutInterval = null;
      // 心跳超时定时器ID
      this.heartbeatTimeout = 4e4;
      // 心跳超时时间，单位毫秒
      this.reconnectInterval = 5e3;
      // 重连间隔，单位毫秒
      this.maxReconnectAttempts = 10;
      // 最大重连次数
      this.reconnectAttempts = 0;
      this.url = `${this.wsUrl}${url}`;
    }
    /**
     * websocket单例
     */
    static getInstance(url) {
      if (!this._instance) {
        this._instance = new _SocketHelper(url);
      }
      return this._instance;
    }
    /**
     * 客户端主动连接
     * @param onSocketOpenCallback
     */
    connect(onSocketOpenCallback) {
      this.onSocketOpenCallback = onSocketOpenCallback;
      this.createWebSocket();
    }
    /**
     * 创建websocket连接
     * @private
     */
    createWebSocket() {
      this.websocket = new Laya.Socket();
      this.websocket.connectByUrl(this.url);
      this.output = this.websocket.output;
      this.websocket.on(Laya.Event.OPEN, this, this.onSocketOpen);
      this.websocket.on(Laya.Event.CLOSE, this, this.onSocketClose);
      this.websocket.on(Laya.Event.MESSAGE, this, this.onMessageReceived);
      this.websocket.on(Laya.Event.ERROR, this, this.onConnectError);
    }
    /**
     * 连接建立成功回调
     * @param e
     * @private
     */
    onSocketOpen(e = null) {
      console.log("ws连接服务端成功");
      this.onSocketOpenCallback();
      this.startHeartbeat();
      this.reconnectAttempts = 0;
    }
    /**
     * 客户端发送心跳消息
     */
    sendHeartbeat() {
      this.sendMessage(this.heartbeatMsg);
    }
    /**
     * 启动心跳定时器
     */
    startHeartbeat() {
      this.heartbeatInterval = setInterval(() => {
        this.sendHeartbeat();
      }, 3e4);
    }
    /**
     * 重置心跳超时定时器
     */
    resetHeartbeatTimeout() {
      this.clearHeartbeatTimeout();
      this.heartbeatTimeoutInterval = setTimeout(() => {
        var _a3;
        console.log("心跳超时，断开连接");
        (_a3 = this.websocket) == null ? void 0 : _a3.close();
      }, this.heartbeatTimeout);
    }
    /**
     * 停止心跳定时器
     */
    stopHeartbeat() {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
      this.clearHeartbeatTimeout();
    }
    /**
     * 清除心跳超时定时器
     */
    clearHeartbeatTimeout() {
      if (this.heartbeatTimeoutInterval) {
        clearTimeout(this.heartbeatTimeoutInterval);
        this.heartbeatTimeoutInterval = null;
      }
    }
    /**
     * websocket重连
     * @private
     */
    reconnect() {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Reconnecting attempt ${this.reconnectAttempts}...`);
        setTimeout(() => {
          this.createWebSocket();
        }, this.reconnectInterval);
      } else {
        console.log("Max reconnect attempts reached");
      }
    }
    /**
     * 客户端发送消息
     * @param msg
     */
    sendMessage(msg) {
      this.websocket.send(msg);
      this.websocket.flush();
    }
    /**
     * 客户端发送byte数据
     * @param byte
     */
    sendByte(byte) {
      var _a3;
      var message = "demonstrate <output.writeByte>";
      for (var i = 0; i < message.length; ++i) {
        (_a3 = this.output) == null ? void 0 : _a3.writeByte(message.charCodeAt(i));
      }
      this.websocket.flush();
    }
    /**
     * 连接断开后的事件回调
     * PS:服务器主动断开链接
     * @param e
     * @private
     */
    onSocketClose(e = null) {
      console.log("Socket closed");
      this.stopHeartbeat();
      this.reconnect();
    }
    /**
     * 有数据接收时的事件回调
     * @param message
     * @private
     */
    onMessageReceived(message = null) {
      console.log("从服务端接收websocket消息:", message);
      if (typeof message == "string") {
        HandleReceivedMessage_default.onMessageReceived(message);
      } else if (message instanceof ArrayBuffer) {
        console.log(new Laya.Byte(message).readUTFBytes());
      }
      this.websocket.input.clear();
    }
    /**
     * 出现异常后的事件回调
     * @param e
     * @private
     */
    onConnectError(e = null) {
      console.log("error");
      this.reconnect();
    }
  };
  __name(_SocketHelper, "SocketHelper");
  var SocketHelper = _SocketHelper;
  var SocketHelper_default = SocketHelper;

  // src/HallScript.ts
  var Event2 = Laya.Event;
  var { regClass: regClass5, property: property4 } = Laya;
  var dataManager4 = new mapManager_default();
  var HallScript = class extends Laya.Script {
    //组件被激活后执行，此时所有节点和组件均已创建完毕，此方法只执行一次
    onEnable() {
      this._socket = SocketHelper_default.getInstance("");
      this._socket.connect(() => {
        const userInfo = dataManager4.getData("userInfo");
        this._socket.sendMessage(JSON.stringify({ type: "setUserId", data: userInfo.id }));
      });
      this.createRoomBtn.on(Event2.CLICK, this, this.handleCreateRoom);
      this.joinRoomBtn.on(Event2.CLICK, this, this.handleJoinRoomDialog);
      this.joinBtn.on(Event2.CLICK, this, this.handleJoinRoom);
      this.enterRoomBtn.on(Event2.CLICK, this, this.enterRoom);
      this.reconnectDialogClose.on(Event2.CLICK, this, this.handleReconnectDialogClose);
    }
    /**
     * 创建房间
     * @private
     */
    handleCreateRoom() {
      const userInfo = dataManager4.getData("userInfo");
      let http = new HttpHelper_default();
      http.post("/room/createRoom", { userId: userInfo == null ? void 0 : userInfo.id }, this.onCreateRoomCallback);
    }
    /**
     * 创建房间回调
     * @param data
     * @private
     */
    onCreateRoomCallback(data) {
      if (!data || JSON.stringify(data) === "{}") {
        return;
      }
      dataManager4.setData("roomInfo", data == null ? void 0 : data.result);
    }
    /**
     * 唤起加入房间弹框
     */
    handleJoinRoomDialog() {
      this.joinRoomDialog.visible = true;
    }
    /**
     * 关闭加入房间弹框
     */
    handleReconnectDialogClose() {
      const userInfo = dataManager4.getData("userInfo");
      let http = new HttpHelper_default();
      http.post("/room/quitRoom", { userId: userInfo == null ? void 0 : userInfo.id, roomId: userInfo == null ? void 0 : userInfo.roomId }, this.onQuitRoomCallback);
    }
    /**
     * 退出房间回调方法
     * @param data
     * @private
     */
    onQuitRoomCallback(data) {
      console.log(data);
    }
    /**
     * 加入房间
     * @private
     */
    handleJoinRoom() {
      var _a3, _b2, _c;
      if (!((_a3 = this.roomTextInput) == null ? void 0 : _a3.text)) {
        console.log("未输入房间号！！！！", (_b2 = this.roomTextInput) == null ? void 0 : _b2.text);
        return;
      }
      const userInfo = dataManager4.getData("userInfo");
      let http = new HttpHelper_default();
      http.post("/room/joinRoom", { userId: userInfo == null ? void 0 : userInfo.id, roomId: (_c = this.roomTextInput) == null ? void 0 : _c.text }, this.onJoinRoomCallback);
    }
    /**
     * 加入房间
     * @private
     */
    onJoinRoomCallback(data) {
      if ((data == null ? void 0 : data.errCode) === 0) {
        dataManager4.setData("roomInfo", data == null ? void 0 : data.result);
        MainRT.getInstance().enterGameScene();
      }
    }
    /**
     * 断线之后，重连且重新进房
     * @private
     */
    enterRoom() {
      Laya.Scene.open("Game.ls", true, "oldPlayer");
    }
  };
  __name(HallScript, "HallScript");
  __decorateClass([
    property4({ type: Laya.Image })
  ], HallScript.prototype, "createRoomBtn", 2);
  __decorateClass([
    property4({ type: Laya.Image })
  ], HallScript.prototype, "joinRoomBtn", 2);
  __decorateClass([
    property4({ type: Laya.TextInput })
  ], HallScript.prototype, "roomTextInput", 2);
  __decorateClass([
    property4({ type: Laya.Dialog })
  ], HallScript.prototype, "joinRoomDialog", 2);
  __decorateClass([
    property4({ type: Laya.Image })
  ], HallScript.prototype, "joinBtn", 2);
  __decorateClass([
    property4({ type: Laya.Dialog })
  ], HallScript.prototype, "reconnectDialog", 2);
  __decorateClass([
    property4({ type: Laya.Image })
  ], HallScript.prototype, "enterRoomBtn", 2);
  __decorateClass([
    property4({ type: Laya.Button })
  ], HallScript.prototype, "reconnectDialogClose", 2);
  HallScript = __decorateClass([
    regClass5("a14bacd4-ac54-4dc4-b597-c83f2d3064a4", "../src/HallScript.ts")
  ], HallScript);

  // src/LoginScript.ts
  var { regClass: regClass6, property: property5 } = Laya;
  var Event3 = Laya.Event;
  var Script = class extends Laya.Script {
    //组件被激活后执行，此时所有节点和组件均已创建完毕，此方法只执行一次
    onAwake() {
      this.btn.on(Event3.CLICK, this, this.handleLogin);
    }
    /**
     * 预加载比较大的资源，比如音效、音乐
     */
    preloadRes() {
      let resArr = [
        `resources/sound/背景音乐.mp3`,
        `resources/sound/牌点击音效.mp3`,
        `resources/sound/出牌音效.mp3`
      ];
      Laya.loader.load(resArr).then((res) => {
      });
    }
    /**
     * 登录
     * @private
     */
    handleLogin() {
      var _a3, _b2;
      const account = (_a3 = this.accountTextInput) == null ? void 0 : _a3.text;
      const password = (_b2 = this.passwordTextInput) == null ? void 0 : _b2.text;
      let http = new HttpHelper_default();
      http.post("/user/login", { account, password }, this.loginCallback);
    }
    /**
     * 登录请求的回调
     * @private
     */
    loginCallback(data) {
      var _a3, _b2, _c;
      if (data.errCode === 0) {
        const dataManager5 = new mapManager_default();
        const playerInfo = (_a3 = data == null ? void 0 : data.result) == null ? void 0 : _a3.playerInfo;
        dataManager5.setData("gameServerInfo", (_b2 = data == null ? void 0 : data.result) == null ? void 0 : _b2.gameServerInfo);
        dataManager5.setData("userInfo", (_c = data == null ? void 0 : data.result) == null ? void 0 : _c.userInfo);
        dataManager5.setData("playerInfo", playerInfo);
        if (playerInfo && (playerInfo == null ? void 0 : playerInfo.playerStatus) >= 2) {
          Laya.Scene.open("Hall.ls", false, "oldPlayer");
        } else {
          Laya.Scene.open("Hall.ls");
        }
      }
    }
    //每帧更新时执行，尽量不要在这里写大循环逻辑或者使用getComponent方法
    onUpdate() {
    }
  };
  __name(Script, "Script");
  __decorateClass([
    property5({ type: Laya.TextInput })
  ], Script.prototype, "accountTextInput", 2);
  __decorateClass([
    property5({ type: Laya.TextInput })
  ], Script.prototype, "passwordTextInput", 2);
  __decorateClass([
    property5({ type: Laya.Image })
  ], Script.prototype, "btn", 2);
  Script = __decorateClass([
    regClass6("88cea8c6-4a81-42db-a610-0031e37e3bcb", "../src/LoginScript.ts")
  ], Script);
})();
//# sourceMappingURL=bundle.js.map
