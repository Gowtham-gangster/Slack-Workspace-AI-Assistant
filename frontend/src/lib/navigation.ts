import {
  LayoutDashboard,
  FileText,
  Settings as SettingsIcon,
  Brain,
  Clock,
  CheckSquare,
  Network,
  BookOpen,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  desc: string;
  mobileLabel?: string;
}

export const menuItems: NavItem[] = [
  { name: 'Workspace', path: '/dashboard', icon: LayoutDashboard, desc: 'Chat & channels', mobileLabel: 'Workspace' },
  { name: 'Intelligence', path: '/intelligence', icon: Brain, desc: 'AI Insights', mobileLabel: 'Insights' },
  { name: 'Action Center', path: '/actions', icon: CheckSquare, desc: 'Task manager', mobileLabel: 'Actions' },
  { name: 'Timeline', path: '/timeline', icon: Clock, desc: 'Activity feed', mobileLabel: 'Timeline' },
  { name: 'Knowledge', path: '/knowledge', icon: Network, desc: 'Semantic search', mobileLabel: 'Knowledge' },
  { name: 'Memory', path: '/memory', icon: BookOpen, desc: 'Persistent graph', mobileLabel: 'Memory' },
  { name: 'Reports', path: '/reports', icon: FileText, desc: 'Analytics', mobileLabel: 'Reports' },
  { name: 'Settings', path: '/settings', icon: SettingsIcon, desc: 'Preferences', mobileLabel: 'Settings' },
  { name: 'Support', path: '/support', icon: HelpCircle, desc: 'Contact & help', mobileLabel: 'Support' },
];
