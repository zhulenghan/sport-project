import { GoogleGenerativeAI } from '@google/generative-ai';
import type { EventFact, Lang } from './types';

function formatFactLine(fact: EventFact): string {
  return `#${fact.moveIndex} ${fact.playerLabel} ${fact.description} | shanten:${fact.actorShantenAfter} | remaining:${fact.remainingTiles}`;
}

function buildSummarizerPrompt(facts: EventFact[], lang: Lang): { system: string; user: string } {
  const lines = facts.map(formatFactLine).join('\n');

  if (lang === 'zh') {
    return {
      system: '你是一个麻将局面分析员。你的任务是根据完整的对局事件序列，生成一段简洁的叙事摘要，供解说员参考。不要主观贴标签，从数据描述事实。',
      user: `[完整对局事件序列]\n${lines}\n\n请用2-3句话生成叙事摘要，覆盖：\n1. 各玩家的向听数变化趋势（按玩家归纳）\n2. 局面的关键转折点（碰杠、听牌等重要节点）\n3. 当前局面下最值得关注的态势\n\n直接输出摘要，不加标题或标签。`,
    };
  }

  return {
    system: 'You are a Mahjong game analyst. Your task is to generate a concise narrative summary of the hand from a complete event sequence, for the live commentator to reference. Describe facts from data, avoid subjective labels.',
    user: `[Complete event sequence]\n${lines}\n\nWrite a 2-3 sentence summary covering:\n1. Each player's shanten trend (aggregate per player from the sequence)\n2. Key turning points (peng, gang, tenpai moments)\n3. The most noteworthy current dynamic\n\nOutput only the summary, no headers or labels.`,
  };
}

export class Summarizer {
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
  private summarizing = false;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: process.env.GEMINI_SUMMARIZER_MODEL ?? process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-lite' });
  }

  get isBusy(): boolean {
    return this.summarizing;
  }

  async summarize(facts: EventFact[], lang: Lang): Promise<string | null> {
    if (facts.length === 0) return null;
    this.summarizing = true;
    try {
      const prompt = buildSummarizerPrompt(facts, lang);
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
        systemInstruction: { role: 'system', parts: [{ text: prompt.system }] },
      });
      const text = result.response.text().replace(/\s+/g, ' ').trim();
      return text || null;
    } catch (e) {
      console.error('[Summarizer] Failed:', (e as Error).message);
      return null;
    } finally {
      this.summarizing = false;
    }
  }
}
