# Context Management 重设计方案

## 麻将解说 AI — Structured Memory Pipeline

**项目**：`majiang-commentator`
**版本**：v2 设计草案
**日期**：2026-04-23

---

## 1. 问题陈述

### 现有架构的根本缺陷

`context.ts` 维护了一个 15 条事件的滑动窗口（`EVENT_WINDOW_SIZE = 15`），但这个窗口**从未被传入 LLM 的 prompt**。`buildPrompt()` 只使用当前事件的 `actionLine` 和 `stateLine`，历史事件数组是死代码：

```typescript
// context.ts — buildPrompt() 完全忽略了 this.events
buildPrompt(event, lang, stateManager, segments): LLMPrompt {
  const actionLine = segments.actionLine || '(None)';
  const stateLine  = segments.promptStateLine || segments.stateLine || '(None)';
  // this.events 从未被用到
}
```

`commentator.ts` 的每次 LLM 调用是完全无状态的单轮对话：

```typescript
// commentator.ts — 无历史，无记忆
const result = await this.model.generateContent({
  contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
  systemInstruction: ...
});
```

**后果**：解说员对 5 分钟前发生的事情一无所知，无法产生"玩家1一直在守，这张3万打得很反常"这类有叙事深度的评论。

---

## 2. 设计原则

### 原则一：我们的代码不做主观判断，只传递客观数据

凡是需要我们写阈值、贴标签的地方，都是潜在的主观分类。LLM 从原始数据推断比从错误标签推断要好。

**被否决的设计（及原因）：**

| 字段 | 类型 | 否决原因 |
|---|---|---|
| `phase: 'opening' \| 'mid' \| 'late'` | 主观分类 | `moveCount` 已经足够，LLM 理解"第23步"意味着什么阶段 |
| `discardPattern: 'safe' \| 'aggressive' \| 'mixed'` | 主观分类 | 阈值（avg shanten > 2 → safe）是拍脑袋定的，有误导风险 |
| `significance: 'routine' \| 'notable' \| 'critical'` | 主观分类 | LLM 看 event type 和 shanten 数自己能判断重要性，标签冗余 |
| `shantenTrend: '↑' \| '↓'` | 主观归纳 | LLM 从原始向听数序列 `[3, 2, 2, 1]` 自己能读出趋势 |
| `PlayerArc` 整体 | 主观归纳 | 上述字段的集合，整体去掉 |

### 原则二：客观的计算结果要显式传入，不能让 LLM 自己猜

向听数是纯计算结果（shanten algorithm），LLM 从牌名文字无法自行计算。这类数据要显式带入每一步的记录里。

### 原则三：职责边界清晰，不在 prompt 里描述两遍同一件事

- `EventFact[]` 负责历史（窗口外的事件序列）
- `stateLine` 负责当前（当前这步的详细局面）
- `narrativeSummary` 负责归纳（窗口外的行为规律）

三者不重叠。

---

## 3. 背景与参考实践

### 3.1 滑动窗口 Context 管理

LangChain 的 `ConversationBufferWindowMemory` 是该模式最广泛的实现，通过参数 `k` 控制保留最近 k 轮交互，超出后丢弃旧内容。其核心洞察是：**对于实时流式场景，只有最近几步才真正影响下一步输出**，完整历史反而引入噪音并增加 token 消耗。

