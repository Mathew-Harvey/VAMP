import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inspectionsApi } from '@/api/inspections';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FOULING_RATINGS } from '@marinestream/shared';
import { formatDateTime } from '@/utils/formatters';
import { useState } from 'react';
import { Plus, CheckCircle } from 'lucide-react';

export default function InspectionPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: inspection, isLoading } = useQuery({
    queryKey: ['inspection', id],
    queryFn: () => inspectionsApi.getById(id!).then((r) => r.data.data),
  });

  const [finding, setFinding] = useState({ area: '', foulingRating: 0, foulingType: '', description: '', recommendation: '', coverage: 0 });

  const addFinding = useMutation({
    mutationFn: () => inspectionsApi.addFinding(id!, finding),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inspection', id] }); setFinding({ area: '', foulingRating: 0, foulingType: '', description: '', recommendation: '', coverage: 0 }); },
  });

  const completeInspection = useMutation({
    mutationFn: () => inspectionsApi.complete(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection', id] }),
  });

  if (isLoading) return <div className="flex items-center justify-center py-20">Loading...</div>;
  if (!inspection) return <div className="text-center py-20">Inspection not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{inspection.type?.replace(/_/g, ' ')} Inspection</h1>
          <p className="text-muted-foreground">{inspection.vessel?.name} &middot; {inspection.inspectorName}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{inspection.status}</Badge>
          {inspection.status === 'IN_PROGRESS' && (
            <Button onClick={() => completeInspection.mutate()} variant="default">
              <CheckCircle className="mr-2 h-4 w-4" /> Complete Inspection
            </Button>
          )}
        </div>
      </div>

      {/* Environmental Conditions */}
      <Card>
        <CardHeader><CardTitle>Environmental Conditions</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Water Temp</span><p>{inspection.waterTemp ? `${inspection.waterTemp}°C` : '—'}</p></div>
            <div><span className="text-muted-foreground">Visibility</span><p>{inspection.waterVisibility ? `${inspection.waterVisibility}m` : '—'}</p></div>
            <div><span className="text-muted-foreground">Weather</span><p>{inspection.weatherConditions || '—'}</p></div>
            <div><span className="text-muted-foreground">Sea State</span><p>{inspection.seaState || '—'}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Findings */}
      <Card>
        <CardHeader><CardTitle>Findings ({inspection.findings?.length || 0})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {inspection.findings?.map((f: any) => (
            <div key={f.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{f.area}</span>
                {f.foulingRating != null && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (FOULING_RATINGS as any)[f.foulingRating]?.color }} />
                    <span className="text-sm">{(FOULING_RATINGS as any)[f.foulingRating]?.label} ({f.foulingRating})</span>
                  </div>
                )}
              </div>
              {f.description && <p className="text-sm text-muted-foreground">{f.description}</p>}
              {f.recommendation && <p className="text-sm mt-1"><strong>Recommendation:</strong> {f.recommendation}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Add Finding Form */}
      {inspection.status === 'IN_PROGRESS' && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add Finding</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Area</Label>
                  <Input value={finding.area} onChange={(e) => setFinding({ ...finding, area: e.target.value })} placeholder="e.g., Hull Flat Bottom" />
                </div>
                <div className="space-y-2">
                  <Label>Fouling Type</Label>
                  <Input value={finding.foulingType} onChange={(e) => setFinding({ ...finding, foulingType: e.target.value })} placeholder="e.g., Barnacles" />
                </div>
              </div>

              {/* Fouling Rating Selector */}
              <div className="space-y-2">
                <Label>Fouling Rating (IMO 0-5)</Label>
                <div className="flex gap-2">
                  {Object.entries(FOULING_RATINGS).map(([rating, info]) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setFinding({ ...finding, foulingRating: parseInt(rating) })}
                      className={`flex-1 rounded-lg border-2 p-3 text-center transition-all ${
                        finding.foulingRating === parseInt(rating) ? 'border-slate-900 shadow-lg scale-105' : 'border-transparent hover:border-slate-200'
                      }`}
                      style={{ backgroundColor: info.color + '20' }}
                    >
                      <div className="w-6 h-6 rounded-full mx-auto mb-1" style={{ backgroundColor: info.color }} />
                      <div className="text-xs font-bold">{rating}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{info.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Coverage (%)</Label>
                <Input type="number" min={0} max={100} value={finding.coverage} onChange={(e) => setFinding({ ...finding, coverage: parseInt(e.target.value) || 0 })} />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={finding.description} onChange={(e) => setFinding({ ...finding, description: e.target.value })} placeholder="Describe the finding..." />
              </div>

              <div className="space-y-2">
                <Label>Recommendation</Label>
                <Textarea value={finding.recommendation} onChange={(e) => setFinding({ ...finding, recommendation: e.target.value })} placeholder="Recommended action..." />
              </div>

              <Button onClick={() => addFinding.mutate()} disabled={!finding.area || addFinding.isPending} className="w-full">
                {addFinding.isPending ? 'Adding...' : 'Add Finding'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
