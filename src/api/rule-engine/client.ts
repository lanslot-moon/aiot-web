import { request } from '@/api/iam/client';

export type Kind = 'TRIGGER' | 'CONDITION' | 'TRANSFORM' | 'ACTION';
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export type NodeConfig = JsonObject & { kind: Kind };
export type RuleNode = { nodeId: string; name: string; x: number; y: number; config: NodeConfig };
export type Relation = { fromNodeId: string; fromPort: string; toNodeId: string };
export type Definition = {
  entryNodeId: string;
  settings: JsonObject;
  nodes: RuleNode[];
  relations: Relation[];
};
export type Draft = { name: string; description: string | null; definition: Definition };
export type Rule = Draft & {
  createdTime: number;
  updatedTime: number;
  ruleId: string;
  draftRevision: number;
  status: string;
  generation: number;
  activeVersionId: string | null;
};
export type Version = { versionId: string; versionNumber: number; draftRevision: number };
export type Page<T> = { items: T[]; nextCursor: string | null; hasMore: boolean };
export type Capabilities = { nodePorts: Record<string, string[]> | null; actionTypes: string[] };
export type Decision = {
  condition: { type: string; reason?: string };
  path: { nodeId: string; port: string | null }[];
};
export type SimulationStep = {
  time: number;
  deadline: boolean;
  decision: Decision;
  plans: { actionId: string; targetId: string }[];
};
export type Execution = {
  executionId: string;
  occurredAt: number;
  versionId: string;
  decision: Decision;
};

export function ruleRequest<T>(projectId: string, path: string, method = 'GET', body?: unknown) {
  return request<T>('/api/v1/rule-engine/' + path, method, body, { projectId });
}
export function pagePath(
  path: string,
  cursor?: string | null,
  filters: Record<string, string> = {},
) {
  const params = new URLSearchParams({ pageSize: '30', ...filters });
  if (cursor) params.set('cursor', cursor);
  return path + '?' + params;
}
