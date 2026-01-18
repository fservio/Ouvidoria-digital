export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  MESSAGE_QUEUE?: globalThis.Queue;
  WHATSAPP_QUEUE?: globalThis.Queue;
  SLA_QUEUE?: globalThis.Queue;
  N8N_QUEUE?: globalThis.Queue;
  JWT_SECRET: string;
  MASTER_KEY: string;
  WEBHOOK_VERIFY_TOKEN?: string;
  N8N_HMAC_SECRET?: string;
  PUBLIC_INTAKE_ENABLED?: string;
  CITIZEN_EDIT_ENABLED?: string;
}

export interface Bindings {
  DB: D1Database;
  KV: KVNamespace;
  MESSAGE_QUEUE?: globalThis.Queue;
  WHATSAPP_QUEUE?: globalThis.Queue;
  SLA_QUEUE?: globalThis.Queue;
  N8N_QUEUE?: globalThis.Queue;
}

export interface Variables {
  user: UserPayload | null;
}

export interface UserPayload {
  id: string;
  email: string;
  role: string;
  secretariat_id: string | null;
}

export interface Case {
  id: string;
  protocol: string;
  external_message_id: string | null;
  citizen_phone: string;
  citizen_name: string | null;
  citizen_email: string | null;
  status: CaseStatus;
  priority: CasePriority;
  source: CaseSource;
  queue_id: string | null;
  assigned_to: string | null;
  sla_due_at: string | null;
  sla_breached: number;
  resolved_at: string | null;
  closed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type CaseStatus =
  | 'new'
  | 'routing'
  | 'assigned'
  | 'in_progress'
  | 'waiting_citizen'
  | 'resolved'
  | 'closed';

export type CasePriority = 'low' | 'normal' | 'high' | 'urgent';
export type CaseSource = 'whatsapp' | 'phone' | 'email' | 'web' | 'presencial';

export interface Message {
  id: string;
  case_id: string | null;
  external_message_id: string;
  direction: 'inbound' | 'outbound';
  type: MessageType;
  content: string | null;
  media_url: string | null;
  metadata: Record<string, unknown> | null;
  delivery_status: 'pending' | 'sent' | 'failed';
  last_error: string | null;
  sent_at: string | null;
  is_processed: number;
  processed_at: string | null;
  created_at: string;
}

export type MessageType =
  | 'text'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'button'
  | 'interactive';

export interface Secretariat {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: number;
  sla_hours: number;
}

export interface ServiceQueue {
  id: string;
  secretariat_id: string;
  slug: string;
  name: string;
  description: string | null;
  priority: number;
  is_active: number;
  sla_hours: number;
}

export interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  enabled: number;
  conditions: RoutingConditions;
  actions: RoutingAction[];
  description: string | null;
  match_count: number;
}

export interface RoutingConditions {
  all?: Condition[];
  any?: Condition[];
  not?: Condition;
}

export interface Condition {
  field: string;
  op: ConditionOperator;
  value: string | number | boolean;
}

export type ConditionOperator =
  | 'eq'
  | 'ne'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'regex'
  | 'exists'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

export interface RoutingAction {
  type: RoutingActionType;
  value?: string;
  strategy?: string;
  target_queue_slug?: string;
  fallback_queue_id?: string;
  routes?: QueueRoute[];
  fields?: string[];
}

export type RoutingActionType =
  | 'add_tag'
  | 'set_priority'
  | 'set_secretariat'
  | 'set_queue'
  | 'set_queue_by_meta'
  | 'set_sla_rule'
  | 'require_fields';

export interface QueueRoute {
  when_any: Condition[];
  queue_id: string;
}

export interface SLARule {
  id: string;
  name: string;
  hours: number;
  priority: CasePriority;
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  user_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string;
  changes: MetaWebhookChange[];
}

export interface MetaWebhookChange {
  field: string;
  value: MetaWebhookValue;
}

export interface MetaWebhookValue {
  messaging_product: string;
  metadata: {
    phone_number_id: string;
    display_phone_number: string;
  };
  contacts?: Array<{
    wa_id: string;
    profile: { name: string };
  }>;
  messages?: MetaWebhookMessage[];
}

export interface MetaWebhookMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string };
  document?: { id: string; filename: string; mime_type: string; sha256: string };
  timestamp: string;
  reaction?: { message_id: string; emoji: string };
  interactive?: { type: string; [key: string]: unknown };
}
