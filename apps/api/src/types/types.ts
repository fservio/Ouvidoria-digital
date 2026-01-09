export type Env = {
  Bindings: {
    DB: D1Database
    KV: KVNamespace
    JWT_SECRET: string
    OPENAI_API_KEY: string
    N8N_SECRET: string
  }
}
