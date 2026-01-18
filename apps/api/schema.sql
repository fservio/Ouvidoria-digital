-- Schema D1 - Ouvidoria Digital Teresina
-- Atualizado: Janeiro 2025

-- ============================================
-- CONFIGURAÇÕES E INTEGRAÇÕES
-- ============================================

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('meta', 'n8n', 'webhook')),
  config_encrypted TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SECRETARIAS (8 no seed MVP)
-- ============================================

CREATE TABLE IF NOT EXISTS secretariats (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  working_hours JSON,
  sla_hours INTEGER DEFAULT 72,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- FILAS DE ATENDIMENTO (14 no seed MVP)
-- ============================================

CREATE TABLE IF NOT EXISTS queues (
  id TEXT PRIMARY KEY,
  secretariat_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  working_hours JSON,
  sla_hours INTEGER DEFAULT 48,
  auto_assign INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (secretariat_id) REFERENCES secretariats(id)
);

-- ============================================
-- TAGS PARA CLASSIFICAÇÃO
-- ============================================

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3B82F6',
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PERFIS DE CIDADAO
-- ============================================

CREATE TABLE IF NOT EXISTS citizen_profiles (
  id TEXT PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  phone_e164 TEXT,
  whatsapp_wa_id TEXT,
  instagram_user_id TEXT,
  instagram_username TEXT,
  consent_at TEXT,
  consent_source TEXT DEFAULT 'implicit_service' CHECK (consent_source IN ('web_form', 'whatsapp', 'instagram', 'implicit_service')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_citizen_whatsapp_wa_id ON citizen_profiles(whatsapp_wa_id) WHERE whatsapp_wa_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_citizen_instagram_user_id ON citizen_profiles(instagram_user_id) WHERE instagram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_citizen_phone ON citizen_profiles(phone_e164);
CREATE INDEX IF NOT EXISTS idx_citizen_email ON citizen_profiles(email);

-- ============================================
-- CASOS/PROTOCOLOS DE OUVIDORIA
-- ============================================

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  protocol TEXT NOT NULL UNIQUE,
  external_message_id TEXT,
  citizen_id TEXT,
  citizen_phone TEXT NOT NULL,
  citizen_name TEXT,
  citizen_email TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'routing', 'assigned', 'in_progress', 'waiting_citizen', 'resolved', 'closed', 'triage_human')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  source TEXT DEFAULT 'whatsapp' CHECK (source IN ('whatsapp', 'phone', 'email', 'web', 'presencial')),
  channel TEXT DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'web', 'instagram')),
  queue_id TEXT,
  assigned_to TEXT,
  sla_due_at TEXT,
  sla_breached INTEGER DEFAULT 0,
  resolved_at TEXT,
  closed_at TEXT,
  metadata JSON,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (queue_id) REFERENCES queues(id),
  FOREIGN KEY (citizen_id) REFERENCES citizen_profiles(id)
);

CREATE TABLE IF NOT EXISTS case_tags (
  case_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (case_id, tag_id),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS missing_fields (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  is_provided INTEGER DEFAULT 0,
  provided_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- ============================================
-- MENSAGENS DO WHATSAPP
-- ============================================

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  case_id TEXT,
  external_message_id TEXT NOT NULL UNIQUE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'document', 'audio', 'video', 'button', 'interactive')),
  content TEXT,
  media_url TEXT,
  metadata JSON,
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  last_error TEXT,
  sent_at TEXT,
  is_processed INTEGER DEFAULT 0,
  processed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id)
);

-- ============================================
-- RESPOSTAS DOS ATENDENTES
-- ============================================

CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_internal INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id)
);

CREATE TABLE IF NOT EXISTS user_queues (
  user_id TEXT NOT NULL,
  queue_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, queue_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE
);

-- ============================================
-- REGRAS DE ROTEAMENTO (DSL)
-- ============================================

CREATE TABLE IF NOT EXISTS routing_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  conditions JSON NOT NULL,
  actions JSON NOT NULL,
  description TEXT,
  match_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sla_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hours INTEGER NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY,
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  version INTEGER NOT NULL,
  is_active INTEGER DEFAULT 0,
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (template_key, version)
);

-- ============================================
-- USUÁRIOS DO SISTEMA
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'manager', 'operator', 'viewer', 'GABINETE_VIEWER_GLOBAL', 'GOVERNO_GESTOR_GLOBAL')),
  secretariat_id TEXT,
  is_active INTEGER DEFAULT 1,
  last_login TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (secretariat_id) REFERENCES secretariats(id)
);

