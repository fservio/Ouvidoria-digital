import { z } from 'zod';

export const ticketCreateSchema = z.object({
  nome: z.string().min(2),
  mensagem: z.string().min(10),
  setor: z.enum(['saude', 'educacao', 'transito', 'infraestrutura urbana']).optional()
});

export const ticketStatusUpdateSchema = z.object({
  status: z.enum(['em_analise', 'resolvido'])
});

export const authLoginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(6)
});

export const aiClassificationSchema = z.enum([
  'saude',
  'educacao',
  'transito',
  'infraestrutura urbana'
]);

export const aiResponseSchema = z.string().min(10);

export const n8nNotifySchema = z.object({
  ticketId: z.string().min(1),
  mensagem: z.string().min(5),
  canal: z.string().min(2)
});

export const n8nActionSchema = z.object({
  ticketId: z.string().min(1),
  acao: z.string().min(2),
  detalhe: z.string().optional()
});
