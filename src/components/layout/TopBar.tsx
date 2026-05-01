<<<<<<< HEAD
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
=======
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabase";
import { Bell, Sun, Moon, Megaphone, LogOut, User } from "lucide-react";

interface TopBarProps {
  onMenuToggle: () => void;
}

export default function TopBar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const isAdmin =
    profile?.role === "admin" ||
    profile?.role === "super_admin";
  const { theme, toggleTheme } = useTheme();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const accountRoute = isAdmin
    ? "/admin/settings"
    : "/portal/profile";
  const unreadCount = notifications.filter(n => !n.is_read).length;


  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
<<<<<<< HEAD
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
=======
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .neq("type", "announcement") // 👈 IMPORTANT
        .order("created_at", { ascending: false })
        .limit(10);

      setNotifications(data || []);

      const { data: ann } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      setAnnouncements(ann || []);

    };

    fetchData();

    const channel = supabase
      .channel('topbar-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

<<<<<<< HEAD
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
=======
  return (
    <header className="h-14 border-b bg-background flex items-center px-4 sm:px-6">
      <div className="lg:hidden">
        <button onClick={onMenuToggle}>
          <img src="/Logo-Icon.png" className="h-6" />
        </button>
      </div>

      {/* RIGHT: everything pushed */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Announcement */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Megaphone size={18} />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-80 p-2">
            {announcements.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2">
                No announcements
              </div>
            ) : (
              announcements.map(a => (
                <div key={a.id} className="p-2 rounded-md text-sm bg-muted">
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.content}
                  </div>
                </div>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full">
                  {unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-80 p-2">
            {notifications.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2">
                No notifications
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`p-2 rounded-md text-sm ${n.is_read ? "opacity-60" : "bg-muted"
                    }`}
                >
                  <div className="font-medium">{n.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {n.message}
                  </div>
                </div>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme */}
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </Button>

        {/* Avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="focus:outline-none">
              <Avatar className="w-8 h-8 cursor-pointer">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback>
                  {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64 p-2">

            {/* USER HEADER */}
            <div className="flex flex-col items-center gap-2 p-3 border-b">
              <Avatar className="w-12 h-12">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback>
                  {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>

              <div className="text-center">
                <div className="text-sm font-medium">
                  {profile?.full_name || "User"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {profile?.email}
                </div>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="p-1">
              <DropdownMenuItem
                onClick={() => navigate(accountRoute)}
                className="cursor-pointer flex items-center gap-2"
              >
                <User size={16} />
                Account
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={signOut}
                className="text-red-600 cursor-pointer flex items-center gap-2"
              >
                <LogOut size={16} />
                Sign Out
              </DropdownMenuItem>
            </div>

          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </header>
  );
}
