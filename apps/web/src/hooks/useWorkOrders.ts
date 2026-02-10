import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workOrdersApi } from '../api/work-orders';

export function useWorkOrders(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['workOrders', params],
    queryFn: () => workOrdersApi.list(params).then((r) => r.data),
  });
}

export function useWorkOrder(id: string) {
  return useQuery({
    queryKey: ['workOrder', id],
    queryFn: () => workOrdersApi.getById(id).then((r) => r.data.data),
    enabled: !!id,
  });
}

export function useCreateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => workOrdersApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workOrders'] }),
  });
}

export function useChangeWorkOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      workOrdersApi.changeStatus(id, status, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workOrders'] });
      qc.invalidateQueries({ queryKey: ['workOrder'] });
    },
  });
}
