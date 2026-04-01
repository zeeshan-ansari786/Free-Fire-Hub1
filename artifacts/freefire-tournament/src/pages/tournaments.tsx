import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useGetTournaments, getGetTournamentsQueryKey, type GetTournamentsStatus } from "@workspace/api-client-react";
import { format, differenceInSeconds } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Swords, IndianRupee, Zap, Map, Users, Timer } from "lucide-react";
import { getDefaultBanner } from "@/lib/tournament-defaults";

function TournamentCountdown({ startDateTime }: { startDateTime: string }) {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    const compute = () => {
      const diff = differenceInSeconds(new Date(startDateTime), new Date());
      if (diff <= 0) return null;
      return { d: Math.floor(diff / 86400), h: Math.floor((diff % 86400) / 3600), m: Math.floor((diff % 3600) / 60), s: diff % 60 };
    };
    setTimeLeft(compute());
    const interval = setInterval(() => { setTimeLeft(compute()); }, 1000);
    return () => clearInterval(interval);
  }, [startDateTime]);

  if (!timeLeft) return (
    <span className="flex items-center gap-1 text-destructive font-bold">
      <Timer className="h-3 w-3" /> Starting Now!
    </span>
  );

  if (timeLeft.d > 0) return (
    <span className="flex items-center gap-1 text-primary font-mono font-bold">
      <Timer className="h-3 w-3" />
      {timeLeft.d}d {String(timeLeft.h).padStart(2,"0")}h {String(timeLeft.m).padStart(2,"0")}m
    </span>
  );

  return (
    <span className="flex items-center gap-1 font-mono font-bold text-yellow-400 animate-pulse">
      <Timer className="h-3 w-3" />
      {String(timeLeft.h).padStart(2,"0")}:{String(timeLeft.m).padStart(2,"0")}:{String(timeLeft.s).padStart(2,"0")}
    </span>
  );
}

