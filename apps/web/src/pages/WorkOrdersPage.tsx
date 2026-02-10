import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkOrders, useCreateWorkOrder } from '@/hooks/useWorkOrders';
import { useVessels } from '@/hooks/useVessels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, ClipboardList } from 'lucide-react';
import { WORK_ORDER_TYPES, WORK_ORDER_STATUSES, WORK_ORDER_PRIORITIES } from '@marinestream/shared';
import { formatDate } from '@/utils/formatters';

const statusBadge: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'> = {
  DRAFT: 'secondary',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  IN_PROGRESS: 'info',
  AWAITING_REVIEW: 'info',
  UNDER_REVIEW: 'info',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
  ON_HOLD: 'warning',
};

export default function WorkOrdersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const { data, isLoading } = useWorkOrders({ search, ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}), limit: '50' });
  const { data: vesselsData } = useVessels({ limit: '100' });
  const createWO = useCreateWorkOrder();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', vesselId: '', type: 'BIOFOULING_INSPECTION', priority: 'NORMAL', description: '' });

  const workOrders = data?.data || [];
  const vessels = vesselsData?.data || [];

  const handleCreate = () => {
    createWO.mutate(form, { onSuccess: () => { setShowCreate(false); setForm({ title: '', vesselId: '', type: 'BIOFOULING_INSPECTION', priority: 'NORMAL', description: '' }); } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Work Orders</h1>
          <p className="text-muted-foreground">Manage inspections and maintenance</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Work Order</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Work Order</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Work order title" />
              </div>
              <div className="space-y-2">
                <Label>Vessel</Label>
                <Select value={form.vesselId} onValueChange={(v) => setForm({ ...form, vesselId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select vessel" /></SelectTrigger>
                  <SelectContent>{vessels.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(WORK_ORDER_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(WORK_ORDER_PRIORITIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
              </div>
              <Button onClick={handleCreate} disabled={!form.title || !form.vesselId || createWO.isPending} className="w-full">
                {createWO.isPending ? 'Creating...' : 'Create Work Order'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search work orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {Object.entries(WORK_ORDER_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : workOrders.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No work orders found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workOrders.map((wo: any) => (
                  <TableRow key={wo.id}>
                    <TableCell>
                      <Link to={`/work-orders/${wo.id}`} className="font-mono text-sm text-ocean hover:underline">{wo.referenceNumber}</Link>
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{wo.title}</TableCell>
                    <TableCell>{wo.vessel?.name}</TableCell>
                    <TableCell className="text-sm">{(WORK_ORDER_TYPES as any)[wo.type] || wo.type}</TableCell>
                    <TableCell>
                      <Badge variant={wo.priority === 'URGENT' ? 'destructive' : wo.priority === 'HIGH' ? 'warning' : 'outline'}>{wo.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadge[wo.status] || 'outline'}>{(WORK_ORDER_STATUSES as any)[wo.status]?.label || wo.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(wo.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
