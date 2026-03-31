import { useState } from "react";
import { Link } from "wouter";
import { useGetGlobalLeaderboard, getGetGlobalLeaderboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Medal, Target, IndianRupee, Users } from "lucide-react";

export default function Leaderboard() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetGlobalLeaderboard(
    { page, limit: 50 },
    { query: { queryKey: getGetGlobalLeaderboardQueryKey({ page, limit: 50 }) } }
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="text-center space-y-4">
        <div className="inline-flex mx-auto bg-secondary/10 p-4 rounded-full w-fit neon-border-green mb-2">
          <Trophy className="h-10 w-10 text-secondary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black uppercase font-display tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-secondary via-primary to-secondary drop-shadow-[0_0_10px_rgba(57,255,20,0.4)]">
          Global Rankings
        </h1>
        <p className="text-muted-foreground font-mono max-w-xl mx-auto">
          The top predators in the arena. Earn points by playing matches, securing kills, and placing high.
        </p>
      </div>

      <Card className="bg-card/80 backdrop-blur border-border/50 neon-border">
        <CardContent className="p-0 sm:p-6 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 w-full bg-border/20 rounded animate-pulse" />
              ))}
            </div>
          ) : !data?.players?.length ? (
            <div className="p-12 text-center text-muted-foreground font-mono uppercase tracking-widest">
              Leaderboard is currently empty.
            </div>
          ) : (
            <Table className="min-w-[600px]">
              <TableHeader className="border-b-primary/30 bg-background/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-20 font-mono text-primary uppercase text-center">Rank</TableHead>
                  <TableHead className="font-mono text-primary uppercase">Player</TableHead>
                  <TableHead className="font-mono text-primary uppercase text-right">Points</TableHead>
                  <TableHead className="font-mono text-primary uppercase text-right">Kills</TableHead>
                  <TableHead className="font-mono text-primary uppercase text-right">Matches</TableHead>
                  <TableHead className="font-mono text-primary uppercase text-right">Earnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.players.map((player, idx) => {
                  const isTop3 = player.rank <= 3;
                  return (
                    <TableRow 
                      key={player.user.id} 
                      className={`font-mono border-b-border/30 hover:bg-primary/5 transition-colors cursor-pointer
                        ${player.rank === 1 ? 'bg-secondary/10 hover:bg-secondary/20' : ''}`}
                    >
                      <TableCell className="text-center font-bold">
                        {player.rank === 1 ? <Medal className="h-6 w-6 text-secondary mx-auto" /> :
                         player.rank === 2 ? <Medal className="h-6 w-6 text-zinc-300 mx-auto" /> :
                         player.rank === 3 ? <Medal className="h-6 w-6 text-amber-600 mx-auto" /> :
                         <span className="text-muted-foreground opacity-50">#{player.rank}</span>}
                      </TableCell>
                      <TableCell>
                        <Link href={`/profile/${player.user.id}`} className="flex items-center gap-3 group">
                          <span className={`font-bold font-display tracking-wider text-lg transition-colors group-hover:text-primary
                            ${player.rank === 1 ? 'text-secondary neon-text-green' : 'text-foreground'}`}>
                            {player.user.inGameName}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-primary font-bold text-lg">{player.totalPoints}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        <div className="flex items-center justify-end gap-1"><Target className="h-3 w-3" />{player.totalKills}</div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        <div className="flex items-center justify-end gap-1"><Users className="h-3 w-3" />{player.matchesPlayed}</div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-secondary">
                        {player.totalEarnings > 0 ? `₹${player.totalEarnings}` : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
