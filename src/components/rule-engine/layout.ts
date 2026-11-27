import { Graph, layout, type OrderConstraint } from '@dagrejs/dagre';
import { ports, type FlowEdge, type FlowNode } from './graph';

// 卡片、吸附网格和自动排列共用画布坐标，缩放只改变显示比例。
export const gridSize = 8;
export const cardSize = { width: 216, height: 96 };
export const columnGap = 88;
export const snap = (value: number) => Math.round(value / gridSize) * gridSize;

export function arrangeNodes(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const graph = new Graph({ multigraph: true })
    .setGraph({ rankdir: 'LR', ranksep: columnGap, nodesep: 64, marginx: 32, marginy: 32 })
    .setDefaultEdgeLabel(() => ({}));
  nodes.forEach((node) => graph.setNode(node.id, { ...cardSize }));
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target, {}, edge.sourceHandle!);
  }

  // 在从左往右的画布上，Dagre 的同层顺序对应从上到下的出口顺序。
  const constraints: OrderConstraint[] = [];
  for (const node of nodes) {
    const [upperPort, lowerPort] = ports(node.data.config);
    if (!lowerPort) continue;
    const outgoing = graph.outEdges(node.id) ?? [];
    const upper = outgoing.find((edge) => edge.name === upperPort)?.w;
    const lower = outgoing.find((edge) => edge.name === lowerPort)?.w;
    if (
      upper &&
      lower &&
      upper !== lower &&
      graph.predecessors(upper)?.length === 1 &&
      graph.predecessors(lower)?.length === 1
    ) {
      constraints.push({ left: upper, right: lower });
    }
  }
  layout(graph, { constraints });

  // Dagre 返回卡片中心，React Flow 保存左上角。
  return nodes.map((node) => {
    const center = graph.node(node.id);
    return {
      ...node,
      position: {
        x: snap(center.x - cardSize.width / 2),
        y: snap(center.y - cardSize.height / 2),
      },
    };
  });
}
