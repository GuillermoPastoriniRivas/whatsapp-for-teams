export interface LoginOutput {
  accessToken: string;
  refreshToken: string;
  agent: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}
