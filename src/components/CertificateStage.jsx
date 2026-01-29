import React, { useEffect } from "react";
import { Stage, Layer, Image as KImage, Text as KText, Transformer } from "react-konva";
import { coverRect } from "../lib/templates";

export default function CertificateStage({
  cw,
  ch,
  bg,
  fields,
  selectedId,
  setSelectedId,
  updateField,
  stageRef,
  transformerRef,
  stageContainerRef,
  openEditorFor,
}) {
  // Attach transformer to selected node
  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;

    if (!selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stage.findOne(`#${selectedId}`);
    if (!node) return;

    tr.nodes([node]);
    tr.getLayer()?.batchDraw();
  }, [selectedId, fields, stageRef, transformerRef]);

  return (
    <div style={styles.canvasStageOuter} ref={stageContainerRef}>
      <Stage
        width={cw}
        height={ch}
        ref={stageRef}
        style={styles.stage}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) setSelectedId("");
        }}
      >
        <Layer>
          {/* background */}
          {bg ? (
            (() => {
              const r = coverRect(bg.width, bg.height, cw, ch);
              return <KImage image={bg} x={r.x} y={r.y} width={r.w} height={r.h} listening={false} />;
            })()
          ) : (
            <KText text="Loading template…" x={20} y={20} fontFamily="Inter" fontSize={16} fill="#6b7280" />
          )}

          {/* text fields */}
          {fields.map((f) => (
            <KText
              key={f.id}
              id={f.id}
              text={f.text || ""}
              x={f.x - (f.align === "center" ? f.width / 2 : f.align === "right" ? f.width : 0)}
              y={f.y}
              width={f.width}
              fontFamily={f.fontFamily}
              fontSize={f.fontSize}
              fontStyle={f.fontStyle}
              fill={f.fill}
              align={f.align}
              draggable
              onClick={() => setSelectedId(f.id)}
              onTap={() => setSelectedId(f.id)}
              onDblClick={() => openEditorFor(f.id)}
              onDblTap={() => openEditorFor(f.id)}
              onDragEnd={(e) => {
                const node = e.target;
                const newX =
                  f.align === "center" ? node.x() + f.width / 2 : f.align === "right" ? node.x() + f.width : node.x();
                updateField(f.id, { x: newX, y: node.y() });
              }}
              onTransformEnd={(e) => {
                const node = e.target;
                const tr = transformerRef.current;
                const scaleX = node.scaleX();
                const scaleY = node.scaleY();

                const nextWidth = Math.max(120, f.width * scaleX);
                const nextFontSize = Math.max(10, Math.min(120, f.fontSize * scaleY));

                node.scaleX(1);
                node.scaleY(1);

                const nx =
                  f.align === "center" ? node.x() + nextWidth / 2 : f.align === "right" ? node.x() + nextWidth : node.x();

                updateField(f.id, { x: nx, y: node.y(), width: nextWidth, fontSize: nextFontSize });
                tr?.getLayer()?.batchDraw();
              }}
            />
          ))}

          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            enabledAnchors={["middle-left", "middle-right", "top-left", "top-right", "bottom-left", "bottom-right"]}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 120) return oldBox;
              if (newBox.height < 20) return oldBox;
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
}

const styles = {
  canvasStageOuter: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    position: "relative",
  },
  stage: {
    borderRadius: 14,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 25px 60px rgba(0,0,0,0.40)",
    width: "100%",
    maxWidth: 1100,
    height: "auto",
  },
};
