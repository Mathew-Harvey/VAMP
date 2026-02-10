import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, CheckCircle, XCircle } from 'lucide-react';
import { formatDateTime } from '@/utils/formatters';
import { useMutation } from '@tanstack/react-query';

export default function AuditLogPage() {
  const [entityType, setEntityType] = useState('ALL');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit', entityType, page],
    queryFn: () => apiClient.get('/audit', { params: { entityType: entityType !== 'ALL' ? entityType : undefined, page, limit: 20 } }).then((r) => r.data),
  });

  const verify = useMutation({
    mutationFn: () => apiClient.get('/audit/verify').then((r) => r.data.data),
  });

  const entries = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-muted-foreground">Immutable record of all platform activity</p>
        </div>
        <Button onClick={() => verify.mutate()} variant="outline" disabled={verify.isPending}>
          <Shield className="mr-2 h-4 w-4" />
          {verify.isPending ? 'Verifying...' : 'Verify Chain Integrity'}
        </Button>
      </div>

      {verify.data && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            {verify.data.valid ? (
              <><CheckCircle className="h-5 w-5 text-green-500" /><span className="font-medium text-green-700">Chain integrity verified — {verify.data.entriesChecked} entries checked</span></>
            ) : (
              <><XCircle className="h-5 w-5 text-red-500" /><span className="font-medium text-red-700">Chain broken at sequence {verify.data.brokenAtSequence}</span></>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Entities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Entities</SelectItem>
                <SelectItem value="Vessel">Vessel</SelectItem>
                <SelectItem value="WorkOrder">Work Order</SelectItem>
                <SelectItem value="Inspection">Inspection</SelectItem>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="Media">Media</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.sequence}</TableCell>
                      <TableCell><Badge variant="outline">{e.action}</Badge></TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm">{e.description}</TableCell>
                      <TableCell className="text-sm">{e.entityType}</TableCell>
                      <TableCell className="text-sm">{e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : 'System'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(e.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {meta && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">Page {meta.page} of {meta.totalPages} ({meta.total} entries)</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= meta.totalPages}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
