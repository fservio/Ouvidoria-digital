export type Variables = {
  user: {
    id: string
    email: string
    papel: string
    setor?: string
  }
}

export type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  OPENAI_API_KEY: string
  N8N_SECRET: string
}