> 参考：[LangChain ConversationBufferWindowMemory](https://python.langchain.com/v0.1/docs/modules/memory/types/buffer_window/)

### 3.2 叙事链：把前一步输出接入下一步输入

微软在为国际象棋构建实时解说系统时发现，纯滑动窗口在窗口边界处丢失信息。解决方案是**把前一步的解说输出作为下一步的输入**，形成叙事链。在我们的方案里，异步 `narrativeSummary` 承担了同样的角色——将窗口外的历史浓缩后接入当前 prompt。

> *"Ensuring the model retains game context can be achieved by chaining prior outputs with new inputs, forming a conversational narrative."*
>
> — [Real-Time Chess Commentary using Vision-Language Models, Microsoft Data Science Blog](https://medium.com/data-science-at-microsoft/real-time-chess-commentary-using-vision-language-models-c9d4e68a9de7)

### 3.3 结构化数据优于主观标签

ArXiv 2024 年的论文"Concept-Guided Chess Commentary"发现，向 LLM 喂入**结构化的领域计算结果**（如 Stockfish 对每步棋的概念评分变化）比喂入主观标签能显著减少幻觉并提升解说相关性。关键点：这些特征是引擎**计算**出来的，不是人工分类的。这与我们保留向听数、去掉 discardPattern 的决策一致。

> 参考：[Concept-Guided Chess Commentary with LLMs — ArXiv 2410.20811](https://arxiv.org/html/2410.20811v1)

### 3.4 结构化 JSON 防止 LLM 幻觉游戏状态

Thoughtbot 工程博客指出，对 LLM 强制要求结构化中间输出，可以让 pipeline 各阶段可测试、可缓存，防止模型在生成阶段"捏造"游戏事实。我们的 `EventFact` 作为每步的结构化记录，承担了这个职责。

> 参考：[Get Consistent Data from Your LLM with JSON Schema — Thoughtbot](https://thoughtbot.com/blog/get-consistent-data-from-your-llm-with-json-schema)

### 3.5 异步后台摘要解耦实时响应

在生产级 AI Agent 系统中，将"状态摘要更新"与"实时响应生成"解耦是标准做法。后台摘要任务非阻塞地运行，主流程始终使用上一版缓存的摘要，不等待。

> *"Non-blocking operations: command finishes instantly while LLM processes in background. Resilience: if LLM service unavailable, messages queue; processing resumes automatically."*
>
> — [Turbocharging AI Agents with Symfony's Async Approach — DEV.to](https://dev.to/mattleads/turbocharging-ai-agents-with-symfonys-async-approach-a-deep-dive-33d7)

### 3.6 实时游戏解说的延迟基准

MDPI 2025 年的视频游戏实时解说论文测量了三段式 pipeline 的端到端延迟：数据预处理 131ms + 事件预测 0.19ms + LLaMA 3.3 生成 3080ms。我们使用 Gemini API，目标是生成 1-2 句解说控制在 **400-800ms**。关键约束：**LLM 调用前的 context 组装阶段必须 < 50ms**，避免给总延迟增加负担。

> 参考：[Real-Time Video Game Commentary with Temporal Event Prediction — MDPI Mathematics 2025](https://www.mdpi.com/2227-7390/13/17/2738)

---

## 4. 双 Agent 设计

### 4.1 为什么是两个 Agent

系统中存在两个职责完全不同的 LLM 调用角色，必须作为独立的 Agent 分开处理：

| | Commentator | Summarizer |
|---|---|---|
| **触发时机** | 每个关键事件，同步 | 每 8 步，异步后台 |
| **输入** | 三段结构化 prompt（摘要 + 滑窗 + 当前） | 完整 EventFact[] |
| **输出** | 1-2 句实时解说 | 2-3 句叙事摘要 |
| **延迟要求** | 严格，400-800ms | 宽松，后台不阻塞主流程 |
| **模型选择** | 可用更快、更便宜的模型 | 可用更强的模型，摘要质量影响后续所有解说 |
| **context 要求** | 干净，每次调用完全独立，无对话历史 | 干净，每次从完整 EventFact[] 重新生成 |

两者在 `RoomSession` 里是独立实例，各自持有自己的模型配置：

```typescript
interface RoomSession {
  commentator: Commentator;  // 实时解说 agent
  summarizer: Summarizer;    // 后台叙事摘要 agent
  // ...
}
```

### 4.2 Summarizer：全量重算 vs 增量摘要

**被否决方案：增量摘要**

每次给 Summarizer 上一版 summary + 最近新增的 N 步，在此基础上继续更新。

问题：**误差会累积**。某次摘要生成偏差，后续每一版都在错误基础上叠加，越来越偏。在解说质量完全依赖摘要质量的场景里，这是不可接受的风险。

**采用方案：全量重算**

每次触发时，把本地存储的**完整 `EventFact[]`**（从第1步到当前步）全部传给 Summarizer，从原始数据重新生成摘要。

成本可接受：`EventFact` 是已结构化压缩的数据，每步约 15 tokens，一局 80 步约 1200 tokens，远小于原始 `GameEvent`（含手牌数组，会很大）。且 Summarizer 是后台异步，延迟不是核心约束。

本地完整 trace 的存储结构：

```typescript
export interface GameSnapshot {
  moveCount: number;          // 当前总步数
  allMoves: EventFact[];      // 完整历史，本地存储，传给 Summarizer
  recentMoves: EventFact[];   // 滑动窗口，最近 WINDOW_SIZE 步，传给 Commentator
  narrativeSummary: string;   // Summarizer 生成的叙事摘要
  summaryUpToMove: number;    // narrativeSummary 覆盖到第几步
}
```

### 4.3 Summarizer 不需要游戏状态快照

**当前状态快照**：不需要。Commentator 的 Part 3（`stateLine`）已经覆盖当前局面。如果 Summarizer 的摘要也描述当前状态，会在 Commentator 的 prompt 里重复两次同一件事，违反原则三。Summarizer 的职责是覆盖**窗口外的历史**，当前状态由 `stateLine` 负责。

**历史状态快照**：不需要。每步存一份全体玩家的完整牌面代价太高，而且 `EventFact[]` 已经隐式编码了历史进展——向听数变化轨迹、碰杠时机、每步打出的牌——LLM 从这些信息完全可以推断出"玩家2在第15步碰牌之后开始积极进攻"这类规律。

### 4.4 Summarizer 如何获得向听信息

`EventFact.actorShantenAfter` 记录**行动玩家**在那一步之后的向听数。完整序列里，各玩家的向听数是按行动顺序**交错分布**的：

```
#41 玩家1 打出3万 | 向听2 | 剩余18张    ← 玩家1的向听
#42 玩家2 碰了发发发 | 向听1 | 剩余17张  ← 玩家2的向听
#43 玩家3 打出9筒 | 向听3 | 剩余16张    ← 玩家3的向听
#44 玩家1 打出8万 | 向听1 | 剩余15张    ← 玩家1的下一次
```

Summarizer 按 `playerLabel` 过滤即可还原每位玩家的向听历史，LLM 自行完成这个聚合。

**没有信息损失**：麻将里向听数只在你行动时才会变（打牌、碰、杠），不行动时向听数不变。因此每次玩家行动时记一次，等价于完整的向听变化历史。

---

## 5. 数据结构设计

### 5.1 EventFact — 单步事件的结构化记录

```typescript
export interface EventFact {
  moveIndex: number;         // 全局步数编号（客观）
  type: string;              // 'playCard' | 'peng' | 'gang' | 'win' | ...（客观）
  playerLabel: string;       // "玩家1" | "Player 1"（客观）
  description: string;       // 自然语言描述，由 describeEvent() 拼装
  actorShantenAfter: number; // 动作后行为方的向听数，算法计算结果（客观）
  remainingTiles: number;    // 剩余牌数（客观）
}
```

**无主观字段**：`significance`、`shantenTrend`、`discardPattern`、`phase` 均已去掉。LLM 从 `actorShantenAfter` 序列和 `type` 自行判断重要性与趋势。

### 5.2 GameSnapshot — Context 类的核心状态

```typescript
export interface GameSnapshot {
  moveCount: number;          // 当前总步数（替代 phase 分类）
  allMoves: EventFact[];      // 完整历史，传给 Summarizer 做全量重算
  recentMoves: EventFact[];   // 滑动窗口，最近 WINDOW_SIZE 步，传给 Commentator
  narrativeSummary: string;   // Summarizer 异步生成的叙事摘要
  summaryUpToMove: number;    // narrativeSummary 覆盖到第几步
}
```

---

## 6. Commentator Prompt 的三段结构

每次调用 Commentator 时，prompt 由三部分组成，来源完全不同：

```
┌─────────────────────────────────────────────────┐
│ Part 1: 叙事摘要                                 │
│ 来源：Summarizer 异步生成，读取                   │
│       snapshot.narrativeSummary                  │
│ 覆盖：第1步 ~ summaryUpToMove 步的历史            │
├─────────────────────────────────────────────────┤
│ Part 2: 滑动窗口（最近 WINDOW_SIZE 步）           │
│ 来源：snapshot.recentMoves                       │
│       每步由 describeEvent() 拼装成一行            │
│ 格式：#41 玩家1 打出3万 | 向听2 | 剩余18张        │
│       #42 玩家2 碰了发发发 | 向听1 | 剩余17张     │
├─────────────────────────────────────────────────┤
│ Part 3: 当前动作 + 局面                           │
│ 来源：buildEventSegments()                       │
│   actionLine — 当前这步的动作句                   │
│   stateLine  — 当前详细局面（手牌数、面子、向听）  │
└─────────────────────────────────────────────────┘
```

**Part 2 与 Part 3 的 actionLine 是同类信息**，区别在于：历史窗口每步只有一行简短描述，当前事件额外附有详细的 `stateLine` 局面快照，这是历史步骤没有的。

### 6.1 拼装函数职责划分

| 函数 | 所在文件 | 职责 |
|---|---|---|
| `describeEvent()` | `context.ts` | 单步事件 → 一行自然语言，用于 Part 2 滑动窗口每行 |
| `buildEventSegments()` | `state-manager.ts` | 当前事件 → `actionLine` + `stateLine`，用于 Part 3 |
| `buildPrompt()` | `context.ts` | 组装三段 prompt，传给 Commentator |
| `maybeRefreshSummary()` | `context.ts` | 触发 Summarizer 后台异步更新 |

### 6.2 Commentator Prompt 模板（中文）

```
[叙事摘要（前{summaryUpToMove}步）]
{narrativeSummary}

[最近{WINDOW_SIZE}步]
#{moveIndex} {playerLabel} {description} | 向听{actorShantenAfter} | 剩余{remainingTiles}张
...

[当前动作（第{moveCount}步）]
{actionLine}

[当前局面]
{stateLine}

请只输出夹在动作句和状态句之间的解说段落。
```

### 6.3 Token 估算（Commentator）

| 组件 | 估计 tokens |
|---|---|
| System prompt | ~80 |
| 叙事摘要（2-3句） | ~60 |
| 滑动窗口（10步 × ~15 tokens/步） | ~150 |
| actionLine + stateLine | ~80 |
| **总计** | **~370 tokens，固定，不随局数增长** |

---

## 7. Summarizer 的输入与 Prompt

### 7.1 Summarizer 的输入

- **完整 `allMoves: EventFact[]`**（从第1步到当前步）
- **不包含**：当前游戏状态快照、历史游戏状态快照

每步 EventFact 约 15 tokens，一局 80 步约 1200 tokens，完全可接受。

### 7.2 Summarizer Prompt 模板（中文）

```
[完整对局事件序列]
#{moveIndex} {playerLabel} {description} | 向听{actorShantenAfter} | 剩余{remainingTiles}张
...（第1步到当前步的完整序列）

请用2-3句话生成本局叙事摘要。要求覆盖：
1. 各玩家的向听数变化趋势（按玩家归纳，从序列中读取）
2. 局面的关键转折点（碰杠、听牌等重要节点）
3. 当前局面下最值得关注的态势

不要主观贴标签（如"激进"、"保守"），从数据描述事实。
```

### 7.3 触发条件

每隔 `SUMMARY_INTERVAL`（默认 8）步，且没有正在进行的摘要生成时触发。触发是**非阻塞的**：主解说队列不等待 Summarizer 完成，Commentator 继续使用上一版缓存的 `narrativeSummary`。

---

## 8. 架构总览

```
GameEvent（来自游戏服务器）
        │
        ▼
┌──────────────────────────────────────┐
│  extractEventFact()      （无 LLM）  │
│  GameEvent → EventFact              │
│  describeEvent() + shanten 计算      │
│  耗时: < 5ms                         │
└──────────────┬───────────────────────┘
               │
               ▼
   snapshot.allMoves 追加（完整历史）
   snapshot.recentMoves 更新（滑窗）
               │
               ├─────────────────────────────────────────┐
               ▼                                         │ (非阻塞，后台)
┌──────────────────────────────────┐   ┌─────────────────────────────────┐
│  buildPrompt()      （无 LLM）   │   │  maybeRefreshSummary()           │
│  三段组装：                       │   │  每 8 步触发                     │
│    Part1: narrativeSummary       │   │                                  │
│    Part2: recentMoves 滑窗       │   │  Summarizer.summarize(           │
│    Part3: actionLine + stateLine │   │    snapshot.allMoves             │
└──────────────┬───────────────────┘   │  ) → 新 narrativeSummary        │
               │                       └─────────────────────────────────┘
               ▼
┌──────────────────────────────────┐
│  Commentator.commentate()        │
│  Gemini API → 1-2句解说          │
│  目标延迟: 400-800ms              │
└──────────────────────────────────┘
```

---

## 9. 改动文件清单

### `types.ts` — 新增类型

- 新增 `EventFact`
- 新增 `GameSnapshot`

### `commentator.ts` — 职责收窄

仅负责实时解说，不再被 Summarizer 复用。

### `summarizer.ts` — 新增文件

独立的 Summarizer 类，持有自己的模型配置，负责后台叙事摘要生成。

### `context.ts` — 主要改造

| 改动 | 现在 | 改后 |
|---|---|---|
| 存储结构 | `events: string[]` | `snapshot: GameSnapshot` |
| `addEvent()` | push 字符串到数组 | 调用 `extractEventFact()`，同时更新 `allMoves` 和 `recentMoves` |
| `buildPrompt()` | 只用 actionLine + stateLine | 三段组装（Part 1-3） |
| 新增 | — | `extractEventFact()` |
| 新增 | — | `maybeRefreshSummary(summarizer)` |

### `room-manager.ts` — 轻量改动

`RoomSession` 新增 `summarizer: Summarizer` 实例。在 `handleGameEvent()` 推入 `pendingItems` 之后调用：

```typescript
context.maybeRefreshSummary(session.summarizer, settings.lang);
```

### `state-manager.ts` — 不改动

`buildEventSegments()` 继续负责生成 Part 3 的 `actionLine` 和 `stateLine`。

---

## 10. 常量配置

```typescript
const WINDOW_SIZE      = 10;  // 滑动窗口大小（步数），可按实测调整
const SUMMARY_INTERVAL = 8;   // 每隔多少步触发一次 Summarizer
```

---

## 11. 实施 Roadmap

### Phase 1（核心，约 1 天）

- [ ] `types.ts`：新增 `EventFact`、`GameSnapshot`
- [ ] `context.ts`：重构存储结构，实现 `extractEventFact()`
- [ ] `context.ts`：重写 `buildPrompt()`，三段组装
- [ ] `context.ts`：更新 `addEvent()` 同时维护 `allMoves` 和 `recentMoves`

### Phase 2（双 Agent，约半天）

- [ ] `summarizer.ts`：新建 Summarizer 类，独立模型配置
- [ ] `context.ts`：实现 `maybeRefreshSummary(summarizer)`，含 Summarizer prompt 模板
- [ ] `room-manager.ts`：`RoomSession` 新增 `summarizer` 实例，触发后台刷新
- [ ] 验证：Summarizer 不阻塞主解说队列，`narrativeSummary` 正常更新

### Phase 3（调优，迭代）

- [ ] 对比改造前后解说质量（用真实对局录像跑）
- [ ] 调整 `WINDOW_SIZE` 和 `SUMMARY_INTERVAL`
- [ ] 检查 Summarizer 摘要是否有效覆盖玩家向听趋势和局面转折两个维度

---

## 12. 参考资料

| 来源 | 要点 |
|---|---|
| [LangChain ConversationBufferWindowMemory](https://python.langchain.com/v0.1/docs/modules/memory/types/buffer_window/) | 滑动窗口 context 管理的标准实现，`k` 参数控制窗口大小 |
| [Real-Time Chess Commentary using VLMs — Microsoft Data Science Blog](https://medium.com/data-science-at-microsoft/real-time-chess-commentary-using-vision-language-models-c9d4e68a9de7) | 叙事链模式：前一步输出接入下一步输入，保持叙事连贯性 |
| [Concept-Guided Chess Commentary — ArXiv 2410.20811](https://arxiv.org/html/2410.20811v1) | 用引擎计算的客观特征（非主观标签）引导 LLM，减少幻觉 |
| [Get Consistent Data from Your LLM with JSON Schema — Thoughtbot](https://thoughtbot.com/blog/get-consistent-data-from-your-llm-with-json-schema) | 结构化中间输出使 pipeline 可测试、防止 LLM 捏造游戏状态 |
| [Turbocharging AI Agents with Async Architecture — DEV.to](https://dev.to/mattleads/turbocharging-ai-agents-with-symfonys-async-approach-a-deep-dive-33d7) | 后台异步摘要与主流程解耦的生产级模式 |
| [Real-Time Video Game Commentary — MDPI Mathematics 2025](https://www.mdpi.com/2227-7390/13/17/2738) | 三段式 pipeline 延迟基准：预处理 131ms + LLM 生成 3080ms |
| [Basketball Real-Time AI Commentary — MDPI Applied Sciences 2025](https://www.mdpi.com/2076-3417/15/3/1543) | 实时体育解说系统的完整架构参考 |
| [Anthropic Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) | System prompt 缓存节省 90% token 成本、85% 延迟（切换 Claude 时适用） |
| [Suphx: Mastering Mahjong — Microsoft Research](https://www.microsoft.com/en-us/research/project/suphx-mastering-mahjong-with-deep-reinforcement-learning/) | 向听数等麻将特征的语义意义背景 |
