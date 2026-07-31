import { Module } from '@nestjs/common';
import { FlowHttpService } from './flow-http.service.js';

@Module({
  providers: [{ provide: 'FlowHttpPort', useClass: FlowHttpService }],
  exports: ['FlowHttpPort'],
})
export class HttpModule {}
