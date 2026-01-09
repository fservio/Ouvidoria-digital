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
}
