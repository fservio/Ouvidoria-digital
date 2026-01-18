import type { Env, CasePriority } from '../../types/index.js';

interface RoutingConditions {
  all?: Array<{ field: string; op: string; value: string | number | boolean }>;
  any?: Array<{ field: string; op: string; value: string | number | boolean }>;
  not?: { field: string; op: string; value: string | number | boolean };
}

interface RoutingAction {
  type: string;
  value?: string;
  strategy?: string;
  target_queue_slug?: string;
  fallback_queue_id?: string;
  routes?: Array<{ when_any: Array<Record<string, unknown>>; queue_id: string }>;
  fields?: string[];
}

interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  enabled: number;
  conditions: RoutingConditions;
  actions: RoutingAction[];
  description: string | null;
  match_count: number;
}

export interface RoutingResult {
  routed: boolean;
  queue_id: string | null;
  secretariat_id: string | null;
  priority: CasePriority | null;
  tags: string[];
  sla_hours: number | null;
  missing_fields: string[];
  rule_applied: string | null;
}

export async function routeCase(
  caseId: string,
  messageContent: string,
  env: Env
): Promise<RoutingResult> {
  const rules = await getActiveRulesOrdered(env.DB);

  for (const rule of rules) {
    const matches = evaluateConditions(rule.conditions, messageContent);

    if (matches) {
      await incrementRuleMatchCount(rule.id, env.DB);
      return applyRoutingActions(caseId, rule.actions, env);
    }
  }

  const fallbackRule = await getFallbackRule(env.DB);
  if (fallbackRule) {
    await incrementRuleMatchCount(fallbackRule.id, env.DB);
    return applyRoutingActions(caseId, fallbackRule.actions, env);
  }

  return {
    routed: false,
    queue_id: null,
    secretariat_id: null,
    priority: null,
    tags: [],
    sla_hours: null,
    missing_fields: [],
    rule_applied: null,
  };
}

export async function simulateRouting(
  messageContent: string,
  env: Env
): Promise<RoutingResult> {
  const rules = await getActiveRulesOrdered(env.DB);

  for (const rule of rules) {
    const matches = evaluateConditions(rule.conditions, messageContent);

    if (matches) {
      return {
        routed: true,
        queue_id: null,
        secretariat_id: null,
        priority: null,
        tags: [],
        sla_hours: null,
        missing_fields: [],
        rule_applied: rule.id,
      };
    }
  }

  const fallbackRule = await getFallbackRule(env.DB);
  return {
    routed: Boolean(fallbackRule),
    queue_id: null,
    secretariat_id: null,
    priority: null,
    tags: [],
    sla_hours: null,
    missing_fields: [],
    rule_applied: fallbackRule?.id || null,
  };
}

async function getFallbackRule(db: D1Database): Promise<RoutingRule | null> {
  const result = await db
    .prepare('SELECT * FROM routing_rules WHERE id = ? AND enabled = 1')
    .bind('rule_fallback_triagem')
    .first();

  if (!result) return null;

  const rule = result as unknown as RoutingRule;
  return {
    ...rule,
    conditions: typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions,
    actions: typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions,
  };
}

async function getActiveRulesOrdered(db: D1Database): Promise<RoutingRule[]> {
  const result = await db
    .prepare('SELECT * FROM routing_rules WHERE enabled = 1 ORDER BY priority DESC')
    .all();

  return (result.results as unknown as RoutingRule[]).map((rule) => ({
    ...rule,
    conditions: typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions,
    actions: typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions,
  }));
}

function evaluateConditions(
  conditions: RoutingConditions,
  messageContent: string
): boolean {
  if (conditions.all) {
    return conditions.all.every((c) => evaluateCondition(c, messageContent));
  }

  if (conditions.any) {
    return conditions.any.some((c) => evaluateCondition(c, messageContent));
  }

  if (conditions.not) {
    return !evaluateCondition(conditions.not, messageContent);
  }

  return false;
}

function evaluateCondition(
  condition: { field: string; op: string; value: string | number | boolean },
  messageContent: string
): boolean {
  const { op, value } = condition;
  const fieldValue = getFieldValue(condition.field, messageContent);
  const compareValue = String(value);
  const compareField = String(fieldValue);

  switch (op) {
    case 'eq':
      return compareField === compareValue;

    case 'ne':
      return compareField !== compareValue;

    case 'contains':
      return compareField.toLowerCase().includes(compareValue.toLowerCase());

    case 'regex':
      try {
        const regex = new RegExp(compareValue, 'i');
        return regex.test(compareField);
      } catch {
        return false;
      }

    case 'in':
      const inValues = compareValue.split(',');
      return inValues.includes(compareField);

    case 'not_in':
      const notInValues = compareValue.split(',');
      return !notInValues.includes(compareField);

    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;

    case 'gt':
      return Number(fieldValue) > Number(value);

    case 'gte':
      return Number(fieldValue) >= Number(value);

    case 'lt':
      return Number(fieldValue) < Number(value);

    case 'lte':
      return Number(fieldValue) <= Number(value);

    default:
      return false;
  }
}

