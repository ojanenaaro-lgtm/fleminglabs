export function SerendipityGraph() {
  // Node positions for a small-world network layout
  const nodes = [
    { x: 120, y: 80, highlight: false },
    { x: 260, y: 50, highlight: true },
    { x: 380, y: 100, highlight: false },
    { x: 80, y: 200, highlight: false },
    { x: 220, y: 180, highlight: true },
    { x: 350, y: 220, highlight: false },
    { x: 160, y: 300, highlight: false },
    { x: 300, y: 310, highlight: false },
  ];

  // Edges: pairs of node indices
  const edges = [
    [0, 1], [0, 3], [0, 4],
    [1, 2], [1, 4],
    [2, 5],
    [3, 4], [3, 6],
    [4, 5], [4, 6], [4, 7],
    [5, 7],
  ];

  return (
    <svg
      viewBox="0 0 460 380"
      className="w-full max-w-md h-auto"
      aria-hidden="true"
    >
      {/* Edges */}
      {edges.map(([a, b], i) => (
        <line
          key={`edge-${i}`}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="var(--sage-light)"
          strokeWidth="1.5"
          opacity="0.5"
        />
      ))}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <g key={`node-${i}`}>
          {node.highlight && (
            <circle
              cx={node.x}
              cy={node.y}
              r="16"
              fill="var(--primary)"
              opacity="0.15"
              className="animate-[waveform-breathe_3s_ease-in-out_infinite]"
            />
          )}
          <circle
            cx={node.x}
            cy={node.y}
            r={node.highlight ? 8 : 6}
            fill={node.highlight ? "var(--primary)" : "var(--sage)"}
          />
        </g>
      ))}
    </svg>
  );
}
