import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vesselsApi } from '../api/vessels';

export function useVessels(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['vessels', params],
    queryFn: () => vesselsApi.list(params).then((r) => r.data),
  });
}

export function useVessel(id: string) {
  return useQuery({
    queryKey: ['vessel', id],
    queryFn: () => vesselsApi.getById(id).then((r) => r.data.data),
    enabled: !!id,
  });
}

export function useCreateVessel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => vesselsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vessels'] }),
  });
}

export function useUpdateVessel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => vesselsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vessels'] }),
  });
}
