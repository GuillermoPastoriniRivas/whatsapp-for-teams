import { Injectable } from '@nestjs/common';
import { PaymentProviderResolverPort } from '../../application/ports/payment-provider-resolver.port.js';
import { PaymentProvider } from '../../domain/enums/payment-provider.enum.js';

@Injectable()
export class CountryBasedProviderResolver implements PaymentProviderResolverPort {
  resolve(_countryCode: string | null): PaymentProvider {
    // Phase 1: Lemon Squeezy for all countries
    // Future: route MercadoPago for AR/BR/MX/CO/CL/PE/UY, Stripe for the rest
    return PaymentProvider.LEMON_SQUEEZY;
  }
}
