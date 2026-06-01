'use client';

import type { DamagePlotBar } from '../lib/damage-plot-types';

type DamagePlotBarsProps = {
  bars: DamagePlotBar[];
};

export function DamagePlotBars({ bars }: DamagePlotBarsProps) {
  return (
    <group>
      {bars.map((bar) => (
        <mesh
          key={`${bar.eventId}:${bar.channelKey}`}
          position={bar.position}
          scale={bar.scale}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={bar.color} roughness={0.55} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
}
