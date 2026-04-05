export interface EnvironmentVariables {
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  META_API_VERSION: string;
  META_WEBHOOK_VERIFY_TOKEN: string;
  PORT: number;
  AWS_SES_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  SES_FROM_EMAIL?: string;
  SES_REPLY_TO_EMAIL?: string;
  FRONTEND_URL?: string;
}
