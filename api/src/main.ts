import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const config = app.get(ConfigService);
  const port = config.get<number>('port', 3000);

  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}

bootstrap();
