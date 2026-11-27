import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import {
  Background,
  ConnectionLineType,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react';
import type {
  ReactFlowInstance,
  Connection,
  NodeProps,
  OnEdgesChange,
  OnNodesChange,
} from '@xyflow/react';
import { GitBranch, Play, SlidersHorizontal, WandSparkles, Zap } from 'lucide-react';
import { SmartEdgeProvider, SmartSmoothStepEdge } from '@tisoap/react-flow-smart-edge';
import { Button } from '@/components/ui/button';
import type { Capabilities, Decision, Kind } from '@/api/rule-engine/client';
import { kinds, portLabels, ports, type FlowEdge, type FlowNode } from './graph';
import { cardSize, gridSize } from './layout';
import '@xyflow/react/dist/style.css';
import './workspace.css';

const Catalog = createContext<Capabilities | undefined>(undefined);
const icons = { TRIGGER: Play, CONDITION: GitBranch, TRANSFORM: SlidersHorizontal, ACTION: Zap };

function RuleCard({ id, data }: NodeProps<FlowNode>) {
  const catalog = useContext(Catalog);
  const outputs = ports(data.config, catalog);
  const signature = outputs.join(',');
  const updateHandles = useUpdateNodeInternals();
  useEffect(() => {
    updateHandles(id);
  }, [id, signature, updateHandles]);
  const Icon = icons[data.config.kind];
  return (
    <div className="rule-node" data-kind={data.config.kind} style={cardSize}>
      {data.config.kind !== 'TRIGGER' && (
        <Handle type="target" position={Position.Left} aria-label="输入" />
      )}
      <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-(--node-ink)">
        <span className="rule-node-icon">
          <Icon size={14} strokeWidth={1.8} />
        </span>
        {kinds[data.config.kind]}
      </div>
      <strong className="mt-1 block truncate text-sm font-medium" title={data.name}>
        {data.name}
      </strong>
      <span className="block truncate font-mono text-xs text-muted-foreground" title={id}>
        {id}
      </span>
      {outputs.map((port, index) => {
        const top = outputs.length === 1 ? '50%' : index === 0 ? '25%' : '75%';
        return (
          <div key={port} className="rule-outlet" data-port={port} style={{ top }}>
            {outputs.length > 1 && (
              <span className="rule-port-label text-xs font-medium">{portLabels[port]}</span>
            )}
            <Handle
              type="source"
              position={Position.Right}
              id={port}
              aria-label={portLabels[port]}
            />
          </div>
        );
      })}
    </div>
  );
}

const nodeTypes = { rule: RuleCard };
const fitOptions = { padding: 0.15, maxZoom: 1 };
const edgeTypes = { routed: SmartSmoothStepEdge };
const edgeOptions = { type: 'routed', interactionWidth: 20 };
const routingOptions = {
  routeOnlyWhenBlocked: false,
  routeWhileDragging: true,
  gridRatio: gridSize,
  nodePadding: 12,
};
const labels = {
  'controls.ariaLabel': '画布视图',
  'controls.zoomIn.ariaLabel': '放大',
  'controls.zoomOut.ariaLabel': '缩小',
  'controls.fitView.ariaLabel': '显示全图',
  'minimap.ariaLabel': '流程缩略图',
};

function ArrangeButton({ onArrange, disabled }: { onArrange: () => void; disabled: boolean }) {
  const { fitView } = useReactFlow();
  return (
    <Panel position="top-right">
      <Button
        size="sm"
        variant="outline"
        className="shadow-sm"
        disabled={disabled}
        onClick={() => {
          onArrange();
          requestAnimationFrame(() => void fitView(fitOptions));
        }}
      >
        <WandSparkles /> 自动排列
      </Button>
    </Panel>
  );
}

interface Props {
  nodes: FlowNode[];
  edges: FlowEdge[];
  capabilities?: Capabilities;
  trace?: Decision;
  onNodesChange: OnNodesChange<FlowNode>;
  onEdgesChange: OnEdgesChange<FlowEdge>;
  onConnect: (connection: Connection) => void;
  onEdit: (id: string) => void;
  onArrange: () => void;
  onDropNode: (kind: Exclude<Kind, 'TRIGGER'>, point: { x: number; y: number }) => void;
}

export function FlowCanvas({
  nodes,
  edges,
  capabilities,
  trace,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onEdit,
  onArrange,
  onDropNode,
}: Props) {
  const flow = useRef<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);
  const entry = nodes.find((node) => node.data.config.kind === 'TRIGGER');
  // 手机上先让用户看清入口。缩放工具中的“显示全图”仍按整张图计算。
  const initialFit =
    entry && window.matchMedia('(max-width: 639px)').matches
      ? { ...fitOptions, nodes: [{ id: entry.id }] }
      : fitOptions;
  const visibleNodes = useMemo(() => {
    const visited = new Set(trace?.path.map((step) => step.nodeId));
    return nodes.map((node) =>
      visited.has(node.id) ? { ...node, className: 'rule-visited' } : node,
    );
  }, [nodes, trace]);
  const visibleEdges = useMemo(() => {
    const used = new Set(
      trace?.path
        .slice(0, -1)
        .map((step, i) => JSON.stringify([step.nodeId, step.port, trace.path[i + 1].nodeId])),
    );
    return edges.map((edge) => {
      const visited = used.has(JSON.stringify([edge.source, edge.sourceHandle, edge.target]));
      const color = visited
        ? 'var(--rule-trace)'
        : edge.selected
          ? 'var(--rule-accent)'
          : 'var(--rule-wire)';
      return {
        ...edge,
        animated: visited,
        style: { stroke: color, strokeWidth: visited || edge.selected ? 2.6 : 1.7 },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
      };
    });
  }, [edges, trace]);
  return (
    <div className="rule-canvas">
      <Catalog.Provider value={capabilities}>
        <SmartEdgeProvider nodes={nodes} options={routingOptions}>
          <ReactFlow<FlowNode, FlowEdge>
            onInit={(instance) => {
              flow.current = instance;
            }}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes('application/x-rule-node')) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
              }
            }}
            onDrop={(event) => {
              const kind = event.dataTransfer.getData('application/x-rule-node');
              if (
                !flow.current ||
                (kind !== 'CONDITION' && kind !== 'TRANSFORM' && kind !== 'ACTION')
              )
                return;
              event.preventDefault();
              onDropNode(
                kind,
                flow.current.screenToFlowPosition(
                  { x: event.clientX, y: event.clientY },
                  { snapToGrid: true },
                ),
              );
            }}
            nodes={visibleNodes}
            edges={visibleEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={edgeOptions}
            connectionLineType={ConnectionLineType.SmoothStep}
            snapToGrid
            snapGrid={[gridSize, gridSize]}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeDragThreshold={4}
            nodeClickDistance={3}
            onNodeClick={(event, node) => {
              if (event.target instanceof Element && !event.target.closest('.react-flow__handle'))
                onEdit(node.id);
            }}
            isValidConnection={(c) =>
              !!c.sourceHandle &&
              c.source !== c.target &&
              !edges.some((e) => e.source === c.source && e.sourceHandle === c.sourceHandle)
            }
            fitView
            fitViewOptions={initialFit}
            minZoom={0.15}
            maxZoom={2}
            ariaLabelConfig={labels}
            deleteKeyCode={['Delete', 'Backspace']}
          >
            <Background gap={gridSize * 2} size={1} />
            <ArrangeButton onArrange={onArrange} disabled={nodes.length < 2} />
            <Controls
              orientation="horizontal"
              fitViewOptions={fitOptions}
              showInteractive={false}
            />
            <MiniMap
              className="rule-minimap"
              pannable
              zoomable
              nodeBorderRadius={3}
              nodeColor={(node) =>
                'var(--rule-' + (node as FlowNode).data.config.kind.toLowerCase() + ')'
              }
            />
          </ReactFlow>
        </SmartEdgeProvider>
      </Catalog.Provider>
    </div>
  );
}
