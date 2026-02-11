import { useMemo, useState } from 'react';
import { Bell, LogOut, Video, PhoneOff, Users, PhoneCall, CheckCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useCallStore } from '@/stores/call.store';
import { useLogout } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export default function Header() {
  const { user, organisation } = useAuthStore();
  const {
    activeWorkOrderId, isInCall, isPanelOpen, togglePanel, endCall, startCall,
    remoteCallActive, remoteCallCount, remoteCallWorkOrderId, remoteCallWorkOrderTitle,
  } = useCallStore();
  const queryClient = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);
  const logoutMutation = useLogout();

  const { data: notifCount = 0 } = useQuery<number>({
    queryKey: ['notificationCount'],
    queryFn: () => apiClient.get('/notifications/count').then((r) => r.data.data.count),
    refetchInterval: 30000,
  });

  const { data: notifications = [], isLoading: loadingNotifications } = useQuery<NotificationItem[]>({
    queryKey: ['notifications', notifOpen],
    queryFn: () => apiClient.get('/notifications').then((r) => r.data.data || []),
    enabled: notifOpen,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationCount'] });
    },
  });

  const unreadNotifications = useMemo(() => notifications.filter((n) => !n.isRead), [notifications]);

  // Show call indicator: either you're in a call OR a remote call is active on the current work order
  const showRemoteCall = remoteCallActive && !isInCall && remoteCallWorkOrderId;

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">
          {organisation?.name || 'MarineStream'}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {/* You're in a call */}
        {isInCall ? (
          <div className="flex items-center gap-2">
            <button onClick={togglePanel}
              className="flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-3 py-1.5 hover:bg-green-100 transition-colors">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <Video className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">In Call</span>
            </button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={endCall} title="End call">
              <PhoneOff className="h-4 w-4" />
            </Button>
          </div>
        ) : activeWorkOrderId && isPanelOpen ? (
          <button onClick={togglePanel}
            className="flex items-center gap-2 rounded-full bg-slate-100 border border-slate-200 px-3 py-1.5 hover:bg-slate-200 transition-colors">
            <Video className="h-4 w-4 text-slate-600" />
            <span className="text-sm text-slate-600">Hide Call</span>
          </button>
        ) : null}

        {/* Remote call in progress (someone else is in a call on the work order you're viewing) */}
        {showRemoteCall && (
          <button
            onClick={() => startCall(remoteCallWorkOrderId!, remoteCallWorkOrderTitle || 'Work Order')}
            className="flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-3 py-1.5 hover:bg-green-100 transition-colors"
          >
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <PhoneCall className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">Call in progress</span>
            <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
              <Users className="h-3 w-3 mr-0.5" /> {remoteCallCount}
            </Badge>
          </button>
        )}

        {/* Notifications */}
        <Dialog open={notifOpen} onOpenChange={setNotifOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Open notifications">
              <Bell className="h-5 w-5" />
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {notifCount}
                </span>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Notifications</DialogTitle>
              <DialogDescription>
                Activity updates for your assigned work.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[60vh] overflow-y-auto pr-1">
              {loadingNotifications ? (
                <p className="text-sm text-muted-foreground">Loading notifications...</p>
              ) : notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notifications yet.</p>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`rounded-md border p-3 ${notification.isRead ? 'bg-white' : 'bg-blue-50/70 border-blue-200'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{notification.title}</p>
                          <p className="text-sm text-muted-foreground">{notification.message}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markReadMutation.mutate(notification.id)}
                            disabled={markReadMutation.isPending}
                          >
                            Mark read
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {unreadNotifications.length > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => unreadNotifications.forEach((n) => markReadMutation.mutate(n.id))}
                  disabled={markReadMutation.isPending}
                >
                  <CheckCheck className="h-4 w-4" />
                  Mark all read
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* User info */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ocean text-white text-sm font-semibold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={() => logoutMutation.mutate()}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
