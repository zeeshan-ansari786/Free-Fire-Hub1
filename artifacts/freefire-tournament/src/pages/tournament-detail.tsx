import { useState, useEffect } from "react";
import { useParams } from "wouter";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Swords, IndianRupee, Zap, Map, Users, Clock, ShieldAlert, Lock, Unlock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

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

  useEffect(() => {
    if (!tournament?.startDateTime || tournament.status !== "upcoming") return;

    const interval = setInterval(() => {
      const diff = differenceInSeconds(new Date(tournament.startDateTime), new Date());
      if (diff <= 0) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
        clearInterval(interval);
      } else {
        setTimeLeft({
          d: Math.floor(diff / (3600 * 24)),
          h: Math.floor((diff % (3600 * 24)) / 3600),
          m: Math.floor((diff % 3600) / 60),
          s: diff % 60
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [tournament]);

  const handleRegister = () => {
    if (!user) {
      toast({ title: "Login required", description: "You must be logged in to register.", variant: "destructive" });
      return;
    }

    if (tournament?.entryFee && tournament.entryFee > 0 && !transactionId) {
      toast({ title: "Payment details required", description: "Please provide a transaction ID.", variant: "destructive" });
      return;
    }

    register(
      { id: tournamentId, data: { paymentScreenshotUrl, transactionId } },
      {
        onSuccess: () => {
          toast({ title: "Registered Successfully", description: "Your registration is now pending verification." });
          setIsRegisterOpen(false);
          queryClient.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournamentId) });
        },
        onError: (err) => {
          toast({ title: "Registration Failed", description: err.error?.message || "Something went wrong.", variant: "destructive" });
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8 animate-pulse">
        <div className="h-64 bg-card rounded-xl border border-border" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-96 bg-card rounded-xl border border-border" />
          <div className="h-96 bg-card rounded-xl border border-border" />
        </div>
      </div>
    );
  }

  if (!tournament) return <div>Tournament not found</div>;

  return (
    <div className="space-y-8 pb-12">
      {/* Banner & Hero */}
      <div className="relative rounded-xl overflow-hidden neon-border border-primary/30 h-64 md:h-80 flex flex-col justify-end bg-card">
        {tournament.bannerUrl ? (
          <div className="absolute inset-0 z-0">
            <img src={tournament.bannerUrl} alt={tournament.title} className="w-full h-full object-cover opacity-50" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-card to-background z-0 flex items-center justify-center">
            <Swords className="h-32 w-32 text-primary/10" />
          </div>
        )}
        
        <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-background/80 font-mono text-primary border-primary/50 uppercase tracking-widest">{tournament.status}</Badge>
              <Badge variant="outline" className="bg-background/80 font-mono text-secondary border-secondary/50 uppercase tracking-widest">{tournament.gameMode}</Badge>
            </div>
            <h1 className="text-3xl md:text-5xl font-black uppercase font-display tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
              {tournament.title}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm font-mono text-muted-foreground">
              <span className="flex items-center gap-1.5"><Map className="h-4 w-4 text-primary" /> {tournament.mapName}</span>
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-secondary" /> {format(new Date(tournament.startDateTime), "MMM do, yyyy - h:mm a")}</span>
            </div>
          </div>

          <div className="bg-background/80 backdrop-blur p-4 rounded border border-border/50 text-center min-w-48">
            <p className="text-xs text-muted-foreground font-mono uppercase mb-1">Prize Pool</p>
            <p className="text-3xl font-bold text-secondary flex items-center justify-center neon-text-green">
              <IndianRupee className="h-6 w-6 mr-1" />{tournament.prizePool}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="font-display uppercase tracking-wider text-xl">Tournament Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground font-mono whitespace-pre-wrap">{tournament.description || "No description provided."}</p>
              
              <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-background/50 p-4 rounded border border-border/50 text-center">
                  <p className="text-xs text-muted-foreground font-mono uppercase mb-1">Entry Fee</p>
                  <p className="text-xl font-bold text-primary flex items-center justify-center">
                    {tournament.entryFee > 0 ? <><IndianRupee className="h-4 w-4" />{tournament.entryFee}</> : "FREE"}
                  </p>
                </div>
                <div className="bg-background/50 p-4 rounded border border-border/50 text-center">
                  <p className="text-xs text-muted-foreground font-mono uppercase mb-1">Slots</p>
                  <p className="text-xl font-bold text-white flex items-center justify-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" /> {tournament.filledSlots}/{tournament.maxSlots}
                  </p>
                </div>
                <div className="bg-background/50 p-4 rounded border border-border/50 text-center">
                  <p className="text-xs text-muted-foreground font-mono uppercase mb-1">Mode</p>
                  <p className="text-xl font-bold text-white uppercase">{tournament.gameMode}</p>
                </div>
                <div className="bg-background/50 p-4 rounded border border-border/50 text-center">
                  <p className="text-xs text-muted-foreground font-mono uppercase mb-1">Map</p>
                  <p className="text-xl font-bold text-white uppercase">{tournament.mapName}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard if completed */}
          {tournament.status === "completed" && (
            <Card className="bg-card/50 backdrop-blur border-secondary/30 neon-border-green">
              <CardHeader>
                <CardTitle className="font-display uppercase tracking-wider text-xl flex items-center gap-2">
                  <Swords className="h-5 w-5 text-secondary" /> Final Standings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingLeaderboard ? (
                  <div className="h-32 flex items-center justify-center text-muted-foreground font-mono">Loading...</div>
                ) : !leaderboard?.length ? (
                  <div className="h-32 flex items-center justify-center text-muted-foreground font-mono text-sm">Leaderboard not updated yet.</div>
                ) : (
                  <Table>
                    <TableHeader className="border-b-secondary/20">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-16 font-mono text-secondary uppercase">Rank</TableHead>
                        <TableHead className="font-mono text-secondary uppercase">Player</TableHead>
                        <TableHead className="text-right font-mono text-secondary uppercase">Kills</TableHead>
                        <TableHead className="text-right font-mono text-secondary uppercase">Prize</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboard.map((entry) => (
                        <TableRow key={entry.id} className="border-b-border/30 hover:bg-secondary/5 font-mono">
                          <TableCell className="font-bold">#{entry.rank}</TableCell>
                          <TableCell className="text-white">{entry.user.inGameName}</TableCell>
                          <TableCell className="text-right">{entry.kills}</TableCell>
                          <TableCell className="text-right text-secondary font-bold">
                            {entry.prize > 0 ? `₹${entry.prize}` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className={`bg-card/80 backdrop-blur border ${tournament.isRegistered ? 'border-secondary/50 neon-border-green' : 'border-primary/50 neon-border'}`}>
            <CardHeader className="text-center pb-2">
              <CardTitle className="font-display uppercase tracking-wider text-xl">Registration</CardTitle>
              {tournament.isRegistered ? (
                <Badge className="bg-secondary text-secondary-foreground mx-auto uppercase tracking-widest font-bold font-mono">
                  {tournament.registrationStatus}
                </Badge>
              ) : tournament.status !== "upcoming" ? (
                <Badge variant="outline" className="mx-auto uppercase tracking-widest font-mono text-muted-foreground border-muted-foreground">
                  Closed
                </Badge>
              ) : (
                <p className="text-sm text-muted-foreground font-mono">
                  {tournament.maxSlots - tournament.filledSlots} slots remaining
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {tournament.status === "upcoming" && timeLeft && (
                <div className="grid grid-cols-4 gap-2 text-center my-4">
                  <div className="bg-background/50 p-2 rounded border border-primary/20">
                    <span className="block text-xl font-bold text-primary font-mono">{timeLeft.d}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">Days</span>
                  </div>
                  <div className="bg-background/50 p-2 rounded border border-primary/20">
                    <span className="block text-xl font-bold text-primary font-mono">{timeLeft.h.toString().padStart(2, '0')}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">Hrs</span>
                  </div>
                  <div className="bg-background/50 p-2 rounded border border-primary/20">
                    <span className="block text-xl font-bold text-primary font-mono">{timeLeft.m.toString().padStart(2, '0')}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">Min</span>
                  </div>
                  <div className="bg-background/50 p-2 rounded border border-primary/20">
                    <span className="block text-xl font-bold text-primary font-mono animate-pulse">{timeLeft.s.toString().padStart(2, '0')}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">Sec</span>
                  </div>
                </div>
              )}

              {!tournament.isRegistered && tournament.status === "upcoming" && (
                <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest clip-path-slant rounded-none shadow-[0_0_15px_rgba(0,245,255,0.4)]"
                      disabled={tournament.filledSlots >= tournament.maxSlots}
                    >
                      {tournament.filledSlots >= tournament.maxSlots ? "Tournament Full" : "Register Now"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card neon-border border-primary/50 sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="font-display uppercase text-2xl text-primary">Confirm Registration</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4 font-mono">
                      <div className="bg-background/50 p-4 rounded border border-border/50 flex justify-between items-center">
                        <span className="text-muted-foreground">Entry Fee:</span>
                        <span className="font-bold text-xl text-primary">{tournament.entryFee > 0 ? `₹${tournament.entryFee}` : 'FREE'}</span>
                      </div>
                      
                      {tournament.entryFee > 0 && (
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">Please send the exact amount to the UPI ID below and enter your transaction ID.</p>
                          <div className="bg-primary/10 p-3 rounded border border-primary/30 text-center font-bold text-primary text-lg">
                            admin@upi
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-xs uppercase text-primary">Transaction ID (Required)</label>
                            <Input 
                              placeholder="e.g. 123456789012" 
                              value={transactionId}
                              onChange={(e) => setTransactionId(e.target.value)}
                              className="bg-background border-primary/30"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs uppercase text-primary">Screenshot Link (Optional)</label>
                            <Input 
                              placeholder="https://imgur.com/..." 
                              value={paymentScreenshotUrl}
                              onChange={(e) => setPaymentScreenshotUrl(e.target.value)}
                              className="bg-background border-primary/30"
                            />
                          </div>
                        </div>
                      )}

                      <Button 
                        onClick={handleRegister} 
                        disabled={isRegistering}
                        className="w-full h-12 mt-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest clip-path-slant rounded-none"
                      >
                        {isRegistering ? "Processing..." : "Confirm Join"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>

          {/* Room Details */}
          <Card className="bg-card/50 backdrop-blur border-border/50 relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="font-display uppercase tracking-wider text-xl flex items-center gap-2">
                Room Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tournament.registrationStatus === "verified" ? (
                <div className="space-y-4">
                  <div className="bg-secondary/10 p-4 rounded border border-secondary/30 flex items-center gap-4">
                    <Unlock className="h-6 w-6 text-secondary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground font-mono uppercase mb-1">Room ID</p>
                      <p className="text-lg font-bold font-mono tracking-widest">{tournament.roomId || "Pending"}</p>
                    </div>
                  </div>
                  <div className="bg-primary/10 p-4 rounded border border-primary/30 flex items-center gap-4">
                    <Lock className="h-6 w-6 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground font-mono uppercase mb-1">Password</p>
                      <p className="text-lg font-bold font-mono tracking-widest">{tournament.roomPassword || "Pending"}</p>
                    </div>
                  </div>
                  {(!tournament.roomId || !tournament.roomPassword) && (
                    <p className="text-xs text-muted-foreground font-mono text-center mt-2">
                      Details will be posted here 15 minutes before match starts.
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center text-center px-4 relative">
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-0" />
                  <Lock className="h-10 w-10 text-muted-foreground mb-3 z-10 opacity-50" />
                  <p className="text-sm font-mono text-muted-foreground z-10">
                    Room ID & Password are only visible to verified participants.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
