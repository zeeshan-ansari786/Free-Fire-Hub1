import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { getDefaultBanner } from "@/lib/tournament-defaults";
import { 
  useGetTournament, getGetTournamentQueryKey, 
  useRegisterForTournament, 
  useGetTournamentLeaderboard, getGetTournamentLeaderboardQueryKey
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { format, differenceInSeconds } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Swords, IndianRupee, Zap, Map, Users, Clock, ShieldAlert, Lock, Unlock, Medal, Target, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type TeamMember = { uid: string; name: string };

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const tournamentId = parseInt(id || "0", 10);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tournament, isLoading } = useGetTournament(
    tournamentId,
    { query: { enabled: !!tournamentId, queryKey: getGetTournamentQueryKey(tournamentId) } }
  );

  const { data: leaderboard, isLoading: isLoadingLeaderboard } = useGetTournamentLeaderboard(
    tournamentId,
    { query: { enabled: !!tournamentId && tournament?.status === "completed", queryKey: getGetTournamentLeaderboardQueryKey(tournamentId) } }
  );

  const { mutate: register, isPending: isRegistering } = useRegisterForTournament();

  const [paymentScreenshotUrl, setPaymentScreenshotUrl] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  // Dynamic team members for duo/squad
  const getDefaultMembers = (mode: string): TeamMember[] => {
    if (mode === "duo") return [{ uid: "", name: "" }];
    if (mode === "squad") return [{ uid: "", name: "" }, { uid: "", name: "" }, { uid: "", name: "" }];
    return [];
  };
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (tournament?.gameMode) setTeamMembers(getDefaultMembers(tournament.gameMode));
  }, [tournament?.gameMode]);

  useEffect(() => {
    if (!tournament?.startDateTime || tournament.status !== "upcoming") return;
    const interval = setInterval(() => {
      const diff = differenceInSeconds(new Date(tournament.startDateTime), new Date());
      if (diff <= 0) { setTimeLeft({ d: 0, h: 0, m: 0, s: 0 }); clearInterval(interval); }
      else setTimeLeft({ d: Math.floor(diff / (3600 * 24)), h: Math.floor((diff % (3600 * 24)) / 3600), m: Math.floor((diff % 3600) / 60), s: diff % 60 });
    }, 1000);
    return () => clearInterval(interval);
  }, [tournament]);

  const updateMember = (index: number, field: "uid" | "name", value: string) => {
    setTeamMembers(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const handleRegister = () => {
    if (!user) {
      toast({ title: "Login required", description: "You must be logged in to register.", variant: "destructive" });
      return;
    }
    if (tournament?.entryFee && tournament.entryFee > 0 && !transactionId) {
      toast({ title: "Payment details required", description: "Please provide a transaction ID.", variant: "destructive" });
      return;
    }
    // Validate team members
    const invalidMember = teamMembers.find(m => !m.uid.trim() || !m.name.trim());
    if (invalidMember) {
      toast({ title: "Team details required", description: "Please fill in all teammate UIDs and IGNs.", variant: "destructive" });
      return;
    }

    register(
      { id: tournamentId, data: { paymentScreenshotUrl, transactionId, teamMembers: teamMembers.length > 0 ? teamMembers : undefined } },
      {
        onSuccess: () => {
          toast({ title: "Registered Successfully!", description: tournament?.entryFee === 0 ? "You're in! Check 'My Matches' for room details." : "Your registration is pending verification." });
          setIsRegisterOpen(false);
          queryClient.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournamentId) });
        },
        onError: (err) => toast({ title: "Registration failed", description: (err as any)?.error?.message || "An error occurred", variant: "destructive" })
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-64 bg-card animate-pulse rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-card animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!tournament) return <div className="text-center py-20 font-mono text-muted-foreground">Tournament not found.</div>;

  const isFull = tournament.filledSlots >= tournament.maxSlots;
  const canRegister = !tournament.isRegistered && tournament.status === "upcoming" && !isFull && user;
  const showRoom = (tournament.isRegistered && (tournament.registrationStatus === "verified" || tournament.registrationStatus === "free")) && (tournament.roomId || tournament.roomPassword);

  const modeLabel: Record<string, string> = { solo: "Solo", duo: "Duo", squad: "Squad (4 Players)" };

  return (
    <div className="space-y-8 pb-12">
      {/* Banner */}
      <div className="relative h-56 md:h-72 rounded-xl overflow-hidden border border-primary/20">
        <img
          src={tournament.bannerUrl || getDefaultBanner(tournament.gameMode)}
          alt={tournament.title}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = getDefaultBanner("squad"); }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`text-xs font-mono px-3 py-1 border rounded font-bold uppercase ${tournament.status === "upcoming" ? "text-primary border-primary/30 bg-primary/10" : tournament.status === "ongoing" ? "text-secondary border-secondary/30 bg-secondary/10" : "text-muted-foreground border-border bg-card/50"}`}>
              {tournament.status}
            </span>
            <span className="text-xs font-mono px-3 py-1 border border-border/50 rounded text-muted-foreground bg-card/50 uppercase">{modeLabel[tournament.gameMode] || tournament.gameMode}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black font-display uppercase tracking-wider text-white drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]">{tournament.title}</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-primary/20"><CardContent className="p-4">
          <IndianRupee className="h-5 w-5 text-primary mb-1" />
          <p className="text-xs font-mono text-muted-foreground">Prize Pool</p>
          <p className="text-xl font-bold font-display text-primary">₹{tournament.prizePool}</p>
        </CardContent></Card>
        <Card className="bg-card/50 border-secondary/20"><CardContent className="p-4">
          <IndianRupee className="h-5 w-5 text-secondary mb-1" />
          <p className="text-xs font-mono text-muted-foreground">Entry Fee</p>
          <p className="text-xl font-bold font-display text-secondary">{tournament.entryFee === 0 ? "FREE" : `₹${tournament.entryFee}`}</p>
        </CardContent></Card>
        <Card className="bg-card/50 border-border/30"><CardContent className="p-4">
          <Users className="h-5 w-5 text-foreground mb-1" />
          <p className="text-xs font-mono text-muted-foreground">Slots</p>
          <p className="text-xl font-bold font-display">{tournament.filledSlots}/{tournament.maxSlots}</p>
        </CardContent></Card>
        <Card className="bg-card/50 border-border/30"><CardContent className="p-4">
          <Map className="h-5 w-5 text-foreground mb-1" />
          <p className="text-xs font-mono text-muted-foreground">Map</p>
          <p className="text-xl font-bold font-display">{tournament.mapName}</p>
        </CardContent></Card>
      </div>

      {/* Countdown */}
      {tournament.status === "upcoming" && timeLeft && (
        <Card className="bg-card/50 border-primary/20 neon-border">
          <CardContent className="p-6 flex flex-col items-center">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">Starts In</p>
            <div className="flex gap-4 md:gap-8">
              {[["d", "Days"], ["h", "Hrs"], ["m", "Min"], ["s", "Sec"]].map(([key, label]) => (
                <div key={key} className="flex flex-col items-center">
                  <span className="text-4xl md:text-5xl font-black font-display text-primary neon-text tabular-nums">{String(timeLeft[key as keyof typeof timeLeft]).padStart(2, "0")}</span>
                  <span className="text-xs font-mono text-muted-foreground mt-1">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registration / Room */}
      <div className="flex flex-col sm:flex-row gap-4">
        {tournament.isRegistered ? (
          <Card className="flex-1 bg-card/50 border-secondary/30">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-secondary" />
                <span className="font-bold font-display uppercase tracking-wider text-secondary">You're Registered</span>
              </div>
              <p className="text-sm font-mono text-muted-foreground">
                Status: <span className={tournament.registrationStatus === "verified" || tournament.registrationStatus === "free" ? "text-secondary" : "text-yellow-500"}>{tournament.registrationStatus?.toUpperCase()}</span>
              </p>
              {showRoom && (
                <div className="mt-4 p-4 bg-secondary/5 border border-secondary/30 rounded font-mono">
                  <div className="flex items-center gap-2 mb-2 text-secondary font-bold"><Unlock className="h-4 w-4" /> Room Open</div>
                  <p>Room ID: <span className="text-foreground font-bold tracking-widest">{tournament.roomId}</span></p>
                  <p>Password: <span className="text-foreground font-bold tracking-widest">{tournament.roomPassword}</span></p>
                </div>
              )}
              {!showRoom && (tournament.registrationStatus === "verified" || tournament.registrationStatus === "free") && (
                <div className="mt-4 p-3 bg-background/50 border border-border/30 rounded font-mono text-xs text-muted-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Room details will appear 15 minutes before the match starts.
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          tournament.status === "upcoming" && (
            <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
              <DialogTrigger asChild>
                <Button size="lg" disabled={isFull || !user} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest clip-path-slant rounded-none h-14 shadow-[0_0_20px_rgba(0,245,255,0.4)]">
                  <Swords className="h-5 w-5 mr-2" />
                  {isFull ? "Tournament Full" : user ? "Join Tournament" : "Login to Join"}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-primary/30 max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-display uppercase tracking-wider text-primary">Join Tournament</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 pt-2">
                  <p className="text-sm font-mono text-muted-foreground">{tournament.title}</p>

                  {/* Mode info */}
                  <div className="bg-primary/5 border border-primary/20 rounded p-3 text-xs font-mono">
                    <span className="text-primary font-bold">{modeLabel[tournament.gameMode]}</span>
                    {tournament.gameMode === "duo" && " — Add 1 teammate"}
                    {tournament.gameMode === "squad" && " — Add 3 teammates"}
                    {tournament.gameMode === "solo" && " — No teammates needed"}
                  </div>

                  {/* Team Members (Duo/Squad) */}
                  {teamMembers.length > 0 && (
                    <div className="space-y-3">
                      <Label className="font-mono text-xs uppercase text-muted-foreground">Teammate Details</Label>
                      {teamMembers.map((member, i) => (
                        <div key={i} className="grid grid-cols-2 gap-3 p-3 bg-background/50 border border-border/30 rounded">
                          <div>
                            <Label className="font-mono text-xs text-muted-foreground">Teammate {i + 1} UID</Label>
                            <Input value={member.uid} onChange={e => updateMember(i, "uid", e.target.value)} placeholder="Free Fire UID" className="bg-background/30 border-border/50 font-mono mt-1" />
                          </div>
                          <div>
                            <Label className="font-mono text-xs text-muted-foreground">IGN</Label>
                            <Input value={member.name} onChange={e => updateMember(i, "name", e.target.value)} placeholder="In-Game Name" className="bg-background/30 border-border/50 font-mono mt-1" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Payment */}
                  {tournament.entryFee > 0 ? (
                    <div className="space-y-4 border-t border-border/30 pt-4">
                      <div className="bg-primary/5 border border-primary/20 rounded p-4 font-mono text-sm">
                        <p className="text-primary font-bold mb-2">Entry Fee: ₹{tournament.entryFee}</p>
                        <p>UPI ID: <span className="text-foreground">ffarena@upi</span></p>
                        <p className="text-muted-foreground text-xs mt-1">Pay and enter your transaction details below.</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="font-mono text-xs uppercase text-muted-foreground">Transaction ID *</Label>
                        <Input value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="UPI Transaction ID" className="bg-background/50 border-border/50 font-mono" />
                      </div>
                      <div className="space-y-1">
                        <Label className="font-mono text-xs uppercase text-muted-foreground">Screenshot URL (optional)</Label>
                        <Input value={paymentScreenshotUrl} onChange={e => setPaymentScreenshotUrl(e.target.value)} placeholder="https://..." className="bg-background/50 border-border/50 font-mono" />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-secondary/10 border border-secondary/30 rounded p-3 font-mono text-sm text-secondary">
                      ✓ Free tournament — No payment needed!
                    </div>
                  )}

                  <Button onClick={handleRegister} disabled={isRegistering} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest">
                    {isRegistering ? "Registering..." : "Confirm Registration"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )
        )}

        {!user && tournament.status === "upcoming" && (
          <p className="text-sm font-mono text-muted-foreground self-center">
            <a href="/login" className="text-primary hover:underline">Login</a> to register for this tournament.
          </p>
        )}
      </div>

      {tournament.description && (
        <Card className="bg-card/30 border-border/30">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground font-mono leading-relaxed">{tournament.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard (completed) */}
      {tournament.status === "completed" && (
        <Card className="bg-card/50 border-secondary/20">
          <CardHeader><CardTitle className="font-display uppercase tracking-wider text-secondary flex items-center gap-2"><Trophy className="h-5 w-5" /> Final Results</CardTitle></CardHeader>
          <CardContent>
            {isLoadingLeaderboard ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-border/20 rounded animate-pulse" />)}</div>
            ) : !leaderboard?.entries?.length ? (
              <p className="text-center font-mono text-muted-foreground py-6">Results not posted yet.</p>
            ) : (
              <Table className="font-mono">
                <TableHeader>
                  <TableRow><TableHead>Rank</TableHead><TableHead>Player</TableHead><TableHead className="text-right">Kills</TableHead><TableHead className="text-right">Points</TableHead><TableHead className="text-right">Prize</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.entries.map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-bold">
                        {entry.rank === 1 ? <Medal className="h-5 w-5 text-secondary" /> : entry.rank === 2 ? <Medal className="h-5 w-5 text-zinc-300" /> : entry.rank === 3 ? <Medal className="h-5 w-5 text-amber-600" /> : `#${entry.rank}`}
                      </TableCell>
                      <TableCell className="font-bold">{entry.user?.inGameName ?? "—"}</TableCell>
                      <TableCell className="text-right"><div className="flex items-center justify-end gap-1"><Target className="h-3 w-3 text-primary" />{entry.kills}</div></TableCell>
                      <TableCell className="text-right font-bold text-primary">{entry.points}</TableCell>
                      <TableCell className="text-right text-secondary font-bold">{entry.prizeWon > 0 ? `₹${entry.prizeWon}` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
