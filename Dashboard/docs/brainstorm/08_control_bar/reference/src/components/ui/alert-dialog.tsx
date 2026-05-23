'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface AlertDialogContentProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

const AlertDialogContext = React.createContext<{
  onOpenChange: (open: boolean) => void;
} | null>(null);

export function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  if (!open) return null;

  return (
    <AlertDialogContext.Provider value={{ onOpenChange }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        />
        {children}
      </div>
    </AlertDialogContext.Provider>
  );
}

export function AlertDialogContent({ children, className }: AlertDialogContentProps) {
  const context = React.useContext(AlertDialogContext);

  return (
    <div
      className={cn(
        'relative z-50 w-full max-w-md rounded-xl bg-card border shadow-xl',
        'animate-in fade-in-0 zoom-in-95',
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        onClick={() => context?.onOpenChange(false)}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>
      {children}
    </div>
  );
}

export function AlertDialogHeader({ children, className }: AlertDialogHeaderProps) {
  return (
    <div className={cn('flex flex-col space-y-2 p-6 pb-0', className)}>
      {children}
    </div>
  );
}

export function AlertDialogFooter({ children, className }: AlertDialogFooterProps) {
  return (
    <div className={cn('flex justify-end gap-3 p-6 pt-4', className)}>
      {children}
    </div>
  );
}

export function AlertDialogTitle({ children, className }: AlertDialogTitleProps) {
  return (
    <h2 className={cn('text-lg font-semibold', className)}>
      {children}
    </h2>
  );
}

export function AlertDialogDescription({ children, className }: AlertDialogDescriptionProps) {
  return (
    <div className={cn('text-sm text-muted-foreground', className)}>
      {children}
    </div>
  );
}

export function AlertDialogAction({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button className={className} {...props}>
      {children}
    </Button>
  );
}

export function AlertDialogCancel({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const context = React.useContext(AlertDialogContext);

  return (
    <Button
      variant="outline"
      className={className}
      onClick={() => context?.onOpenChange(false)}
      {...props}
    >
      {children}
    </Button>
  );
}
