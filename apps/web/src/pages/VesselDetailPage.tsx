import { useParams, Link } from 'react-router-dom';
import { useVessel } from '@/hooks/useVessels';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Ship, ClipboardList, Layers, History } from 'lucide-react';
import { formatDate } from '@/utils/formatters';
import { VESSEL_TYPES } from '@marinestream/shared';
import { useState } from 'react';

const COMPONENT_CATEGORIES = [
  { value: 'HULL', label: 'Hull' },
  { value: 'SEA_CHEST', label: 'Sea Chest' },
  { value: 'THRUSTER', label: 'Thruster' },
  { value: 'PROPELLER', label: 'Propeller' },
  { value: 'RUDDER', label: 'Rudder' },
  { value: 'KEEL', label: 'Keel' },
  { value: 'ANODES', label: 'Anodes' },
  { value: 'INTAKE', label: 'Intake / Transducer' },
  { value: 'OTHER', label: 'Other' },
];

const conditionBadge: Record<string, 'success' | 'warning' | 'destructive' | 'outline'> = {
  GOOD: 'success', FAIR: 'warning', POOR: 'destructive', CRITICAL: 'destructive',
};

export default function VesselDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: vessel, isLoading } = useVessel(id!);
  const qc = useQueryClient();
  const [showAddComp, setShowAddComp] = useState(false);
  const [newComp, setNewComp] = useState({ name: '', category: 'HULL', location: '', description: '' });

  const { data: components } = useQuery({
    queryKey: ['vessel-components', id],
    queryFn: () => apiClient.get(`/vessels/${id}/components`).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: workOrders } = useQuery({
    queryKey: ['vessel-work-orders', id],
    queryFn: () => apiClient.get('/work-orders', { params: { vesselId: id, limit: '100' } }).then((r) => r.data.data),
    enabled: !!id,
  });

  const addComponent = useMutation({
    mutationFn: (data: any) => apiClient.post(`/vessels/${id}/components`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vessel-components', id] }); setShowAddComp(false); setNewComp({ name: '', category: 'HULL', location: '', description: '' }); },
  });

  if (isLoading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading vessel...</div>;
  if (!vessel) return <div className="flex items-center justify-center py-20 text-muted-foreground">Vessel not found</div>;

  const completedWork = (workOrders || []).filter((w: any) => w.status === 'COMPLETED');
  const activeWork = (workOrders || []).filter((w: any) => w.status !== 'COMPLETED' && w.status !== 'CANCELLED');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/vessels"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900">{vessel.name}</h1>
          <p className="text-muted-foreground">{(VESSEL_TYPES as any)[vessel.vesselType] || vessel.vesselType} {vessel.imoNumber ? `· IMO ${vessel.imoNumber}` : ''} {vessel.homePort ? `· ${vessel.homePort}` : ''}</p>
        </div>
        <Badge variant={vessel.complianceStatus === 'COMPLIANT' ? 'success' : vessel.complianceStatus === 'NON_COMPLIANT' ? 'destructive' : 'warning'}>
          {vessel.complianceStatus?.replace(/_/g, ' ')}
        </Badge>
        <Badge variant="outline">{vessel.status}</Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2"><Ship className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="components" className="gap-2"><Layers className="h-4 w-4" /> General Arrangement ({components?.length || 0})</TabsTrigger>
          <TabsTrigger value="record-book" className="gap-2"><History className="h-4 w-4" /> Record Book ({completedWork.length})</TabsTrigger>
          <TabsTrigger value="active-work" className="gap-2"><ClipboardList className="h-4 w-4" /> Active Work ({activeWork.length})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Vessel Details</CardTitle></CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Flag State</dt><dd>{vessel.flagState || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Call Sign</dt><dd>{vessel.callSign || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">MMSI</dt><dd>{vessel.mmsi || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Gross Tonnage</dt><dd>{vessel.grossTonnage || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Length Overall</dt><dd>{vessel.lengthOverall ? `${vessel.lengthOverall}m` : '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Beam</dt><dd>{vessel.beam ? `${vessel.beam}m` : '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Year Built</dt><dd>{vessel.yearBuilt || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Home Port</dt><dd>{vessel.homePort || '—'}</dd></div>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Anti-Fouling System</CardTitle></CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Coating Type</dt><dd>{vessel.afsCoatingType || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Manufacturer</dt><dd>{vessel.afsManufacturer || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Product</dt><dd>{vessel.afsProductName || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Service Life</dt><dd>{vessel.afsServiceLife ? `${vessel.afsServiceLife} months` : '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Last Drydock</dt><dd>{vessel.lastDrydockDate ? formatDate(vessel.lastDrydockDate) : '—'}</dd></div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* General Arrangement Tab */}
        <TabsContent value="components">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Underwater Components (Digital Twin)</CardTitle>
              <Dialog open={showAddComp} onOpenChange={setShowAddComp}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Component</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Vessel Component</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={newComp.name} onChange={(e) => setNewComp({ ...newComp, name: e.target.value })} placeholder="e.g. Sea Chest Port 1" />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={newComp.category} onValueChange={(v) => setNewComp({ ...newComp, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COMPONENT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input value={newComp.location} onChange={(e) => setNewComp({ ...newComp, location: e.target.value })} placeholder="e.g. Port side engine room" />
                    </div>
                    <Button onClick={() => addComponent.mutate(newComp)} disabled={!newComp.name || addComponent.isPending} className="w-full">
                      {addComponent.isPending ? 'Adding...' : 'Add Component'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {!components || components.length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No components defined yet</p>
                  <p className="text-sm text-muted-foreground">Add underwater components to build the vessel's digital twin</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Component</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Condition</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {components.map((c: any, i: number) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell><Badge variant="outline">{COMPONENT_CATEGORIES.find((cat) => cat.value === c.category)?.label || c.category}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.location || '—'}</TableCell>
                        <TableCell>{c.condition ? <Badge variant={conditionBadge[c.condition] || 'outline'}>{c.condition}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Record Book Tab - Historic completed work */}
        <TabsContent value="record-book">
          <Card>
            <CardHeader><CardTitle>Vessel Record Book</CardTitle></CardHeader>
            <CardContent>
              {completedWork.length === 0 ? (
                <div className="text-center py-12">
                  <History className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No completed work records yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedWork.map((wo: any) => (
                    <Link key={wo.id} to={`/work-orders/${wo.id}`} className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-ocean">{wo.referenceNumber}</span>
                          <Badge variant="success">Completed</Badge>
                        </div>
                        <p className="font-medium mt-1">{wo.title}</p>
                        <p className="text-sm text-muted-foreground">{wo.type?.replace(/_/g, ' ')} · {wo.completedAt ? formatDate(wo.completedAt) : formatDate(wo.createdAt)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Work Tab */}
        <TabsContent value="active-work">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Active Work Orders</CardTitle>
              <Button asChild size="sm"><Link to="/work-orders"><Plus className="mr-2 h-4 w-4" /> New Work Order</Link></Button>
            </CardHeader>
            <CardContent>
              {activeWork.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No active work orders</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeWork.map((wo: any) => (
                    <Link key={wo.id} to={`/work-orders/${wo.id}`} className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-ocean">{wo.referenceNumber}</span>
                          <Badge variant="outline">{wo.status?.replace(/_/g, ' ')}</Badge>
                          <Badge variant={wo.priority === 'URGENT' ? 'destructive' : wo.priority === 'HIGH' ? 'warning' : 'outline'}>{wo.priority}</Badge>
                        </div>
                        <p className="font-medium mt-1">{wo.title}</p>
                        <p className="text-sm text-muted-foreground">{wo.type?.replace(/_/g, ' ')} · Created {formatDate(wo.createdAt)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
