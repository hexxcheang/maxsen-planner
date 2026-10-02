import { Circle, Group, Label, Path, Rect, Tag, Text } from 'react-konva';
import type Konva from 'konva';
import type { Scene, SceneItem, SceneMarker, ScenePath } from '@maxsen/domain';

const FONT = "'Instrument Sans Variable', 'Instrument Sans', system-ui, sans-serif";
const INK = '#1F1D1A';

type PickEvent = Konva.KonvaEventObject<MouseEvent | TouchEvent>;

interface SceneLayerProps {
  scene: Scene;
  draggable: boolean;
  onPick: (elementId: string, e: PickEvent) => void;
  onDragEnd: (elementId: string, dx: number, dy: number) => void;
}

type NodeProps = Omit<SceneLayerProps, 'scene'>;

/** Drag handlers for a node whose resting position is (x, y): report the delta, then snap back. */
function dragProps(id: string, x: number, y: number, { draggable, onPick, onDragEnd }: NodeProps) {
  return {
    draggable,
    onMouseDown: (e: PickEvent) => onPick(id, e),
    onTouchStart: (e: PickEvent) => onPick(id, e),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      const dx = e.target.x() - x;
      const dy = e.target.y() - y;
      e.target.position({ x, y });
      if (dx !== 0 || dy !== 0) onDragEnd(id, dx, dy);
    },
  };
}

function MarkerNode({ m, ...rest }: { m: SceneMarker } & NodeProps) {
  const filled = m.badgeStyle === 'filled';
  const badgeW = m.size * 1.4;
  return (
    <>
      <Group
        x={m.x}
        y={m.y}
        rotation={m.rotation}
        name={`element-${m.elementId}`}
        {...dragProps(m.elementId, m.x, m.y, rest)}
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

function PathNode({ p, ...rest }: { p: ScenePath } & NodeProps) {
  const magnetic = p.shape === 'magnetic';
  return (
    <Group name={`element-${p.elementId}`} {...dragProps(p.elementId, 0, 0, rest)}>
      <Path
        data={p.d}
        stroke={p.color}
        strokeWidth={p.strokeWidth}
        lineCap={p.kind === 'track' && !magnetic ? 'square' : 'round'}
        lineJoin="round"
        hitStrokeWidth={Math.max(p.strokeWidth * 3, 12)}
        opacity={p.kind === 'led-strip' ? 0.9 : 1}
        {...(p.dash ? { dash: p.dash } : {})}
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
            fill={p.kind === 'curtain' ? p.color : INK}
            fontStyle={p.kind === 'curtain' ? 'bold' : 'normal'}
            padding={p.label.fontSize * 0.25}
          />
        </Label>
      )}
    </Group>
  );
}

function ItemNode({ item, ...rest }: { item: SceneItem } & NodeProps) {
  if (item.type === 'marker') return <MarkerNode m={item} {...rest} />;
  if (item.type === 'path') return <PathNode p={item} {...rest} />;
  return (
    <Label
      x={item.x}
      y={item.y}
      name={`element-${item.elementId}`}
      {...dragProps(item.elementId, item.x, item.y, rest)}
    >
      <Tag fill={item.highlight ?? 'rgba(255,255,255,0.01)'} cornerRadius={item.fontSize * 0.15} />
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
