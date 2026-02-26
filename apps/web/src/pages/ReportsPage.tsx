import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { workOrdersApi } from '@/api/work-orders';
import { reportsApi } from '@/api/reports';

type ReportKind = 'inspection' | 'work-order' | 'bfmp' | 'compliance' | 'audit';

const REPORT_CONFIG: Array<{
  id: ReportKind;
  title: string;
  desc: string;
  icon: typeof FileText;
  needsWorkOrder: boolean;
}> = [
  { id: 'inspection', title: 'Inspection Report', desc: 'Detailed inspection findings with photos and measurements', icon: FileText, needsWorkOrder: true },
  { id: 'work-order', title: 'Work Order Report', desc: 'Complete work order lifecycle with all submissions', icon: FileText, needsWorkOrder: true },
  { id: 'bfmp', title: 'BFMP', desc: 'IMO-compliant Biofouling Management Plan', icon: FileText, needsWorkOrder: false },
  { id: 'compliance', title: 'Compliance Summary', desc: 'Fleet-wide compliance status overview', icon: FileText, needsWorkOrder: false },
  { id: 'audit', title: 'Audit Report', desc: 'Filtered audit trail export', icon: FileText, needsWorkOrder: false },
];

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportKind | null>(null);
  const [workOrderId, setWorkOrderId] = useState('');
  const [showComingSoon, setShowComingSoon] = useState(false);

  const { data: workOrdersRes, isLoading: loadingWorkOrders } = useQuery({
    queryKey: ['workOrders', { limit: '100' }],
    queryFn: () => workOrdersApi.list({ limit: '100' }),
    enabled: reportType === 'inspection' || reportType === 'work-order',
  });
  const workOrders = workOrdersRes?.data?.data ?? [];

  const generateMutation = useMutation({
    mutationFn: ({ type, workOrderId }: { type: 'inspection' | 'work-order'; workOrderId: string }) =>
      reportsApi.generate(type, workOrderId),
  });

  const handleGenerateClick = (report: (typeof REPORT_CONFIG)[0]) => {
    if (report.needsWorkOrder) {
      setWorkOrderId('');
      setReportType(report.id as 'inspection' | 'work-order');
      return;
    }
    setShowComingSoon(true);
  };

  const handleConfirmGenerate = () => {
    if (reportType !== 'inspection' && reportType !== 'work-order') return;
    if (!workOrderId) return;

    if (reportType === 'inspection') {
      const url = reportsApi.getPreviewUrl(workOrderId);
      window.open(url, '_blank', 'noopener,noreferrer');
      setReportType(null);
      return;
    }

    generateMutation.mutate(
      { type: 'work-order', workOrderId },
      {
        onSuccess: (res) => {
          const payload = res?.data?.data;
          if (payload) {
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const u = URL.createObjectURL(blob);
            window.open(u, '_blank');
            setTimeout(() => URL.revokeObjectURL(u), 1000);
          }
          setReportType(null);
        },
      }
    );
  };

  const needsWorkOrder = reportType === 'inspection' || reportType === 'work-order';
  const canConfirm = workOrderId && needsWorkOrder;
  const isGenerating = generateMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
        <p className="text-muted-foreground">Generate and download compliance reports</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {REPORT_CONFIG.map((report) => {
          const ReportIcon = report.icon;
          return (
            <Card key={report.id}>
              <CardHeader>
                <ReportIcon className="h-8 w-8 text-ocean mb-2" />
                <CardTitle className="text-lg">{report.title}</CardTitle>
                <CardDescription>{report.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleGenerateClick(report)}
                >
                  <Download className="mr-2 h-4 w-4" /> Generate
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Work order selection for Inspection / Work Order reports */}
      <Dialog open={needsWorkOrder} onOpenChange={(open) => !open && setReportType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reportType === 'inspection' ? 'Inspection Report' : 'Work Order Report'}
            </DialogTitle>
            <DialogDescription>
              Select a work order to generate the report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Work order</Label>
              <Select
                value={workOrderId}
                onValueChange={setWorkOrderId}
                disabled={loadingWorkOrders}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingWorkOrders ? 'Loading…' : 'Select work order'} />
                </SelectTrigger>
                <SelectContent>
                  {workOrders.map((wo: any) => (
                    <SelectItem key={wo.id} value={wo.id}>
                      {wo.referenceNumber} – {wo.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportType(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmGenerate} disabled={!canConfirm || isGenerating}>
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {reportType === 'inspection' ? 'Open report' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coming soon for BFMP, Compliance, Audit */}
      <Dialog open={showComingSoon} onOpenChange={setShowComingSoon}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Coming soon</DialogTitle>
            <DialogDescription>
              This report type is not yet available. Inspection Report and Work Order Report can be generated now.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowComingSoon(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
