import { Circle, Group, Label, Path, Rect, Tag, Text } from 'react-konva';
import type Konva from 'konva';
import type { Scene, SceneItem, SceneMarker, ScenePath } from '@maxsen/domain';

const FONT = "'Instrument Sans Variable', 'Instrument Sans', system-ui, sans-serif";
const INK = '#1F1D1A';

interface SceneLayerProps {
  scene: Scene;
  draggable: boolean;
  onPick: (elementId: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onMarkerDragEnd: (elementId: string, dx: number, dy: number) => void;
}

function MarkerNode({
  m,
  draggable,
  onPick,
  onMarkerDragEnd,
}: { m: SceneMarker } & Omit<SceneLayerProps, 'scene'>) {
  const filled = m.badgeStyle === 'filled';
  const badgeW = m.size * 1.4;
  return (
    <>
      <Group
        x={m.x}
        y={m.y}
        rotation={m.rotation}
        name={`element-${m.elementId}`}
        draggable={draggable}
        onMouseDown={(e) => onPick(m.elementId, e)}
        onTouchStart={(e) => onPick(m.elementId, e)}
        onDragEnd={(e) => {
          const dx = e.target.x() - m.x;
          const dy = e.target.y() - m.y;
          e.target.position({ x: m.x, y: m.y });
          onMarkerDragEnd(m.elementId, dx, dy);
        }}
      >
        <Path
          data={m.pathD}
          scaleX={m.size}
          scaleY={m.size}
          fill={filled ? m.color : '#FFFFFF'}
          fillRule="evenodd"
          stroke={m.color}
          strokeWidth={filled ? 0 : 0.08}
          hitStrokeWidth={0}
        />
        {m.badge.text && (
          <Text
            text={m.badge.text}
            x={m.badge.dx - badgeW / 2}
            y={m.badge.dy - m.badge.fontSize * 0.55}
            width={badgeW}
            align="center"
            fontSize={m.badge.fontSize}
            fontFamily={FONT}
            fontStyle="600"
            fill={m.badge.color}
            listening={false}
          />
        )}
      </Group>
      {m.label && (
        <Text
          text={m.label.text}
          x={m.label.x - 200}
          y={m.label.y - m.label.fontSize * 0.2}
          width={400}
          align="center"
          fontSize={m.label.fontSize}
          fontFamily={FONT}
          fill={INK}
          listening={false}
        />
      )}
    </>
  );
}

function PathNode({ p, onPick }: { p: ScenePath; onPick: SceneLayerProps['onPick'] }) {
  const magnetic = p.shape === 'magnetic';
  return (
    <Group
      name={`element-${p.elementId}`}
      onMouseDown={(e) => onPick(p.elementId, e)}
      onTouchStart={(e) => onPick(p.elementId, e)}
    >
      <Path
        data={p.d}
        stroke={p.color}
        strokeWidth={p.strokeWidth}
        lineCap={p.kind === 'track' && !magnetic ? 'square' : 'round'}
        lineJoin="round"
        hitStrokeWidth={Math.max(p.strokeWidth * 3, 12)}
        opacity={p.kind === 'led-strip' ? 0.9 : 1}
      />
      {p.heads.map((h, i) =>
        magnetic ? (
          <Circle
            key={i}
            x={h.x}
            y={h.y}
            radius={h.size / 2}
            fill={p.color}
            stroke="#FFFFFF"
            strokeWidth={h.size * 0.12}
          />
        ) : (
          <Rect
            key={i}
            x={h.x}
            y={h.y}
            width={h.size}
            height={h.size}
            offsetX={h.size / 2}
            offsetY={h.size / 2}
            rotation={h.angle}
            fill={p.color}
            stroke="#FFFFFF"
            strokeWidth={h.size * 0.12}
          />
        ),
      )}
      {p.label && (
        <Label
          x={p.label.x}
          y={p.label.y}
          offsetX={p.label.text.length * p.label.fontSize * 0.27}
          offsetY={p.label.fontSize * 0.75}
          listening={false}
        >
          <Tag
            fill="#FFFFFF"
            opacity={0.88}
            pointerDirection="none"
            cornerRadius={p.label.fontSize * 0.2}
          />
          <Text
            text={p.label.text}
            fontSize={p.label.fontSize}
            fontFamily={FONT}
            fill={INK}
            padding={p.label.fontSize * 0.25}
            offsetX={0}
          />
        </Label>
      )}
    </Group>
  );
}

function ItemNode({ item, ...rest }: { item: SceneItem } & Omit<SceneLayerProps, 'scene'>) {
  if (item.type === 'marker') return <MarkerNode m={item} {...rest} />;
  if (item.type === 'path') return <PathNode p={item} onPick={rest.onPick} />;
  return (
    <Label
      x={item.x}
      y={item.y}
      name={`element-${item.elementId}`}
      onMouseDown={(e) => rest.onPick(item.elementId, e)}
      onTouchStart={(e) => rest.onPick(item.elementId, e)}
    >
      <Tag fill={item.highlight ?? 'transparent'} cornerRadius={item.fontSize * 0.15} />
      <Text
        text={item.text}
        fontSize={item.fontSize}
        fontFamily={FONT}
        fontStyle={item.bold ? '600' : 'normal'}
        fill={item.color}
        padding={item.highlight ? item.fontSize * 0.3 : 0}
      />
    </Label>
  );
}

export function SceneLayer({ scene, ...rest }: SceneLayerProps) {
  return (
    <>
      {scene.items.map((item) => (
        <ItemNode key={item.elementId} item={item} {...rest} />
      ))}
    </>
  );
}
