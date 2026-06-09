'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { databaseApi } from '@/lib/api/database';
import type { BatchSaveRequest } from '@/types/database';

interface BatchSaveVariables {
  certificateId: string;
  payload: BatchSaveRequest;
}

export function useCertificateBatchSave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: BatchSaveVariables) =>
      databaseApi.saveCertificateResultsBatch(
        variables.certificateId,
        variables.payload,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['database'] });
    },
  });
}

