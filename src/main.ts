import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { log } from 'console';
import { WrapUserInArrayInterceptor } from './middleware/jwt.middleware';

// IMPORTING env VALUES 
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
  app.useGlobalInterceptors(new WrapUserInArrayInterceptor());
  const config = new DocumentBuilder()
    .setTitle('NG zuvy API Docs')
    .setDescription(`[Base url: ${BASE_URL}]
    
## Authentication
This API uses Google OAuth2 for authentication. The flow is as follows:

1. Client obtains a Google ID token from Google's authentication service
2. Client sends this token to our /auth/login endpoint
3. Server validates the token and returns JWT access and refresh tokens
4. Client uses the access token in subsequent requests in the Authorization header

### Security
- All endpoints except /auth/login require a valid JWT token
- The token should be included in the Authorization header as: \`Bearer <token>\`
- Refresh tokens can be used to obtain new access tokens via /auth/refresh
- Tokens can be invalidated via /auth/logout`)
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controllers
    )
    .build();

  if (!BASE_URL.includes('main-api')) {
    const document = SwaggerModule.createDocument(app, config);
    document.security = [
      {
        'JWT-auth': [], 
      },
    ];
    
    SwaggerModule.setup('apis', app, document);
  }
  await app.listen(PORT || 6000);
  log(`Application is running on swagger: localhost:${PORT}/apis#/`);
}
bootstrap();