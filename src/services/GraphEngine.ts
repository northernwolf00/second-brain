import { getDb } from '../db/DatabaseService';
import { GraphNode, GraphEdge } from '../types';
import { Scalar } from '@op-engineering/op-sqlite';
import * as d3 from 'd3-force';

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const GraphEngine = {
  async buildGraph(): Promise<GraphData> {
    const db = getDb();

    const notesResult = db.executeSync(
      `SELECT n.id, n.title,
        (SELECT COUNT(*) FROM links WHERE source_id = n.id OR target_id = n.id) as linkCount
       FROM notes n
       WHERE n.is_deleted = 0`,
    );

    const linksResult = db.executeSync(
      `SELECT l.id, l.source_id, l.target_id
       FROM links l
       JOIN notes s ON s.id = l.source_id AND s.is_deleted = 0
       JOIN notes t ON t.id = l.target_id AND t.is_deleted = 0`,
    );

    const nodes: GraphNode[] = (notesResult.rows ?? []).map((row: Record<string, Scalar>) => ({
      id: row.id as string,
      title: row.title as string,
      linkCount: row.linkCount as number,
    }));

    const edges: GraphEdge[] = (linksResult.rows ?? []).map((row: Record<string, Scalar>) => ({
      id: row.id as string,
      source: row.source_id as string,
      target: row.target_id as string,
    }));

    return this.runLayout(nodes, edges);
  },

  runLayout(nodes: GraphNode[], edges: GraphEdge[]): GraphData {
    if (nodes.length === 0) return { nodes, edges };

    type SimNode = d3.SimulationNodeDatum & GraphNode;
    const simNodes: SimNode[] = nodes.map(n => ({ ...n, x: Math.random() * 400, y: Math.random() * 400 }));
    const nodeMap = new Map(simNodes.map(n => [n.id, n]));

    type SimLink = d3.SimulationLinkDatum<SimNode> & { id: string };
    const simLinks: SimLink[] = edges
      .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map(e => ({ source: nodeMap.get(e.source)!, target: nodeMap.get(e.target)!, id: e.id }));

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks).id(n => n.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(200, 200))
      .force('collision', d3.forceCollide(20));

    simulation.stop();
    for (let i = 0; i < 300; i++) simulation.tick();

    const layoutNodes: GraphNode[] = simNodes.map(n => ({
      id: n.id,
      title: n.title,
      linkCount: n.linkCount,
      x: n.x ?? 0,
      y: n.y ?? 0,
    }));

    return { nodes: layoutNodes, edges };
  },
};
