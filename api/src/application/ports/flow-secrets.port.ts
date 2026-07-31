export interface FlowSecretsPort {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}
