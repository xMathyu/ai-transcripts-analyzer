import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ParsedTranscript,
  TopicAnalysis,
  ClassificationResult,
} from '../interfaces/transcript.interface';

interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface ClassificationResponse {
  category: string;
  confidence: number;
  reasoning: string;
}

interface TopicResponse {
  topics: Array<{
    topic: string;
    frequency: number;
    description: string;
  }>;
}

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly openai: OpenAI;
  private readonly model: string;
  private tokenUsage = { prompt: 0, completion: 0, total: 0 };
  private estimatedCost = 0;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
    this.model =
      this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';

    this.logger.log(`Using OpenAI model: ${this.model}`);
  }

  private trackUsage(usage: TokenUsage | undefined): void {
    if (usage) {
      this.tokenUsage.prompt += usage.prompt_tokens || 0;
      this.tokenUsage.completion += usage.completion_tokens || 0;
      this.tokenUsage.total += usage.total_tokens || 0;

      // GPT-5 mini pricing: Input $0.250/1M tokens, Output $2.000/1M tokens
      const promptCost = ((usage.prompt_tokens || 0) * 0.25) / 1000000;
      const completionCost = ((usage.completion_tokens || 0) * 2.0) / 1000000;
      this.estimatedCost += promptCost + completionCost;

      this.logger.log(
        `Token usage - Prompt: ${usage.prompt_tokens}, Completion: ${usage.completion_tokens}, Total cost: $${this.estimatedCost.toFixed(6)}`,
      );
    }
  }

  private cleanJsonResponse(content: string): string {
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '');
    }
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '');
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.replace(/\s*```$/, '');
    }
    return cleaned.trim();
  }

  async classifyTranscript(
    transcript: ParsedTranscript,
  ): Promise<ClassificationResult> {
    try {
      const summary = this.createTranscriptSummary(transcript);

      const prompt = `Analyze this customer service call transcript and classify it into one of these categories:
- technical_issues: Problems with internet, TV, phone, configurations
- commercial_support: Queries about plans, promotions, sales
- administrative_requests: Data changes, activations/deactivations
- billing_issues: Billing queries, charges, adjustments
- service_activation: Activation of additional services
- complaints_claims: Formal complaints, claims, dissatisfaction

Summarized transcript:
${summary}

Respond in JSON format with:
{
  "category": "exact_category",
  "confidence": number_0_to_1,
  "reasoning": "brief_explanation"
}`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 150,
      });

      this.trackUsage(response.usage);

      const rawContent = response.choices[0].message.content || '{}';
      const cleanedContent = this.cleanJsonResponse(rawContent);
      const result = JSON.parse(cleanedContent) as ClassificationResponse;

      return {
        transcriptId: transcript.id,
        category: result.category,
        confidence: result.confidence,
        reasoning: result.reasoning,
      };
    } catch (error) {
      this.logger.error(
        `Error classifying transcript ${transcript.id}:`,
        error,
      );

      return {
        transcriptId: transcript.id,
        category: 'error',
        confidence: 0,
        reasoning: `Classification failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async extractTopicsFromBatch(
    transcripts: ParsedTranscript[],
    maxTopics: number = 5,
  ): Promise<TopicAnalysis[]> {
    try {
      const summaries = transcripts
        .map((t) => this.createTranscriptSummary(t))
        .join('\n\n---\n\n');

      const prompt = `Analyze these customer service call transcripts and extract the ${maxTopics} most frequent and relevant topics.

Transcripts:
${summaries}

Identify common patterns, recurring problems, and main themes. Respond in JSON format:
{
  "topics": [
    {
      "topic": "topic_name",
      "frequency": estimated_number,
      "description": "brief_description"
    }
  ]
}`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 300,
      });

      this.trackUsage(response.usage);

      const cleanedContent = this.cleanJsonResponse(
        response.choices[0].message.content || '{"topics": []}',
      );
      const result = JSON.parse(cleanedContent) as TopicResponse;

      return result.topics.map((topic) => ({
        topic: topic.topic,
        frequency: topic.frequency,
        relevantTranscripts: [],
        description: topic.description,
      }));
    } catch (error) {
      this.logger.error('Error extracting topics from batch:', error);
      throw error;
    }
  }

  async generateSummary(transcript: ParsedTranscript): Promise<string> {
    try {
      const summary = this.createTranscriptSummary(transcript);

      const prompt = `Summarize this customer service call in 2-3 sentences highlighting the main problem and resolution:

${summary}`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 100,
      });

      this.trackUsage(response.usage);

      return response.choices[0].message.content || '';
    } catch (error) {
      this.logger.error(
        `Error generating summary for transcript ${transcript.id}:`,
        error,
      );
      throw error;
    }
  }

  private createTranscriptSummary(transcript: ParsedTranscript): string {
    const messages = transcript.messages
      .filter((m) => m.speaker !== 'SYSTEM')
      .slice(0, 20)
      .map((m) => `${m.speaker}: ${m.content}`)
      .join('\n');

    return `ID: ${transcript.id}\nMessages:\n${messages}`;
  }

  getUsageStats(): {
    tokenUsage: any;
    estimatedCost: number;
    remainingBudget: number;
  } {
    const budget = 5.0;
    return {
      tokenUsage: this.tokenUsage,
      estimatedCost: this.estimatedCost,
      remainingBudget: budget - this.estimatedCost,
    };
  }

  canPerformOperation(estimatedTokens: number): boolean {
    const budget = 5.0;
    // GPT-5 mini: Average cost estimation (assuming 50% input, 50% output)
    // Input: $0.25/1M, Output: $2.0/1M, Average: ~$1.125/1M tokens
    const estimatedCost = (estimatedTokens * 1.125) / 1000000;
    return this.estimatedCost + estimatedCost <= budget;
  }
}
