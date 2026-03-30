import { useParams, useLocation } from "wouter";
import { useGetPlayerProfile, getGetPlayerProfileQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Trophy, Target, IndianRupee, Gamepad2, Award } from "lucide-react";

export default function Profile() {
  const { userId: urlUserId } = useParams<{ userId?: string }>();
  const { user: currentUser } = useAuth();
  const [, setLocation] = useLocation();

  // If no param, assume we want my profile. If no param and not logged in, redirect.
  const targetId = urlUserId ? parseInt(urlUserId, 10) : currentUser?.id;

  if (!urlUserId && !currentUser) {
    setLocation("/login");
    return null;
  }

  const { data: profile, isLoading } = useGetPlayerProfile(
    targetId as number,
    { query: { enabled: !!targetId, queryKey: getGetPlayerProfileQueryKey(targetId as number) } }
  );

  if (isLoading) {
    return <div className="h-96 w-full animate-pulse bg-card rounded-xl border border-border" />;
  }

  if (!profile) return <div className="text-center font-mono py-20">Profile not found.</div>;

  const user = profile.user;
  const isMe = currentUser?.id === user.id;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Profile Header */}
      <div className="relative pt-24 pb-8 px-8 bg-card rounded-xl border border-border/50 overflow-hidden flex flex-col items-center text-center">
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-primary/10 to-transparent" />
        
        <div className="relative z-10 -mt-24 mb-4">
          <div className="h-32 w-32 rounded-full bg-background border-4 border-primary shadow-[0_0_20px_rgba(0,245,255,0.4)] flex items-center justify-center overflow-hidden">
            <User className="h-16 w-16 text-primary" />
          </div>
        </div>
        
        <div className="relative z-10 space-y-2">
          <h1 className="text-4xl font-black uppercase font-display tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
            {user.inGameName}
          </h1>
          <div className="flex gap-2 justify-center font-mono text-sm text-muted-foreground">
            <span className="bg-background/50 px-3 py-1 rounded border border-border/50">UID: {user.freeFireUid}</span>
            {isMe && <span className="bg-background/50 px-3 py-1 rounded border border-border/50">User: {user.username}</span>}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur border-border/50 border-b-2 border-b-secondary hover:-translate-y-1 transition-transform">
          <CardContent className="p-6 text-center space-y-2">
            <Trophy className="h-8 w-8 text-secondary mx-auto opacity-80" />
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Global Rank</p>
            <p className="text-3xl font-bold font-display text-white">#{profile.globalRank || '-'}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 backdrop-blur border-border/50 border-b-2 border-b-primary hover:-translate-y-1 transition-transform">
          <CardContent className="p-6 text-center space-y-2">
            <Target className="h-8 w-8 text-primary mx-auto opacity-80" />
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Total Kills</p>
            <p className="text-3xl font-bold font-display text-white">{profile.totalKills}</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50 border-b-2 border-b-white/50 hover:-translate-y-1 transition-transform">
          <CardContent className="p-6 text-center space-y-2">
            <Gamepad2 className="h-8 w-8 text-white mx-auto opacity-80" />
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Matches</p>
            <p className="text-3xl font-bold font-display text-white">{profile.matchesPlayed}</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50 border-b-2 border-b-secondary hover:-translate-y-1 transition-transform neon-border-green">
          <CardContent className="p-6 text-center space-y-2">
            <IndianRupee className="h-8 w-8 text-secondary mx-auto opacity-80" />
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Earnings</p>
            <p className="text-3xl font-bold font-display text-secondary">₹{profile.totalEarnings}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tournaments */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-wider text-xl flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" /> Tournament History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profile.recentTournaments?.length === 0 ? (
            <p className="text-center text-muted-foreground font-mono py-8">No recent matches played.</p>
          ) : (
            <div className="space-y-4">
              {profile.recentTournaments?.map((entry) => (
                <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-background/50 rounded border border-border/50 hover:border-primary/30 transition-colors gap-4">
                  <div>
                    <h4 className="font-display font-bold uppercase tracking-wider text-lg">Tournament #{entry.tournamentId}</h4>
                    <p className="text-xs font-mono text-muted-foreground mt-1">Placement: {entry.placement} • Points: {entry.totalPoints}</p>
                  </div>
                  
                  <div className="flex gap-6 font-mono text-sm">
                    <div className="text-center">
                      <p className="text-muted-foreground uppercase text-[10px]">Rank</p>
                      <p className="font-bold text-white">#{entry.rank}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground uppercase text-[10px]">Kills</p>
                      <p className="font-bold text-primary">{entry.kills}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground uppercase text-[10px]">Prize</p>
                      <p className="font-bold text-secondary">₹{entry.prize}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
