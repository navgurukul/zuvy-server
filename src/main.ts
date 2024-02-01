
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

// INPORTING env VALUSE 
const { PORT, BASE_URL } = process.env;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Enable CORS
  const corsOptions: CorsOptions = {
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  };
  app.enableCors(corsOptions);
  const config = new DocumentBuilder()
    .setTitle('NG zuvy API Docs')
    .setDescription(`[Base url: ${BASE_URL}]`)
    .setVersion('1.0')
    .addCookieAuth('optional-session-id', { type: 'apiKey', name: 'Authorization', in: 'cookie' })
    // .addSecurity('basic', { type: 'http', scheme: 'basic' })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('apis', app, document);
  await app.listen(PORT || 6000);
  console.log(`Application is running on swagger: ${BASE_URL}/apis#/`);
}
bootstrap();