-- ============================================
-- LOGS DE AUDITORIA
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id TEXT,
  old_value JSON,
  new_value JSON,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_case ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);

-- ============================================
-- AGENT RUNS (IA)
-- ============================================

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  message_id TEXT,
  request_json JSON,
  response_json JSON,
  confidence REAL,
  risk_level TEXT,
  status TEXT DEFAULT 'completed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id)
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_case ON agent_runs(case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  user_id TEXT,
  ip TEXT,
  path TEXT,
  user_agent TEXT,
  details JSON,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_protocol ON cases(protocol);
CREATE INDEX IF NOT EXISTS idx_cases_citizen_phone ON cases(citizen_phone);
CREATE INDEX IF NOT EXISTS idx_cases_queue_id ON cases(queue_id);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_case_id ON messages(case_id);
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON messages(external_message_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_routing_rules_priority ON routing_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_routing_rules_enabled ON routing_rules(enabled);

-- ============================================
-- SEED: 8 SECRETARIAS (MVP)
-- ============================================

INSERT OR IGNORE INTO secretariats (id, code, name, description, sla_hours) VALUES
('sec_ouvidoria', 'OUVIDORIA_CENTRAL', 'Ouvidoria Central', 'Triagem e coordenação de manifestações', 48),
('sec_sdu_cn', 'SDU_CENTRO_NORTE', 'SDU Centro-Norte', 'Superintendência de Desenvolvimento Urbano Centro-Norte', 72),
('sec_sdu_sul', 'SDU_SUL', 'SDU Sul', 'Superintendência de Desenvolvimento Urbano Sul', 72),
('sec_sdu_leste', 'SDU_LESTE', 'SDU Leste', 'Superintendência de Desenvolvimento Urbano Leste', 72),
('sec_sdu_sudeste', 'SDU_SUDESTE', 'SDU Sudeste', 'Superintendência de Desenvolvimento Urbano Sudeste', 72),
('sec_fms', 'FMS_SAUDE', 'Fundação Municipal de Saúde', 'Saúde pública municipal', 48),
('sec_strans', 'STRANS_TRANSITO', 'STRANS', 'Superintendência de Trânsito', 72),
('sec_semec', 'SEMEC_EDUCACAO', 'SEMEC', 'Secretaria Municipal de Educação', 96);

-- ============================================
-- SEED: 14 FILAS (MVP)
-- ============================================

INSERT OR IGNORE INTO queues (id, secretariat_id, slug, name, description, sla_hours) VALUES
-- Ouvidoria Central
('q_triagem', 'sec_ouvidoria', 'TRIAGEM', 'Triagem', 'Triagem inicial de manifestações', 24),
('q_qualidade', 'sec_ouvidoria', 'QUALIDADE_SLA', 'Qualidade SLA', 'Monitoramento de SLA', 24),
-- SDU Centro-Norte
('q_cn_obras', 'sec_sdu_cn', 'OBRAS_MANUTENCAO', 'Obras e Manutenção', 'Manutenção de vias e infraestrutura', 72),
('q_cn_limpeza', 'sec_sdu_cn', 'LIMPEZA_CAPINA', 'Limpeza e Capina', 'Limpeza urbana e capina', 48),
-- SDU Sul
('q_sul_obras', 'sec_sdu_sul', 'OBRAS_MANUTENCAO', 'Obras e Manutenção', 'Manutenção de vias e infraestrutura', 72),
('q_sul_limpeza', 'sec_sdu_sul', 'LIMPEZA_CAPINA', 'Limpeza e Capina', 'Limpeza urbana e capina', 48),
-- SDU Leste
('q_leste_obras', 'sec_sdu_leste', 'OBRAS_MANUTENCAO', 'Obras e Manutenção', 'Manutenção de vias e infraestrutura', 72),
('q_leste_limpeza', 'sec_sdu_leste', 'LIMPEZA_CAPINA', 'Limpeza e Capina', 'Limpeza urbana e capina', 48),
-- SDU Sudeste
('q_sudeste_obras', 'sec_sdu_sudeste', 'OBRAS_MANUTENCAO', 'Obras e Manutenção', 'Manutenção de vias e infraestrutura', 72),
('q_sudeste_limpeza', 'sec_sdu_sudeste', 'LIMPEZA_CAPINA', 'Limpeza e Capina', 'Limpeza urbana e capina', 48),
-- FMS Saúde
('q_fms_ubs', 'sec_fms', 'UBS_ATENDIMENTO', 'UBS e Atendimento', 'Atendimento em Unidades Básicas de Saúde', 48),
('q_fms_farmacia', 'sec_fms', 'MEDICAMENTOS_FARMACIA', 'Medicamentos e Farmácia', 'Distribuição de medicamentos', 24),
-- STRANS Trânsito
('q_strans_sinalizacao', 'sec_strans', 'SINALIZACAO_TRANSITO', 'Sinalização de Trânsito', 'Sinalização, semáforos e trânsito', 72),
-- SEMEC Educação
('q_semec_infra', 'sec_semec', 'INFRAESTRUTURA_ESCOLAR', 'Infraestrutura Escolar', 'Manutenção de escolas e creches', 96);

-- ============================================
-- SEED: TAGS COMUNS
-- ============================================

INSERT OR IGNORE INTO tags (id, name, color, description) VALUES
('tag_vias', 'vias_publicas', '#EF4444', 'Vias públicas e pavimentação'),
('tag_tapa_buraco', 'tapa_buraco', '#F97316', 'Tapa-buraco'),
('tag_iluminacao', 'iluminacao_publica', '#EAB308', 'Iluminação pública'),
('tag_limpeza', 'limpeza_urbana', '#22C55E', 'Limpeza urbana'),
('tag_capina', 'capina', '#84CC16', 'Capina e mato alto'),
('tag_lixo', 'coleta_lixo', '#10B981', 'Coleta de lixo'),
('tag_saude', 'saude', '#3B82F6', 'Saúde pública'),
('tag_transito', 'transito', '#8B5CF6', 'Trânsito e mobilidade'),
('tag_educacao', 'educacao', '#F59E0B', 'Educação'),
('tag_triagem', 'triagem_manual', '#6B7280', 'Triagem manual necessária');

INSERT OR IGNORE INTO message_templates (id, template_key, channel, version, is_active, content, created_by) VALUES
('tmpl_welcome_v1', 'WA_WELCOME', 'whatsapp', 1, 1,
'Olá! Você está falando com a Ouvidoria Digital do Município.\n\nPara registrar sua manifestação, descreva o problema e, se possível, informe:\n• Endereço (rua e número)\n• Bairro\n• Ponto de referência\n• Foto (se tiver)\n\nAssim que recebermos as informações, vamos gerar um número de protocolo.',
'system'),
('tmpl_protocol_v1', 'WA_PROTOCOL_CONFIRMED', 'whatsapp', 1, 1,
'Manifestação registrada ✅\n\nSeu número de protocolo é: {{protocol}}\n\nGuarde este número para acompanhar o andamento.\nSe quiser complementar, responda por aqui com novas informações ou anexos.',
'system'),
('tmpl_request_info_v1', 'WA_REQUEST_INFO', 'whatsapp', 1, 1,
'Para encaminhar corretamente, preciso de mais alguns dados:\n\n{{required_fields_list}}\n\nVocê pode responder com o texto e, se possível, enviar uma foto.',
'system'),
('tmpl_routed_v1', 'WA_ROUTED_TO_SECRETARIAT', 'whatsapp', 1, 1,
'Obrigado! Sua manifestação foi encaminhada para: {{secretariat}} ({{queue}}).\n\nProtocolo: {{protocol}}\nStatus atual: {{status}}\n\nSe precisar complementar, é só responder por aqui.',
'system'),
('tmpl_closed_v1', 'WA_CLOSED', 'whatsapp', 1, 1,
'Seu atendimento foi encerrado.\n\nProtocolo: {{protocol}}\nStatus final: {{status}}\n\nSe o problema persistir ou você quiser adicionar novas informações, responda por aqui mencionando o protocolo.\nObrigado por contribuir com a melhoria da cidade.',
'system');

-- ============================================
-- SEED: REGRAS DE ROTEAMENTO (DSL)
-- ============================================

INSERT OR IGNORE INTO routing_rules (id, name, priority, enabled, conditions, actions, description) VALUES
('rule_vias_buraco', 'Vias - Buraco/Cratera/Asfalto', 10, 1,
'{"all": [{"field": "channel", "op": "eq", "value": "whatsapp"}, {"any": [{"field": "message.text", "op": "contains", "value": "buraco"}, {"field": "message.text", "op": "contains", "value": "cratera"}, {"field": "message.text", "op": "contains", "value": "asfalto"}, {"field": "message.text", "op": "regex", "value": "\\\\b(pavimenta(c|ç)ao|tapa\\\\s*buraco|via\\\\s*p(u|ú)blica)\\\\b"}]}]}',
'[{"type": "add_tag", "value": "vias_publicas"}, {"type": "add_tag", "value": "tapa_buraco"}, {"type": "set_queue_by_meta", "strategy": "sdu_by_zone", "target_queue_slug": "OBRAS_MANUTENCAO", "fallback_queue_id": "q_triagem"}, {"type": "set_priority", "value": "high"}, {"type": "set_sla_rule", "value": "sla_vias_high"}, {"type": "require_fields", "fields": ["endereco", "bairro", "ponto_referencia", "foto_opcional"]}]',
'Detecta reclamações sobre buracos e pavimentação e encaminha para SDU por zona'),

('rule_iluminacao', 'Serviços Urbanos - Iluminação', 20, 1,
'{"all": [{"field": "channel", "op": "eq", "value": "whatsapp"}, {"any": [{"field": "message.text", "op": "contains", "value": "ilumina"}, {"field": "message.text", "op": "contains", "value": "poste"}, {"field": "message.text", "op": "contains", "value": "lâmpada"}, {"field": "message.text", "op": "contains", "value": "lampada"}, {"field": "message.text", "op": "regex", "value": "\\\\b(luz\\\\s*apagada|sem\\\\s*luz|poste\\\\s*apagado)\\\\b"}]}]}',
'[{"type": "add_tag", "value": "iluminacao_publica"}, {"type": "set_queue_by_meta", "strategy": "sdu_by_zone", "target_queue_slug": "OBRAS_MANUTENCAO", "fallback_queue_id": "q_triagem"}, {"type": "set_priority", "value": "normal"}, {"type": "set_sla_rule", "value": "sla_iluminacao_normal"}, {"type": "require_fields", "fields": ["endereco", "bairro", "ponto_referencia", "numero_poste_opcional", "foto_opcional"]}]',
'Detecta problemas de iluminação pública e encaminha para SDU por zona'),

('rule_limpeza_lixo', 'Serviços Urbanos - Lixo/Capina/Limpeza', 30, 1,
'{"all": [{"field": "channel", "op": "eq", "value": "whatsapp"}, {"any": [{"field": "message.text", "op": "contains", "value": "lixo"}, {"field": "message.text", "op": "contains", "value": "entulho"}, {"field": "message.text", "op": "contains", "value": "capina"}, {"field": "message.text", "op": "contains", "value": "limpeza"}, {"field": "message.text", "op": "regex", "value": "\\\\b(coleta\\\\s*(de)?\\\\s*lixo|terreno\\\\s*baldio|mato\\\\s*alto)\\\\b"}]}]}',
'[{"type": "add_tag", "value": "limpeza_urbana"}, {"type": "set_queue_by_meta", "strategy": "sdu_by_zone", "target_queue_slug": "LIMPEZA_CAPINA", "fallback_queue_id": "q_triagem"}, {"type": "set_priority", "value": "normal"}, {"type": "set_sla_rule", "value": "sla_limpeza_normal"}, {"type": "require_fields", "fields": ["endereco", "bairro", "ponto_referencia", "foto_opcional"]}]',
'Detecta problemas de limpeza urbana e encaminha para SDU por zona'),

('rule_saude_fms', 'Saúde - UBS/Atendimento/Medicamentos (FMS)', 40, 1,
'{"all": [{"field": "channel", "op": "eq", "value": "whatsapp"}, {"any": [{"field": "message.text", "op": "regex", "value": "\\\\b(ubs|posto\\\\s*de\\\\s*sa(u|ú)de|unidade\\\\s*b(a|á)sica)\\\\b"}, {"field": "message.text", "op": "contains", "value": "médico"}, {"field": "message.text", "op": "contains", "value": "medico"}, {"field": "message.text", "op": "contains", "value": "consulta"}, {"field": "message.text", "op": "contains", "value": "medicamento"}, {"field": "message.text", "op": "contains", "value": "farmácia"}, {"field": "message.text", "op": "contains", "value": "farmacia"}]}]}',
'[{"type": "add_tag", "value": "saude"}, {"type": "set_secretariat", "value": "sec_fms"}, {"type": "set_queue", "strategy": "keyword_split", "routes": [{"when_any": [{"field": "message.text", "op": "contains", "value": "medicamento"}, {"field": "message.text", "op": "contains", "value": "farmácia"}, {"field": "message.text", "op": "contains", "value": "farmacia"}], "queue_id": "q_fms_farmacia"}], "default_queue_id": "q_fms_ubs"}, {"type": "set_priority", "value": "high"}, {"type": "set_sla_rule", "value": "sla_saude_high"}, {"type": "require_fields", "fields": ["nome_unidade_opcional", "bairro", "relato", "data_hora_opcional"]}]',
'Detecta manifestações sobre saúde e encaminha para FMS'),

('rule_transito_strans', 'Trânsito - Sinalização/Semáforo/Ônibus (STRANS)', 50, 1,
'{"all": [{"field": "channel", "op": "eq", "value": "whatsapp"}, {"any": [{"field": "message.text", "op": "contains", "value": "semáforo"}, {"field": "message.text", "op": "contains", "value": "semaforo"}, {"field": "message.text", "op": "contains", "value": "sinalização"}, {"field": "message.text", "op": "contains", "value": "sinalizacao"}, {"field": "message.text", "op": "contains", "value": "ônibus"}, {"field": "message.text", "op": "contains", "value": "onibus"}, {"field": "message.text", "op": "contains", "value": "trânsito"}, {"field": "message.text", "op": "contains", "value": "transito"}, {"field": "message.text", "op": "contains", "value": "multa"}]}]}',
'[{"type": "add_tag", "value": "transito"}, {"type": "set_secretariat", "value": "sec_strans"}, {"type": "set_queue", "value": "q_strans_sinalizacao"}, {"type": "set_priority", "value": "normal"}, {"type": "set_sla_rule", "value": "sla_transito_normal"}, {"type": "require_fields", "fields": ["endereco", "bairro", "ponto_referencia", "foto_opcional", "placa_opcional", "linha_onibus_opcional"]}]',
'Detecta manifestações sobre trânsito e encaminha para STRANS'),

('rule_escola_semec', 'Educação - Escola/Infraestrutura/Merenda/Matrícula (SEMEC)', 60, 1,
'{"all": [{"field": "channel", "op": "eq", "value": "whatsapp"}, {"any": [{"field": "message.text", "op": "contains", "value": "escola"}, {"field": "message.text", "op": "contains", "value": "creche"}, {"field": "message.text", "op": "contains", "value": "merenda"}, {"field": "message.text", "op": "contains", "value": "matrícula"}, {"field": "message.text", "op": "contains", "value": "matricula"}, {"field": "message.text", "op": "regex", "value": "\\\\b(sala\\\\s*de\\\\s*aula|banheiro|telhado|ventilador|ar\\\\s*condicionado)\\\\b"}]}]}',
'[{"type": "add_tag", "value": "educacao"}, {"type": "set_secretariat", "value": "sec_semec"}, {"type": "set_queue", "value": "q_semec_infra"}, {"type": "set_priority", "value": "normal"}, {"type": "set_sla_rule", "value": "sla_educacao_normal"}, {"type": "require_fields", "fields": ["nome_escola_opcional", "bairro", "relato", "foto_opcional"]}]',
'Detecta manifestações sobre educação e encaminha para SEMEC'),

('rule_fallback_triagem', 'Fallback - Triagem Ouvidoria Central', 9999, 1,
'{"all": [{"field": "channel", "op": "eq", "value": "whatsapp"}]}',
'[{"type": "add_tag", "value": "triagem_manual"}, {"type": "set_secretariat", "value": "sec_ouvidoria"}, {"type": "set_queue", "value": "q_triagem"}, {"type": "set_priority", "value": "normal"}, {"type": "set_sla_rule", "value": "sla_triagem_normal"}, {"type": "require_fields", "fields": ["relato"]}]',
'Regra de fallback para manifestações que não casam com outras regras');

-- ============================================
-- SEED: REGRAS DE SLA
-- ============================================

INSERT OR IGNORE INTO sla_rules (id, name, hours, priority, description) VALUES
('sla_vias_high', 'SLA Vias - Prioridade Alta', 48, 'high', 'Vias com buracos/crateras - alta prioridade'),
('sla_iluminacao_normal', 'SLA Iluminação - Normal', 72, 'normal', 'Problemas de iluminação pública'),
('sla_limpeza_normal', 'SLA Limpeza - Normal', 48, 'normal', 'Coleta de lixo e capina'),
('sla_saude_high', 'SLA Saúde - Alta Prioridade', 24, 'high', 'Saúde - UBS e medicamentos'),
('sla_transito_normal', 'SLA Trânsito - Normal', 72, 'normal', 'Sinalização e trânsito'),
('sla_educacao_normal', 'SLA Educação - Normal', 96, 'normal', 'Infraestrutura escolar'),
('sla_triagem_normal', 'SLA Triagem - Normal', 24, 'normal', 'Triagem de manifestãções');
