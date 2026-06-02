import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter());
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
