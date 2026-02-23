# 麻将 AI 解说系统 - 实现计划

## 项目概述

在现有麻将服务端基础上，接入 LLM 作为上帝视角解说员，实时解说游戏进程。

```
majiang/              # 客户端（Laya 引擎）
majiang-server/       # 游戏服务端（Node.js）
majiang-commentator/  # AI 解说服务（本项目）
```

## 技术选型

- **LLM**: Gemini Flash（低延迟优先）
- **TTS**: macOS `say` 命令（内置，中文用 Ting-Ting 语音，英文用系统默认）
- **语言**: 默认中文，可切换英文
- **通信**: WebSocket（事件驱动 Push）

## 架构设计

### 整体数据流

```
游戏服务端 (majiang-server)
    │
    │  GameControl 每个动作触发事件
    │  (startGame / peng / gang / win / playCard)
    │
    ▼
EventEmitter ──► 解说者 WebSocket 广播（上帝视角，不清洗数据）
                      │
                      ▼
               majiang-commentator（WebSocket 客户端）
                      │
                      │  1. 接收游戏事件
                      │  2. 判断是否为关键动作
                      │  3. 构建 context
                      │  4. 调用 Gemini Flash
                      │  5. 控制台输出 + TTS 播报
                      │
                      ▼
                 控制台 + 语音播报
```

### 关键动作定义

| 动作 | 是否解说 | 说明 |
|------|---------|------|
| `startGame` | 始终解说 | 介绍对局信息、玩家 |
| `peng` | 始终解说 | 碰牌是战术动作 |
| `gang` | 始终解说 | 杠牌是重大动作 |
| `win` | 始终解说 | 胡牌，比赛结束 |
| `playCard` | 条件解说 | 仅残局（剩余牌 < 20 张）时解说 |

---

## 实现步骤

### 第一阶段：服务端改造（majiang-server）

#### 1.1 新增事件系统

**新增文件：** `core/events/GameEventEmitter.js`

```js
const EventEmitter = require('events');
const gameEvents = new EventEmitter();
module.exports = gameEvents;
```

#### 1.2 在 GameControl 中触发事件

在 `services/game/GameControl.js` 的 startGame / playCard / peng / gang / win 方法中，于现有广播逻辑之后，emit 事件。

事件 payload 格式：

```js
{
  type: 'playCard',          // 事件类型
  roomId: '123456',          // 房间号
  playerId: 'uuid-xxx',     // 触发玩家
  data: { ... },             // 动作相关数据（牌号、碰/杠数组等）
  roomInfo: { ... },         // 完整房间信息（上帝视角，不清洗）
  gameInfo: { ... },         // 完整游戏信息
  timestamp: 1234567890
}
```

#### 1.3 SocketService 支持解说者连接

连接方式：`ws://host:8082?role=commentator&roomId=123456`

解说者连接后：
- `ws.role = 'commentator'`，`ws.watchRoomId = roomId`
- 不作为玩家加入房间
- 监听 GameEventEmitter 的 `gameEvent` 事件
- 将对应 roomId 的事件原样推送（**不经过 HackService 清洗**）
- 连接断开时移除监听器

---

### 第二阶段：解说服务（majiang-commentator）

#### 2.1 项目结构

```
majiang-commentator/
├── index.js              # 入口，解析命令行参数（roomId, lang）
├── package.json
├── src/
│   ├── ws-client.js      # WebSocket 客户端，连接游戏服务端
│   ├── context.js        # Context 管理模块（三层结构）
│   ├── commentator.js    # Gemini Flash 调用与解说生成
│   └── tts.js            # TTS 输出（macOS say 命令）
└── PLAN.md
```

#### 2.2 Context 管理模块

三层 context 结构，全部由代码从 roomInfo/gameInfo 结构化提取，不依赖 LLM 总结：

| 层 | 内容 | 更新时机 | Token 开销 |
|---|---|---|---|
| **基础信息** | 玩家数量、名称、房间规则 | `startGame` 时设定一次 | 极少 |
| **局势摘要** | 每人明牌（碰/杠）、已出的牌、手牌数/内容、剩余牌数 | 每个事件后从 roomInfo 提取 | 少 |
| **事件流** | 最近 10-15 步操作记录（滑动窗口） | 每个事件追加，超出窗口丢弃最早的 | 可控 |

#### 2.3 Prompt 结构

```
[系统] 你是一位专业的麻将解说员，风格幽默生动。你拥有上帝视角，能看到所有玩家的手牌。
请用1-2句话解说当前这一步，可以分析牌局走势和玩家策略。

[对局信息]
4人局，玩家：张三、李四、王五、赵六

[当前局势]
- 剩余牌: 42张
- 张三: 手牌[一万,二万,三万,五条,六条,七条,二索,三索,四索,八万,八万,九万,九万] 碰[] 杠[] 已出[东风,北风]
- 李四: 手牌[...] 碰[一条x3] 杠[] 已出[...]
- ...

[最近事件]
1. 张三 出了 东风
2. 李四 碰了 东风 → 不对，碰了一条  // (示意)
...

[当前事件]
王五 碰了 七万
```

#### 2.4 Gemini Flash 调用

- 使用 `@google/generative-ai` SDK
- 需要 `GEMINI_API_KEY` 环境变量
- 每个关键事件触发一次调用
- 超时 / 报错时跳过本次解说，不阻塞游戏

#### 2.5 TTS 输出

- macOS 使用内置 `say` 命令
- 中文语音：`say -v Ting-Ting "解说文本"`
- 英文语音：`say -v Samantha "commentary text"`
- 异步执行，不阻塞下一次解说
- 如果上一句还没说完，新解说进入队列依次播报

#### 2.6 启动方式

```bash
# 默认中文，连接本地服务端，观战房间 123456
node index.js --room 123456

# 英文解说
node index.js --room 123456 --lang en

# 指定服务端地址
node index.js --room 123456 --host 192.168.1.5
```

---

## 实现优先级（按顺序）

1. **服务端事件系统** — `GameEventEmitter` + `GameControl` 触发事件
2. **SocketService 解说者连接** — 支持 `role=commentator` 的 WebSocket
3. **解说服务骨架** — `ws-client` 连接 + `context` 管理 + 控制台输出
4. **接入 Gemini Flash** — LLM 调用生成解说
5. **TTS 播报** — `say` 命令语音输出 + 队列管理
