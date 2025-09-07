import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('AI Transcripts Analyzer API')
    .setDescription(
      'API para analizar transcripciones de llamadas de atención al cliente usando IA. ' +
        'Incluye funcionalidades de búsqueda semántica, extracción de temas y clasificación automática.',
    )
    .setVersion('1.0')
    .addTag(
      'Transcripts Analysis',
      'Endpoints para análisis de transcripciones',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'AI Transcripts Analyzer - API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  const port = process.env.PORT || 3000;

  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  logger.log(
    `🎯 Health Check: http://localhost:${port}/api/transcripts/statistics`,
  );
}

bootstrap().catch((error) => {
  console.error('Error starting application:', error);
  process.exit(1);
});
