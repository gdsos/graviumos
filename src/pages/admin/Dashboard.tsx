import { useState, useEffect } from 'react';
import { supabase, formatINR } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
import { ArrowRight, TrendingUp, Settings, Calculator } from 'lucide-react';

interface KPIData {
  totalLeads: number;
  convertedLeads: number;
  activeProjects: number;
  totalRevenue: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export default function Dashboard() {
  const [kpi, setKpi] = useState<KPIData>({ totalLeads: 0, convertedLeads: 0, activeProjects: 0, totalRevenue: 0 });
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [leadFunnel, setLeadFunnel] = useState<{ name: string; value: number; fill: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();

  useEffect(() => {
    const fetch = async () => {
      const [leadsRes, projectsRes] = await Promise.all([
        supabase.from('leads').select('status, created_at'),
        supabase.from('projects').select('status, revenue, created_at'),
      ]);

      const leads = leadsRes.data || [];
      const projects = projectsRes.data || [];

      const totalRevenue = projects.reduce((s: number, p: { revenue: number }) => s + (p.revenue || 0), 0);

      setKpi({
        totalLeads: leads.length,
        convertedLeads: leads.filter((l: { status: string }) => l.status === 'Converted').length,
        activeProjects: projects.filter((p: { status: string }) => p.status === 'Active').length,
        totalRevenue,
      });

      // Monthly revenue (last 6 months)
      const months: MonthlyRevenue[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStr = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        const monthProjects = projects.filter((p: { created_at: string }) => {
          const pd = new Date(p.created_at);
          return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
        });
        months.push({ month: monthStr, revenue: monthProjects.reduce((s: number, p: { revenue: number }) => s + (p.revenue || 0), 0) });
      }
      setMonthlyRevenue(months);

      // Lead funnel
      const statuses = ['Open', 'Qualified', 'Converted', 'Rejected', 'Ghosted'];
      const colors = [
        '#3B82F6', // Open - Blue
        '#6B7280', // Qualified - Gray
        '#10B981', // Converted - Green
        '#EF4444', // Rejected - Red
        '#F59E0B', // Ghosted - Amber
      ];
      setLeadFunnel(statuses.map((s, i) => ({
        name: s,
        value: leads.filter((l: { status: string }) => l.status === s).length,
        fill: colors[i],
      })));

      setLoading(false);
    };

    fetch();
  }, []);

  const chartColor = theme === 'dark' ? '#F5F5F5' : '#2F2F2F';
  const textColor = theme === 'dark' ? '#D7D7D7' : '#4B4B4B';
  const gridColor = theme === 'dark' ? '#2F2F2F' : '#E4E4E4';

  const kpiCards = [
    { label: 'Total Leads', value: kpi.totalLeads.toString(), icon: ArrowRight, color: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
    { label: 'Conversion Rate', value: kpi.totalLeads > 0 ? `${Math.round((kpi.convertedLeads / kpi.totalLeads) * 100)}%` : '0%', icon: TrendingUp, color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
    { label: 'Active Projects', value: kpi.activeProjects.toString(), icon: Settings, color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
    { label: 'Total Revenue', value: formatINR(kpi.totalRevenue), icon: Calculator, color: 'bg-muted text-foreground' },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-32 sm:px-6 lg:px-8 lg:pb-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
        <span className="text-sm text-muted-foreground">A quick operational view of leads, projects, and revenue movement.</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpiCards.map(card => {
          const IconComponent = card.icon;

          return (
            <div
              key={card.label}
              className="bg-card rounded-xl border border-border p-4 sm:p-5 flex items-start gap-3 min-w-0 overflow-hidden"
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${card.color}`}
              >
                <IconComponent size={20} className="text-current" />
              </div>

              <div className="min-w-0 flex-1">
                <span className="text-[11px] sm:text-xs text-muted-foreground uppercase tracking-wide block truncate">
                  {card.label}
                </span>

                <h3 className="text-lg sm:text-xl font-bold mt-1 break-words leading-tight">
                  {loading ? '—' : card.value}
                </h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly Revenue */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-lg font-bold mb-4">Monthly Revenue</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyRevenue} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="month" tick={{ fill: textColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: textColor, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: unknown) => [formatINR(v as number), 'Revenue']}
                contentStyle={{ background: theme === 'dark' ? '#212225' : '#fff', border: '1px solid #D8D8DB', borderRadius: '8px' }}
              />
              <Bar dataKey="revenue" fill={chartColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Lead Funnel */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-lg font-bold mb-4">Lead Funnel</h3>
          {loading ? (
            <div className="h-52 flex items-center justify-center">
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {leadFunnel.map(item => (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="w-24 text-right">
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                  </div>
                  <div className="flex-1 bg-muted/60 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                      style={{
                        width: `${Math.max((item.value / Math.max(kpi.totalLeads, 1)) * 100, item.value > 0 ? 10 : 0)}%`,
                        background: item.fill,
                      }}
                    >
                      {item.value > 0 && (
                        <span className="text-white text-xs font-bold">{item.value}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
