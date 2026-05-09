
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
  const [lastSeenAnnouncement, setLastSeenAnnouncement] =
  useState<string | null>(
    localStorage.getItem("lastSeenAnnouncement")
  );

  const unreadAnnouncements = announcements.filter(a => {
    if (!lastSeenAnnouncement) return true;

    return (
      new Date(a.created_at).getTime() >
      new Date(lastSeenAnnouncement).getTime()
    );
  }).length;
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

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10);

      setNotifications(data || []);
    };

    const fetchAnnouncements = async () => {
      let query = supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      // Company-wide + user's departments
      if (profile.department_ids?.length) {
        query = query.or(
          `target_type.eq.company,target_department_id.in.(${profile.department_ids.join(",")})`
        );
      } else {
        query = query.eq("target_type", "company");
      }

      const { data } = await query;

      setAnnouncements(data || []);
    };

    const fetchAll = async () => {
      await Promise.all([
        fetchNotifications(),
        fetchAnnouncements(),
      ]);
    };

    fetchAll();

    // Notifications realtime
    const notificationsChannel = supabase
      .channel(`notifications-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        payload => {
          if (payload.eventType === "INSERT") {
            setNotifications(prev => [
              payload.new as any,
              ...prev,
            ].slice(0, 10));
          }

          if (payload.eventType === "UPDATE") {
            setNotifications(prev =>
              prev.map(n =>
                n.id === payload.new.id
                  ? payload.new
                  : n
              )
            );
          }

          if (payload.eventType === "DELETE") {
            setNotifications(prev =>
              prev.filter(n => n.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    // Announcements realtime
    const announcementsChannel = supabase
      .channel(`announcements-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "announcements",
        },
        payload => {
          // INSERT
          if (payload.eventType === "INSERT") {
            const newAnnouncement = payload.new as any;

            const userDeptIds = profile.department_ids || [];

            const canView =
              newAnnouncement.target_type === "company" ||
              (
                newAnnouncement.target_department_id &&
                userDeptIds.includes(
                  newAnnouncement.target_department_id
                )
              );

            if (canView) {
              setAnnouncements(prev => [
                newAnnouncement,
                ...prev,
              ].slice(0, 5));
            }
          }

          // DELETE
          if (payload.eventType === "DELETE") {
            setAnnouncements(prev =>
              prev.filter(
                a => a.id !== payload.old.id
              )
            );
          }

          // UPDATE
          if (payload.eventType === "UPDATE") {
            setAnnouncements(prev =>
              prev.map(a =>
                a.id === payload.new.id
                  ? payload.new
                  : a
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(announcementsChannel);
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
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => {
                const now = new Date().toISOString();

                localStorage.setItem(
                  "lastSeenAnnouncement",
                  now
                );

                setLastSeenAnnouncement(now);
              }}
            >
              <Megaphone size={18} />

              {unreadAnnouncements > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full">
                  {unreadAnnouncements}
                </span>
              )}
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
                    onClick={async () => {

                      // mark notification as read
                      if (!n.is_read) {
                        await supabase
                          .from("notifications")
                          .update({ is_read: true })
                          .eq("id", n.id);

                        setNotifications(prev =>
                          prev.map(notif =>
                            notif.id === n.id
                              ? { ...notif, is_read: true }
                              : notif
                          )
                        );
                      }

                      // navigate to linked page
                      if (n.link) {
                        navigate(n.link, { replace: false });
                      }
                    }}
                    className={`p-2 rounded-md text-sm cursor-pointer hover:bg-muted/80 transition-colors ${n.is_read ? "opacity-60" : "bg-muted"
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
