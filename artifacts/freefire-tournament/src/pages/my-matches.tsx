import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Swords, Calendar, Users, IndianRupee, Lock, Unlock, Trophy, Target, Clock } from "lucide-react";
import { format, isPast } from "date-fns";
import { customFetch } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

type MatchEntry = {
  id: number;
  tournamentId: number;
  paymentStatus: string;
  registeredAt: string;
  teamMembers: Array<{ uid: string; name: string }> | null;
  minutesUntilStart: number | null;
  tournament: {
    id: number;
    title: string;
    status: string;
    startDateTime: string;
    mapName: string;
    gameMode: string;
    prizePool: number;
    roomId: string | null;
    roomPassword: string | null;
    bannerUrl: string | null;
  } | null;
  leaderboardEntry: {
    rank: number;
    kills: number;
    points: number;
    prizeWon: number;
  } | null;
};

function useMyMatches(enabled: boolean) {
  return useQuery({
    queryKey: ["my-matches"],
    queryFn: () => customFetch<{ matches: MatchEntry[] }>("/api/my-matches", { method: "GET" }),
    enabled,
  });
}

export default function MyMatches() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { data, isLoading: matchesLoading } = useMyMatches(isAuthenticated);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) setLocation("/login");
  }, [isLoading, isAuthenticated]);

  if (!isLoading && !isAuthenticated) return null;

  const upcoming = data?.matches?.filter(m => m.tournament?.status !== "completed") ?? [];
  const recent = data?.matches?.filter(m => m.tournament?.status === "completed") ?? [];

  const statusColor: Record<string, string> = {
    upcoming: "bg-primary/10 text-primary border-primary/30",
    ongoing: "bg-secondary/10 text-secondary border-secondary/30",
    completed: "bg-muted text-muted-foreground border-border",
  };

  const paymentColor: Record<string, string> = {
    verified: "text-secondary",
    free: "text-secondary",
    pending: "text-yellow-500",
    rejected: "text-destructive",
  };

  return (
    <div className="space-y-10 pb-12 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 border-b border-primary/20 pb-4">
        <Swords className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-black uppercase font-display tracking-wider text-primary">My Matches</h1>
          <p className="text-sm font-mono text-muted-foreground">Your tournament history and upcoming rooms</p>
        </div>
      </div>

      {/* Upcoming Matches */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-display uppercase tracking-wider flex items-center gap-2 text-foreground">
          <Clock className="h-5 w-5 text-primary" /> Upcoming & Ongoing
        </h2>

        {matchesLoading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-32 bg-card border border-border rounded-xl animate-pulse" />)}</div>
        ) : !upcoming.length ? (
          <Card className="border-dashed border-primary/30 bg-card/30">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Swords className="h-10 w-10 text-muted-foreground opacity-30 mb-3" />
              <p className="font-mono text-muted-foreground">You haven't joined any upcoming tournaments.</p>
              <Link href="/tournaments" className="text-primary hover:underline font-mono text-sm mt-2">Browse Tournaments →</Link>
            </CardContent>
          </Card>
        ) : (
          upcoming.map(m => {
            if (!m.tournament) return null;
            const t = m.tournament;
            const hasRoom = t.roomId && t.roomPassword;
            const minutesLeft = m.minutesUntilStart;
            const roomHidden = !hasRoom || (minutesLeft !== null && minutesLeft > 15);

            return (
              <Card key={m.id} className="bg-card/80 border-primary/20 hover:border-primary/50 transition-colors overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    {t.bannerUrl ? (
                      <img src={t.bannerUrl} alt={t.title} className="w-full sm:w-40 h-32 sm:h-auto object-cover shrink-0" />
                    ) : (
                      <div className="w-full sm:w-40 h-32 sm:h-auto bg-gradient-to-br from-primary/10 to-card flex items-center justify-center shrink-0 border-r border-border/30">
                        <Swords className="h-8 w-8 text-primary/30" />
                      </div>
                    )}
                    <div className="p-5 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                        <h3 className="text-lg font-bold font-display uppercase tracking-wider">{t.title}</h3>
                        <div className="flex gap-2 flex-wrap">
                          <span className={`text-xs font-mono px-2 py-0.5 border rounded ${statusColor[t.status] || ""}`}>{t.status.toUpperCase()}</span>
                          <span className={`text-xs font-mono ${paymentColor[m.paymentStatus] || "text-muted-foreground"}`}>
                            Payment: {m.paymentStatus.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 text-xs font-mono text-muted-foreground">
                        <div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(t.startDateTime), "MMM d, h:mm a")}</div>
                        <div className="flex items-center gap-1"><Users className="h-3 w-3" />{t.gameMode.toUpperCase()} · {t.mapName}</div>
                        <div className="flex items-center gap-1"><IndianRupee className="h-3 w-3" />₹{t.prizePool} Prize</div>
                      </div>

                      {/* Team members */}
                      {m.teamMembers && m.teamMembers.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {m.teamMembers.map((mem, i) => (
                            <span key={i} className="text-xs font-mono bg-background/50 border border-border/50 px-2 py-1 rounded">
                              {mem.name} <span className="text-muted-foreground">({mem.uid})</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Room Details */}
                      {(m.paymentStatus === "verified" || m.paymentStatus === "free") && (
                        <div className={`rounded border p-3 font-mono text-sm ${roomHidden ? "border-border/30 bg-background/30" : "border-secondary/30 bg-secondary/5 neon-border-green"}`}>
                          {roomHidden ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Lock className="h-4 w-4" />
                              <span className="text-xs">
                                {!hasRoom ? "Room details not posted yet" : `Room unlocks ${minutesLeft !== null ? `in ${Math.ceil(minutesLeft)} min` : "soon"}`}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-4">
                              <Unlock className="h-4 w-4 text-secondary" />
                              <div>
                                <span className="text-muted-foreground">Room ID: </span>
                                <span className="text-foreground font-bold tracking-widest">{t.roomId}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Password: </span>
                                <span className="text-foreground font-bold tracking-widest">{t.roomPassword}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      {/* Recent Matches */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-display uppercase tracking-wider flex items-center gap-2 text-foreground">
          <Trophy className="h-5 w-5 text-secondary" /> Match History
        </h2>

        {matchesLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-card border border-border rounded-xl animate-pulse" />)}</div>
        ) : !recent.length ? (
          <Card className="border-dashed border-secondary/30 bg-card/30">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Trophy className="h-10 w-10 text-muted-foreground opacity-30 mb-3" />
              <p className="font-mono text-muted-foreground">No completed matches yet.</p>
            </CardContent>
          </Card>
        ) : (
          recent.map(m => {
            if (!m.tournament) return null;
            const t = m.tournament;
            const lb = m.leaderboardEntry;
            return (
              <Card key={m.id} className="bg-card/50 border-border/50 hover:border-secondary/30 transition-colors">
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <Link href={`/tournaments/${t.id}`} className="font-bold font-display uppercase tracking-wider hover:text-primary transition-colors">{t.title}</Link>
                    <div className="flex gap-4 mt-1 text-xs font-mono text-muted-foreground">
                      <span>{format(new Date(t.startDateTime), "MMM d, yyyy")}</span>
                      <span>{t.mapName} · {t.gameMode}</span>
                    </div>
                  </div>
                  {lb ? (
                    <div className="flex gap-6 text-center">
                      <div>
                        <div className="text-2xl font-bold font-display text-secondary">#{lb.rank}</div>
                        <div className="text-xs font-mono text-muted-foreground">Rank</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold font-display flex items-center gap-1"><Target className="h-4 w-4 text-primary" />{lb.kills}</div>
                        <div className="text-xs font-mono text-muted-foreground">Kills</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold font-display">{lb.points}</div>
                        <div className="text-xs font-mono text-muted-foreground">Points</div>
                      </div>
                      {lb.prizeWon > 0 && (
                        <div>
                          <div className="text-2xl font-bold font-display text-secondary">₹{lb.prizeWon}</div>
                          <div className="text-xs font-mono text-muted-foreground">Won</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-muted-foreground px-3 py-1 border border-border rounded">Results Pending</span>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
