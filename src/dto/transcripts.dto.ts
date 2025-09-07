import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TranscriptCategory {
  TECHNICAL_ISSUES = 'technical_issues',
  COMMERCIAL_SUPPORT = 'commercial_support',
  ADMINISTRATIVE_REQUESTS = 'administrative_requests',
  BILLING_ISSUES = 'billing_issues',
  SERVICE_ACTIVATION = 'service_activation',
  COMPLAINTS_CLAIMS = 'complaints_claims',
}

export class SearchTranscriptsDto {
  @ApiProperty({
    description: 'Keywords or phrases to search for',
    example: 'internet connection problem',
  })
  @IsString()
  query: string;

  @ApiPropertyOptional({
    description: 'Filter by category',
    enum: TranscriptCategory,
    example: TranscriptCategory.TECHNICAL_ISSUES,
  })
  @IsOptional()
  @IsEnum(TranscriptCategory)
  category?: TranscriptCategory;

  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export class ExtractTopicsDto {
  @ApiPropertyOptional({
    description: 'Specific transcript IDs to analyze',
    type: [String],
    example: ['sample_01', 'sample_02', 'sample_03'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  transcriptIds?: string[];

  @ApiPropertyOptional({
    description: 'Maximum number of topics to extract',
    default: 5,
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  topicsCount?: number = 5;

  @ApiPropertyOptional({
    description: 'Filter by category',
    enum: TranscriptCategory,
    example: TranscriptCategory.BILLING_ISSUES,
  })
  @IsOptional()
  @IsEnum(TranscriptCategory)
  category?: TranscriptCategory;
}

export class ClassifyTranscriptDto {
  @ApiProperty({
    description: 'Transcript file ID',
    example: 'sample_01',
  })
  @IsString()
  transcriptId: string;
}
