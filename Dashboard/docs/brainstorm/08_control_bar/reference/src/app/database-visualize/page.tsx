import GraphViewer from "@/features/graph/GraphViewer";
import { AppPageFrame } from "@/components/layout/AppPageFrame";

export const dynamic = "force-dynamic";

export default function DatabaseVisualizePage() {
  return (
    <AppPageFrame>
      <GraphViewer />
    </AppPageFrame>
  );
}
