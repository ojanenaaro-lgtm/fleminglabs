"use client";

import {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import * as d3 from "d3";
import { ENTRY_TYPE_LABELS } from "@/lib/types";
import type {
  Entry,
  EntryType,
  ConnectionType,
  ConnectionWithEntries,
} from "@/lib/types";

/* ── colour maps ─────────────────────────────────────────────────────── */

const NODE_COLORS: Record<EntryType, string> = {
  voice_note: "#d97706",
  observation: "#2D5A3D",
  measurement: "#2563eb",
  protocol_step: "#7c3aed",
  annotation: "#6b7c6b",
  hypothesis: "#4f46e5",
  anomaly: "#dc2626",
  idea: "#0d9488",
};

const NODE_BG: Record<EntryType, string> = {
  voice_note: "#fef3c7",
  observation: "#e8f0eb",
  measurement: "#dbeafe",
  protocol_step: "#ede9fe",
  annotation: "#f3f4f6",
  hypothesis: "#eef2ff",
  anomaly: "#fef2f2",
  idea: "#f0fdfa",
};

const EDGE_COLORS: Record<ConnectionType, string> = {
  pattern: "#2D5A3D",
  contradiction: "#dc2626",
  supports: "#2563eb",
  reminds_of: "#9ca3af",
  same_phenomenon: "#d97706",
  literature_link: "#7c3aed",
};


/* ── graph data types ────────────────────────────────────────────────── */

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  entry: Entry;
  connectionCount: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  connection: ConnectionWithEntries;
}

/* ── props ────────────────────────────────────────────────────────────── */

interface ConnectionGraphProps {
  entries: Entry[];
  connections: ConnectionWithEntries[];
  activeTypes: ConnectionType[];
  minConfidence: number;
  onNodeClick: (entry: Entry) => void;
  onEdgeClick: (connection: ConnectionWithEntries) => void;
}

/* ── component ───────────────────────────────────────────────────────── */

