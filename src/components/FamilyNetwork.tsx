import { useEffect, useRef } from 'react';
import { PatentFamily, GraphNode } from '../data/types';

interface FamilyNetworkProps {
  family: PatentFamily;
  onNodeSelect: (node: GraphNode) => void;
}

export default function FamilyNetwork({ family, onNodeSelect }: FamilyNetworkProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const d3 = (window as any).d3;
    if (!d3 || !containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = ''; // Clear previous SVG

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 350;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g');

    // Define arrows for citations
    svg.append('defs').selectAll('marker')
      .data(['citation'])
      .enter().append('marker')
      .attr('id', (d: any) => d)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L10,0L0,4')
      .attr('fill', '#8b5cf6'); // Purple citation arrow

    const zoom = d3.zoom()
      .scaleExtent([0.3, 4])
      .on('zoom', (event: any) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Deep copy nodes and edges to avoid mutation of state by D3 force layout
    const nodes = (family.nodes || []).map(n => ({ ...n }));
    const edges = (family.edges || []).map(e => ({ ...e }));

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id((d: any) => d.id).distance((d: any) => d.type === 'equivalent' ? 70 : 130))
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(32));

    // Render edges (links)
    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .enter().append('line')
      .attr('stroke', (d: any) => d.type === 'citation' ? '#a855f7' : 'rgba(0, 210, 255, 0.6)')
      .attr('stroke-width', (d: any) => d.type === 'citation' ? 1.5 : 1.2) // Solid thin line for sibling, dash line for citation
      .attr('stroke-dasharray', (d: any) => d.type === 'citation' ? '5,4' : 'none')
      .attr('marker-end', (d: any) => d.type === 'citation' ? 'url(#citation)' : null);

    // Render node groups
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      );

    // Draw circles inside node groups
    node.append('circle')
      .attr('r', (d: any) => d.is_representative ? 12 : 8)
      .attr('fill', (d: any) => {
        if (d.type === 'core') return '#00d2ff'; // Cyan core
        if (d.type === 'citation') return '#a855f7'; // Purple citation
        if (d.type === 'equivalent_with_text') return '#ec4899'; // Pink
        return 'rgba(0, 210, 255, 0.4)'; // Sibling equivalent
      })
      .attr('stroke', (d: any) => d.is_representative ? '#ffffff' : '#07090e')
      .attr('stroke-width', (d: any) => d.is_representative ? 2.5 : 1.5)
      .on('click', (_event: any, d: any) => {
        onNodeSelect(d);
      });

    // Node text labels
    node.append('text')
      .attr('dx', (d: any) => d.is_representative ? 15 : 11)
      .attr('dy', '.35em')
      .attr('fill', '#f3f4f6')
      .style('font-size', '0.72rem')
      .style('font-family', 'Outfit, sans-serif')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 2px 4px rgba(0,0,0,0.8)')
      .text((d: any) => d.label);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`);
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Set zoom-fit/controls
    const zoomInBtn = document.getElementById('btn-zoom-in');
    const zoomOutBtn = document.getElementById('btn-zoom-out');
    const zoomFitBtn = document.getElementById('btn-zoom-fit');

    if (zoomInBtn) zoomInBtn.onclick = () => svg.transition().call(zoom.scaleBy, 1.3);
    if (zoomOutBtn) zoomOutBtn.onclick = () => svg.transition().call(zoom.scaleBy, 1 / 1.3);
    if (zoomFitBtn) zoomFitBtn.onclick = () => svg.transition().call(zoom.transform, d3.zoomIdentity);

    return () => {
      simulation.stop();
    };
  }, [family]);

  return (
    <div style={{ flex: '1', position: 'relative', width: '100%', height: '100%' }}>
      {/* Zoom controls */}
      <div 
        className="graph-controls" 
        id="graph-controls"
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          display: 'flex',
          gap: '6px',
          zIndex: 10
        }}
      >
        <button className="graph-ctrl-btn" id="btn-zoom-in" title="Zoom In"><i className="fa-solid fa-plus"></i></button>
        <button className="graph-ctrl-btn" id="btn-zoom-out" title="Zoom Out"><i className="fa-solid fa-minus"></i></button>
        <button className="graph-ctrl-btn" id="btn-zoom-fit" title="Fit to Screen"><i className="fa-solid fa-arrows-to-eye"></i></button>
      </div>

      {/* Relationship Legend overlay */}
      <div 
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          background: 'rgba(13, 17, 23, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--glass-border)',
          borderRadius: '6px',
          padding: '6px 12px',
          fontSize: '0.72rem',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          zIndex: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke="rgba(0, 210, 255, 0.8)" strokeWidth="1.2" /></svg>
          <span style={{ color: 'var(--text-bright)', fontWeight: 500 }}>Sibling</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="5,3" /></svg>
          <span style={{ color: 'var(--text-bright)', fontWeight: 500 }}>Citation</span>
        </div>
      </div>
      
      {/* Graph Area */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '380px' }}></div>
    </div>
  );
}
