import { useState } from "react";
import { useLocation } from "wouter";
import { 
  useGetAdminStats, getGetAdminStatsQueryKey,
  useGetPendingRegistrations, getGetPendingRegistrationsQueryKey,
  useVerifyRegistration,
  useCreateTournament, getGetTournamentsQueryKey
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Users, Trophy, IndianRupee, CheckCircle, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats } = useGetAdminStats({ query: { enabled: !!user?.isAdmin, queryKey: getGetAdminStatsQueryKey() } });
  const { data: pendingRegs } = useGetPendingRegistrations({ query: { enabled: !!user?.isAdmin, queryKey: getGetPendingRegistrationsQueryKey() } });
  
  const { mutate: verifyReg } = useVerifyRegistration();

  if (!authLoading && !user?.isAdmin) {
    setLocation("/");
    return null;
  }

  const handleVerify = (regId: number, status: "verified" | "rejected") => {
    verifyReg({ id: regId, data: { status } }, {
      onSuccess: () => {
        toast({ title: `Registration ${status}` });
        queryClient.invalidateQueries({ queryKey: getGetPendingRegistrationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
      },
      onError: (err) => toast({ title: "Error", description: err.error?.message, variant: "destructive" })
    });
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-3 border-b border-primary/20 pb-4">
        <ShieldAlert className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-black uppercase font-display tracking-wider text-primary">Command Center</h1>
          <p className="text-sm font-mono text-muted-foreground">System Overview & Management</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-primary/30">
          <CardContent className="p-6">
            <Users className="h-6 w-6 text-primary mb-2 opacity-80" />
            <p className="text-sm text-muted-foreground font-mono">Total Players</p>
            <p className="text-2xl font-bold font-display">{stats?.totalPlayers || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-secondary/30">
          <CardContent className="p-6">
            <Trophy className="h-6 w-6 text-secondary mb-2 opacity-80" />
            <p className="text-sm text-muted-foreground font-mono">Active Tournaments</p>
            <p className="text-2xl font-bold font-display">{stats?.activeTournaments || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-white/30">
          <CardContent className="p-6">
            <IndianRupee className="h-6 w-6 text-white mb-2 opacity-80" />
            <p className="text-sm text-muted-foreground font-mono">Prize Distributed</p>
            <p className="text-2xl font-bold font-display">₹{stats?.totalPrizeDistributed || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-yellow-500/30">
          <CardContent className="p-6">
            <ShieldAlert className="h-6 w-6 text-yellow-500 mb-2 opacity-80" />
            <p className="text-sm text-muted-foreground font-mono">Pending Verifications</p>
            <p className="text-2xl font-bold font-display text-yellow-500">{stats?.pendingPayments || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="verifications" className="w-full">
        <TabsList className="bg-card/80 border border-border/50 rounded-none h-auto p-1 grid grid-cols-3">
          <TabsTrigger value="verifications" className="font-mono uppercase text-xs sm:text-sm py-3 rounded-none data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/50">
            Verifications
          </TabsTrigger>
          <TabsTrigger value="tournaments" className="font-mono uppercase text-xs sm:text-sm py-3 rounded-none data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/50">
            Tournaments
          </TabsTrigger>
          <TabsTrigger value="create" className="font-mono uppercase text-xs sm:text-sm py-3 rounded-none data-[state=active]:bg-secondary/20 data-[state=active]:text-secondary data-[state=active]:shadow-none border border-transparent data-[state=active]:border-secondary/50">
            Create New
          </TabsTrigger>
        </TabsList>

        <TabsContent value="verifications" className="mt-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="font-display uppercase tracking-wider text-xl text-yellow-500">Pending Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingRegs?.length === 0 ? (
                <p className="text-center font-mono text-muted-foreground py-8">No pending verifications.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="font-mono">
                    <TableHeader>
                      <TableRow>
                        <TableHead>User / IGN</TableHead>
                        <TableHead>Tournament</TableHead>
                        <TableHead>Txn ID / Screenshot</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingRegs?.map((reg: any) => (
                        <TableRow key={reg.id}>
                          <TableCell>
                            <span className="block font-bold text-white">{reg.user.inGameName}</span>
                            <span className="text-xs text-muted-foreground">UID: {reg.user.freeFireUid}</span>
                          </TableCell>
                          <TableCell>T#{reg.tournamentId}</TableCell>
                          <TableCell>
                            <span className="block text-primary">{reg.transactionId || 'None'}</span>
                            {reg.paymentScreenshotUrl && (
                              <a href={reg.paymentScreenshotUrl} target="_blank" rel="noreferrer" className="text-xs text-secondary hover:underline">View Proof</a>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{format(new Date(reg.registeredAt), "MMM d, h:mm a")}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" className="h-8 px-2 border-secondary/50 text-secondary hover:bg-secondary/20" onClick={() => handleVerify(reg.id, "verified")}>
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 px-2 border-destructive/50 text-destructive hover:bg-destructive/20" onClick={() => handleVerify(reg.id, "rejected")}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tournaments" className="mt-6">
           <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="font-display uppercase tracking-wider text-xl text-primary">Manage Tournaments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground font-mono text-sm py-8 text-center">Tournament list and room details form will appear here. Select a tournament to manage its leaderboard or post room details.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <Card className="bg-card/50 border-secondary/30 neon-border-green">
            <CardHeader>
              <CardTitle className="font-display uppercase tracking-wider text-xl text-secondary">Create Tournament</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground font-mono text-sm py-8 text-center">Tournament creation form goes here. Uses CreateTournamentRequest schema.</p>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
