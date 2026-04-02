import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { getDefaultBanner } from "@/lib/tournament-defaults";
import { 
  useGetTournament, getGetTournamentQueryKey, 
  useRegisterForTournament, 
  useGetTournamentLeaderboard, getGetTournamentLeaderboardQueryKey,
  getGetMeQueryKey
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { format, differenceInSeconds } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Swords, IndianRupee, Zap, Map, Users, Clock, Lock, Unlock, Medal, Target, ChevronLeft, Wallet, AlertTriangle, Crown, Skull } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type TeamMember = { uid: string; name: string };

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const tournamentId = parseInt(id || "0", 10);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: tournament, isLoading } = useGetTournament(
    tournamentId,
    { query: { enabled: !!tournamentId, queryKey: getGetTournamentQueryKey(tournamentId) } }
  );

  const { data: leaderboard, isLoading: isLoadingLeaderboard } = useGetTournamentLeaderboard(
    tournamentId,
    { query: { enabled: !!tournamentId && tournament?.status === "completed", queryKey: getGetTournamentLeaderboardQueryKey(tournamentId) } }
  );

  const { mutate: register, isPending: isRegistering } = useRegisterForTournament();

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isInsufficientOpen, setIsInsufficientOpen] = useState(false);
  const [insufficientData, setInsufficientData] = useState<{ required: number; balance: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  const storageKey = `reg_form_${tournamentId}`;
  const dialogWasOpenRef = useRef(false);

  // Load saved form state from sessionStorage
  const loadSavedForm = useCallback(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved) as { playerInfo: { uid: string; name: string }; teamMembers: TeamMember[] };
    } catch {}
    return null;
  }, [storageKey]);

  // Player's own playing UID/IGN (can differ from account UID)
  const [playerInfo, setPlayerInfo] = useState<{ uid: string; name: string }>(() => {
    const saved = loadSavedForm();
    return saved?.playerInfo ?? { uid: "", name: "" };
  });

  // Dynamic team members for duo/squad (teammates only, not self)
  const getDefaultMembers = (mode: string): TeamMember[] => {
    if (mode === "duo") return [{ uid: "", name: "" }];
    if (mode === "squad") return [{ uid: "", name: "" }, { uid: "", name: "" }, { uid: "", name: "" }];
    return [];
  };
  // Start empty — the useEffect below populates once the tournament mode is known
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Initialise team slots when tournament mode is known.
  // If sessionStorage has the right number of members for this mode, restore them.
  // Otherwise (first visit, or stale/wrong count), start fresh with empty defaults.
  useEffect(() => {
    if (!tournament?.gameMode) return;
    const defaults = getDefaultMembers(tournament.gameMode);
    const saved = loadSavedForm();
    if (saved?.teamMembers && saved.teamMembers.length === defaults.length) {
      setTeamMembers(saved.teamMembers);
    } else {
      setTeamMembers(defaults);
    }
  }, [tournament?.gameMode]);

  // Persist form data to sessionStorage whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ playerInfo, teamMembers }));
    } catch {}
  }, [playerInfo, teamMembers, storageKey]);

  // Pre-fill player info from account when dialog opens (only if fields are empty)
  useEffect(() => {
    if (isRegisterOpen && user) {
      setPlayerInfo(prev => ({
        uid: prev.uid || (user as any).freeFireUid || "",
        name: prev.name || (user as any).inGameName || "",
      }));
    }
  }, [isRegisterOpen]);

  // Track whether the dialog was open before the user switched apps
  useEffect(() => {
    dialogWasOpenRef.current = isRegisterOpen;
  }, [isRegisterOpen]);

  // Re-open the dialog when the user comes back from another app (mobile)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && dialogWasOpenRef.current) {
        setIsRegisterOpen(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!tournament?.startDateTime || tournament.status !== "upcoming") return;

    const compute = () => {
      const diff = differenceInSeconds(new Date(tournament.startDateTime), new Date());
      if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0 };
      return { d: Math.floor(diff / 86400), h: Math.floor((diff % 86400) / 3600), m: Math.floor((diff % 3600) / 60), s: diff % 60 };
    };

    // Populate immediately so there's no blank flash
    setTimeLeft(compute());

    const interval = setInterval(() => {
      const t = compute();
      setTimeLeft(t);
      if (t.d === 0 && t.h === 0 && t.m === 0 && t.s === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [tournament?.startDateTime, tournament?.status]);

  const updateMember = (index: number, field: "uid" | "name", value: string) => {
    setTeamMembers(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const handleRegister = () => {
    if (!user) {
      toast({ title: "Login required", description: "You must be logged in to register.", variant: "destructive" });
      return;
    }
    // Validate player's own UID and IGN
    if (!playerInfo.uid.trim() || !playerInfo.name.trim()) {
      toast({ title: "Your UID & IGN required", description: "Please enter your Free Fire UID and in-game name.", variant: "destructive" });
      return;
    }
    // Validate team members
    const invalidMember = teamMembers.find(m => !m.uid.trim() || !m.name.trim());
    if (invalidMember) {
      toast({ title: "Team details required", description: "Please fill in all teammate UIDs and IGNs.", variant: "destructive" });
      return;
    }

    // Build full team list: player first (self: true), then teammates
    const allMembers = [
      { uid: playerInfo.uid.trim(), name: playerInfo.name.trim(), self: true },
      ...teamMembers,
    ];

    register(
      { id: tournamentId, data: { teamMembers: allMembers } },
      {
        onSuccess: () => {
          toast({ title: "Registered Successfully!", description: payableAmount === 0 ? "You're in! Check 'My Matches' for room details." : `₹${payableAmount} deducted from your wallet. You're in!` });
          setIsRegisterOpen(false);
          try { sessionStorage.removeItem(storageKey); } catch {}
          queryClient.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournamentId) });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
        onError: (err: any) => {
          const errData = err?.data || err;
          if (errData?.code === "INSUFFICIENT_BALANCE" || err?.status === 402) {
            const required = errData?.required ?? tournament?.entryFee ?? 0;
            const balance = errData?.balance ?? 0;
            setInsufficientData({ required, balance });
            setIsRegisterOpen(false);
            setIsInsufficientOpen(true);
          } else {
            toast({ title: "Registration failed", description: errData?.error || errData?.message || "An error occurred", variant: "destructive" });
          }
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-card animate-pulse rounded" />
        <div className="h-64 bg-card animate-pulse rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-card animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!tournament) return <div className="text-center py-20 font-mono text-muted-foreground">Tournament not found.</div>;

  const isFull = tournament.filledSlots >= tournament.maxSlots;
  const canRegister = !tournament.isRegistered && tournament.status === "upcoming" && !isFull && !!user;
  const showRoom = (tournament.isRegistered && (tournament.registrationStatus === "verified" || tournament.registrationStatus === "free")) && (tournament.roomId || tournament.roomPassword);

  const modeLabel: Record<string, string> = { solo: "Solo", duo: "Duo", squad: "Squad (4 Players)" };
  const walletBalance = (user as any)?.walletBalance ?? 0;

  // Team-size multiplier: solo×1, duo×2, squad×4
  const teamMultiplier = tournament.gameMode === "squad" ? 4 : tournament.gameMode === "duo" ? 2 : 1;
  const payableAmount = (tournament.entryFee ?? 0) * teamMultiplier;
  const canAfford = walletBalance >= payableAmount;

  return (
    <div className="space-y-8 pb-12">
      {/* Back button */}
      <Button variant="ghost" className="font-mono text-muted-foreground hover:text-foreground -ml-2 gap-1" onClick={() => navigate("/tournaments")}>
        <ChevronLeft className="h-4 w-4" /> Back to Tournaments
      </Button>

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
          {tournament.entryFee > 0 && teamMultiplier > 1 && (
            <p className="text-xs font-mono text-muted-foreground mt-0.5">Total: ₹{payableAmount} ({modeLabel[tournament.gameMode]})</p>
          )}
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
                    {tournament.gameMode === "duo" && " — You + 1 teammate"}
                    {tournament.gameMode === "squad" && " — You + 3 teammates"}
                    {tournament.gameMode === "solo" && " — Solo entry"}
                  </div>

                  {/* Player roster — dynamically built from game mode */}
                  <div className="space-y-3">
                    <Label className="font-mono text-xs uppercase text-muted-foreground flex items-center gap-1">
                      <span className="text-secondary">★</span> Player Details
                      <span className="ml-1 text-primary">
                        ({tournament.gameMode === "solo" ? "1 Player" : tournament.gameMode === "duo" ? "2 Players" : "4 Players"})
                      </span>
                    </Label>

                    {/* Owner / Player 1 */}
                    <div className="p-3 bg-secondary/5 border border-secondary/30 rounded space-y-2">
                      <p className="text-xs font-mono font-bold text-secondary uppercase tracking-wider">
                        Player 1 — Owner (You)
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="font-mono text-xs text-muted-foreground">Free Fire UID</Label>
                          <Input
                            value={playerInfo.uid}
                            onChange={e => setPlayerInfo(p => ({ ...p, uid: e.target.value }))}
                            placeholder="e.g. 1234567890"
                            className="bg-background/30 border-border/50 font-mono mt-1"
                          />
                        </div>
                        <div>
                          <Label className="font-mono text-xs text-muted-foreground">In-Game Name</Label>
                          <Input
                            value={playerInfo.name}
                            onChange={e => setPlayerInfo(p => ({ ...p, name: e.target.value }))}
                            placeholder="Your IGN"
                            className="bg-background/30 border-border/50 font-mono mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Teammates — Player 2, 3, 4 */}
                    {teamMembers.map((member, i) => (
                      <div key={i} className="p-3 bg-background/50 border border-border/30 rounded space-y-2">
                        <p className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">
                          Player {i + 2} — Teammate {i + 1}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="font-mono text-xs text-muted-foreground">Free Fire UID</Label>
                            <Input value={member.uid} onChange={e => updateMember(i, "uid", e.target.value)} placeholder="e.g. 1234567890" className="bg-background/30 border-border/50 font-mono mt-1" />
                          </div>
                          <div>
                            <Label className="font-mono text-xs text-muted-foreground">In-Game Name</Label>
                            <Input value={member.name} onChange={e => updateMember(i, "name", e.target.value)} placeholder="Teammate IGN" className="bg-background/30 border-border/50 font-mono mt-1" />
                          </div>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs font-mono text-muted-foreground">You can update your UID/IGN if playing on a different account.</p>
                  </div>

                  {/* Payment info */}
                  {tournament.entryFee > 0 ? (
                    <div className={`border rounded p-4 font-mono text-sm space-y-2 ${canAfford ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/30"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Fee per player</span>
                        <span className="font-bold">₹{tournament.entryFee}</span>
                      </div>
                      {teamMultiplier > 1 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Team size ({modeLabel[tournament.gameMode]})</span>
                          <span className="text-muted-foreground">× {teamMultiplier}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t border-border/30 pt-2">
                        <span className="text-muted-foreground font-bold">Total Payable</span>
                        <span className="font-bold text-primary text-base">₹{payableAmount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Your Wallet</span>
                        <span className={`font-bold ${canAfford ? "text-secondary" : "text-destructive"}`}>₹{walletBalance}</span>
                      </div>
                      {canAfford ? (
                        <div className="text-xs text-muted-foreground pt-1 border-t border-border/30">
                          ✓ ₹{payableAmount} will be deducted from your wallet instantly upon joining.
                        </div>
                      ) : (
                        <div className="text-xs text-destructive pt-1 border-t border-destructive/20 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Insufficient balance. You need ₹{payableAmount - walletBalance} more.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-secondary/10 border border-secondary/30 rounded p-3 font-mono text-sm text-secondary">
                      ✓ Free tournament — No payment needed!
                    </div>
                  )}

                  {canAfford || payableAmount === 0 ? (
                    <Button onClick={handleRegister} disabled={isRegistering} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest">
                      {isRegistering ? "Registering..." : payableAmount > 0 ? `Confirm & Pay ₹${payableAmount}` : "Confirm Registration"}
                    </Button>
                  ) : (
                    <Button onClick={() => { setIsRegisterOpen(false); navigate("/wallet"); }} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-widest">
                      <Wallet className="h-4 w-4 mr-2" /> Deposit to Join
                    </Button>
                  )}
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

      {/* Insufficient Balance Dialog */}
      <Dialog open={isInsufficientOpen} onOpenChange={setIsInsufficientOpen}>
        <DialogContent className="bg-card border-destructive/40 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wider text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Deposit Required
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 font-mono text-sm">
            <div className="bg-destructive/5 border border-destructive/20 rounded p-4 space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Required</span><span className="font-bold text-destructive">₹{insufficientData?.required}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Your Balance</span><span className="font-bold">₹{insufficientData?.balance}</span></div>
              <div className="flex justify-between border-t border-border/30 pt-2"><span className="text-muted-foreground">Shortfall</span><span className="font-bold text-yellow-500">₹{(insufficientData?.required ?? 0) - (insufficientData?.balance ?? 0)}</span></div>
            </div>
            <p className="text-muted-foreground text-xs">Add money to your FF Arena wallet to join this tournament. Deposits are approved within a few minutes.</p>
            <div className="flex gap-3">
              <Button onClick={() => navigate("/wallet")} className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-widest">
                <Wallet className="h-4 w-4 mr-2" /> Go to Wallet
              </Button>
              <Button variant="outline" className="border-border/50" onClick={() => setIsInsufficientOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {tournament.description && (
        <Card className="bg-card/30 border-border/30">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground font-mono leading-relaxed">{tournament.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Results (completed) */}
      {tournament.status === "completed" && (
        <Card className="bg-card/50 border-secondary/20">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wider text-secondary flex items-center gap-2">
              <Crown className="h-5 w-5" /> Final Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingLeaderboard ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-border/20 rounded animate-pulse" />)}</div>
            ) : !Array.isArray(leaderboard) || leaderboard.length === 0 ? (
              <p className="text-center font-mono text-muted-foreground py-6">Results not posted yet.</p>
            ) : (
              <Table className="font-mono">
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-center">Result</TableHead>
                    <TableHead className="text-right">Kills</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">Prize</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(leaderboard as any[]).map((entry: any) => (
                    <TableRow key={entry.id} className={entry.placement === 1 ? "bg-secondary/5" : ""}>
                      <TableCell className="font-bold">
                        {entry.rank === 1 ? <Medal className="h-5 w-5 text-yellow-400" /> : entry.rank === 2 ? <Medal className="h-5 w-5 text-zinc-300" /> : entry.rank === 3 ? <Medal className="h-5 w-5 text-amber-600" /> : <span className="text-muted-foreground">#{entry.rank}</span>}
                      </TableCell>
                      <TableCell className="font-bold">{entry.user?.inGameName ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        {entry.placement === 1 ? (
                          <span className="text-xs font-mono font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-2 py-0.5 rounded">🏆 BOOYAH!</span>
                        ) : (
                          <span className="text-xs font-mono text-muted-foreground">#{entry.placement}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Skull className="h-3 w-3 text-destructive" />{entry.kills}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">{entry.totalPoints ?? entry.points ?? 0}</TableCell>
                      <TableCell className="text-right text-secondary font-bold">{(entry.prize ?? entry.prizeWon) > 0 ? `₹${entry.prize ?? entry.prizeWon}` : "—"}</TableCell>
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
