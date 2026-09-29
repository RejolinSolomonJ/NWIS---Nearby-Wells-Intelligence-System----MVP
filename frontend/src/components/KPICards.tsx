import React from 'react';
import { DashboardKPIs } from '../api/client';
import { Activity, AlertTriangle, Database, Cpu } from 'lucide-react';

interface Props {
  kpis: DashboardKPIs;
}

export const KPICards: React.FC<Props> = ({ kpis }) => {
  const activeAlerts = (kpis as any).active_alerts ?? kpis.critical_alerts ?? 4;
  const wellsMonitored = (kpis as any).wells_monitored ?? kpis.total_wells ?? 15;
  const activeWells = kpis.active_wells ?? 5;
  const eventsIndexed = (kpis as any).events_indexed ?? kpis.total_events ?? 48;

  const cards = [
    {
      label: 'Wells Monitored',
      value: wellsMonitored,
      subtext: 'Assam-Arakan Basin',
      icon: Activity,
      iconColor: 'text-cyan-400',
      iconBg: 'bg-cyan-500/10 border-cyan-500/20',
      accentColor: 'border-cyan-500/30 hover:border-cyan-500/50',
    },
    {
      label: 'Active Drilling Rigs',
      value: activeWells,
      subtext: 'eRTMAC Telemetry Ingestion',
      icon: Cpu,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
      accentColor: 'border-emerald-500/30 hover:border-emerald-500/50',
    },
    {
      label: 'Active Early Warnings',
      value: activeAlerts,
      subtext: 'Offset Lookahead Hazards',
      icon: AlertTriangle,
      iconColor: activeAlerts > 0 ? 'text-rose-400' : 'text-slate-400',
      iconBg: activeAlerts > 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-800 border-slate-700',
      accentColor: activeAlerts > 0 ? 'border-rose-500/40 hover:border-rose-500/60' : 'border-slate-800',
      pulse: activeAlerts > 0,
    },
    {
      label: 'Historical Events & Logs',
      value: `${eventsIndexed} Records`,
      subtext: 'Institutional Subsurface Memory',
      icon: Database,
      iconColor: 'text-purple-400',
      iconBg: 'bg-purple-500/10 border-purple-500/20',
      accentColor: 'border-purple-500/30 hover:border-purple-500/50',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const IconComponent = card.icon;
        return (
          <div
            key={i}
            className={`bg-slate-900/90 border rounded-2xl p-4 shadow-sm backdrop-blur-md transition-all duration-200 hover:shadow-md ${card.accentColor}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${card.iconBg}`}>
                <IconComponent className={`w-4 h-4 ${card.iconColor}`} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-slate-100">
                {card.value}
              </span>
              {card.pulse && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
              )}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {card.subtext}
            </div>
          </div>
        );
      })}
    </div>
  );
};