function getFieldValue(field: string, messageContent: string): unknown {
  switch (field) {
    case 'channel':
      return 'whatsapp';

    case 'message.text':
      return messageContent;

    default:
      return null;
  }
}

async function applyRoutingActions(
  caseId: string,
  actions: RoutingAction[],
  env: Env
): Promise<RoutingResult> {
  const result: RoutingResult = {
    routed: true,
    queue_id: null,
    secretariat_id: null,
    priority: null,
    tags: [],
    sla_hours: null,
    missing_fields: [],
    rule_applied: caseId,
  };

  for (const action of actions) {
    switch (action.type) {
      case 'add_tag':
        if (action.value) {
          result.tags.push(action.value);
          await addTagToCase(caseId, action.value, env.DB);
        }
        break;

      case 'set_priority':
        if (action.value && ['low', 'normal', 'high', 'urgent'].includes(action.value)) {
          result.priority = action.value as CasePriority;
          await env.DB
            .prepare('UPDATE cases SET priority = ? WHERE id = ?')
            .bind(result.priority, caseId)
            .run();
        }
        break;

      case 'set_secretariat':
        result.secretariat_id = action.value || null;
        break;

      case 'set_queue':
        if (action.value) {
          result.queue_id = action.value;
        }
        break;

      case 'set_queue_by_meta':
        if (action.target_queue_slug) {
          result.queue_id = await resolveQueueByMeta(
            action.target_queue_slug,
            action.fallback_queue_id,
            env
          );
        }
        break;

      case 'set_sla_rule':
        if (action.value) {
          result.sla_hours = await getSLAHours(action.value, env.DB);
        }
        break;

      case 'require_fields':
        if (action.fields) {
          result.missing_fields = action.fields;
          await addMissingFields(caseId, action.fields, env.DB);
        }
        break;
    }
  }

  if (result.queue_id) {
    const queue = await env.DB
      .prepare('SELECT secretariat_id FROM queues WHERE id = ?')
      .bind(result.queue_id)
      .first();

    if (queue) {
      result.secretariat_id = (queue as { secretariat_id: string }).secretariat_id;
    }
  }

  return result;
}

async function resolveQueueByMeta(
  targetQueueSlug: string,
  fallbackQueueId: string | undefined,
  env: Env
): Promise<string> {
  const queue = await env.DB
    .prepare(
      `SELECT q.id FROM queues q
       JOIN secretariats s ON q.secretariat_id = s.id
       WHERE q.slug = ? AND q.is_active = 1 AND s.is_active = 1
       ORDER BY q.priority DESC
       LIMIT 1`
    )
    .bind(targetQueueSlug)
    .first();

  if (queue) {
    return (queue as { id: string }).id;
  }

  return fallbackQueueId || 'q_triagem';
}

async function getSLAHours(slaRuleId: string, db: D1Database): Promise<number | null> {
  const result = await db
    .prepare('SELECT hours FROM sla_rules WHERE id = ? AND is_active = 1')
    .bind(slaRuleId)
    .first();

  if (result) {
    return (result as { hours: number }).hours;
  }

  const defaultResult = await db
    .prepare('SELECT hours FROM sla_rules WHERE name = ? AND is_active = 1')
    .bind('sla_triagem_normal')
    .first();

  return defaultResult ? (defaultResult as { hours: number }).hours : 48;
}

async function addTagToCase(caseId: string, tagName: string, db: D1Database): Promise<void> {
  const tag = await db.prepare('SELECT id FROM tags WHERE name = ?').bind(tagName).first();

  if (tag) {
    await db
      .prepare('INSERT OR IGNORE INTO case_tags (case_id, tag_id) VALUES (?, ?)')
      .bind(caseId, (tag as { id: string }).id)
      .run();
  }
}

async function addMissingFields(caseId: string, fields: string[], db: D1Database): Promise<void> {
  for (const field of fields) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO missing_fields (id, case_id, field_name, is_provided)
         VALUES (?, ?, ?, 0)`
      )
      .bind(crypto.randomUUID(), caseId, field)
      .run();
  }
}

async function incrementRuleMatchCount(ruleId: string, db: D1Database): Promise<void> {
  await db
    .prepare('UPDATE routing_rules SET match_count = match_count + 1 WHERE id = ?')
    .bind(ruleId)
    .run();
}