export function ConnectionGraph({
  entries,
  connections,
  activeTypes,
  minConfidence,
  onNodeClick,
  onEdgeClick,
}: ConnectionGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [tooltip, setTooltip] = useState<{
    node: GraphNode;
    x: number;
    y: number;
  } | null>(null);

  /* filter connections ------------------------------------------------ */

  const filtered = useMemo(
    () =>
      connections.filter(
        (c) =>
          activeTypes.includes(c.connection_type) &&
          (c.confidence ?? 0) >= minConfidence
      ),
    [connections, activeTypes, minConfidence]
  );

  /* build node / link arrays ----------------------------------------- */

  const { nodes, links } = useMemo(() => {
    const entryIds = new Set<string>();
    const counts = new Map<string, number>();

    filtered.forEach((c) => {
      entryIds.add(c.source_entry_id);
      entryIds.add(c.target_entry_id);
      counts.set(c.source_entry_id, (counts.get(c.source_entry_id) || 0) + 1);
      counts.set(c.target_entry_id, (counts.get(c.target_entry_id) || 0) + 1);
    });

    const nodes: GraphNode[] = entries
      .filter((e) => entryIds.has(e.id))
      .map((e) => ({
        id: e.id,
        entry: e,
        connectionCount: counts.get(e.id) || 0,
      }));

    const nodeIdSet = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = filtered
      .filter(
        (c) => nodeIdSet.has(c.source_entry_id) && nodeIdSet.has(c.target_entry_id)
      )
      .map((c) => ({
        source: c.source_entry_id,
        target: c.target_entry_id,
        connection: c,
      }));

    return { nodes, links };
  }, [entries, filtered]);

  /* resize observer -------------------------------------------------- */

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  /* node radius helper ----------------------------------------------- */

  const radius = useCallback(
    (d: GraphNode) => 10 + Math.min(d.connectionCount, 6) * 4,
    []
  );

  /* D3 render -------------------------------------------------------- */

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (nodes.length === 0) {
      svg
        .append("text")
        .attr("x", dimensions.width / 2)
        .attr("y", dimensions.height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#6b7c6b")
        .attr("font-size", "14px")
        .attr("font-family", "var(--font-body)")
        .text("No connections match current filters");
      return;
    }

    const { width, height } = dimensions;

    /* ── defs: filters & gradients ──────────────────────────────────── */

    const defs = svg.append("defs");

    // soft glow
    const glow = defs.append("filter").attr("id", "node-glow");
    glow
      .append("feGaussianBlur")
      .attr("stdDeviation", 4)
      .attr("result", "blur");
    const merge = glow.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    // subtle bg gradient
    const bgGrad = defs
      .append("radialGradient")
      .attr("id", "bg-gradient")
      .attr("cx", "50%")
      .attr("cy", "50%")
      .attr("r", "60%");
    bgGrad.append("stop").attr("offset", "0%").attr("stop-color", "#f0f2ee");
    bgGrad.append("stop").attr("offset", "100%").attr("stop-color", "#FAFAF7");

    // background rect
    svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "url(#bg-gradient)")
      .attr("rx", 12);

    /* ── zoom ──────────────────────────────────────────────────────── */

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 5])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoomBehavior);

    // double-click to reset
    svg.on("dblclick.zoom", () => {
      svg
        .transition()
        .duration(500)
        .call(zoomBehavior.transform, d3.zoomIdentity);
    });

    const container = svg.append("g");

    /* ── links (curved paths) ──────────────────────────────────────── */

    const linkGroup = container.append("g").attr("class", "links");

    const link = linkGroup
      .selectAll<SVGPathElement, GraphLink>("path")
      .data(links)
      .enter()
      .append("path")
      .attr("fill", "none")
      .attr(
        "stroke",
        (d) => EDGE_COLORS[d.connection.connection_type] || "#9ca3af"
      )
      .attr("stroke-width", (d) =>
        Math.max(1.5, (d.connection.confidence ?? 0.5) * 5)
      )
      .attr("stroke-opacity", 0.35)
      .attr("stroke-linecap", "round")
      .attr("cursor", "pointer")
      .on("mouseenter", function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("stroke-opacity", 0.75)
          .attr("stroke-width", (d) =>
            Math.max(3, ((d as GraphLink).connection.confidence ?? 0.5) * 7)
          );
      })
      .on("mouseleave", function () {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("stroke-opacity", 0.35)
          .attr("stroke-width", (d) =>
            Math.max(1.5, ((d as GraphLink).connection.confidence ?? 0.5) * 5)
          );
      })
      .on("click", function (event, d) {
        event.stopPropagation();
        onEdgeClick(d.connection);
      });

    /* ── nodes ────────────────────────────────────────────────────── */

    const nodeGroup = container.append("g").attr("class", "nodes");

    const node = nodeGroup
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("cursor", "grab")
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
      );

    // outer glow ring
    node
      .append("circle")
      .attr("r", (d) => radius(d) + 6)
      .attr("fill", (d) => NODE_BG[d.entry.entry_type] || "#f3f4f6")
      .attr("opacity", 0.5);

    // main circle
    node
      .append("circle")
      .attr("r", radius)
      .attr("fill", (d) => NODE_COLORS[d.entry.entry_type] || "#6b7c6b")
      .attr("fill-opacity", 0.85)
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .attr("filter", "url(#node-glow)");

    // inner dot (gives a neural-network feel)
    node
      .append("circle")
      .attr("r", 3)
      .attr("fill", "white")
      .attr("fill-opacity", 0.6);

    // labels
    node
      .append("text")
      .text((d) => {
        const text = d.entry.content || "Untitled";
        return text.length > 24 ? text.slice(0, 24) + "\u2026" : text;
      })
      .attr("dx", (d) => radius(d) + 8)
      .attr("dy", 4)
      .attr("font-size", "11px")
      .attr("fill", "#4a5e4a")
      .attr("font-family", "var(--font-body)")
      .attr("pointer-events", "none");

    // hover & click
    node
      .on("mouseenter", function (event, d) {
        const [x, y] = d3.pointer(event, svgRef.current);
        setTooltip({ node: d, x, y });
        d3.select(this)
          .select("circle:nth-child(2)")
          .transition()
          .duration(150)
          .attr("fill-opacity", 1)
          .attr("r", radius(d) + 2);
      })
      .on("mouseleave", function (_, d) {
        setTooltip(null);
        d3.select(this)
          .select("circle:nth-child(2)")
          .transition()
          .duration(200)
          .attr("fill-opacity", 0.85)
          .attr("r", radius(d));
      })
      .on("click", function (event, d) {
        event.stopPropagation();
        onNodeClick(d.entry);
      });

    /* ── simulation ──────────────────────────────────────────────── */

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(160)
          .strength(0.4)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide<GraphNode>().radius((d) => radius(d) + 12)
      )
      .force("x", d3.forceX(width / 2).strength(0.04))
      .force("y", d3.forceY(height / 2).strength(0.04))
      .alphaDecay(0.006) // slow decay → gentle floating
      .velocityDecay(0.3)
      .on("tick", ticked);

    simulationRef.current = simulation;

    // keep it alive with very gentle drift
    const driftInterval = setInterval(() => {
      if (simulation.alpha() < 0.01) {
        simulation.alpha(0.015).restart();
      }
    }, 4000);

    function ticked() {
      link.attr("d", (d) => {
        const s = d.source as GraphNode;
        const t = d.target as GraphNode;
        const dx = (t.x ?? 0) - (s.x ?? 0);
        const dy = (t.y ?? 0) - (s.y ?? 0);
        const dr = Math.sqrt(dx * dx + dy * dy) * 0.7;
        return `M${s.x},${s.y}A${dr},${dr} 0 0,1 ${t.x},${t.y}`;
      });

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    }

    /* ── drag ────────────────────────────────────────────────────── */

    function dragstarted(
      event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>
    ) {
      if (!event.active) simulation.alphaTarget(0.08).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
      d3.select(event.sourceEvent.target.closest("g")).attr(
        "cursor",
        "grabbing"
      );
    }

    function dragged(
      event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>
    ) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(
      event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>
    ) {
      if (!event.active) simulation.alphaTarget(0.003);
      event.subject.fx = null;
      event.subject.fy = null;
      d3.select(event.sourceEvent.target.closest("g")).attr("cursor", "grab");
    }

    /* ── cleanup ─────────────────────────────────────────────────── */

    return () => {
      clearInterval(driftInterval);
      simulation.stop();
    };
  }, [nodes, links, dimensions, onNodeClick, onEdgeClick, radius]);

  /* ── legend ────────────────────────────────────────────────────────── */

  const legendItems = useMemo(
    () =>
      (["pattern", "supports", "contradiction", "reminds_of"] as const).map(
        (t) => ({
          type: t,
          color: EDGE_COLORS[t],
          label: t === "reminds_of" ? "Reminds of" : t.charAt(0).toUpperCase() + t.slice(1),
        })
      ),
    []
  );

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[500px]">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="rounded-xl"
      />

      {/* legend */}
      <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-sm rounded-lg border border-border/40 px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
        {legendItems.map((item) => (
          <div key={item.type} className="flex items-center gap-1.5">
            <div
              className="w-3 h-0.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[10px] text-muted">{item.label}</span>
          </div>
        ))}
        <div className="w-px h-3 bg-border/40 self-center" />
        {(
          [
            "observation",
            "measurement",
            "voice_note",
            "protocol_step",
          ] as EntryType[]
        ).map((t) => (
          <div key={t} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: NODE_COLORS[t] }}
            />
            <span className="text-[10px] text-muted">
              {ENTRY_TYPE_LABELS[t]}
            </span>
          </div>
        ))}
      </div>

      {/* tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-white rounded-lg shadow-lg border border-border/50 p-3 max-w-[240px] z-20"
          style={{
            left: Math.min(tooltip.x + 16, dimensions.width - 260),
            top: Math.max(tooltip.y - 12, 8),
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor:
                  NODE_COLORS[tooltip.node.entry.entry_type] || "#6b7c6b",
              }}
            />
            <span className="text-[10px] font-medium text-muted uppercase tracking-wide">
              {ENTRY_TYPE_LABELS[tooltip.node.entry.entry_type] ||
                tooltip.node.entry.entry_type}
            </span>
          </div>
          <p className="text-xs font-medium text-foreground leading-snug line-clamp-3">
            {tooltip.node.entry.content || "Untitled entry"}
          </p>
          <p className="text-[10px] text-muted mt-1.5">
            {tooltip.node.connectionCount} connection
            {tooltip.node.connectionCount !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
