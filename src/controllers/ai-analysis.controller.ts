import {
  Controller,
  Post,
  Param,
  Body,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ExtractTopicsDto } from '../dto/transcripts.dto';
import { TranscriptProcessingService } from '../services/transcript-processing.service';
import { OpenAiService } from '../services/openai.service';
import { CacheService } from '../services/cache.service';
import type {
  ApiResponse as ApiResponseInterface,
  TopicAnalysis,
} from '../interfaces/transcript.interface';

@ApiTags('AI Analysis (Uses OpenAI - Consumes Tokens)')
@Controller('api/ai')
export class AiAnalysisController {
  private readonly logger = new Logger(AiAnalysisController.name);

  constructor(
    private readonly transcriptService: TranscriptProcessingService,
    private readonly openAiService: OpenAiService,
    private readonly cacheService: CacheService,
  ) {}

  @Post('topics/extract')
  @ApiOperation({
    summary: 'Extract main topics from transcripts using AI',
    description:
      'Uses OpenAI to analyze transcripts and extract the most relevant topics with frequency analysis. This endpoint consumes AI tokens and may take longer to process.',
  })
  @ApiResponse({
    status: 200,
    description: 'Topics extracted successfully using AI analysis',
    schema: {
      example: {
        success: true,
        data: [
          {
            topic: 'internet connectivity issues',
            frequency: 15,
            relevantTranscripts: ['sample_01', 'sample_03', 'sample_07'],
            description:
              'Problems related to internet connection, slow speeds, and network outages',
          },
          {
            topic: 'billing inquiries',
            frequency: 12,
            relevantTranscripts: ['sample_02', 'sample_05'],
            description:
              'Questions about charges, payment methods, and invoice discrepancies',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 402,
    description: 'AI budget exceeded - cannot perform operation',
  })
  async extractTopicsWithAI(
    @Body() extractDto: ExtractTopicsDto,
  ): Promise<ApiResponseInterface<any>> {
    try {
      const cacheKey = this.cacheService.generateKey('ai-topics', extractDto);
      const cachedResult =
        this.cacheService.get<ApiResponseInterface<any>>(cacheKey);

      if (cachedResult) {
        this.logger.log('Cache hit for AI topic extraction');
        return cachedResult;
      }

      const estimatedTokens = 1000 * (extractDto.transcriptIds?.length || 10);
      if (!this.openAiService.canPerformOperation(estimatedTokens)) {
        throw new HttpException(
          'AI budget exceeded. Cannot perform this operation.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      let transcripts = this.transcriptService.getTranscripts();

      if (extractDto.transcriptIds && extractDto.transcriptIds.length > 0) {
        transcripts = transcripts.filter((t) =>
          extractDto.transcriptIds!.includes(t.id),
        );
      }

      if (extractDto.category) {
        transcripts = transcripts.filter(
          (t) => t.category === extractDto.category,
        );
      }

      const batchSize = 10;
      const allTopics: TopicAnalysis[] = [];

      for (let i = 0; i < transcripts.length; i += batchSize) {
        const batch = transcripts.slice(i, i + batchSize);
        const batchTopics = await this.openAiService.extractTopicsFromBatch(
          batch,
          extractDto.topicsCount,
        );
        allTopics.push(...batchTopics);
      }

      const topicsMap = new Map<string, TopicAnalysis>();
      for (const topic of allTopics) {
        const existing = topicsMap.get(topic.topic);
        if (existing) {
          existing.frequency += topic.frequency;
          existing.relevantTranscripts = Array.from(
            new Set([
              ...existing.relevantTranscripts,
              ...topic.relevantTranscripts,
            ]),
          );
        } else {
          topicsMap.set(topic.topic, topic);
        }
      }

      const finalTopics = Array.from(topicsMap.values())
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, extractDto.topicsCount);

      const response: ApiResponseInterface<any> = {
        success: true,
        data: finalTopics,
      };

      this.cacheService.set(cacheKey, response, 60 * 60 * 1000);

      this.logger.log(
        `AI Topics extracted: ${finalTopics.length} topics found`,
      );

      return response;
    } catch (error) {
      this.logger.error('Error extracting topics with AI:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error extracting topics with AI',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('classify/all')
  @ApiOperation({
    summary: 'Classify ALL transcripts using AI (Batch Operation)',
    description:
      'Uses OpenAI to automatically categorize ALL available transcripts. This is a heavy operation that consumes many AI tokens. Use with caution.',
  })
  @ApiResponse({
    status: 200,
    description: 'All transcripts classified successfully using AI',
    schema: {
      example: {
        success: true,
        data: {
          totalProcessed: 99,
          successful: 97,
          failed: 2,
          results: [
            {
              transcriptId: 'sample_01',
              category: 'technical_issues',
              confidence: 0.89,
              reasoning: 'Customer reported connectivity problems',
            },
            {
              transcriptId: 'sample_02',
              category: 'billing_issues',
              confidence: 0.95,
              reasoning: 'Customer inquired about billing charges',
            },
          ],
          estimatedCost: 2.45,
          processingTime: '45.3 seconds',
        },
      },
    },
  })
  @ApiResponse({
    status: 402,
    description: 'AI budget exceeded - cannot perform operation',
  })
  async classifyAllTranscriptsWithAI(): Promise<ApiResponseInterface<any>> {
    try {
      const startTime = Date.now();
      const cacheKey = 'ai-classify-all-transcripts';
      const cachedResult =
        this.cacheService.get<ApiResponseInterface<any>>(cacheKey);

      if (cachedResult) {
        this.logger.log('Cache hit for bulk AI classification');
        return cachedResult;
      }

      const allTranscripts = this.transcriptService.getTranscripts();
      const estimatedTokens = allTranscripts.length * 500;

      if (!this.openAiService.canPerformOperation(estimatedTokens)) {
        throw new HttpException(
          `AI budget exceeded. Estimated cost too high for ${allTranscripts.length} transcripts.`,
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      this.logger.log(
        `Starting bulk classification of ${allTranscripts.length} transcripts...`,
      );

      const results: any[] = [];
      const batchSize = 5;
      let successful = 0;
      let failed = 0;

      for (let i = 0; i < allTranscripts.length; i += batchSize) {
        const batch = allTranscripts.slice(i, i + batchSize);
        this.logger.log(
          `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allTranscripts.length / batchSize)}...`,
        );

        const batchPromises = batch.map(async (transcript) => {
          try {
            if (
              transcript.category &&
              transcript.category !== 'uncategorized'
            ) {
              this.logger.log(
                `Transcript ${transcript.id} already classified as ${transcript.category}`,
              );
              return {
                transcriptId: transcript.id,
                category: transcript.category,
                confidence: 1.0,
                reasoning: 'Already classified',
                status: 'skipped',
              };
            }

            const classification =
              await this.openAiService.classifyTranscript(transcript);

            this.transcriptService.updateTranscriptClassification(
              transcript.id,
              classification.category,
              '',
            );

            successful++;
            return {
              ...classification,
              status: 'success',
            };
          } catch (error) {
            failed++;
            this.logger.error(
              `Failed to classify transcript ${transcript.id}:`,
              error,
            );
            return {
              transcriptId: transcript.id,
              error: (error as Error).message || 'Unknown error',
              status: 'failed',
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        if (i + batchSize < allTranscripts.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      const endTime = Date.now();
      const processingTime = ((endTime - startTime) / 1000).toFixed(1);
      const usageStats = this.openAiService.getUsageStats();

      const response: ApiResponseInterface<any> = {
        success: true,
        data: {
          totalProcessed: allTranscripts.length,
          successful,
          failed,
          results: results.slice(0, 10),
          estimatedCost: usageStats.estimatedCost,
          processingTime: `${processingTime} seconds`,
          note:
            successful > 0
              ? 'Transcripts have been classified and are now searchable by category'
              : 'No transcripts were classified',
        },
      };

      this.cacheService.set(cacheKey, response, 24 * 60 * 60 * 1000);

      this.logger.log(
        `Bulk classification completed: ${successful} successful, ${failed} failed in ${processingTime}s`,
      );

      return response;
    } catch (error) {
      this.logger.error('Error in bulk transcript classification:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error classifying transcripts with AI',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('classify/:id')
  @ApiOperation({
    summary: 'Classify a specific transcript using AI',
    description:
      'Uses OpenAI to automatically categorize a transcript into predefined categories. This endpoint consumes AI tokens.',
  })
  @ApiParam({
    name: 'id',
    description: 'Transcript ID',
    example: 'sample_01',
  })
  @ApiResponse({
    status: 200,
    description: 'Transcript classified successfully using AI',
    schema: {
      example: {
        success: true,
        data: {
          transcriptId: 'sample_01',
          category: 'technical_issues',
          confidence: 0.89,
          reasoning:
            'Customer reported internet connectivity problems and requested technical support for troubleshooting',
          summary:
            'Customer experiencing internet connection issues since yesterday, technician scheduled for tomorrow',
        },
      },
    },
  })
  @ApiResponse({
    status: 402,
    description: 'AI budget exceeded - cannot perform operation',
  })
  @ApiResponse({
    status: 404,
    description: 'Transcript not found',
  })
  async classifyTranscriptWithAI(
    @Param('id') id: string,
  ): Promise<ApiResponseInterface<any>> {
    try {
      const cacheKey = `ai-classify:${id}`;
      const cachedResult =
        this.cacheService.get<ApiResponseInterface<any>>(cacheKey);

      if (cachedResult) {
        this.logger.log(`Cache hit for AI classification: ${id}`);
        return cachedResult;
      }

      const transcript = this.transcriptService.getTranscriptById(id);
      if (!transcript) {
        throw new HttpException('Transcript not found', HttpStatus.NOT_FOUND);
      }

      if (!this.openAiService.canPerformOperation(500)) {
        this.logger.warn(
          `AI budget exceeded for transcript ${id}. Current cost: $${this.openAiService.getUsageStats().estimatedCost.toFixed(6)}`,
        );
        throw new HttpException(
          'AI budget exceeded. Cannot perform this operation.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      const classification =
        await this.openAiService.classifyTranscript(transcript);

      let summary = '';
      if (this.openAiService.canPerformOperation(200)) {
        summary = await this.openAiService.generateSummary(transcript);
      }

      this.transcriptService.updateTranscriptClassification(
        id,
        classification.category,
        summary,
      );

      const response: ApiResponseInterface<any> = {
        success: true,
        data: {
          transcriptId: classification.transcriptId,
          category: classification.category,
          confidence: classification.confidence,
          reasoning: classification.reasoning,
          summary,
        },
      };

      this.cacheService.set(cacheKey, response, 24 * 60 * 60 * 1000);

      this.logger.log(
        `Transcript ${id} classified with AI as ${classification.category}`,
      );

      return response;
    } catch (error) {
      this.logger.error(`Error classifying transcript ${id} with AI:`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error classifying transcript with AI',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('summarize/:id')
  @ApiOperation({
    summary: 'Generate AI summary for a specific transcript',
    description:
      'Uses OpenAI to generate a concise summary of the transcript conversation. This endpoint consumes AI tokens.',
  })
  @ApiParam({
    name: 'id',
    description: 'Transcript ID',
    example: 'sample_01',
  })
  @ApiResponse({
    status: 200,
    description: 'Summary generated successfully using AI',
    schema: {
      example: {
        success: true,
        data: {
          transcriptId: 'sample_01',
          summary:
            'Customer experiencing internet connection issues since yesterday. Technical support scheduled troubleshooting session for next business day.',
          wordCount: 18,
          generatedAt: '2025-09-06T10:30:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 402,
    description: 'AI budget exceeded - cannot perform operation',
  })
  @ApiResponse({
    status: 404,
    description: 'Transcript not found',
  })
  async generateSummaryWithAI(
    @Param('id') id: string,
  ): Promise<ApiResponseInterface<any>> {
    try {
      const cacheKey = `ai-summary:${id}`;
      const cachedResult =
        this.cacheService.get<ApiResponseInterface<any>>(cacheKey);

      if (cachedResult) {
        this.logger.log(`Cache hit for AI summary: ${id}`);
        return cachedResult;
      }

      const transcript = this.transcriptService.getTranscriptById(id);
      if (!transcript) {
        throw new HttpException('Transcript not found', HttpStatus.NOT_FOUND);
      }

      if (!this.openAiService.canPerformOperation(200)) {
        throw new HttpException(
          'AI budget exceeded. Cannot perform this operation.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      const summary = await this.openAiService.generateSummary(transcript);

      const response: ApiResponseInterface<any> = {
        success: true,
        data: {
          transcriptId: id,
          summary,
          wordCount: summary.split(' ').length,
          generatedAt: new Date().toISOString(),
        },
      };

      this.cacheService.set(cacheKey, response, 24 * 60 * 60 * 1000);

      this.logger.log(`AI Summary generated for transcript ${id}`);

      return response;
    } catch (error) {
      this.logger.error(
        `Error generating AI summary for transcript ${id}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error generating AI summary',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
