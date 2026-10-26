import { v4 as uuidv4 } from 'uuid';
import { decodeValue, encodeValue, type ProfileBody, type SimulationValue } from '@/api/device/simulation';
import { schemaObject } from '../command-schema';

export type Generator = 'current' | 'constant' | 'random' | 'ramp' | 'wave';
export interface PropertyRow { key: string; code: string; generator: Generator; value: string; minimum: string; maximum: string; rate: string; amplitude: string; period: string }
export const newRow = (): PropertyRow => ({ key: uuidv4(), code: '', generator: 'constant', value: '0', minimum: '0', maximum: '100', rate: '1', amplitude: '10', period: '60' });

/** 只转换能够由表单完整表达的规则，避免覆盖自定义动作、参数或初始状态。 */
export function readProfileForm(body: ProfileBody): { rows: PropertyRow[]; interval: string; ruleId: string } {
  const unsupported = () => new Error('此 JSON 包含表单无法完整表达的规则，请继续使用 JSON 编辑，避免丢失配置。');
  if ([body.parameters, body.initialProperties, body.scripts].some(value => schemaObject(value) !== value)) throw unsupported();
  if (Object.keys(body.parameters).length || Object.keys(body.scripts).length || body.rules.length !== 1) throw unsupported();
  if (Object.keys(body).some(key => !['version', 'parameters', 'initialProperties', 'scripts', 'rules'].includes(key))) throw unsupported();
  const rule = body.rules[0];
  if (rule.trigger.type !== 'periodic' || rule.condition || ![1, 2].includes(rule.actions.length) || !Number.isSafeInteger(rule.trigger.intervalMs) || Number(rule.trigger.intervalMs) <= 0) throw unsupported();
  if (Object.keys(rule).some(key => !['ruleId', 'trigger', 'actions', 'condition'].includes(key)) || Object.keys(rule.trigger).some(key => !['type', 'intervalMs'].includes(key))) throw unsupported();
  const report = rule.actions[rule.actions.length - 1];
  const setter = rule.actions.length === 2 ? rule.actions[0] : undefined;
  if ((setter && (setter.type !== 'setProperties' || schemaObject(setter.properties) !== setter.properties)) || report.type !== 'reportProperties' || !Array.isArray(report.properties)) throw unsupported();
  if (rule.actions.some(action => Object.keys(action).some(key => !['type', 'properties'].includes(key)))) throw unsupported();
  const sources = schemaObject(setter?.properties);
  const codes = report.properties;
  if (!codes.length || codes.some(code => typeof code !== 'string') || new Set(codes).size !== codes.length || [...Object.keys(sources), ...Object.keys(body.initialProperties)].some(code => !codes.includes(code))) throw unsupported();
  const rows = codes.map(code => {
    const source = schemaObject(sources[code]);
    const row = { ...newRow(), code: String(code) };
    if (!Object.prototype.hasOwnProperty.call(sources, row.code)) {
      row.generator = 'current';
      row.value = Object.prototype.hasOwnProperty.call(body.initialProperties, row.code) ? JSON.stringify(decodeValue(body.initialProperties[row.code])) : '';
      return row;
    }
    let initial: unknown;
    let expectedKeys: string[];
    switch (source.type) {
      case 'constant':
        row.generator = 'constant'; initial = decodeValue(source.value as SimulationValue); row.value = JSON.stringify(initial); expectedKeys = ['type', 'value']; break;
      case 'random':
        row.generator = 'random'; row.minimum = String(source.minimum); row.maximum = String(source.maximum); initial = source.minimum; expectedKeys = ['type', 'minimum', 'maximum']; break;
      case 'ramp':
        row.generator = 'ramp'; row.minimum = String(source.minimum); row.maximum = String(source.maximum); row.value = String(source.initial); row.rate = String(source.perSecond); initial = source.initial; expectedKeys = ['type', 'minimum', 'maximum', 'initial', 'perSecond']; break;
      case 'wave':
        row.generator = 'wave'; row.value = String(source.center); row.amplitude = String(source.amplitude); row.period = String(Number(source.periodMs) / 1000); initial = source.center; expectedKeys = ['type', 'center', 'amplitude', 'periodMs']; break;
      default: throw unsupported();
    }
    if (Object.keys(source).some(key => !expectedKeys.includes(key)) || JSON.stringify(encodeValue(initial)) !== JSON.stringify(body.initialProperties[row.code])) throw unsupported();
    if (row.generator !== 'constant' && expectedKeys.filter(key => key !== 'type').some(key => typeof source[key] !== 'number' || !Number.isFinite(source[key]))) throw unsupported();
    return row;
  });
  return { rows, interval: String(Number(rule.trigger.intervalMs) / 1000), ruleId: rule.ruleId };
}
