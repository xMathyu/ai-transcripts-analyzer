import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TranscriptsController } from './controllers/transcripts.controller';
import { AiAnalysisController } from './controllers/ai-analysis.controller';
import { TranscriptProcessingService } from './services/transcript-processing.service';
import { OpenAiService } from './services/openai.service';
import { CacheService } from './services/cache.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [AppController, TranscriptsController, AiAnalysisController],
  providers: [
    AppService,
    TranscriptProcessingService,
    OpenAiService,
    CacheService,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly transcriptService: TranscriptProcessingService,
  ) {}

  async onModuleInit() {
    await this.transcriptService.loadAllTranscripts();
  }
}
