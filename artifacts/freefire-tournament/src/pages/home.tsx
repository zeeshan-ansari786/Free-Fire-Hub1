import { Link } from "wouter";
import { useGetTournaments, useGetGlobalLeaderboard, getGetTournamentsQueryKey, getGetGlobalLeaderboardQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Users, Zap, IndianRupee, ArrowRight, Activity, Medal, Swords } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function Home() {
  const { data: tournamentsData, isLoading: isLoadingTournaments } = useGetTournaments(
    { status: "upcoming", limit: 3 },
    { query: { queryKey: getGetTournamentsQueryKey({ status: "upcoming", limit: 3 }) } }
  );

  const { data: leaderboardData, isLoading: isLoadingLeaderboard } = useGetGlobalLeaderboard(
    { limit: 3 },
    { query: { queryKey: getGetGlobalLeaderboardQueryKey({ limit: 3 }) } }
  );

  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <section className="relative -mx-4 px-4 sm:-mx-8 sm:px-8 py-24 lg:py-32 overflow-hidden flex flex-col items-center justify-center text-center">
        <div className="absolute inset-0 z-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070')] bg-cover bg-center mix-blend-luminosity" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/80 to-background z-0" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-4xl mx-auto space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary font-mono text-sm font-semibold uppercase tracking-wider mb-4 neon-border">
            <Activity className="h-4 w-4 animate-pulse" />
            Live Platform
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter font-display leading-none">
            Dominate The <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-primary drop-shadow-[0_0_15px_rgba(0,245,255,0.4)]">
              Battleground
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground font-mono max-w-2xl mx-auto leading-relaxed">
            India's most intense Free Fire tournament platform. Compete in daily matches, rank up globally, and win massive prize pools.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/tournaments">
              <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest clip-path-slant h-14 px-8 shadow-[0_0_20px_rgba(0,245,255,0.5)]">
                Join The Battle <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-primary/50 text-primary hover:bg-primary/10 font-bold uppercase tracking-widest clip-path-slant h-14 px-8">
                View Rankings
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Featured Tournaments */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold font-display uppercase tracking-wider flex items-center gap-3">
            <Zap className="h-8 w-8 text-primary neon-text" /> 
            Upcoming Matches
          </h2>
          <Link href="/tournaments" className="text-primary hover:text-secondary font-mono text-sm uppercase tracking-wider hidden sm:flex items-center gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoadingTournaments ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : tournamentsData?.tournaments.length === 0 ? (
          <Card className="border-dashed border-primary/30 bg-card/30">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trophy className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground font-mono uppercase tracking-widest">No upcoming tournaments right now.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournamentsData?.tournaments.map((t) => (
              <Link key={t.id} href={`/tournaments/${t.id}`}>
                <Card className="group cursor-pointer hover:neon-border transition-all duration-300 bg-card/80 backdrop-blur border-primary/20 overflow-hidden relative h-full flex flex-col">
                  <div className="absolute top-0 right-0 p-3 flex gap-2 z-10">
                    <div className="bg-background/90 backdrop-blur px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider border border-primary/30 text-primary shadow-sm rounded">
                      {t.gameMode}
                    </div>
                  </div>
                  
                  <div className="h-32 bg-muted relative overflow-hidden">
                    {t.bannerUrl ? (
                      <img src={t.bannerUrl} alt={t.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-card flex items-center justify-center">
                        <Swords className="h-12 w-12 text-primary/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                  </div>
                  
                  <CardContent className="p-5 flex-1 flex flex-col pt-2 relative z-10">
                    <h3 className="text-xl font-bold font-display uppercase tracking-wider mb-2 group-hover:text-primary transition-colors line-clamp-1">{t.title}</h3>
                    
                    <div className="text-xs text-muted-foreground font-mono mb-4 flex items-center gap-2">
                      <Zap className="h-3 w-3 text-secondary" />
                      {format(new Date(t.startDateTime), "MMM do, h:mm a")}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4 mt-auto">
                      <div className="bg-background/50 p-3 rounded border border-border/50">
                        <p className="text-[10px] text-muted-foreground font-mono uppercase">Prize Pool</p>
                        <p className="text-lg font-bold text-secondary flex items-center">
                          <IndianRupee className="h-4 w-4" />{t.prizePool}
                        </p>
                      </div>
                      <div className="bg-background/50 p-3 rounded border border-border/50">
                        <p className="text-[10px] text-muted-foreground font-mono uppercase">Entry Fee</p>
                        <p className="text-lg font-bold text-primary flex items-center">
                          {t.entryFee > 0 ? <><IndianRupee className="h-4 w-4" />{t.entryFee}</> : "FREE"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono uppercase text-muted-foreground">
                        <span>Slots Filled</span>
                        <span>{t.filledSlots}/{t.maxSlots}</span>
                      </div>
                      <div className="w-full bg-background h-2 rounded-full overflow-hidden border border-border/50">
                        <div 
                          className="bg-primary h-full shadow-[0_0_10px_rgba(0,245,255,0.8)]" 
                          style={{ width: `${(t.filledSlots / t.maxSlots) * 100}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Top Players */}
      <section className="space-y-8 pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold font-display uppercase tracking-wider flex items-center gap-3">
            <Trophy className="h-8 w-8 text-secondary neon-text-green" /> 
            Hall of Fame
          </h2>
          <Link href="/leaderboard" className="text-secondary hover:text-primary font-mono text-sm uppercase tracking-wider hidden sm:flex items-center gap-1">
            Full Rankings <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoadingLeaderboard ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : leaderboardData?.players.length === 0 ? (
          <Card className="border-dashed border-secondary/30 bg-card/30">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Medal className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground font-mono uppercase tracking-widest">Rankings are empty.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {leaderboardData?.players.map((player, idx) => (
              <Link key={player.user.id} href={`/profile/${player.user.id}`}>
                <Card className={`group cursor-pointer transition-all duration-300 bg-card/80 backdrop-blur border-border/50 overflow-hidden relative
                  ${idx === 0 ? 'neon-border-green' : 'hover:border-primary/50'}`}>
                  
                  {idx === 0 && (
                    <div className="absolute top-0 right-0 bg-secondary text-secondary-foreground font-bold px-3 py-1 font-mono text-xs rounded-bl-lg z-10 shadow-[0_0_10px_rgba(57,255,20,0.5)]">
                      #1 GLOBAL
                    </div>
                  )}

                  <CardContent className="p-6 flex items-center gap-4">
                    <div className={`text-4xl font-black font-display opacity-20 ${idx === 0 ? 'text-secondary opacity-40' : ''}`}>
                      #{player.rank}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-xl font-bold font-display uppercase tracking-wider group-hover:text-secondary transition-colors">
                        {player.user.inGameName}
                      </h3>
                      <p className="text-xs text-muted-foreground font-mono mb-2">UID: {player.user.freeFireUid}</p>
                      
                      <div className="flex gap-4 text-sm font-mono mt-2">
                        <span className="flex items-center gap-1 text-primary"><Users className="h-3 w-3" /> {player.totalKills} Kills</span>
                        <span className="flex items-center gap-1 text-secondary"><IndianRupee className="h-3 w-3" /> {player.totalEarnings}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
