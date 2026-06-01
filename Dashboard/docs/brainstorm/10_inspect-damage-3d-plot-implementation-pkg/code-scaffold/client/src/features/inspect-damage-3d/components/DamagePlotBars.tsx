'use client';

import type { DamagePlotBar } from '../lib/damage-plot-types';

type DamagePlotBarsProps = {
  bars: DamagePlotBar[];
};

export function DamagePlotBars({ bars }: DamagePlotBarsProps) {
  // MVP implementation uses regular meshes for readability.
  // If bars.length grows beyond roughly 300, replace internals with InstancedMesh
  // while keeping this component API unchanged.
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
