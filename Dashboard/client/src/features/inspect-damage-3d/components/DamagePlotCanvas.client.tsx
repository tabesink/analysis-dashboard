'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import type { DamagePlotLayout } from '../lib/damage-plot-types';
import { DamagePlotAxes } from './DamagePlotAxes';
import { DamagePlotBars } from './DamagePlotBars';

type DamagePlotCanvasProps = {
  layout: DamagePlotLayout;
};

export default function DamagePlotCanvas({ layout }: DamagePlotCanvasProps) {
  const cameraPosition = useMemo<[number, number, number]>(() => {
    const distance = Math.max(layout.bounds.width, layout.bounds.depth, layout.bounds.height) * 1.5;
    return [
      layout.center[0] + distance,
      layout.center[1] + distance * 0.8,
      layout.center[2] + distance,
    ];
  }, [layout]);

  return (
    <Canvas
      shadows={false}
      gl={{ antialias: true, alpha: false }}
      camera={{ position: cameraPosition, fov: 45 }}
      style={{ background: '#ffffff' }}
      fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">WebGL is not available.</div>}
    >
      <color attach="background" args={['#ffffff']} />
      <PerspectiveCamera makeDefault position={cameraPosition} fov={45} />
      <OrbitControls
        makeDefault
        target={layout.center}
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableZoom
        enableRotate
      />
      <ambientLight intensity={1.2} />
      <directionalLight position={[20, 30, 20]} intensity={1.5} />
      <DamagePlotBars bars={layout.bars} />
      <Suspense fallback={null}>
        <DamagePlotAxes layout={layout} />
      </Suspense>
    </Canvas>
  );
}
