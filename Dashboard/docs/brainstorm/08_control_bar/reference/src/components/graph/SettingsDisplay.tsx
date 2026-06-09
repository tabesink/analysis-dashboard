"use client";

import { useSettingsStore } from "@/stores/settings";

export default function SettingsDisplay() {
  const maxDepth = useSettingsStore.use.graphQueryMaxDepth();
  const maxNodes = useSettingsStore.use.graphMaxNodes();

  return (
    <div className="absolute bottom-4 left-[calc(1rem+2.5rem)] flex items-center gap-2 text-xs text-gray-400">
      <div>Depth: {maxDepth}</div>
      <div>Max: {maxNodes}</div>
    </div>
  );
}
