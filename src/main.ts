import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
console.log('BASE_URL: ', process.env.BASE_URL);
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
    .setDescription(`[Base url: ${process.env.BASE_URL}]`)
    .setVersion('1.0')
    // .setBasePath(`${process.env.BASE_URL}`)
    .addCookieAuth('optional-session-id', { type: 'apiKey', name: 'Authorization',in: 'cookie' })
    // .setSchemes(['http', 'https'])
    .build()

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('apis', app, document);

  await app.listen(process.env.PORT || 6000);
//   SwaggerModule.setup('apis', app, document, {
    //     swaggerOptions: {
    //         persistAuthorization: true, // this
    //     },
    // });
}
bootstrap();
