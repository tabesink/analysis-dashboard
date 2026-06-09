"use client";

import { BookOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/stores/settings";

export default function LegendButton() {
  const showLegend = useSettingsStore.use.showLegend();
  const setShowLegend = useSettingsStore.use.setShowLegend();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle legend"
      title="Toggle legend"
      onClick={() => setShowLegend(!showLegend)}
    >
      <BookOpenIcon className="size-4" />
    </Button>
  );
}
