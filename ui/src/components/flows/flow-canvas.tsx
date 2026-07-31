"use client";
"use no memo";

// Canvas @xyflow. Vive dentro de un wrapper .zoom-neutral (el zoom CSS global
// rompería la matemática de punteros). Excluido del React Compiler.

import { useCallback } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FlowNodeComponent } from "./flow-node";

const nodeTypes = { flowNode: FlowNodeComponent };

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onSelectNode: (nodeId: string | null) => void;
  onDropNode: (nodeType: string, position: { x: number; y: number }) => void;
  readOnly?: boolean;
}

function CanvasInner(props: FlowCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData("application/x-flow-node");
      if (!nodeType) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      props.onDropNode(nodeType, position);
    },
    [props, screenToFlowPosition],
  );

  return (
    <ReactFlow
      nodes={props.nodes}
      edges={props.edges}
      nodeTypes={nodeTypes}
      onNodesChange={props.onNodesChange}
      onEdgesChange={props.onEdgesChange}
      onConnect={props.onConnect}
      onSelectionChange={({ nodes }) => props.onSelectNode(nodes[0]?.id ?? null)}
      onDrop={handleDrop}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      fitView
      snapToGrid
      snapGrid={[16, 16]}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={!props.readOnly}
      nodesDraggable={!props.readOnly}
      elementsSelectable
      deleteKeyCode={props.readOnly ? null : ["Backspace", "Delete"]}
      defaultEdgeOptions={{ type: "smoothstep" }}
      className="bg-muted/30"
    >
      <Background gap={16} size={1} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable className="!bg-background" />
    </ReactFlow>
  );
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
