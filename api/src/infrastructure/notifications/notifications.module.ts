import { Module } from '@nestjs/common';
import { WebPushService } from './web-push.service.js';

@Module({
  providers: [
    WebPushService,
    { provide: 'WebPushPort', useExisting: WebPushService },
  ],
  exports: ['WebPushPort', WebPushService],
})
export class NotificationsModule {}
