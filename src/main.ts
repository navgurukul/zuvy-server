
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

// INPORTING env VALUSE 
const { PORT, BASE_URL } = process.env;

async function bootstrap() {
  const corsOptions: CorsOptions = {
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  };
  const app = await NestFactory.create(AppModule);
  // Enable CORS
  app.enableCors(corsOptions);
  const config = new DocumentBuilder()
    .setTitle('NG zuvy API Docs')
    .setDescription(`[Base url: ${BASE_URL}]`)
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  if (!BASE_URL.includes('main-api')) {
    const document = SwaggerModule.createDocument(app, config);
    document.security = [
      {
        bearerAuth: [], // This should match the name of the security scheme added in addBearerAuth()
      },
    ];
    SwaggerModule.setup('apis', app, document);
  }
  await app.listen(PORT || 6000);
  console.log(`Application is running on swagger: ${BASE_URL}/apis#/`);
}
bootstrap();