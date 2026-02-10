import { useParams, Link } from 'react-router-dom';
import { useWorkOrder, useChangeWorkOrderStatus } from '@/hooks/useWorkOrders';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, User, MessageSquare, Video, FileText, ClipboardCheck, CheckCircle, AlertTriangle } from 'lucide-react';
import { formatDate, formatDateTime, formatRelative } from '@/utils/formatters';
import { WORK_ORDER_STATUSES, WORK_ORDER_TYPES, FOULING_RATINGS } from '@marinestream/shared';
import { useState, useRef, useCallback } from 'react';

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: wo, isLoading } = useWorkOrder(id!);
  const changeStatus = useChangeWorkOrderStatus();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');

  // Form entries
  const { data: formEntries, refetch: refetchForm } = useQuery({
    queryKey: ['work-form', id],
    queryFn: () => apiClient.get(`/work-orders/${id}/form`).then((r) => r.data.data),
    enabled: !!id,
  });

  const generateForm = useMutation({
    mutationFn: () => apiClient.post(`/work-orders/${id}/form/generate`),
    onSuccess: () => refetchForm(),
  });

  const updateEntry = useMutation({
    mutationFn: ({ entryId, data }: { entryId: string; data: any }) =>
      apiClient.put(`/form-entries/${entryId}`, data),
    onSuccess: () => refetchForm(),
  });

  const addComment = useMutation({
    mutationFn: () => apiClient.post(`/work-orders/${id}/comments`, { content: comment }),
    onSuccess: () => { setComment(''); qc.invalidateQueries({ queryKey: ['workOrder', id] }); },
  });

  // Video capture
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      setVideoStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error('Camera access failed:', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    videoStream?.getTracks().forEach((t) => t.stop());
    setVideoStream(null);
  }, [videoStream]);

  const captureScreenshot = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImages((prev) => [...prev, dataUrl]);
    return dataUrl;
  }, []);

  if (isLoading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  if (!wo) return <div className="text-center py-20 text-muted-foreground">Work order not found</div>;

  const statusInfo = (WORK_ORDER_STATUSES as any)[wo.status];
  const hasForm = formEntries && formEntries.length > 0;
  const completedEntries = formEntries?.filter((e: any) => e.status === 'COMPLETED').length || 0;
  const totalEntries = formEntries?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/work-orders"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{wo.title}</h1>
            <Badge variant="outline">{statusInfo?.label || wo.status}</Badge>
            <Badge variant={wo.priority === 'URGENT' ? 'destructive' : wo.priority === 'HIGH' ? 'warning' : 'outline'}>{wo.priority}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {wo.referenceNumber} · {(WORK_ORDER_TYPES as any)[wo.type]} ·{' '}
            <Link to={`/vessels/${wo.vessel?.id}`} className="text-ocean hover:underline">{wo.vessel?.name}</Link>
          </p>
        </div>
        <div className="flex gap-2">
          {wo.status === 'DRAFT' && <Button onClick={() => changeStatus.mutate({ id: id!, status: 'PENDING_APPROVAL' })}>Submit for Approval</Button>}
          {wo.status === 'PENDING_APPROVAL' && <Button onClick={() => changeStatus.mutate({ id: id!, status: 'APPROVED' })}>Approve</Button>}
          {wo.status === 'APPROVED' && <Button onClick={() => changeStatus.mutate({ id: id!, status: 'IN_PROGRESS' })}>Start Work</Button>}
          {wo.status === 'IN_PROGRESS' && <Button onClick={() => changeStatus.mutate({ id: id!, status: 'AWAITING_REVIEW' })}>Submit for Review</Button>}
          {wo.status === 'UNDER_REVIEW' && <Button onClick={() => changeStatus.mutate({ id: id!, status: 'COMPLETED' })}>Complete</Button>}
        </div>
      </div>

      <Tabs defaultValue="form">
        <TabsList>
          <TabsTrigger value="form" className="gap-2"><ClipboardCheck className="h-4 w-4" /> Work Form {hasForm ? `(${completedEntries}/${totalEntries})` : ''}</TabsTrigger>
          <TabsTrigger value="video" className="gap-2"><Video className="h-4 w-4" /> Video / Camera</TabsTrigger>
          <TabsTrigger value="details" className="gap-2"><FileText className="h-4 w-4" /> Details</TabsTrigger>
          <TabsTrigger value="comments" className="gap-2"><MessageSquare className="h-4 w-4" /> Comments ({wo.comments?.length || 0})</TabsTrigger>
          <TabsTrigger value="team" className="gap-2"><User className="h-4 w-4" /> Team ({wo.assignments?.length || 0})</TabsTrigger>
        </TabsList>

        {/* Work Form Tab */}
        <TabsContent value="form">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Component Inspection Form</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Auto-generated from vessel general arrangement</p>
              </div>
              {!hasForm && (
                <Button onClick={() => generateForm.mutate()} disabled={generateForm.isPending}>
                  {generateForm.isPending ? 'Generating...' : 'Generate Form'}
                </Button>
              )}
              {hasForm && (
                <div className="text-right">
                  <p className="text-sm font-medium">{completedEntries} / {totalEntries} completed</p>
                  <div className="w-32 h-2 bg-muted rounded-full mt-1">
                    <div className="h-2 bg-ocean rounded-full transition-all" style={{ width: `${totalEntries ? (completedEntries / totalEntries) * 100 : 0}%` }} />
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!hasForm ? (
                <div className="text-center py-12">
                  <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No form generated yet</p>
                  <p className="text-sm text-muted-foreground">Click "Generate Form" to create inspection entries from the vessel's components</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formEntries.map((entry: any) => (
                    <FormEntryCard
                      key={entry.id}
                      entry={entry}
                      isActive={activeEntryId === entry.id}
                      onToggle={() => setActiveEntryId(activeEntryId === entry.id ? null : entry.id)}
                      onUpdate={(data: any) => updateEntry.mutate({ entryId: entry.id, data })}
                      capturedImages={capturedImages}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Video / Camera Tab */}
        <TabsContent value="video">
          <Card>
            <CardHeader><CardTitle>Camera / Video Capture</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  {!videoStream ? (
                    <Button onClick={startCamera}><Video className="mr-2 h-4 w-4" /> Start Camera</Button>
                  ) : (
                    <>
                      <Button onClick={captureScreenshot} variant="default">Capture Screenshot</Button>
                      <Button onClick={stopCamera} variant="outline">Stop Camera</Button>
                    </>
                  )}
                </div>
                {videoStream && (
                  <div className="rounded-lg overflow-hidden bg-black aspect-video max-w-2xl">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
                  </div>
                )}
                {capturedImages.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Captured Screenshots ({capturedImages.length})</h4>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                      {capturedImages.map((img, i) => (
                        <div key={i} className="relative rounded-lg overflow-hidden border aspect-video">
                          <img src={img} alt={`Capture ${i + 1}`} className="w-full h-full object-cover" />
                          <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">#{i + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Information</CardTitle></CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Location</dt><dd>{wo.location || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Scheduled Start</dt><dd>{wo.scheduledStart ? formatDate(wo.scheduledStart) : '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Scheduled End</dt><dd>{wo.scheduledEnd ? formatDate(wo.scheduledEnd) : '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Created</dt><dd>{formatDateTime(wo.createdAt)}</dd></div>
                </dl>
                {wo.description && <><Separator className="my-4" /><p className="text-sm">{wo.description}</p></>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
              <CardContent>
                {wo.workflow ? (
                  <div className="space-y-3">
                    {wo.workflow.steps?.map((step: any, i: number) => (
                      <div key={step.id} className={`flex items-start gap-3 p-3 rounded-lg border ${step.id === wo.currentStepId ? 'border-ocean bg-ocean/5' : ''}`}>
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step.id === wo.currentStepId ? 'bg-ocean text-white' : 'bg-muted text-muted-foreground'}`}>{i + 1}</div>
                        <div>
                          <p className="text-sm font-medium">{step.name}</p>
                          <p className="text-xs text-muted-foreground">{step.type?.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No workflow assigned</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {wo.comments?.map((c: any) => (
                <div key={c.id} className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold shrink-0">{c.author?.firstName?.[0]}{c.author?.lastName?.[0]}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{c.author?.firstName} {c.author?.lastName}</span>
                      <span className="text-xs text-muted-foreground">{formatRelative(c.createdAt)}</span>
                    </div>
                    <p className="text-sm mt-1">{c.content}</p>
                  </div>
                </div>
              ))}
              <Separator />
              <div className="flex gap-3">
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment..." className="flex-1" />
                <Button onClick={() => addComment.mutate()} disabled={!comment.trim() || addComment.isPending}>Post</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <Card>
            <CardContent className="pt-6">
              {wo.assignments?.length > 0 ? (
                <div className="space-y-3">
                  {wo.assignments.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{a.user?.firstName} {a.user?.lastName}</p>
                        <p className="text-xs text-muted-foreground">{a.user?.email}</p>
                      </div>
                      <Badge variant="outline">{a.role}</Badge>
                    </div>
                  ))}
                </div>
              ) : <p className="text-muted-foreground">No team members assigned</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Form entry component for each vessel component
function FormEntryCard({ entry, isActive, onToggle, onUpdate, capturedImages }: {
  entry: any;
  isActive: boolean;
  onToggle: () => void;
  onUpdate: (data: any) => void;
  capturedImages: string[];
}) {
  const [formData, setFormData] = useState({
    condition: entry.condition || '',
    foulingRating: entry.foulingRating?.toString() || '',
    foulingType: entry.foulingType || '',
    coverage: entry.coverage?.toString() || '',
    coatingCondition: entry.coatingCondition || '',
    notes: entry.notes || '',
    recommendation: entry.recommendation || '',
    actionRequired: entry.actionRequired || false,
  });

  const handleSave = () => {
    onUpdate({
      condition: formData.condition || null,
      foulingRating: formData.foulingRating ? parseInt(formData.foulingRating) : null,
      foulingType: formData.foulingType || null,
      coverage: formData.coverage ? parseFloat(formData.coverage) : null,
      coatingCondition: formData.coatingCondition || null,
      notes: formData.notes || null,
      recommendation: formData.recommendation || null,
      actionRequired: formData.actionRequired,
      status: 'COMPLETED',
    });
  };

  const isCompleted = entry.status === 'COMPLETED';
  const comp = entry.vesselComponent;

  return (
    <div className={`rounded-lg border ${isCompleted ? 'border-green-200 bg-green-50/30' : isActive ? 'border-ocean' : ''}`}>
      <button onClick={onToggle} className="flex items-center justify-between w-full p-4 text-left">
        <div className="flex items-center gap-3">
          {isCompleted ? (
            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
          ) : entry.actionRequired ? (
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
          )}
          <div>
            <p className="font-medium">{comp?.name}</p>
            <p className="text-xs text-muted-foreground">{comp?.category} · {comp?.location}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {entry.foulingRating != null && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (FOULING_RATINGS as any)[entry.foulingRating]?.color || '#ccc' }} />
              <span className="text-xs">{entry.foulingRating}</span>
            </div>
          )}
          <Badge variant={isCompleted ? 'success' : 'outline'}>{entry.status}</Badge>
        </div>
      </button>

      {isActive && (
        <div className="px-4 pb-4 space-y-4 border-t pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Condition</Label>
              <Select value={formData.condition || 'NONE'} onValueChange={(v) => setFormData({ ...formData, condition: v === 'NONE' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Not assessed</SelectItem>
                  <SelectItem value="GOOD">Good</SelectItem>
                  <SelectItem value="FAIR">Fair</SelectItem>
                  <SelectItem value="POOR">Poor</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Fouling Rating (0-5)</Label>
              <Select value={formData.foulingRating || 'NONE'} onValueChange={(v) => setFormData({ ...formData, foulingRating: v === 'NONE' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">N/A</SelectItem>
                  {Object.entries(FOULING_RATINGS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{k} - {v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Coverage %</Label>
              <Input type="number" min={0} max={100} value={formData.coverage} onChange={(e) => setFormData({ ...formData, coverage: e.target.value })} placeholder="0-100" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Fouling Type</Label>
              <Input value={formData.foulingType} onChange={(e) => setFormData({ ...formData, foulingType: e.target.value })} placeholder="e.g. Barnacles, Slime" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Coating Condition</Label>
              <Input value={formData.coatingCondition} onChange={(e) => setFormData({ ...formData, coatingCondition: e.target.value })} placeholder="e.g. Intact, Degraded" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Notes</Label>
            <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Observations..." rows={2} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Recommendation</Label>
            <Textarea value={formData.recommendation} onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })} placeholder="Recommended actions..." rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id={`action-${entry.id}`} checked={formData.actionRequired} onChange={(e) => setFormData({ ...formData, actionRequired: e.target.checked })} className="rounded" />
            <Label htmlFor={`action-${entry.id}`} className="text-sm">Action required</Label>
          </div>
          {capturedImages.length > 0 && (
            <div>
              <Label className="text-xs mb-1 block">Attach captured screenshots</Label>
              <div className="flex gap-2 flex-wrap">
                {capturedImages.map((img, i) => (
                  <div key={i} className="w-16 h-12 rounded border overflow-hidden cursor-pointer hover:ring-2 ring-ocean">
                    <img src={img} alt={`Cap ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onToggle}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save & Complete</Button>
          </div>
        </div>
      )}
    </div>
  );
}
