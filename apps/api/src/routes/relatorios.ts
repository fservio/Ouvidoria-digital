import { authMiddleware, requireRole } from '../middleware/authMiddleware'

app.get(
  '/relatorios',
  authMiddleware,
  requireRole(['gestor']),
  async (c) => {
    // ... lógica do relatório
  }
)
