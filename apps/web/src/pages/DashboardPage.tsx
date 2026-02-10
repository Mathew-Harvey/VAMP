import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Ship, ClipboardList, CheckCircle, AlertTriangle, Activity } from 'lucide-react';
import { formatRelative } from '@/utils/formatters';

export default function DashboardPage() {
  const { data: overview } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => apiClient.get('/dashboard/overview').then((r) => r.data.data),
  });

  const { data: activity } = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () => apiClient.get('/dashboard/recent-activity').then((r) => r.data.data),
  });

  const fleet = overview?.fleet;
  const wo = overview?.workOrders;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-muted-foreground">Fleet overview and recent activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Vessels</CardTitle>
            <Ship className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fleet?.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">managed in fleet</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Compliant</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{fleet?.compliant ?? 0}</div>
            <p className="text-xs text-muted-foreground">vessels compliant</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Work Orders</CardTitle>
            <ClipboardList className="h-4 w-4 text-ocean" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-ocean">{wo?.active ?? 0}</div>
            <p className="text-xs text-muted-foreground">in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Due for Inspection</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{fleet?.dueForInspection ?? 0}</div>
            <p className="text-xs text-muted-foreground">vessels need inspection</p>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Summary + Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fleet Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Compliant</span>
                <Badge variant="success">{fleet?.compliant ?? 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Non-Compliant</span>
                <Badge variant="destructive">{fleet?.nonCompliant ?? 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Due for Inspection</span>
                <Badge variant="warning">{fleet?.dueForInspection ?? 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Under Review</span>
                <Badge variant="info">{fleet?.underReview ?? 0}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {activity?.map((entry: any) => (
                <div key={entry.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-1 h-2 w-2 rounded-full bg-ocean shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700 truncate">{entry.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.actor?.firstName} {entry.actor?.lastName} &middot; {formatRelative(entry.createdAt)}
                    </p>
                  </div>
                </div>
              )) || <p className="text-sm text-muted-foreground">No recent activity</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
