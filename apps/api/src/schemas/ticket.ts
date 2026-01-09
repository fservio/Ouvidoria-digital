import { z } from 'zod'

export const ticketCreateSchema = z.object({
  nome: z.string().min(1),
  mensagem: z.string().min(5),
  setor: z.string().optional()
})
