import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LemonSqueezyPaymentService } from './lemon-squeezy-payment.service.js';
import { CountryBasedProviderResolver } from './country-based-provider-resolver.js';

@Module({
  imports: [ConfigModule],
  providers: [
    { provide: 'PaymentProviderPort', useClass: LemonSqueezyPaymentService },
    { provide: 'PaymentProviderResolverPort', useClass: CountryBasedProviderResolver },
  ],
  exports: ['PaymentProviderPort', 'PaymentProviderResolverPort'],
})
export class PaymentModule {}
