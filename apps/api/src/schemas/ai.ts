import { z } from 'zod'

export const aiClassificationSchema = z.union([
  z.literal('saude'),
  z.literal('educacao'),
  z.literal('transito'),
  z.literal('infraestrutura')
])

export const aiResponseSchema = z.string()
