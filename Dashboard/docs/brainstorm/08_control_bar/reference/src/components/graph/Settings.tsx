"use client";

import { SettingsIcon, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useGraphStore } from "@/stores/graph";
import { useSettingsStore } from "@/stores/settings";

export default function Settings() {
  const settings = useSettingsStore();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Graph settings">
          <SettingsIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-72 p-3">
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium">Graph Settings</h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Tune graph loading and display.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberSetting label="Max depth" value={settings.graphQueryMaxDepth} onChange={settings.setGraphQueryMaxDepth} />
            <NumberSetting label="Max nodes" value={settings.graphMaxNodes} onChange={(value) => settings.setGraphMaxNodes(value, true)} />
            <NumberSetting
              label="Layout iter."
              value={settings.graphLayoutMaxIterations}
              onChange={settings.setGraphLayoutMaxIterations}
            />
            <NumberSetting label="Min edge" value={settings.minEdgeSize} onChange={settings.setMinEdgeSize} />
            <NumberSetting label="Max edge" value={settings.maxEdgeSize} onChange={settings.setMaxEdgeSize} />
          </div>

          <div className="space-y-2">
            <Toggle label="Property panel" checked={settings.showPropertyPanel} onChange={settings.setShowPropertyPanel} />
            <Toggle label="Node labels" checked={settings.showNodeLabel} onChange={settings.setShowNodeLabel} />
            <Toggle label="Edge labels" checked={settings.showEdgeLabel} onChange={settings.setShowEdgeLabel} />
            <Toggle
              label="Hide unselected edges"
              checked={settings.enableHideUnselectedEdges}
              onChange={settings.setEnableHideUnselectedEdges}
            />
            <Toggle label="Edge events" checked={settings.enableEdgeEvents} onChange={settings.setEnableEdgeEvents} />
            <Toggle label="Node drag" checked={settings.enableNodeDrag} onChange={settings.setEnableNodeDrag} />
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              useGraphStore.getState().clearSelection();
              useGraphStore.getState().incrementGraphDataVersion();
            }}
          >
            <Undo2 className="size-4" /> Reload graph
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NumberSetting({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={1}
        className="h-8 text-xs"
        value={value}
        onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))}
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs">
      <span>{label}</span>
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
    </label>
  );
}
