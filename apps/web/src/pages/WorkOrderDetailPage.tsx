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
import { useCallStore } from '@/stores/call.store';
import { useFormCollaboration, type FormCollaboration } from '@/hooks/useFormCollaboration';
import InviteDialog from '@/components/invite/InviteDialog';
import {
  ArrowLeft, User, MessageSquare, Video, FileText, ClipboardCheck,
  CheckCircle, AlertTriangle, Camera, X, Image, PhoneCall, UserPlus, Building2, Lock, Users,
} from 'lucide-react';
import { formatDate, formatDateTime, formatRelative } from '@/utils/formatters';
import { WORK_ORDER_STATUSES, WORK_ORDER_TYPES, FOULING_RATINGS } from '@marinestream/shared';
import { useState, useCallback, useEffect } from 'react';

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: wo, isLoading } = useWorkOrder(id!);
  const changeStatus = useChangeWorkOrderStatus();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const { activeWorkOrderId, startCall, isInCall, openPanel, setRemoteCall } = useCallStore();

  // Real-time collaboration hook
  const collab = useFormCollaboration(id!);

  // Push call status from collab socket to global store so header can see it
  useEffect(() => {
    setRemoteCall(collab.callActive, collab.callParticipantCount, id!, wo?.title || '');
    return () => setRemoteCall(false, 0, null, null);
  }, [collab.callActive, collab.callParticipantCount, id, wo?.title, setRemoteCall]);

  // Form entries (initial load from REST, then live-updated via socket)
  const { data: formEntries, refetch: refetchForm } = useQuery({
    queryKey: ['work-form', id],
    queryFn: () => apiClient.get(`/work-orders/${id}/form`).then((r) => r.data.data),
    enabled: !!id,
  });

  const generateForm = useMutation({
    mutationFn: () => apiClient.post(`/work-orders/${id}/form/generate`),
    onSuccess: () => refetchForm(),
  });

  const addComment = useMutation({
    mutationFn: () => apiClient.post(`/work-orders/${id}/comments`, { content: comment }),
    onSuccess: () => { setComment(''); qc.invalidateQueries({ queryKey: ['workOrder', id] }); },
  });

  const handleStartCall = () => startCall(id!, wo?.title || 'Work Order');

  // Simple open/close - no entry-level locking. Fields lock individually on focus.
  const handleToggleEntry = (entryId: string) => {
    setActiveEntryId(activeEntryId === entryId ? null : entryId);
  };

  if (isLoading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  if (!wo) return <div className="text-center py-20 text-muted-foreground">Work order not found</div>;

  const statusInfo = (WORK_ORDER_STATUSES as any)[wo.status];
  const hasForm = formEntries && formEntries.length > 0;
  const completedEntries = formEntries?.filter((e: any) => (collab.liveStatuses.get(e.id) || e.status) === 'COMPLETED').length || 0;
  const totalEntries = formEntries?.length || 0;
  const getRoleLabel = (role: string) => {
    if (role === 'LEAD') return 'Admin';
    if (role === 'TEAM_MEMBER') return 'Read & Write';
    if (role === 'REVIEWER') return 'Reviewer';
    return 'Read Only';
  };

  return (
    <div className="space-y-6">
      {/* Call-in-progress banner */}
      {collab.callActive && !isInCall && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-green-800">Video call in progress</span>
            <Badge variant="outline" className="text-green-700 border-green-300">
              <Users className="h-3 w-3 mr-1" /> {collab.callParticipantCount} in call
            </Badge>
          </div>
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleStartCall}>
            <Video className="mr-2 h-4 w-4" /> Join Call
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/work-orders"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{wo.title}</h1>
            <Badge variant="outline">{statusInfo?.label || wo.status}</Badge>
            <Badge variant={wo.priority === 'URGENT' ? 'destructive' : wo.priority === 'HIGH' ? 'warning' : 'outline'}>{wo.priority}</Badge>
            {collab.connected && <div className="h-2 w-2 rounded-full bg-green-400" title="Real-time sync active" />}
          </div>
          <p className="text-sm text-muted-foreground">
            {wo.referenceNumber} · {(WORK_ORDER_TYPES as any)[wo.type]} ·{' '}
            <Link to={`/vessels/${wo.vessel?.id}`} className="text-ocean hover:underline">{wo.vessel?.name}</Link>
          </p>
        </div>
        <div className="flex gap-2">
          <InviteDialog workOrderId={id!} assignments={wo.assignments} />
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
          <TabsTrigger value="video" className="gap-2"><Video className="h-4 w-4" /> Video Call</TabsTrigger>
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
                <p className="text-sm text-muted-foreground mt-1">Auto-generated from vessel general arrangement. Changes sync in real-time.</p>
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
                  <p className="mt-2 text-muted-foreground">Click "Generate Form" to create inspection entries from the vessel's components</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formEntries.map((entry: any) => (
                    <FormEntryCard
                      key={entry.id}
                      entry={entry}
                      isActive={activeEntryId === entry.id}
                      onToggle={() => handleToggleEntry(entry.id)}
                      collab={collab}
                      workOrderId={id!}
                      workOrderTitle={wo?.title || ''}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Video Call Tab */}
        <TabsContent value="video">
          <Card>
            <CardContent className="pt-6">
              {activeWorkOrderId === id && isInCall ? (
                <div className="text-center py-8">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="h-3 w-3 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-600 font-medium">You're in the call</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">The video call is running in the floating panel.</p>
                  <Button onClick={openPanel} variant="outline"><Video className="mr-2 h-4 w-4" /> Show Call Panel</Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Video className="mx-auto h-12 w-12 text-ocean mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Video Call</h3>
                  {collab.callActive && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <div className="h-3 w-3 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-green-600 text-sm">Call in progress ({collab.callParticipantCount} participants)</span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                    Start or join a video call with your team.
                  </p>
                  <Button onClick={handleStartCall} size="lg" className={collab.callActive ? 'bg-green-600 hover:bg-green-700' : ''}>
                    <PhoneCall className="mr-2 h-5 w-5" /> {collab.callActive ? 'Join Call' : 'Start Video Call'}
                  </Button>
                </div>
              )}
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
                        <div><p className="text-sm font-medium">{step.name}</p><p className="text-xs text-muted-foreground">{step.type?.replace(/_/g, ' ')}</p></div>
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
                    <div className="flex items-center gap-2"><span className="text-sm font-medium">{c.author?.firstName} {c.author?.lastName}</span><span className="text-xs text-muted-foreground">{formatRelative(c.createdAt)}</span></div>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Team & Collaborators</CardTitle>
              <InviteDialog workOrderId={id!} assignments={wo.assignments} />
            </CardHeader>
            <CardContent>
              {wo.assignments?.length > 0 ? (
                <div className="space-y-3">
                  {wo.assignments.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ocean/10 text-ocean text-sm font-semibold shrink-0">
                        {a.user?.firstName?.[0]}{a.user?.lastName?.[0]}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{a.user?.firstName} {a.user?.lastName}</p>
                        <p className="text-xs text-muted-foreground">{a.user?.email}</p>
                      </div>
                      <Badge variant={a.role === 'LEAD' ? 'default' : a.role === 'TEAM_MEMBER' ? 'info' : 'outline'}>
                        {getRoleLabel(a.role)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <UserPlus className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
                  <p className="text-muted-foreground">No team members yet</p>
                  <p className="text-sm text-muted-foreground">Click "Invite" to add collaborators by email</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Form Entry Card - with real-time collaboration
// ============================================================================
function FormEntryCard({ entry, isActive, onToggle, collab, workOrderId, workOrderTitle }: {
  entry: any;
  isActive: boolean;
  onToggle: () => void;
  collab: FormCollaboration;
  workOrderId: string;
  workOrderTitle: string;
}) {
  const { isInCall, activeWorkOrderId, focusedPeerId, startCall, openPanel, setScreenshotTarget } = useCallStore();
  const comp = entry.vesselComponent;
  const liveStatus = collab.liveStatuses.get(entry.id) || entry.status;
  const isCompleted = liveStatus === 'COMPLETED';

  const getValue = (field: string, dbValue: any) => collab.getLiveValue(entry.id, field, dbValue);
  const condition = getValue('condition', entry.condition) || '';
  const foulingRating = getValue('foulingRating', entry.foulingRating);
  const foulingType = getValue('foulingType', entry.foulingType) || '';
  const coverage = getValue('coverage', entry.coverage);
  const coatingCondition = getValue('coatingCondition', entry.coatingCondition) || '';
  const notes = getValue('notes', entry.notes) || '';
  const recommendation = getValue('recommendation', entry.recommendation) || '';
  const actionRequired = getValue('actionRequired', entry.actionRequired) || false;

  const liveAtt = collab.liveAttachments.get(entry.id);
  const attachmentsJson = liveAtt ?? entry.attachments ?? '[]';
  const allPhotos: string[] = (() => { try { return JSON.parse(attachmentsJson).filter((a: any) => typeof a === 'string'); } catch { return []; } })();

  const onFieldChange = (field: string, value: any) => collab.updateField(entry.id, field, value);
  const onFocus = (field: string) => collab.lockField(entry.id, field);
  const onBlur = (field: string) => collab.unlockField(entry.id, field);

  const handleCapture = () => {
    const callRunning = isInCall && activeWorkOrderId === workOrderId;
    if (!callRunning) { startCall(workOrderId, workOrderTitle); return; }
    if (!focusedPeerId) { openPanel(); return; }
    setScreenshotTarget(entry.id, (dataUrl: string) => {
      collab.addScreenshot(entry.id, dataUrl);
      setScreenshotTarget(null, null);
    });
    const store = useCallStore.getState();
    if (store.captureFunction) store.captureFunction();
  };

  // Helper to render field lock indicator (not a component - just returns JSX to avoid remount)
  const fieldLabel = (field: string, label: string) => {
    const locked = collab.isFieldLockedByOther(entry.id, field);
    const who = collab.getFieldLocker(entry.id, field)?.userName?.split('@')[0];
    return (
      <div className="flex items-center gap-1">
        <Label className="text-xs">{label}</Label>
        {locked && <span className="text-[10px] text-amber-600 flex items-center gap-0.5"><Lock className="h-2.5 w-2.5" /> {who}</span>}
      </div>
    );
  };
  const fieldDisabled = (field: string) => collab.isFieldLockedByOther(entry.id, field);

  return (
    <div className={`rounded-lg border transition-colors ${
      isCompleted ? 'border-green-200 bg-green-50/30' :
      isActive ? 'border-ocean/50' : ''
    }`}>
      <button onClick={onToggle} className="flex items-center justify-between w-full p-4 text-left">
        <div className="flex items-center gap-3">
          {isCompleted ? (
            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
          ) : actionRequired ? (
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
          {allPhotos.length > 0 && <Badge variant="outline" className="gap-1"><Image className="h-3 w-3" /> {allPhotos.length}</Badge>}
          {foulingRating != null && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (FOULING_RATINGS as any)[foulingRating]?.color || '#ccc' }} />
              <span className="text-xs">{foulingRating}</span>
            </div>
          )}
          {condition && <Badge variant={condition === 'GOOD' ? 'success' : condition === 'POOR' || condition === 'CRITICAL' ? 'destructive' : 'warning'}>{condition}</Badge>}
          <Badge variant={isCompleted ? 'success' : 'outline'}>{liveStatus}</Badge>
        </div>
      </button>

      {isActive && (
        <div className="px-4 pb-4 space-y-4 border-t pt-4" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              {fieldLabel('condition', 'Condition')}
              <Select value={condition || 'NONE'} disabled={fieldDisabled('condition')}
                onValueChange={(v) => { onFieldChange('condition', v === 'NONE' ? null : v); onBlur('condition'); }}
                onOpenChange={(open) => { if (open) onFocus('condition'); }}>
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
              {fieldLabel('foulingRating', 'Fouling Rating (0-5)')}
              <Select value={foulingRating?.toString() || 'NONE'} disabled={fieldDisabled('foulingRating')}
                onValueChange={(v) => { onFieldChange('foulingRating', v === 'NONE' ? null : parseInt(v)); onBlur('foulingRating'); }}
                onOpenChange={(open) => { if (open) onFocus('foulingRating'); }}>
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
              {fieldLabel('coverage', 'Coverage %')}
              <Input type="number" min={0} max={100} value={coverage ?? ''} disabled={fieldDisabled('coverage')}
                onChange={(e) => onFieldChange('coverage', e.target.value ? parseFloat(e.target.value) : null)}
                onFocus={() => onFocus('coverage')} onBlur={() => onBlur('coverage')} placeholder="0-100" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              {fieldLabel('foulingType', 'Fouling Type')}
              <Input value={foulingType} disabled={fieldDisabled('foulingType')}
                onChange={(e) => onFieldChange('foulingType', e.target.value || null)}
                onFocus={() => onFocus('foulingType')} onBlur={() => onBlur('foulingType')} placeholder="e.g. Barnacles, Slime" />
            </div>
            <div className="space-y-2">
              {fieldLabel('coatingCondition', 'Coating Condition')}
              <Input value={coatingCondition} disabled={fieldDisabled('coatingCondition')}
                onChange={(e) => onFieldChange('coatingCondition', e.target.value || null)}
                onFocus={() => onFocus('coatingCondition')} onBlur={() => onBlur('coatingCondition')} placeholder="e.g. Intact, Degraded" />
            </div>
          </div>
          <div className="space-y-2">
            {fieldLabel('notes', 'Notes')}
            <Textarea value={notes} disabled={fieldDisabled('notes')}
              onChange={(e) => onFieldChange('notes', e.target.value || null)}
              onFocus={() => onFocus('notes')} onBlur={() => onBlur('notes')} placeholder="Observations..." rows={2} />
          </div>
          <div className="space-y-2">
            {fieldLabel('recommendation', 'Recommendation')}
            <Textarea value={recommendation} disabled={fieldDisabled('recommendation')}
              onChange={(e) => onFieldChange('recommendation', e.target.value || null)}
              onFocus={() => onFocus('recommendation')} onBlur={() => onBlur('recommendation')} placeholder="Recommended actions..." rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id={`action-${entry.id}`} checked={actionRequired}
              disabled={fieldDisabled('actionRequired')}
              onChange={(e) => onFieldChange('actionRequired', e.target.checked)}
              className="rounded" />
            <Label htmlFor={`action-${entry.id}`} className="text-sm">Action required</Label>
            {collab.isFieldLockedByOther(entry.id, 'actionRequired') && (
              <span className="text-[10px] text-amber-600 flex items-center gap-0.5"><Lock className="h-2.5 w-2.5" /> {collab.getFieldLocker(entry.id, 'actionRequired')?.userName?.split('@')[0]}</span>
            )}
          </div>

          {/* Photo attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1"><Image className="h-3 w-3" /> Photo Evidence ({allPhotos.length})</Label>
              <Button variant="outline" size="sm" onClick={handleCapture} className="text-ocean border-ocean/30 hover:bg-ocean/10">
                <Camera className="h-3 w-3 mr-1" /> Capture Screenshot
              </Button>
            </div>
            {allPhotos.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {allPhotos.map((photo: string, i: number) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden border aspect-[4/3]">
                    <img src={photo} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                    <button onClick={() => collab.removeScreenshot(entry.id, i)}
                      className="absolute top-1 right-1 bg-black/60 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3 w-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">#{i + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onToggle}>Close</Button>
            {!isCompleted && (
              <Button size="sm" onClick={() => collab.completeEntry(entry.id)} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4 mr-1" /> Mark Complete
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
