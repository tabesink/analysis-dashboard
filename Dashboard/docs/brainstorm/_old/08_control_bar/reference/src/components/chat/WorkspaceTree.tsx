"use client";

import { FileIcon, FolderIcon, FolderOpenIcon } from "lucide-react";
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { Tree, TreeItem, TreeItemLabel } from "@/components/reui/tree";
import type { SourceTreeItem, SourceTreeSnapshot } from "@/types/chat";

const emptyTree: SourceTreeSnapshot = {
  root_id: "root",
  items: {
    root: { name: "Root", children: ["workspace"] },
    workspace: { name: "Workspace", children: [] },
  },
  expanded_item_ids: ["workspace"],
};

const indent = 20;

export function WorkspaceTree({ sourceTree }: { sourceTree?: SourceTreeSnapshot | null }) {
  const data = normalizeSourceTree(sourceTree);
  const revision = sourceTreeRevision(data);

  return <WorkspaceTreeContent key={revision} sourceTree={data} />;
}

function WorkspaceTreeContent({ sourceTree }: { sourceTree: SourceTreeSnapshot }) {
  const data = sourceTree;
  const tree = useTree<SourceTreeItem>({
    initialState: {
      expandedItems: data.expanded_item_ids ?? ["workspace"],
    },
    indent,
    rootItemId: data.root_id,
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => (item.getItemData().children?.length ?? 0) > 0,
    dataLoader: {
      getItem: (itemId) => data.items[itemId] ?? { name: itemId },
      getChildren: (itemId) => data.items[itemId]?.children ?? [],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  return (
    <div className="w-full bg-transparent">
      <div className="mb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Sources</p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">Indexed document map</p>
      </div>
      <Tree
        className="relative w-full"
        indent={indent}
        label="Workspace source tree"
        tree={tree}
      >
        {tree.getItems().map((item) => (
          <TreeItem
            key={item.getId()}
            className="bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)-1px),var(--border)_var(--tree-indent))] bg-[length:var(--tree-item-indent)_100%] bg-no-repeat"
            item={item}
          >
            <TreeItemLabel className="relative py-1 before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10 before:bg-[var(--background)] text-xs leading-5 text-[var(--foreground)] hover:bg-[var(--muted)]">
              <span className="flex min-w-0 items-center gap-1.5">
                {item.isFolder() ? (
                  item.isExpanded() ? (
                    <FolderOpenIcon className="pointer-events-none size-3.5 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
                  ) : (
                    <FolderIcon className="pointer-events-none size-3.5 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
                  )
                ) : (
                  <FileIcon className="pointer-events-none size-3.5 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
                )}
                <span className="truncate">{item.getItemName()}</span>
              </span>
            </TreeItemLabel>
          </TreeItem>
        ))}
      </Tree>
      {data.items.workspace?.children?.length ? null : (
        <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">Retrieved source structure will appear after the first backend chat turn.</p>
      )}
    </div>
  );
}

function normalizeSourceTree(sourceTree?: SourceTreeSnapshot | null): SourceTreeSnapshot {
  if (!sourceTree?.items?.[sourceTree.root_id]) {
    return emptyTree;
  }
  return sourceTree;
}

function sourceTreeRevision(sourceTree: SourceTreeSnapshot) {
  return Object.entries(sourceTree.items)
    .map(([itemId, item]) => `${itemId}:${item.children?.length ?? 0}:${item.retrieval_frame_ids?.length ?? 0}`)
    .sort()
    .join("|");
}
