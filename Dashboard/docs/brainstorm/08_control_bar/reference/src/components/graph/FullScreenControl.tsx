"use client";

import { MaximizeIcon, MinimizeIcon } from "lucide-react";
import { useFullScreen } from "@react-sigma/core";
import { Button } from "@/components/ui/button";

export default function FullScreenControl() {
  const { isFullScreen, toggle } = useFullScreen();

  return (
    <Button variant="ghost" size="icon-sm" aria-label="Toggle fullscreen" title={isFullScreen ? "Windowed mode" : "Fullscreen mode"} onClick={toggle}>
      {isFullScreen ? <MinimizeIcon className="size-4" /> : <MaximizeIcon className="size-4" />}
    </Button>
  );
}
