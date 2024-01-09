import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

console.log('BASE_URL: ', process.env.BASE_URL);
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('NG zuvy API Docs')
    .setDescription(`[Base url: ${process.env.BASE_URL}]`)
    .setVersion('1.0')
    // .setBasePath(`${process.env.BASE_URL}`)
    .addCookieAuth('optional-session-id', { type: 'apiKey', name: 'Authorization',in: 'cookie' })
    // .setSchemes(['http', 'https'])     
    .build()

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('apis', app, document);

  await app.listen(3000);
}
bootstrap();