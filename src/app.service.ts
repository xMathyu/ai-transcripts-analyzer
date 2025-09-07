import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'AI Transcripts Analyzer API is running!';
  }
}
