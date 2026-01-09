import { z } from 'zod'

export const ticketCreateSchema = z.object({
  mensagem: z.string().min(5),
  setor: z.string().optional()
})
