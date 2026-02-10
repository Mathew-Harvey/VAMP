import { Bell, LogOut, User, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useLogout } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';

export default function Header() {
  const { user, organisation } = useAuthStore();
  const logoutMutation = useLogout();

  const { data: notifCount } = useQuery({
    queryKey: ['notificationCount'],
    queryFn: () => apiClient.get('/notifications/count').then((r) => r.data.data.count),
    refetchInterval: 30000,
  });

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">
          {organisation?.name || 'MarineStream'}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notifCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {notifCount}
            </span>
          )}
        </Button>

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
