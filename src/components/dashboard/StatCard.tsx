import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, color = 'text-primary-blue' }) => {
  return (
    <div className="premium-card premium-card-hover ornate-corner relative overflow-hidden rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={`icon-medallion h-10 w-10 shrink-0 ${color}`}>
          <Icon size={20} />
        </div>
        <div>
          <div className="text-2xl font-semibold text-text-primary">{value}</div>
          <div className="text-sm text-muted-text">{label}</div>
        </div>
      </div>
    </div>
  );
};
