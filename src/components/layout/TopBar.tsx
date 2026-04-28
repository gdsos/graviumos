import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabase";
import { Bell, Sun, Moon, Megaphone } from "lucide-react";

export default function TopBar() {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

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
  }, [profile]);

  return (
    <header className="h-15 border-b bg-background flex items-center justify-end px-6 ">
      
      <div className="flex items-center gap-3">
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
                  className={`p-2 rounded-md text-sm ${
                    n.is_read ? "opacity-60" : "bg-muted"
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
        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
          {profile?.full_name?.charAt(0) || "U"}
        </div>

      </div>
    </header>
  );
}