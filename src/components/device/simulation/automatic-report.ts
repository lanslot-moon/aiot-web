import type { BehaviorRule, ProfileBody, ProfileVersion } from '@/api/device/simulation';
import { schemaObject } from '../command-schema';

export function isIdleRule(rule: BehaviorRule) {
  return rule.ruleId === 'idle' && rule.trigger.type === 'manual' && !rule.condition
    && rule.actions.length === 1 && rule.actions[0].type === 'setProperties'
    && !Object.keys(schemaObject(rule.actions[0].properties)).length;
}

function requireValidReferences(rules: BehaviorRule[]) {
  const ids = new Set(rules.map(rule => rule.ruleId));
  if (ids.size !== rules.length || rules.length > 128) throw new Error('规则标识必须唯一，行为模板最多包含 128 条规则。');
  for (const rule of rules) {
    for (const action of rule.actions) {
      if (action.type === 'schedule' && !ids.has(String(action.ruleId))) {
        throw new Error(`规则「${rule.ruleId}」仍引用「${String(action.ruleId)}」，请先修改该依赖，再移除或重命名规则。`);
      }
    }
  }
}

export function removeAutomaticRules(source: ProfileVersion, ruleId: string | null): ProfileBody {
  const rules = source.snapshot.rules.filter(rule => rule.trigger.type !== 'periodic' || (ruleId !== null && rule.ruleId !== ruleId));
  if (rules.length === source.snapshot.rules.length) throw new Error('要移除的自动上报规则已变化，请刷新后重试。');
  requireValidReferences(rules);
  // 保留其他行为、参数、脚本及初始值；最后一条行为移除后使用不自动触发的空闲规则。
  return { version: 1, parameters: source.snapshot.parameters, initialProperties: source.snapshot.initialProperties,
    scripts: source.snapshot.scripts, rules: rules.length ? rules : [{ ruleId: 'idle', trigger: { type: 'manual' }, actions: [{ type: 'setProperties', properties: {} }] }] };
}

export function mergeAutomaticRule(draft: ProfileBody, source: ProfileVersion | undefined, ruleId: string | null): ProfileBody {
  const original = source?.snapshot;
  const rules = original?.rules.filter(rule => !isIdleRule(rule)) ?? [];
  const index = ruleId === null ? -1 : rules.findIndex(rule => rule.ruleId === ruleId);
  if (ruleId !== null && index < 0) throw new Error('要编辑的自动上报规则已变化，请返回列表重新选择。');
  const merged = index < 0 ? [...rules, ...draft.rules] : [...rules.slice(0, index), ...draft.rules, ...rules.slice(index + 1)];
  requireValidReferences(merged);
  return { ...draft, parameters: { ...original?.parameters, ...draft.parameters },
    initialProperties: { ...original?.initialProperties, ...draft.initialProperties },
    scripts: { ...original?.scripts, ...draft.scripts }, rules: merged };
}

export function automaticRuleDraft(source: ProfileVersion, ruleId: string, version: number): ProfileBody {
  const rule = source.snapshot.rules.find(item => item.ruleId === ruleId && item.trigger.type === 'periodic');
  if (!rule) throw new Error('自动上报规则不存在，请重新选择。');
  const codes = new Set(rule.actions.flatMap(action => action.type === 'setProperties' ? Object.keys(schemaObject(action.properties))
    : action.type === 'reportProperties' && Array.isArray(action.properties) ? action.properties.filter((code): code is string => typeof code === 'string') : []));
  return { version, parameters: source.snapshot.parameters, scripts: source.snapshot.scripts, rules: [rule],
    initialProperties: Object.fromEntries(Object.entries(source.snapshot.initialProperties).filter(([code]) => codes.has(code))) };
}
