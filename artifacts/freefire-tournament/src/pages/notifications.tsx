import { useGetNotifications, getGetNotificationsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, Trophy, Zap, Info, ArrowRight } from "lucide-react";

export default function Notifications() {
  const { data: notifications, isLoading } = useGetNotifications(
    { limit: 50 },
    { query: { queryKey: getGetNotificationsQueryKey({ limit: 50 }) } }
  );

  const getIconForType = (type: string) => {
    switch(type) {
      case 'tournament_created': return <Trophy className="h-5 w-5 text-primary" />;
      case 'winner_announced': return <Trophy className="h-5 w-5 text-secondary" />;
      case 'room_posted': return <Zap className="h-5 w-5 text-yellow-500" />;
      default: return <Info className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getBorderColor = (type: string) => {
    switch(type) {
      case 'tournament_created': return 'border-l-primary';
      case 'winner_announced': return 'border-l-secondary';
      case 'room_posted': return 'border-l-yellow-500';
      default: return 'border-l-muted-foreground';
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Bell className="h-8 w-8 text-primary neon-text" />
        <h1 className="text-3xl font-black uppercase font-display tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-primary to-white drop-shadow-[0_0_8px_rgba(0,245,255,0.4)]">
          Notifications
        </h1>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 w-full bg-card rounded border border-border animate-pulse" />
          ))}
        </div>
      ) : notifications?.length === 0 ? (
        <Card className="bg-card/50 backdrop-blur border-dashed border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bell className="h-12 w-12 text-muted-foreground mb-4 opacity-30" />
            <p className="text-muted-foreground font-mono uppercase tracking-widest">No recent notifications.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications?.map((notif) => (
            <Card key={notif.id} className={`bg-card/60 backdrop-blur border-border/50 border-l-4 ${getBorderColor(notif.type)} overflow-hidden group`}>
              <CardContent className="p-4 flex gap-4 sm:items-center">
                <div className="shrink-0 mt-1 sm:mt-0 bg-background/80 p-2 rounded-full border border-border/50">
                  {getIconForType(notif.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-display font-bold uppercase tracking-wider text-white">
                      {notif.title}
                    </h4>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0 whitespace-nowrap">
                      {format(new Date(notif.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="text-sm font-mono text-muted-foreground">{notif.message}</p>
                </div>
                
                {notif.tournamentId && (
                  <div className="hidden sm:flex shrink-0">
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity group-hover:translate-x-1" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
