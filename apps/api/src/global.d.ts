declare global {
  interface Env {
    DB?: any;
    KV?: any;
    JWT_SECRET?: string;
    OPENAI_API_KEY?: string;
    N8N_SECRET?: string;
    [key: string]: unknown;
  }
}

declare module 'uuid';
