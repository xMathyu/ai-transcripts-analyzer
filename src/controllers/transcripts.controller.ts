import {
  Controller,
  Get,
  Query,
  Param,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import {
  SearchTranscriptsDto,
  TranscriptCategory,
} from '../dto/transcripts.dto';
import { TranscriptProcessingService } from '../services/transcript-processing.service';
import { OpenAiService } from '../services/openai.service';
import { CacheService } from '../services/cache.service';
import type { ApiResponse as ApiResponseInterface } from '../interfaces/transcript.interface';

@ApiTags('Transcripts Analysis (Local/Fast - No AI Required)')
@Controller('api/transcripts')
export class TranscriptsController {
  private readonly logger = new Logger(TranscriptsController.name);

  constructor(
    private readonly transcriptService: TranscriptProcessingService,
    private readonly openAiService: OpenAiService,
    private readonly cacheService: CacheService,
  ) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search transcripts by keywords (Local Search)',
    description:
      'Fast local search through transcripts using keyword matching and semantic analysis. No AI tokens consumed.',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results found successfully',
    schema: {
      example: {
        success: true,
        data: [
          {
            transcript: {
              id: 'sample_01',
              fileName: 'sample_01.txt',
              duration: '00:05:23',
              category: 'technical_issues',
              summary: 'Customer reporting internet connection problems',
              topics: ['internet', 'connectivity', 'troubleshooting'],
            },
            relevanceScore: 0.85,
            matchedMessages: [
              {
                timestamp: '00:01:15',
                speaker: 'CLIENT',
                content: 'I have internet connection problems since yesterday',
              },
            ],
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      },
    },
  })
  @ApiQuery({
    name: 'query',
    description: 'Keywords to search for',
    example: 'internet connection problem',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: TranscriptCategory,
    description: 'Filter by category',
    example: 'technical_issues',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
    example: 10,
  })
  searchTranscripts(
    @Query() searchDto: SearchTranscriptsDto,
  ): ApiResponseInterface<any> {
    try {
      const cacheKey = this.cacheService.generateKey('search', searchDto);
      const cachedResult =
        this.cacheService.get<ApiResponseInterface<any>>(cacheKey);

      if (cachedResult) {
        this.logger.log(`Cache hit for search: ${searchDto.query}`);
        return cachedResult;
      }

      const result = this.transcriptService.searchTranscripts(
        searchDto.query,
        searchDto.category,
        searchDto.page,
        searchDto.limit,
      );

      const response: ApiResponseInterface<any> = {
        success: true,
        data: result.results,
        pagination: {
          page: result.page,
          limit: searchDto.limit || 10,
          total: result.total,
          totalPages: result.totalPages,
        },
      };

      this.cacheService.set(cacheKey, response, 30 * 60 * 1000);

      this.logger.log(
        `Search completed: ${result.results.length} results for "${searchDto.query}"`,
      );

      return response;
    } catch (error) {
      this.logger.error('Error searching transcripts:', error);
      throw new HttpException(
        'Error searching transcripts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Get general statistics',
    description:
      'Provides comprehensive analytics including transcript counts, AI usage, and cache performance',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          transcripts: {
            total: 100,
            categorized: 85,
            byCategory: {
              technical_issues: 35,
              billing_issues: 20,
              commercial_support: 15,
              administrative_requests: 10,
              service_activation: 3,
              complaints: 2,
            },
            averageMessageCount: 12.5,
            averageDuration: '00:04:30',
          },
          openAiUsage: {
            tokenUsage: {
              prompt: 15420,
              completion: 8930,
              total: 24350,
            },
            estimatedCost: 0.75,
            remainingBudget: 4.25,
          },
          cache: {
            size: 45,
            hitRate: 0.78,
            memoryUsageEstimate: 2048,
          },
        },
      },
    },
  })
  getStatistics(): ApiResponseInterface<any> {
    try {
      const cacheKey = 'statistics';
      const cachedResult =
        this.cacheService.get<ApiResponseInterface<any>>(cacheKey);

      if (cachedResult) {
        return cachedResult;
      }

      const stats = this.transcriptService.getStatistics();
      const usageStats = this.openAiService.getUsageStats();
      const cacheStats = this.cacheService.getStats();

      const response: ApiResponseInterface<any> = {
        success: true,
        data: {
          transcripts: stats,
          openAiUsage: usageStats,
          cache: cacheStats,
        },
      };

      this.cacheService.set(cacheKey, response, 5 * 60 * 1000);

      return response;
    } catch (error) {
      this.logger.error('Error getting statistics:', error);
      throw new HttpException(
        'Error getting statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('topics/frequent')
  @ApiOperation({
    summary: 'Get most frequent topics (local analysis)',
    description:
      'Returns the most frequently occurring topics based on local keyword analysis (faster, no AI required)',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: TranscriptCategory,
    description: 'Filter by category',
    example: 'technical_issues',
  })
  @ApiResponse({
    status: 200,
    description: 'Frequent topics retrieved successfully',
    schema: {
      example: {
        success: true,
        data: [
          {
            topic: 'internet',
            frequency: 28,
            relevantTranscripts: [
              'sample_01',
              'sample_03',
              'sample_07',
              'sample_12',
            ],
            description: 'Internet-related issues and connectivity problems',
          },
          {
            topic: 'billing',
            frequency: 18,
            relevantTranscripts: ['sample_02', 'sample_05', 'sample_09'],
            description: 'Billing inquiries and payment-related topics',
          },
        ],
      },
    },
  })
  getFrequentTopics(
    @Query('category') category?: TranscriptCategory,
  ): ApiResponseInterface<any> {
    try {
      const cacheKey = `frequent-topics:${category || 'all'}`;
      const cachedResult =
        this.cacheService.get<ApiResponseInterface<any>>(cacheKey);

      if (cachedResult) {
        return cachedResult;
      }

      const topics = this.transcriptService.getFrequentTopics(category);

      const response: ApiResponseInterface<any> = {
        success: true,
        data: topics,
      };

      this.cacheService.set(cacheKey, response, 30 * 60 * 1000);

      return response;
    } catch (error) {
      this.logger.error('Error getting frequent topics:', error);
      throw new HttpException(
        'Error getting frequent topics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Get all transcripts',
    description:
      'Returns a list of all available transcripts with basic metadata',
  })
  @ApiResponse({
    status: 200,
    description: 'Transcripts list retrieved successfully',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'sample_01',
            fileName: 'sample_01.txt',
            messageCount: 15,
            duration: '00:05:23',
            category: 'technical_issues',
            summary: 'Customer reporting internet connection problems',
            topics: ['internet', 'connectivity', 'troubleshooting'],
          },
          {
            id: 'sample_02',
            fileName: 'sample_02.txt',
            messageCount: 12,
            duration: '00:03:45',
            category: 'billing_issues',
            summary: 'Inquiry about unexpected charges on monthly bill',
            topics: ['billing', 'charges', 'payment'],
          },
        ],
      },
    },
  })
  getAllTranscripts(): ApiResponseInterface<any> {
    try {
      const transcripts = this.transcriptService.getTranscripts();

      return {
        success: true,
        data: transcripts.map((t) => ({
          id: t.id,
          fileName: t.fileName,
          messageCount: t.messages.length,
          duration: t.duration,
          category: t.category,
          summary: t.summary,
          topics: t.topics,
        })),
      };
    } catch (error) {
      this.logger.error('Error getting all transcripts:', error);
      throw new HttpException(
        'Error getting transcripts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific transcript',
    description:
      'Returns the complete transcript data including all messages and metadata',
  })
  @ApiParam({
    name: 'id',
    description: 'Transcript ID',
    example: 'sample_01',
  })
  @ApiResponse({
    status: 200,
    description: 'Transcript retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          id: 'sample_01',
          fileName: 'sample_01.txt',
          duration: '00:05:23',
          category: 'technical_issues',
          summary: 'Customer reporting internet connection problems',
          topics: ['internet', 'connectivity', 'troubleshooting'],
          sentiment: 'neutral',
          messages: [
            {
              timestamp: '00:00:15',
              speaker: 'AGENT',
              content: 'Hello, how can I help you today?',
            },
            {
              timestamp: '00:00:18',
              speaker: 'CLIENT',
              content:
                'Hi, I have been having internet connection problems since yesterday',
            },
            {
              timestamp: '00:00:25',
              speaker: 'AGENT',
              content:
                'I understand the frustration. Let me help you troubleshoot this issue.',
            },
          ],
        },
      },
    },
  })
  getTranscript(@Param('id') id: string): ApiResponseInterface<any> {
    try {
      const transcript = this.transcriptService.getTranscriptById(id);

      if (!transcript) {
        throw new HttpException('Transcript not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: transcript,
      };
    } catch (error) {
      this.logger.error(`Error getting transcript ${id}:`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error getting transcript',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
