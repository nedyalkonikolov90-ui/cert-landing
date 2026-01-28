import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Text, Image, Transformer } from "react-konva";
import useImage from "use-image";

const WIDTH = 842;
const HEIGHT = 595;

export default function App() {
  const stageRef = useRef(null);
  const transformerRef = useRef(null);

  const [selectedId, setSelectedId] = useState(null);

  const [fields, setFields] = useState([
    {
      id: "certTitle",
      text: "Certificate of Achievement",
      x: WIDTH / 2,
      y: 120,
      fontSize: 40,
      fontStyle: "bold",
      fill: "#1e2233",
      align: "center"
    },
    {
      id: "name",
      text: "John Doe",
      x: WIDTH / 2,
      y: 300,
      fontSize: 34,
      fontStyle: "bold",
      fill: "#111"
    }
  ]);

  const templateUrl =
    "https://cdn.budgetwonders.eu/templates/professional.png";

  const [bgImage] = useImage(templateUrl);

  useEffect(() => {
    if (selectedId && transformerRef.current) {
      const node = stageRef.current.findOne(`#${selectedId}`);
      transformerRef.current.nodes([node]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [selectedId]);

  function updateField(id, newAttrs) {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...newAttrs } : f))
    );
  }

  function handleExport() {
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    downloadImage(uri);
  }

  function downloadImage(uri) {
    const link = document.createElement("a");
    link.download = "certificate.png";
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Certifyly Editor</h1>

      <button onClick={handleExport}>Export PNG</button>

      <div style={{ marginTop: 20 }}>
        <Stage
          width={WIDTH}
          height={HEIGHT}
          ref={stageRef}
          style={{
            border: "1px solid #ddd",
            boxShadow: "0 20px 40px rgba(0,0,0,0.1)"
          }}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) {
              setSelectedId(null);
            }
          }}
        >
          <Layer>
            {bgImage && (
              <Image image={bgImage} width={WIDTH} height={HEIGHT} />
            )}

            {fields.map((field) => (
              <Text
                key={field.id}
                id={field.id}
                {...field}
                draggable
                onClick={() => setSelectedId(field.id)}
                onTap={() => setSelectedId(field.id)}
                onDragEnd={(e) =>
                  updateField(field.id, {
                    x: e.target.x(),
                    y: e.target.y()
                  })
                }
                onTransformEnd={(e) => {
                  const node = e.target;
                  const scaleX = node.scaleX();
                  updateField(field.id, {
                    x: node.x(),
                    y: node.y(),
                    fontSize: Math.max(12, field.fontSize * scaleX)
                  });
                  node.scaleX(1);
                  node.scaleY(1);
                }}
              />
            ))}

            <Transformer
              ref={transformerRef}
              enabledAnchors={["middle-left", "middle-right"]}
              rotateEnabled={false}
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

