import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useVessels, useCreateVessel } from '@/hooks/useVessels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Ship } from 'lucide-react';
import { VESSEL_TYPES } from '@marinestream/shared';

const complianceBadge: Record<string, 'success' | 'destructive' | 'warning' | 'info'> = {
  COMPLIANT: 'success',
  NON_COMPLIANT: 'destructive',
  DUE_FOR_INSPECTION: 'warning',
  UNDER_REVIEW: 'info',
};

export default function VesselsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const { data, isLoading } = useVessels({ search, ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}), limit: '50' });
  const createVessel = useCreateVessel();
  const [showCreate, setShowCreate] = useState(false);
  const [newVessel, setNewVessel] = useState({ name: '', vesselType: 'TUG' });

  const vessels = data?.data || [];

  const handleCreate = () => {
    createVessel.mutate(newVessel, {
      onSuccess: () => { setShowCreate(false); setNewVessel({ name: '', vesselType: 'TUG' }); },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Vessels</h1>
          <p className="text-muted-foreground">Manage your fleet</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Vessel</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Vessel</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Vessel Name</Label>
                <Input value={newVessel.name} onChange={(e) => setNewVessel({ ...newVessel, name: e.target.value })} placeholder="Enter vessel name" />
              </div>
              <div className="space-y-2">
                <Label>Vessel Type</Label>
                <Select value={newVessel.vesselType} onValueChange={(v) => setNewVessel({ ...newVessel, vesselType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(VESSEL_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={!newVessel.name || createVessel.isPending} className="w-full">
                {createVessel.isPending ? 'Creating...' : 'Create Vessel'}
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
              <Input placeholder="Search vessels..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="IN_DRYDOCK">In Drydock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading vessels...</p>
          ) : vessels.length === 0 ? (
            <div className="text-center py-12">
              <Ship className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No vessels found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>IMO</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Compliance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vessels.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <Link to={`/vessels/${v.id}`} className="font-medium text-ocean hover:underline">{v.name}</Link>
                    </TableCell>
                    <TableCell>{(VESSEL_TYPES as any)[v.vesselType] || v.vesselType}</TableCell>
                    <TableCell className="text-muted-foreground">{v.imoNumber || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{v.status}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={complianceBadge[v.complianceStatus] || 'outline'}>
                        {v.complianceStatus?.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
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
