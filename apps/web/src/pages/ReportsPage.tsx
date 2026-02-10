import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
        <p className="text-muted-foreground">Generate and download compliance reports</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[
          { title: 'Inspection Report', desc: 'Detailed inspection findings with photos and measurements', icon: FileText },
          { title: 'Work Order Report', desc: 'Complete work order lifecycle with all submissions', icon: FileText },
          { title: 'BFMP', desc: 'IMO-compliant Biofouling Management Plan', icon: FileText },
          { title: 'Compliance Summary', desc: 'Fleet-wide compliance status overview', icon: FileText },
          { title: 'Audit Report', desc: 'Filtered audit trail export', icon: FileText },
        ].map((report) => {
          const ReportIcon = report.icon;
          return (
          <Card key={report.title}>
            <CardHeader>
              <ReportIcon className="h-8 w-8 text-ocean mb-2" />
              <CardTitle className="text-lg">{report.title}</CardTitle>
              <CardDescription>{report.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" /> Generate
              </Button>
            </CardContent>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
