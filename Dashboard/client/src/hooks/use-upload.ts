/**
 * Hook for file upload with progress tracking
 * Single responsibility: Upload orchestration
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { uploadApi } from '@/lib/api/upload';
import type { UploadResponse, UploadMetadata, UploadTaskEvent } from '@/types/upload';

interface UseUploadOptions {
  /** Callback when upload completes successfully */
  onComplete?: (response: UploadResponse) => void;
  /** Callback when upload fails */
  onError?: (error: string) => void;
}

interface UseUploadReturn {
  /** Upload files with metadata */
  upload: (
    dataFiles: File[],
    channelMapFile: File | undefined,
    metadata: UploadMetadata
  ) => Promise<UploadResponse>;
  /** Cancel the current upload */
  cancel: () => void;
  /** Whether an upload is in progress */
  isUploading: boolean;
  /** Upload progress percentage (0-100) */
  progress: number;
  /** Status message */
  message: string;
}

export function useUpload(options: UseUploadOptions = {}): UseUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const cancelledRef = useRef(false);

  const upload = useCallback(
    async (
      dataFiles: File[],
      channelMapFile: File | undefined,
      metadata: UploadMetadata
    ): Promise<UploadResponse> => {
      cancelledRef.current = false;
      abortRef.current = new AbortController();
      setIsUploading(true);
      setProgress(0);
      setMessage('Uploading files...');

      try {
        const start = await uploadApi.startFolderUpload(
          dataFiles,
          channelMapFile,
          metadata,
          (percent, isProcessing) => {
            if (isProcessing) {
              // File transfer done, server processing
              setProgress(10);
              setMessage('Processing on server (this may take a few minutes)...');
            } else {
              // File transfer: 0-10%
              setProgress(Math.round(percent * 0.1));
              setMessage('Uploading files...');
            }
          },
          abortRef.current.signal,
        );

        setProgress(10);
        setMessage('Validating files...');

        const response = await new Promise<UploadResponse>((resolve, reject) => {
          const es = new EventSource(uploadApi.getFolderUploadEventsUrl(start.task_id), {
            withCredentials: true,
          });
          eventSourceRef.current = es;

          const handleTaskEvent = (raw: MessageEvent) => {
            let data: UploadTaskEvent;
            try {
              data = JSON.parse(raw.data) as UploadTaskEvent;
            } catch {
              return;
            }
            const totalEvents = Math.max(1, data.total_events || 0);
            const completedEvents = Math.max(0, data.completed_events || 0);

            if (data.phase === 'validating') {
              setProgress(10);
              setMessage('Validating files...');
              return;
            }

            if (data.phase === 'converting') {
              setProgress(10);
              setMessage('Converting RSP files...');
              return;
            }

            const serverProgress = Math.round((completedEvents / totalEvents) * 90);
            setProgress(Math.min(99, 10 + serverProgress));
            if (data.current_event) {
              setMessage(`Processed ${completedEvents}/${totalEvents}: ${data.current_event}`);
            } else {
              setMessage(`Processing events: ${completedEvents}/${totalEvents}`);
            }
          };

          es.addEventListener('progress', handleTaskEvent as EventListener);
          es.addEventListener('error', (event) => {
            if (cancelledRef.current) return;
            if ((event as MessageEvent).data) {
              try {
                const payload = JSON.parse((event as MessageEvent).data) as UploadTaskEvent;
                const msg = payload.error || 'Upload failed';
                setMessage(msg);
                es.close();
                reject(new Error(msg));
                return;
              } catch {
                // fall through
              }
            }
            setMessage('Upload stream error');
            es.close();
            reject(new Error('Upload stream error'));
          });
          es.addEventListener('complete', (event) => {
            if (cancelledRef.current) return;
            try {
              const payload = JSON.parse((event as MessageEvent).data) as UploadTaskEvent;
              const finalResponse = payload.result;
              if (!finalResponse) {
                es.close();
                reject(new Error('Upload completed without result'));
                return;
              }
              setProgress(100);
              setMessage(
                finalResponse.pending_channel_map
                  ? `Complete: ${finalResponse.files.length} files pending channel map`
                  : `Complete: ${finalResponse.files.length} files processed`
              );
              es.close();
              resolve(finalResponse);
            } catch {
              es.close();
              reject(new Error('Invalid completion payload'));
            }
          });
        });

        options.onComplete?.(response);
        return response;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setMessage('Upload cancelled');
          throw error;
        }
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';
        setMessage(errorMessage);
        options.onError?.(errorMessage);
        throw error;
      } finally {
        abortRef.current = null;
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        setIsUploading(false);
      }
    },
    [options]
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsUploading(false);
    setProgress(0);
    setMessage('');
  }, []);

  return {
    upload,
    cancel,
    isUploading,
    progress,
    message,
  };
}
