import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Extract event name from event_id (removes version folder prefix) */
export function getEventDisplayName(eventId: string): string {
  const lastSlash = eventId.lastIndexOf('/');
  return lastSlash >= 0 ? eventId.slice(lastSlash + 1) : eventId;
}

/** Truncate text to a max character count with ellipsis */
export function truncateLabel(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}...`;
}
