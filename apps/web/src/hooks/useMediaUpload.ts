import { useMutation } from '@tanstack/react-query';
import apiClient from '../api/client';

export function useMediaUpload() {
  return useMutation({
    mutationFn: async (data: { file: File; vesselId?: string; workOrderId?: string; inspectionId?: string; findingId?: string }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      if (data.vesselId) formData.append('vesselId', data.vesselId);
      if (data.workOrderId) formData.append('workOrderId', data.workOrderId);
      if (data.inspectionId) formData.append('inspectionId', data.inspectionId);
      if (data.findingId) formData.append('findingId', data.findingId);

      const res = await apiClient.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    },
  });
}
