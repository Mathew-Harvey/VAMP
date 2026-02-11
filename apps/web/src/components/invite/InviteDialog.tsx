import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { UserPlus, Mail, Shield, Edit, Eye, Trash2, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

const PERMISSIONS = {
  READ: { label: 'View only', icon: Eye, color: 'text-slate-500' },
  WRITE: { label: 'Can edit', icon: Edit, color: 'text-ocean' },
  ADMIN: { label: 'Admin', icon: Shield, color: 'text-amber-600' },
};

const ROLE_TO_PERM: Record<string, keyof typeof PERMISSIONS> = {
  OBSERVER: 'READ', TEAM_MEMBER: 'WRITE', REVIEWER: 'WRITE', LEAD: 'ADMIN',
};

interface InviteDialogProps {
  workOrderId: string;
  assignments?: Array<{ id: string; role: string; user: { id: string; firstName: string; lastName: string; email: string } }>;
}

export default function InviteDialog({ workOrderId, assignments = [] }: InviteDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<string>('WRITE');
  const [result, setResult] = useState<any>(null);
  const qc = useQueryClient();

  const invite = useMutation({
    mutationFn: () => apiClient.post(`/work-orders/${workOrderId}/invite`, { email, permission }),
    onSuccess: (res) => {
      setResult(res.data.data);
      setEmail('');
      qc.invalidateQueries({ queryKey: ['workOrder', workOrderId] });
    },
  });

  const changePermission = useMutation({
    mutationFn: ({ userId, perm }: { userId: string; perm: string }) =>
      apiClient.patch(`/work-orders/${workOrderId}/collaborators/${userId}/permission`, { permission: perm }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workOrder', workOrderId] }),
  });

  const removeUser = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/work-orders/${workOrderId}/collaborators/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workOrder', workOrderId] }),
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setResult(null);
    invite.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setResult(null); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="mr-2 h-4 w-4" /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Collaborator</DialogTitle>
          <DialogDescription>Add people by email. They'll get access to this work order.</DialogDescription>
        </DialogHeader>

        {/* Invite form */}
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Email address</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setResult(null); }}
                  className="pl-9"
                  required
                />
              </div>
              <Select value={permission} onValueChange={setPermission}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERMISSIONS).map(([key, info]) => (
                    <SelectItem key={key} value={key}>{info.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Result feedback */}
          {result && (
            <ResultBanner result={result} />
          )}

          {invite.error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3">
              <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{(invite.error as any)?.response?.data?.error?.message || 'Failed to invite'}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={!email.trim() || invite.isPending}>
            {invite.isPending ? 'Sending...' : 'Send Invite'}
          </Button>
        </form>

        {/* Current team */}
        {assignments.length > 0 && (
          <div className="border-t pt-3 mt-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">Team ({assignments.length})</p>
            <div className="space-y-1">
              {assignments.map((a) => {
                const perm = ROLE_TO_PERM[a.role] || 'READ';
                const info = PERMISSIONS[perm];
                const Icon = info.icon;
                return (
                  <div key={a.id} className="flex items-center gap-2 rounded-md p-2 hover:bg-muted/50">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold shrink-0">
                      {a.user.firstName[0]}{a.user.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-tight">{a.user.firstName} {a.user.lastName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{a.user.email}</p>
                    </div>
                    <Select
                      value={perm}
                      onValueChange={(p) => changePermission.mutate({ userId: a.user.id, perm: p })}
                    >
                      <SelectTrigger className="w-[100px] h-7 text-xs border-0 bg-muted/50">
                        <div className="flex items-center gap-1">
                          <Icon className={`h-3 w-3 ${info.color}`} />
                          <span>{info.label}</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PERMISSIONS).map(([key, pi]) => (
                          <SelectItem key={key} value={key}>{pi.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => removeUser.mutate(a.user.id)}
                      className="text-muted-foreground hover:text-red-500 p-1 shrink-0"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultBanner({ result }: { result: any }) {
  const emailFailed = result.emailSent === false;
  const isInvited = result.status === 'invited';
  const isAssigned = result.status === 'assigned';
  const isUpdated = result.status === 'updated';

  return (
    <div className={`rounded-md p-3 text-sm ${
      emailFailed ? 'bg-amber-50 border border-amber-200' :
      'bg-green-50 border border-green-200'
    }`}>
      {/* Main message */}
      <div className="flex items-start gap-2">
        {emailFailed ? (
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        ) : (
          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
        )}
        <div>
          {isAssigned && !emailFailed && (
            <p className="text-green-800"><strong>{result.user.firstName} {result.user.lastName}</strong> added and email sent.</p>
          )}
          {isAssigned && emailFailed && (
            <p className="text-amber-800"><strong>{result.user.firstName} {result.user.lastName}</strong> added to the team, but the notification email failed to send.</p>
          )}
          {isUpdated && (
            <p className="text-green-800"><strong>{result.user.firstName} {result.user.lastName}</strong>'s permissions updated.</p>
          )}
          {isInvited && !emailFailed && (
            <p className="text-green-800">Invitation email sent to <strong>{result.email}</strong>. They'll be added when they register.</p>
          )}
          {isInvited && emailFailed && (
            <>
              <p className="text-amber-800">Invitation created for <strong>{result.email}</strong>, but the email could not be delivered.</p>
              <p className="text-amber-700 text-xs mt-1">{result.emailError}</p>
              {result.emailError?.includes('verify a domain') && (
                <p className="text-amber-700 text-xs mt-1">
                  To send emails to any address, <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline font-medium">verify your domain on Resend</a>.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
