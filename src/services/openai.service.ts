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

      // gpt-4o-mini pricing: Input $0.15/1M tokens, Output $0.60/1M tokens
      const promptCost = ((usage.prompt_tokens || 0) * 0.15) / 1000000;
      const completionCost = ((usage.completion_tokens || 0) * 0.6) / 1000000;
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
  ): Promise<{
    transcripts: Array<{
      transcriptId: string;
      category: string;
      confidence: number;
      topics: string[];
    }>;
    aggregatedTopics: TopicAnalysis[];
  }> {
    try {
      this.logger.log(
        `Starting to analyze ${transcripts.length} transcripts for classification and topics`,
      );

      const transcriptAnalysis: {
        transcriptId: string;
        topics: string[];
        category: string;
        confidence: number;
      }[] = [];

      for (const transcript of transcripts) {
        this.logger.log(`Analyzing transcript: ${transcript.id}`);
        const summary = this.createTranscriptSummary(transcript);

        const prompt = `Analyze this customer service call transcript and perform two tasks:

1. CLASSIFY the conversation into one of these categories:
   - technical_issues: Technical problems (internet, TV, phone)
   - commercial_support: Commercial support (plans, promotions)
   - administrative_requests: Administrative requests
   - billing_issues: Billing problems
   - service_activation: Service activation
   - complaints_claims: Complaints and claims

2. EXTRACT the main topics/themes present in the conversation.

Transcript:
${summary}

Respond in JSON format:
{
  "category": "category_name",
  "confidence": 0.95,
  "topics": ["topic1", "topic2", "topic3"]
}`;

        const response = await this.openai.chat.completions.create({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_completion_tokens: 200,
        });

        this.trackUsage(response.usage);

        const cleanedContent = this.cleanJsonResponse(
          response.choices[0].message.content ||
            '{"category": "administrative_requests", "confidence": 0.5, "topics": []}',
        );

        this.logger.log(
          `OpenAI response for ${transcript.id}: ${cleanedContent}`,
        );

        const result = JSON.parse(cleanedContent) as {
          category: string;
          confidence: number;
          topics: string[];
        };

        transcriptAnalysis.push({
          transcriptId: transcript.id,
          topics: result.topics || [],
          category: result.category || 'administrative_requests',
          confidence: result.confidence || 0.5,
        });

        this.logger.log(
          `Analysis for ${transcript.id}: Category=${result.category}, Topics=${JSON.stringify(result.topics)}`,
        );
      }

      const topicMap = new Map<
        string,
        {
          frequency: number;
          transcripts: string[];
          categories: Set<string>;
        }
      >();

      this.logger.log(
        `Aggregating topics from ${transcriptAnalysis.length} transcript analyses`,
      );

      for (const { transcriptId, topics, category } of transcriptAnalysis) {
        this.logger.log(
          `Processing ${topics.length} topics for ${transcriptId} (${category}): ${JSON.stringify(topics)}`,
        );
        for (const topic of topics) {
          const normalizedTopic = topic.toLowerCase().trim();
          this.logger.log(
            `Normalized topic: "${normalizedTopic}" from transcript: ${transcriptId}`,
          );

          if (topicMap.has(normalizedTopic)) {
            const existing = topicMap.get(normalizedTopic)!;
            existing.frequency += 1;
            existing.transcripts.push(transcriptId);
            existing.categories.add(category);
            this.logger.log(
              `Updated existing topic "${normalizedTopic}" - frequency: ${existing.frequency}, transcripts: ${JSON.stringify(existing.transcripts)}`,
            );
          } else {
            topicMap.set(normalizedTopic, {
              frequency: 1,
              transcripts: [transcriptId],
              categories: new Set([category]),
            });
            this.logger.log(
              `Created new topic "${normalizedTopic}" for transcript: ${transcriptId}`,
            );
          }
        }
      }

      this.logger.log(`Final topic map has ${topicMap.size} unique topics`);

      const aggregatedTopics = Array.from(topicMap.entries())
        .map(([topic, data]) => ({
          topic: this.capitalizeFirstLetter(topic),
          frequency: data.frequency,
          relevantTranscripts: data.transcripts,
          categories: Array.from(data.categories),
          description: this.generateTopicDescription(topic),
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, maxTopics);

      return {
        transcripts: transcriptAnalysis,
        aggregatedTopics,
      };
    } catch (error) {
      this.logger.error('Error extracting topics from batch:', error);
      throw error;
    }
  }

  private capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private generateTopicDescription(topic: string): string {
    const descriptions: Record<string, string> = {
      billing: 'Issues related to billing, charges, and payment inquiries',
      technical: 'Technical problems with services like internet, TV, or phone',
      activation: 'Service activation and setup requests',
      support: 'General customer support and assistance requests',
      complaint: 'Customer complaints and dissatisfaction issues',
      commercial: 'Commercial inquiries about plans, promotions, and upgrades',
      refund: 'Refund requests and credit adjustments',
      cancellation: 'Service cancellation and termination requests',
      internet: 'Internet connectivity and speed related issues',
      plan: 'Plan changes, upgrades, and service modifications',
    };

    const lowerTopic = topic.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lowerTopic.includes(key)) {
        return desc;
      }
    }

    return `Customer service topic related to ${topic.toLowerCase()}`;
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

  async classifyAndExtractTopics(transcript: ParsedTranscript): Promise<{
    classification: ClassificationResult;
    topics: string[];
  }> {
    try {
      const summary = this.createTranscriptSummary(transcript);

      const prompt = `Analyze this customer service call transcript and perform two tasks:

1. CLASSIFY the conversation into one of these categories:
   - technical_issues: Technical problems (internet, TV, phone)
   - commercial_support: Commercial support (plans, promotions) 
   - administrative_requests: Administrative requests
   - billing_issues: Billing problems
   - service_activation: Service activation
   - complaints_claims: Complaints and claims

2. EXTRACT the main topics/themes present in the conversation.

Transcript:
${summary}

Respond in JSON format:
{
  "category": "category_name",
  "confidence": 0.95,
  "reasoning": "brief explanation for classification",
  "topics": ["topic1", "topic2", "topic3"]
}`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 200,
      });

      this.trackUsage(response.usage);

      const cleanedContent = this.cleanJsonResponse(
        response.choices[0].message.content ||
          '{"category": "administrative_requests", "confidence": 0.5, "reasoning": "Default classification", "topics": []}',
      );

      const result = JSON.parse(cleanedContent) as {
        category: string;
        confidence: number;
        reasoning: string;
        topics: string[];
      };

      return {
        classification: {
          transcriptId: transcript.id,
          category: result.category,
          confidence: result.confidence,
          reasoning: result.reasoning,
        },
        topics: result.topics || [],
      };
    } catch (error) {
      this.logger.error(
        `Error classifying and extracting topics for transcript ${transcript.id}:`,
        error,
      );

      return {
        classification: {
          transcriptId: transcript.id,
          category: 'error',
          confidence: 0,
          reasoning: `Analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        topics: [],
      };
    }
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
    // gpt-4o-mini: Average cost estimation (assuming 50% input, 50% output)
    // Input: $0.15/1M, Output: $0.6/1M, Average: ~$0.375/1M tokens
    const estimatedCost = (estimatedTokens * 0.375) / 1000000;
    return this.estimatedCost + estimatedCost <= budget;
  }
}
