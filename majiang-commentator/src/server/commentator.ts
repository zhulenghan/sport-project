import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMPrompt } from './types';

export class Commentator {
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-lite' });
  }

  async commentate(prompt: LLMPrompt): Promise<string | null> {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
        systemInstruction: { role: 'system', parts: [{ text: prompt.system }] },
      });
      return result.response.text().replace(/\s+/g, ' ').trim() || null;
    } catch (e) {
      throw new Error(`LLM failed: ${(e as Error).message}`);
    }
  }
}
