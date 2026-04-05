import { PaymentProvider } from '../../domain/enums/payment-provider.enum.js';

export interface PaymentProviderResolverPort {
  resolve(countryCode: string | null): PaymentProvider;
}
