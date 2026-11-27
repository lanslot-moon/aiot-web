import type { Edge, Node } from '@xyflow/react';
import type {
  Capabilities,
  Definition,
  Draft,
  JsonObject,
  Kind,
  NodeConfig,
  Relation,
} from '@/api/rule-engine/client';
import pump from './examples/pump';

export const kinds: Record<Kind, string> = {
  TRIGGER: '触发入口',
  CONDITION: '条件判断',
  TRANSFORM: '字段转换',
  ACTION: '执行动作',
};
export const portLabels: Record<string, string> = {
  NEXT: '下一步',
  TRUE: '满足',
  FALSE: '不满足',
  ASSERT: '异常',
  RESOLVE: '恢复',
};
export type FlowNode = Node<{ name: string; config: NodeConfig }, 'rule'>;
export type FlowEdge = Edge;
export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function parseObject(text: string): JsonObject {
  const value: unknown = JSON.parse(text);
  if (!isObject(value)) throw new Error('请输入 JSON 对象。');
  return value;
}
export function preset(example: boolean): Draft {
  const draft = structuredClone(pump);
  if (!example) {
    draft.name = '未命名规则链';
    draft.description = '';
    draft.definition.nodes = [{ ...draft.definition.nodes[0], name: '设备属性上报' }];
    draft.definition.relations = [];
    draft.definition.settings.scope = {
      productIds: [],
      deviceIds: [],
      deviceGroupIds: [],
      sourceSpacePolicy: 'PRODUCTION_ONLY',
    };
  }
  return draft;
}
export function ports(config: NodeConfig, capabilities?: Capabilities) {
  const phase =
    config.kind === 'CONDITION' &&
    isObject(config.condition) &&
    ['detection', 'silence', 'offline'].includes(String(config.condition.type));
  const defaults = phase
    ? ['ASSERT', 'RESOLVE']
    : config.kind === 'CONDITION'
      ? ['TRUE', 'FALSE']
      : ['NEXT'];
  const supported = capabilities?.nodePorts?.[phase ? 'DETECTION' : config.kind];
  return supported ? defaults.filter((port) => supported.includes(port)) : defaults;
}
export function graphNodes(definition: Definition): FlowNode[] {
  return definition.nodes.map(({ nodeId, name, config, x, y }) => ({
    id: nodeId,
    type: 'rule',
    position: { x, y },
    data: { name, config },
    deletable: nodeId !== definition.entryNodeId,
  }));
}
export function graphEdge(relation: Relation): FlowEdge {
  return {
    id: relation.fromNodeId + ':' + relation.fromPort,
    source: relation.fromNodeId,
    sourceHandle: relation.fromPort,
    target: relation.toNodeId,
  };
}
export function definitionFromGraph(
  settings: JsonObject,
  entryNodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): Definition {
  return {
    settings,
    entryNodeId,
    nodes: nodes.map(({ id, data, position }) => ({
      nodeId: id,
      name: data.name,
      config: data.config,
      x: Math.round(position.x),
      y: Math.round(position.y),
    })),
    relations: edges.map((edge) => ({
      fromNodeId: edge.source,
      fromPort: edge.sourceHandle!,
      toNodeId: edge.target,
    })),
  };
}

export function newConfig(kind: Exclude<Kind, 'TRIGGER'>, actionId: string): NodeConfig {
  if (kind === 'CONDITION')
    return {
      kind,
      condition: {
        type: 'predicate',
        left: { type: 'field', source: 'sourceEvent', path: 'temperature' },
        operator: 'GE',
        right: { type: 'constant', value: { type: 'number', value: 80 } },
      },
    };
  if (kind === 'TRANSFORM')
    return {
      kind,
      transform: {
        type: 'mapping',
        mappings: { status: { type: 'constant', value: { type: 'text', value: 'HIGH' } } },
      },
    };
  return {
    kind,
    action: {
      type: 'DEVICE_COMMAND',
      actionId,
      targets: [],
      identifier: '',
      parameters: {},
      common: {
        timeoutMs: 3000,
        delayMs: 0,
        expiresAfterMs: 60000,
        retryPolicy: {
          maxAttempts: 1,
          initialBackoffMs: 1000,
          maxBackoffMs: 1000,
          retryUncertain: false,
        },
      },
    },
  };
}

export function durationConfig(): NodeConfig {
  return structuredClone(
    pump.definition.nodes.find((node) => node.nodeId === 'temperature')!.config,
  );
}
