export interface TranscriptMessage {
  timestamp: string;
  speaker: 'AGENT' | 'CLIENT' | 'SYSTEM';
  content: string;
}

export interface ParsedTranscript {
  id: string;
  fileName: string;
  messages: TranscriptMessage[];
  duration?: string;
  summary?: string;
  category?: string;
  topics?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface SearchResult {
  transcript: ParsedTranscript;
  relevanceScore: number;
  matchedMessages: TranscriptMessage[];
}

export interface TopicAnalysis {
  topic: string;
  frequency: number;
  relevantTranscripts: string[];
  description?: string;
}

export interface ClassificationResult {
  transcriptId: string;
  category: string;
  confidence: number;
  reasoning: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
