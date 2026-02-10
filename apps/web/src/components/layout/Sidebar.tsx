import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Ship,
  ClipboardList,
  Search,
  FileText,
  Shield,
  Users,
  Settings,
  Bell,
  Anchor,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Vessels', href: '/vessels', icon: Ship },
  { name: 'Work Orders', href: '/work-orders', icon: ClipboardList },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Audit Log', href: '/audit', icon: Shield },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <div className="flex h-full w-64 flex-col bg-slate-900 text-white">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-slate-700">
        <Anchor className="h-8 w-8 text-ocean" />
        <span className="text-xl font-bold">MarineStream</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-ocean/20 text-ocean'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-700 p-4">
        <p className="text-xs text-slate-400">MarineStream v1.0</p>
        <p className="text-xs text-slate-500">Franmarine Underwater Services</p>
      </div>
    </div>
  );
}