export default function Tournaments() {
  const [statusFilter, setStatusFilter] = useState<GetTournamentsStatus | undefined>("upcoming");
  
  const { data, isLoading } = useGetTournaments(
    { status: statusFilter, limit: 20 },
    { query: { queryKey: getGetTournamentsQueryKey({ status: statusFilter, limit: 20 }) } }
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase font-display tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-primary to-white drop-shadow-[0_0_8px_rgba(0,245,255,0.4)]">
            Tournaments
          </h1>
          <p className="text-muted-foreground font-mono mt-2">Register, compete, and climb the ranks.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button 
            variant={statusFilter === "upcoming" ? "default" : "outline"}
            className={statusFilter === "upcoming" ? "bg-primary text-primary-foreground font-bold neon-border rounded-none clip-path-slant" : "border-primary/30 text-primary hover:bg-primary/10 rounded-none clip-path-slant"}
            onClick={() => setStatusFilter("upcoming")}
          >
            UPCOMING
          </Button>
          <Button 
            variant={statusFilter === "ongoing" ? "default" : "outline"}
            className={statusFilter === "ongoing" ? "bg-secondary text-secondary-foreground font-bold neon-border-green rounded-none clip-path-slant" : "border-secondary/30 text-secondary hover:bg-secondary/10 rounded-none clip-path-slant"}
            onClick={() => setStatusFilter("ongoing")}
          >
            ONGOING
          </Button>
          <Button 
            variant={statusFilter === "completed" ? "default" : "outline"}
            className={statusFilter === "completed" ? "bg-accent text-accent-foreground font-bold border border-accent-foreground/50 rounded-none clip-path-slant" : "border-muted text-muted-foreground hover:bg-accent/50 rounded-none clip-path-slant"}
            onClick={() => setStatusFilter("completed")}
          >
            COMPLETED
          </Button>
          <Button 
            variant={statusFilter === undefined ? "default" : "outline"}
            className={statusFilter === undefined ? "bg-white text-black font-bold rounded-none clip-path-slant" : "border-muted text-muted-foreground hover:bg-accent/50 rounded-none clip-path-slant"}
            onClick={() => setStatusFilter(undefined)}
          >
            ALL
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : !data?.tournaments?.length ? (
        <Card className="border-dashed border-primary/30 bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Swords className="h-16 w-16 text-muted-foreground mb-4 opacity-30" />
            <h3 className="text-xl font-bold font-display uppercase tracking-widest text-foreground">No tournaments found</h3>
            <p className="text-muted-foreground font-mono mt-2">Check back later or change your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data?.tournaments.map((t) => (
            <Link key={t.id} href={`/tournaments/${t.id}`}>
              <Card className={`group cursor-pointer transition-all duration-300 bg-card/80 backdrop-blur overflow-hidden flex flex-col sm:flex-row relative
                ${t.status === 'upcoming' ? 'hover:neon-border border-primary/20' : 
                  t.status === 'ongoing' ? 'hover:neon-border-green border-secondary/20' : 
                  'border-border/50 opacity-80 hover:opacity-100'}`}>
                
                <div className="absolute top-0 right-0 p-2 z-10 flex gap-2">
                  <div className={`px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider border rounded shadow-sm bg-background/90 backdrop-blur
                    ${t.status === 'upcoming' ? 'text-primary border-primary/30' : 
                      t.status === 'ongoing' ? 'text-secondary border-secondary/30' : 
                      'text-muted-foreground border-border'}`}>
                    {t.status}
                  </div>
                </div>

                <div className="w-full sm:w-48 h-48 sm:h-auto bg-muted relative shrink-0">
                  <img
                    src={t.bannerUrl || getDefaultBanner(t.gameMode)}
                    alt={t.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { (e.target as HTMLImageElement).src = getDefaultBanner("squad"); }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card hidden sm:block" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent sm:hidden" />
                </div>

                <CardContent className="p-5 flex-1 flex flex-col justify-between relative z-10">
                  <div>
                    <h3 className="text-xl font-bold font-display uppercase tracking-wider mb-2 group-hover:text-primary transition-colors line-clamp-2">{t.title}</h3>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground font-mono mb-3">
                      <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-primary" /> {format(new Date(t.startDateTime), "MMM do, h:mm a")}</span>
                      <span className="flex items-center gap-1"><Map className="h-3 w-3 text-secondary" /> {t.mapName}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3 text-white" /> {t.gameMode.toUpperCase()}</span>
                    </div>
                    {t.status === "upcoming" && (
                      <div className="flex items-center gap-2 mb-3 bg-primary/5 border border-primary/20 rounded px-3 py-1.5 w-fit text-xs">
                        <span className="text-muted-foreground font-mono uppercase tracking-wider">Starts in</span>
                        <TournamentCountdown startDateTime={t.startDateTime} />
                      </div>
                    )}
                    {t.status === "ongoing" && (
                      <div className="flex items-center gap-2 mb-3 bg-secondary/5 border border-secondary/20 rounded px-3 py-1.5 w-fit text-xs">
                        <span className="inline-block w-2 h-2 rounded-full bg-secondary animate-pulse" />
                        <span className="text-secondary font-mono font-bold uppercase tracking-wider">LIVE NOW</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">Prize / Fee</p>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-secondary font-bold flex items-center"><IndianRupee className="h-3 w-3" />{t.prizePool}</span>
                        <span className="text-muted-foreground text-xs">/</span>
                        <span className="text-primary font-bold flex items-center">{t.entryFee > 0 ? <><IndianRupee className="h-3 w-3" />{t.entryFee}</> : "FREE"}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col justify-end">
                      <div className="flex justify-between text-[10px] font-mono uppercase text-muted-foreground mb-1">
                        <span>Slots</span>
                        <span>{t.filledSlots}/{t.maxSlots}</span>
                      </div>
                      <div className="w-full bg-background h-1.5 rounded-full overflow-hidden border border-border/50">
                        <div 
                          className={`h-full ${t.filledSlots >= t.maxSlots ? 'bg-destructive shadow-[0_0_5px_rgba(255,0,0,0.8)]' : 'bg-primary shadow-[0_0_5px_rgba(0,245,255,0.8)]'}`}
                          style={{ width: `${(t.filledSlots / t.maxSlots) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
