'use client';

import { Text } from '@react-three/drei';
import type { DamagePlotLayout } from '../lib/damage-plot-types';

type DamagePlotAxesProps = {
  layout: DamagePlotLayout;
};

const AXIS_COLOR = '#111827';
const GRID_COLOR = '#d1d5db';

export function DamagePlotAxes({ layout }: DamagePlotAxesProps) {
  const { bounds, cellSpacing, channelLabels, eventLabels } = layout;
  const eventLabelStep = Math.max(1, Math.ceil(eventLabels.length / 12));

  return (
    <group>
      <gridHelper
        args={[
          Math.max(bounds.width, bounds.depth),
          Math.max(channelLabels.length, eventLabels.length),
          GRID_COLOR,
          GRID_COLOR,
        ]}
        position={[bounds.width / 2, 0, bounds.depth / 2]}
      />

      {channelLabels.map((label, index) => (
        <Text
          key={label}
          position={[index * cellSpacing, 0.05, -0.8]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.22}
          color={AXIS_COLOR}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      ))}

      {eventLabels.map((label, index) => {
        if (index % eventLabelStep !== 0) return null;
        return (
          <Text
            key={`${label}:${index}`}
            position={[-0.8, 0.05, index * cellSpacing]}
            rotation={[-Math.PI / 2, 0, Math.PI / 2]}
            fontSize={0.2}
            color={AXIS_COLOR}
            anchorX="center"
            anchorY="middle"
          >
            {label}
          </Text>
        );
      })}

      <Text position={[bounds.width / 2, 0.15, -1.7]} fontSize={0.3} color={AXIS_COLOR} anchorX="center">
        Channel
      </Text>
      <Text position={[-1.7, 0.15, bounds.depth / 2]} rotation={[0, Math.PI / 2, 0]} fontSize={0.3} color={AXIS_COLOR} anchorX="center">
        Event
      </Text>
      <Text position={[-1.2, bounds.height, -1.2]} fontSize={0.3} color={AXIS_COLOR} anchorX="center">
        Damage
      </Text>
    </group>
  );
}
