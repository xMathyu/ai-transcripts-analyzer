import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  ParsedTranscript,
  TranscriptMessage,
  SearchResult,
  TopicAnalysis,
} from '../interfaces/transcript.interface';
import { TranscriptCategory } from '../dto/transcripts.dto';

@Injectable()
export class TranscriptProcessingService {
  private readonly logger = new Logger(TranscriptProcessingService.name);
  private transcripts: ParsedTranscript[] = [];
  private readonly samplePath = join(process.cwd(), 'sample');

  async loadAllTranscripts(): Promise<void> {
    try {
      const files = await fs.readdir(this.samplePath);
      const txtFiles = files.filter((file) => file.endsWith('.txt'));

      this.logger.log(`Loading ${txtFiles.length} transcript files...`);

      for (const file of txtFiles) {
        try {
          const transcript = await this.parseTranscriptFile(file);
          this.transcripts.push(transcript);
        } catch (error) {
          this.logger.error(`Error parsing file ${file}:`, error);
        }
      }

      this.logger.log(
        `Successfully loaded ${this.transcripts.length} transcripts`,
      );
    } catch (error) {
      this.logger.error('Error loading transcript files:', error);
      throw error;
    }
  }

  private async parseTranscriptFile(
    fileName: string,
  ): Promise<ParsedTranscript> {
    const filePath = join(this.samplePath, fileName);
    const content = await fs.readFile(filePath, 'utf-8');

    const messages: TranscriptMessage[] = [];
    const lines = content.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      const match = line.match(/\[([^\]]+)\]\s+(\w+):\s*(.+)/);
      if (match) {
        const [, timestamp, speaker, content] = match;
        if (['AGENTE', 'CLIENTE', 'SISTEMA'].includes(speaker)) {
          messages.push({
            timestamp,
            speaker: speaker as 'AGENT' | 'CLIENT' | 'SYSTEM',
            content: content.trim(),
          });
        }
      }
    }

    return {
      id: fileName.replace('.txt', ''),
      fileName,
      messages,
      duration: this.calculateDuration(messages),
    };
  }

  private calculateDuration(messages: TranscriptMessage[]): string {
    if (messages.length === 0) return '00:00:00';

    const firstTimestamp = messages[0].timestamp;
    const lastTimestamp = messages[messages.length - 1].timestamp;

    return `${firstTimestamp} - ${lastTimestamp}`;
  }

  getTranscripts(): ParsedTranscript[] {
    return this.transcripts;
  }

  getTranscriptById(id: string): ParsedTranscript | undefined {
    return this.transcripts.find((t) => t.id === id);
  }

  searchTranscripts(
    query: string,
    category?: TranscriptCategory,
    page: number = 1,
    limit: number = 10,
  ): {
    results: SearchResult[];
    total: number;
    page: number;
    totalPages: number;
  } {
    const queryLower = query.toLowerCase();
    let filteredTranscripts = this.transcripts;

    if (category) {
      filteredTranscripts = filteredTranscripts.filter(
        (t) => t.category === category,
      );
    }

    const searchResults: SearchResult[] = [];

    for (const transcript of filteredTranscripts) {
      const matchedMessages: TranscriptMessage[] = [];
      let relevanceScore = 0;

      for (const message of transcript.messages) {
        if (message.content.toLowerCase().includes(queryLower)) {
          matchedMessages.push(message);
          relevanceScore += 1;
        }
      }

      if (transcript.summary?.toLowerCase().includes(queryLower)) {
        relevanceScore += 2;
      }

      if (
        transcript.topics?.some((topic) =>
          topic.toLowerCase().includes(queryLower),
        )
      ) {
        relevanceScore += 3;
      }

      if (relevanceScore > 0) {
        searchResults.push({
          transcript,
          relevanceScore,
          matchedMessages,
        });
      }
    }

    searchResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const total = searchResults.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const results = searchResults.slice(startIndex, endIndex);

    return {
      results,
      total,
      page,
      totalPages,
    };
  }

  updateTranscriptClassification(
    transcriptId: string,
    category: string,
    summary?: string,
  ): void {
    const transcript = this.getTranscriptById(transcriptId);
    if (transcript) {
      const oldCategory = transcript.category || 'unclassified';
      transcript.category = category;
      if (summary) {
        transcript.summary = summary;
      }
      console.log(
        `Updated transcript ${transcriptId}: ${oldCategory} → ${category}`,
      );
    } else {
      console.error(
        `Transcript ${transcriptId} not found for classification update`,
      );
    }
  }

  updateTranscriptTopics(transcriptId: string, topics: string[]): void {
    const transcript = this.getTranscriptById(transcriptId);
    if (transcript) {
      transcript.topics = topics;
    }
  }

  getFrequentTopics(category?: TranscriptCategory): TopicAnalysis[] {
    let targetTranscripts = this.transcripts;

    if (category) {
      targetTranscripts = targetTranscripts.filter(
        (t) => t.category === category,
      );
    }

    const transcriptsWithTopics = targetTranscripts.filter(
      (transcript) => transcript.topics && transcript.topics.length > 0,
    );

    if (transcriptsWithTopics.length === 0) {
      return [];
    }

    const topicFrequency = new Map<string, Set<string>>();

    transcriptsWithTopics.forEach((transcript) => {
      transcript.topics!.forEach((topic) => {
        const normalizedTopic = topic.toLowerCase().trim();
        if (!topicFrequency.has(normalizedTopic)) {
          topicFrequency.set(normalizedTopic, new Set());
        }
        topicFrequency.get(normalizedTopic)!.add(transcript.id);
      });
    });

    const topics: TopicAnalysis[] = Array.from(topicFrequency.entries())
      .map(([topic, transcriptIds]) => ({
        topic: this.capitalizeFirstLetter(topic),
        frequency: transcriptIds.size,
        relevantTranscripts: Array.from(transcriptIds),
        description: this.getAITopicDescription(topic),
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    return topics;
  }

  private capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private getAITopicDescription(topic: string): string {
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
      disputed: 'Disputed charges and billing discrepancies',
      configuration: 'Service configuration and setup assistance',
      appointment: 'Service appointment scheduling and coordination',
    };

    const lowerTopic = topic.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lowerTopic.includes(key)) {
        return desc;
      }
    }

    return `AI-identified topic: ${topic}`;
  }

  getStatistics(): {
    totalTranscripts: number;
    categoriesDistribution: { [key: string]: number };
    averageMessagesPerTranscript: number;
  } {
    const totalTranscripts = this.transcripts.length;
    const categoriesDistribution: { [key: string]: number } = {};
    let totalMessages = 0;

    console.log(`Calculating statistics for ${totalTranscripts} transcripts`);

    for (const transcript of this.transcripts) {
      totalMessages += transcript.messages.length;

      const category = transcript.category || 'unclassified';
      categoriesDistribution[category] =
        (categoriesDistribution[category] || 0) + 1;

      if (Object.keys(categoriesDistribution).length <= 5) {
        console.log(`Transcript ${transcript.id}: category = ${category}`);
      }
    }

    console.log('Categories distribution:', categoriesDistribution);

    return {
      totalTranscripts,
      categoriesDistribution,
      averageMessagesPerTranscript: totalMessages / totalTranscripts || 0,
    };
  }
}
