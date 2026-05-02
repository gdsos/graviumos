
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Avatar,
  AvatarImage,
  AvatarFallback
} from "../../components/ui/avatar";
import { useAuth } from "../../contexts/AuthContext";
import { hasPermission } from "@/auth/permissions";
import { useTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabase";
import { Bell, Sun, Moon, Megaphone, LogOut, User, Settings } from "lucide-react";

interface TopBarProps {
  onMenuToggle: () => void;
}

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const isAdmin = hasPermission(profile?.role, "settings.view");
  const accountRoute = isAdmin
    ? "/admin/settings"
    : "/portal/profile";
  
  const accountLabel = isAdmin
    ? "Settings"
    : "Account Settings";
    
  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
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
      .channel("topbar-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const markAllRead = async () => {
    if (!profile) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", profile.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return (
    <header className="h-15 border-b bg-background flex items-center px-4 sm:px-6">
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
            <div className="px-4 py-2 border-b flex items-center justify-between">
              <div className="text-sm font-semibold">Notifications</div>
              <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground">
                Mark all read
              </button>
            </div>
            {notifications.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2">
                No notifications
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`p-2 rounded-md text-sm ${n.is_read ? "opacity-60" : "bg-muted"}`}
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
                <AvatarImage src={profile?.profile_picture_url || ""} />
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
                <AvatarImage src={profile?.profile_picture_url || ""} />
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
            <DropdownMenuItem
              onClick={() => navigate(accountRoute)}
              className="cursor-pointer flex items-center gap-2"
            >
              {isAdmin ? (
                <Settings size={16} />
              ) : (
                <User size={16} />
              )}

              {accountLabel}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={signOut}
              className="text-red-600 cursor-pointer flex items-center gap-2"
            >
              <LogOut size={16} />
              Sign Out
            </DropdownMenuItem>

          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </header>
  );
}
