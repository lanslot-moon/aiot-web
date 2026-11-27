import { useState } from 'react';
import { addEdge, useEdgesState, useNodesState, type Connection } from '@xyflow/react';
import { Link, useNavigate } from 'react-router';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ChevronDown,
  GitBranch,
  Pencil,
  Save,
  Settings2,
  SlidersHorizontal,
  Trash2,
  PanelLeft,
  Zap,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { clearDraft, useDraftRegistration } from '@/components/iam/drafts';
import {
  ruleRequest,
  type Capabilities,
  type Decision,
  type Draft,
  type Kind,
  type Rule,
} from '@/api/rule-engine/client';
import {
  definitionFromGraph,
  graphEdge,
  graphNodes,
  kinds,
  newConfig,
  ports,
  type FlowEdge,
  type FlowNode,
} from './graph';
import { FlowCanvas } from './flow-canvas';
import { NodeDialog, SettingsDialog } from './edit-dialogs';
import { RunPanel } from './run-panel';
import { arrangeNodes, cardSize, columnGap, snap } from './layout';
import { RuleStatus } from './rule-status';

const toolIcons = { CONDITION: GitBranch, TRANSFORM: SlidersHorizontal, ACTION: Zap };

export function RuleEditor({
  projectId,
  initial,
  existing,
}: {
  projectId: string;
  initial: Draft;
  existing?: Rule;
}) {
  const navigate = useNavigate();
  const base = '/projects/' + encodeURIComponent(projectId) + '/rule-chains';
  const [rule, setRule] = useState(existing);
  const [meta, setMeta] = useState({
    name: initial.name,
    description: initial.description,
    settings: initial.definition.settings,
  });
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(graphNodes(initial.definition));
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(
    initial.definition.relations.map(graphEdge),
  );
  const [editing, setEditing] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [trace, setTrace] = useState<Decision>();
  const { data: capabilities, error: capabilityError } = useSWR(
    [projectId, 'rule-capabilities'],
    () => ruleRequest<Capabilities>(projectId, 'capabilities'),
  );
  const draft: Draft = {
    name: meta.name,
    description: meta.description,
    definition: definitionFromGraph(meta.settings, initial.definition.entryNodeId, nodes, edges),
  };
  // 用同一序列化方式比较服务端草稿和编辑结果，节点选中、高亮和缩放不会改变草稿。
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify({
      name: initial.name,
      description: initial.description,
      definition: definitionFromGraph(
        initial.definition.settings,
        initial.definition.entryNodeId,
        graphNodes(initial.definition),
        initial.definition.relations.map(graphEdge),
      ),
    }),
  );
  const dirty = baseline !== JSON.stringify(draft);
  const registration = useDraftRegistration(dirty);
  const selected = nodes.find((n) => n.selected);
  const edge = edges.find((e) => e.selected);
  const current = nodes.find((n) => n.id === editing);
  function append(kind: Exclude<Kind, 'TRIGGER'>, drop?: { x: number; y: number }) {
    const nodeId =
      'n_' +
      Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) =>
        n.toString(16).padStart(2, '0'),
      ).join('');
    const anchor = selected?.position ?? nodes[nodes.length - 1]?.position ?? { x: 0, y: 0 };
    const position = drop ?? { x: snap(anchor.x + cardSize.width + columnGap), y: snap(anchor.y) };
    // 当前节点右侧可能已经接过分支，新增卡片放到这一列的下一个空位。
    while (
      !drop &&
      nodes.some(
        (node) =>
          Math.abs(node.position.x - position.x) < cardSize.width + 8 &&
          Math.abs(node.position.y - position.y) < cardSize.height + 8,
      )
    ) {
      position.y += cardSize.height + 64;
    }
    const node: FlowNode = {
      id: nodeId,
      type: 'rule',
      data: { name: kinds[kind], config: newConfig(kind, nodeId) },
      position,
      selected: true,
    };
    setNodes((all) => [...all.map((n) => ({ ...n, selected: false })), node]);
    if (!drop) setEditing(nodeId);
    setTrace(undefined);
  }
  function connect(c: Connection) {
    if (!c.sourceHandle) return;
    const port = c.sourceHandle;
    setEdges((all) =>
      addEdge(graphEdge({ fromNodeId: c.source, fromPort: port, toNodeId: c.target }), all),
    );
    setTrace(undefined);
  }
  function remove() {
    if (selected && selected.deletable !== false) {
      setNodes((all) => all.filter((n) => n.id !== selected.id));
      setEdges((all) => all.filter((e) => e.source !== selected.id && e.target !== selected.id));
    } else if (edge) setEdges((all) => all.filter((e) => e.id !== edge.id));
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const saved = rule
        ? await ruleRequest<Rule>(
            projectId,
            'rules/' + encodeURIComponent(rule.ruleId) + '/draft',
            'PUT',
            { ...draft, expectedRevision: rule.draftRevision },
          )
        : await ruleRequest<Rule>(projectId, 'rules', 'POST', draft);
      clearDraft(registration);
      setRule(saved);
      setBaseline(JSON.stringify(draft));
      setTrace(undefined);
      toast.success('草稿已保存');
      if (!rule) void navigate(base + '/' + encodeURIComponent(saved.ruleId), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
            to={base}
          >
            <ArrowLeft size={14} />
            规则链列表
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="break-all text-base font-medium">{meta.name}</h2>
            <RuleStatus status={rule?.status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(dirty || rule) && (
            <span className="mr-1 text-xs text-muted-foreground" role="status">
              {dirty ? '有未保存修改' : '修订 ' + rule?.draftRevision}
            </span>
          )}
          <Button variant="outline" disabled={busy} onClick={() => setSettingsOpen(true)}>
            <Settings2 />
            规则设置
          </Button>
          <Button disabled={busy || (!dirty && !!rule)} onClick={() => void save()}>
            <Save />
            {busy ? '正在保存…' : '保存草稿'}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {capabilityError && (
        <p role="alert" className="text-sm text-destructive">
          读取当前项目的节点能力失败：{capabilityError.message}
        </p>
      )}
      <Collapsible
        defaultOpen={false}
        render={
          <section
            inert={busy}
            className="rule-surface min-w-0 overflow-hidden"
            aria-label="编排画布"
          />
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <CollapsibleTrigger render={<Button size="sm" variant="outline" className="group" />}>
              <PanelLeft />
              节点库
              <ChevronDown className="transition-transform group-aria-expanded:rotate-180" />
            </CollapsibleTrigger>
            <h3 className="text-sm font-medium">编排画布</h3>
            <span className="ml-1 text-xs tabular-nums text-muted-foreground">
              {nodes.length} 节点 · {edges.length} 连线
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="节点工具">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="编辑节点"
              title="编辑节点"
              disabled={!selected}
              onClick={() => setEditing(selected?.id)}
            >
              <Pencil />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="移除所选"
              title="移除所选"
              disabled={(!selected || selected.deletable === false) && !edge}
              onClick={remove}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row">
          <CollapsibleContent className="shrink-0 sm:w-40">
            <aside
              aria-label="节点库"
              className="flex flex-wrap items-start gap-2 border-b bg-muted/20 p-3 sm:flex-col sm:items-stretch sm:border-r sm:border-b-0"
            >
              <p className="w-full text-xs leading-5 text-muted-foreground">
                拖到画布或点击添加。拖动端口连线，单击节点配置。
              </p>
              {(['CONDITION', 'TRANSFORM', 'ACTION'] as const).map((kind) => {
                const Icon = toolIcons[kind];
                return (
                  <Button
                    key={kind}
                    className="rule-tool justify-start cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('application/x-rule-node', kind);
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                    data-kind={kind}
                    size="sm"
                    variant="outline"
                    aria-label={'添加' + kinds[kind]}
                    onClick={() => append(kind)}
                  >
                    <Icon className="text-(--node-ink)" />
                    {kinds[kind]}
                  </Button>
                );
              })}
            </aside>
          </CollapsibleContent>
          <div className="min-w-0 flex-1">
            <FlowCanvas
              onDropNode={append}
              nodes={nodes}
              edges={edges}
              capabilities={capabilities}
              trace={!dirty ? trace : undefined}
              onConnect={connect}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onEdit={setEditing}
              onArrange={() => setNodes(arrangeNodes(nodes, edges))}
            />
          </div>
        </div>
      </Collapsible>
      {current && (
        <NodeDialog
          key={current.id}
          node={current}
          onClose={() => setEditing(undefined)}
          onSave={(name, config) => {
            const outputs = ports(config, capabilities);
            if (edges.some((e) => e.source === current.id && !outputs.includes(e.sourceHandle!))) {
              throw new Error('新条件使用不同的出口。请先移除旧出口的连线，再应用配置。');
            }
            setNodes((all) =>
              all.map((n) => (n.id === current.id ? { ...n, data: { name, config } } : n)),
            );
            setEditing(undefined);
            setTrace(undefined);
          }}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          draft={draft}
          onClose={() => setSettingsOpen(false)}
          onSave={(name, description, settings) => {
            setMeta({ name, description, settings });
            setSettingsOpen(false);
          }}
        />
      )}
      {rule && (
        <RunPanel
          key={rule.ruleId + '-' + rule.draftRevision}
          projectId={projectId}
          rule={rule}
          dirty={dirty}
          onTrace={setTrace}
          onActivation={(generation, version, enabled) =>
            setRule({
              ...rule,
              generation,
              activeVersionId: version,
              status: enabled ? 'ENABLED' : 'DISABLED',
            })
          }
        />
      )}
    </div>
  );
}
