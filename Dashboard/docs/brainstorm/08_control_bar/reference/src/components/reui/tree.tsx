"use client";

import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import type { ItemInstance, TreeInstance } from "@headless-tree/core";
import { cn } from "@/lib/utils";

type TreeProps<T> = ComponentPropsWithoutRef<"div"> & {
  tree: TreeInstance<T>;
  indent: number;
  label?: string;
};

export function Tree<T>({ tree, indent, label = "Tree", className, style, children, ...props }: TreeProps<T>) {
  return (
    <div
      {...tree.getContainerProps(label)}
      {...props}
      className={cn("w-full", className)}
      style={{ "--tree-indent": `${indent}px`, ...style } as CSSProperties}
    >
      {children}
    </div>
  );
}

type TreeItemProps<T> = ComponentPropsWithoutRef<"button"> & {
  item: ItemInstance<T>;
};

export function TreeItem<T>({ item, className, style, ...props }: TreeItemProps<T>) {
  const indent = item.getTree().getConfig().indent ?? 0;
  const indentWidth = item.getItemMeta().level * indent;

  return (
    <button
      type="button"
      {...item.getProps()}
      {...props}
      className={cn("block w-full text-left", className)}
      style={{ "--tree-item-indent": `${indentWidth}px`, paddingInlineStart: `${indentWidth}px`, ...style } as CSSProperties}
    />
  );
}

type TreeItemLabelProps = ComponentPropsWithoutRef<"span"> & {
  children: ReactNode;
};

export function TreeItemLabel({ className, children, ...props }: TreeItemLabelProps) {
  return (
    <span
      {...props}
      className={cn(
        "flex min-h-6 items-center rounded-md px-1.5 py-0.5 text-xs leading-5 text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
