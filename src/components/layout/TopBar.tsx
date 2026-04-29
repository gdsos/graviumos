import { useState, useEffect } from 'react';
import { PIcon, PText } from '@porsche-design-system/components-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase, type Notification, type Announcement } from '../../lib/supabase';

interface TopBarProps {
  onMenuToggle: () => void;
  isAdmin: boolean;
}

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showAnnouncPanel, setShowAnnouncPanel] = useState(false);

  const unreadCount = notifications.filter(n => !n.is_read && n.type !== 'announcement').length;

  const displayNotifications = notifications.filter(n => n.type !== 'announcement');

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setNotifications((notifs as Notification[]) || []);

      const { data: anncs } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      setAnnouncements((anncs as Announcement[]) || []);
    };

    fetchData();

    const channel = supabase
      .channel('topbar-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return (
    <header className="h-16 bg-surface border-b border-contrast-low flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button onClick={onMenuToggle} className="text-contrast-medium hover:text-primary transition-colors lg:hidden">
          <PIcon name="menu-lines" size="small" />
        </button>
      </div>

      {/* Latest announcement ticker */}
      {announcements.length > 0 && (
        <div className="hidden md:flex items-center gap-2 flex-1 mx-8 max-w-md overflow-hidden">
          <PIcon name="broadcast" size="x-small" color="contrast-medium" />
          <PText size="x-small" color="contrast-medium" className="truncate">
            {announcements[0].title}
          </PText>
        </div>
      )}

      <div className="flex items-center gap-2 ml-auto">
        {/* Announcements */}
        <div className="relative">
          <button
            onClick={() => { setShowAnnouncPanel(!showAnnouncPanel); setShowNotifPanel(false); }}
            className="p-2 rounded-lg text-contrast-medium hover:text-primary hover:bg-contrast-low/50 transition-colors"
          >
            <PIcon name="broadcast" size="small" />
          </button>
          {showAnnouncPanel && (
            <div className="absolute right-0 top-12 w-80 bg-surface border border-contrast-low rounded-xl shadow-high z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-contrast-low flex items-center justify-between">
                <PText size="small" weight="semi-bold">Announcements</PText>
                <button onClick={() => setShowAnnouncPanel(false)}>
                  <PIcon name="close" size="x-small" />
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {announcements.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <PText size="small" color="contrast-medium">No announcements</PText>
                  </div>
                ) : announcements.map(a => (
                  <div key={a.id} className="px-4 py-3 border-b border-contrast-low last:border-0 hover:bg-canvas transition-colors">
                    <PText size="x-small" weight="semi-bold">{a.title}</PText>
                    <PText size="xx-small" color="contrast-medium" className="mt-1 line-clamp-2">{a.content}</PText>
                    <PText size="xx-small" color="contrast-low" className="mt-1">
                      {new Date(a.created_at).toLocaleDateString('en-IN')}
                    </PText>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifPanel(!showNotifPanel); setShowAnnouncPanel(false); }}
            className="p-2 rounded-lg text-contrast-medium hover:text-primary hover:bg-contrast-low/50 transition-colors relative"
          >
            <PIcon name="bell" size="small" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-error rounded-full flex items-center justify-center text-canvas text-xs font-bold" style={{ fontSize: '9px' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifPanel && (
            <div className="absolute right-0 top-12 w-80 bg-surface border border-contrast-low rounded-xl shadow-high z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-contrast-low flex items-center justify-between">
                <PText size="small" weight="semi-bold">Notifications</PText>
                <button onClick={markAllRead} className="text-xs text-contrast-medium hover:text-primary">
                  Mark all read
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {displayNotifications.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <PText size="small" color="contrast-medium">No notifications</PText>
                  </div>
                ) : displayNotifications.map(n => (
                  <div key={n.id} className={`px-4 py-3 border-b border-contrast-low last:border-0 transition-colors ${n.is_read ? 'opacity-60' : 'bg-info-soft/30'}`}>
                    <div className="flex items-start gap-2">
                      {!n.is_read && <span className="w-2 h-2 bg-info rounded-full mt-1.5 flex-shrink-0"></span>}
                      <div>
                        <PText size="x-small" weight="semi-bold">{n.title}</PText>
                        <PText size="xx-small" color="contrast-medium" className="mt-0.5">{n.message}</PText>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-contrast-medium hover:text-primary hover:bg-contrast-low/50 transition-colors"
        >
          <PIcon name={theme === 'dark' ? 'light' : 'moon'} size="small" />
        </button>

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-canvas text-xs font-bold flex-shrink-0">
          {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  );
}
