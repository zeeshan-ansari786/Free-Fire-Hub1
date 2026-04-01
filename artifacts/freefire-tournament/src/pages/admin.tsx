import { useState } from "react";
import { useLocation } from "wouter";
import { 
  useGetAdminStats, getGetAdminStatsQueryKey,
  useGetPendingRegistrations, getGetPendingRegistrationsQueryKey,
  useVerifyRegistration,
  useCreateTournament,
  useUpdateTournament,
  usePostRoomDetails,
  useGetTournaments, getGetTournamentsQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Users, Trophy, IndianRupee, CheckCircle, XCircle, Pencil, Key, Plus, Swords, Ban, Wallet, ArrowUpCircle } from "lucide-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";

type Tournament = {
  id: number; title: string; description?: string | null; startDateTime: string;
  mapName: string; gameMode: string; maxSlots: number; filledSlots: number;
  status: string; prizePool: number; entryFee: number; bannerUrl?: string | null;
  roomId?: string | null; roomPassword?: string | null;
};

type UserEntry = {
  id: number; username: string; email: string; inGameName: string; freeFireUid: string;
  whatsappNumber: string; isAdmin: boolean; isBanned: boolean; walletBalance: number;
  matchesPlayed: number; totalEarnings: number; createdAt: string;
};

type FinancialData = {
  totalDeposits: number; depositCount: number; totalWithdrawals: number; withdrawalCount: number;
  pendingWithdrawals: Array<{ id: number; userId: number; amount: number; description: string; createdAt: string; user: UserEntry | null }>;
};

function useAdminUsers() {
  return useQuery({ queryKey: ["admin-users"], queryFn: () => customFetch<UserEntry[]>("/api/admin/users", { method: "GET" }) });
}
function useAdminFinancial() {
  return useQuery({ queryKey: ["admin-financial"], queryFn: () => customFetch<FinancialData>("/api/admin/financial", { method: "GET" }) });
}
function useBanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ isBanned: boolean; message: string }>(`/api/admin/users/${id}/ban`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}
function useApproveWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      customFetch<{ message: string }>(`/api/admin/financial/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-financial"] }),
  });
}

export default function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editTournament, setEditTournament] = useState<Tournament | null>(null);
  const [roomTournament, setRoomTournament] = useState<Tournament | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", startDateTime: "", mapName: "", gameMode: "", maxSlots: "", status: "", bannerUrl: "" });
  const [roomForm, setRoomForm] = useState({ roomId: "", roomPassword: "" });
  const [createForm, setCreateForm] = useState({ title: "", description: "", startDateTime: "", mapName: "Bermuda", gameMode: "squad", maxSlots: "100", prizePool: "", entryFee: "0", bannerUrl: "" });

  const { data: stats } = useGetAdminStats({ query: { enabled: !!user?.isAdmin, queryKey: getGetAdminStatsQueryKey() } });
  const { data: pendingRegs } = useGetPendingRegistrations({ query: { enabled: !!user?.isAdmin, queryKey: getGetPendingRegistrationsQueryKey() } });
  const { data: tournamentsData } = useGetTournaments({ limit: 50 }, { query: { enabled: !!user?.isAdmin, queryKey: getGetTournamentsQueryKey({ limit: 50 }) } });
  const { data: adminUsers, isLoading: usersLoading } = useAdminUsers();
  const { data: financial, isLoading: financialLoading } = useAdminFinancial();

  const { mutate: verifyReg } = useVerifyRegistration();
  const { mutate: updateTournament, isPending: isUpdating } = useUpdateTournament();
  const { mutate: postRoom, isPending: isPostingRoom } = usePostRoomDetails();
  const { mutate: createTournament, isPending: isCreating } = useCreateTournament();
  const { mutate: banUser } = useBanUser();
  const { mutate: approveWithdrawal } = useApproveWithdrawal();

  if (!authLoading && !user?.isAdmin) { setLocation("/"); return null; }

  const handleVerify = (regId: number, status: "verified" | "rejected") => {
    verifyReg({ id: regId, data: { status } }, {
      onSuccess: () => { toast({ title: `Registration ${status}` }); queryClient.invalidateQueries({ queryKey: getGetPendingRegistrationsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() }); },
      onError: (err) => toast({ title: "Error", description: (err as any)?.error?.message, variant: "destructive" })
    });
  };

  const openEdit = (t: Tournament) => {
    setEditTournament(t);
    setEditForm({ title: t.title, description: t.description ?? "", startDateTime: format(new Date(t.startDateTime), "yyyy-MM-dd'T'HH:mm"), mapName: t.mapName, gameMode: t.gameMode, maxSlots: String(t.maxSlots), status: t.status, bannerUrl: t.bannerUrl ?? "" });
  };

  const handleEditSave = () => {
    if (!editTournament) return;
    updateTournament({ id: editTournament.id, data: { title: editForm.title, description: editForm.description || undefined, startDateTime: new Date(editForm.startDateTime).toISOString(), mapName: editForm.mapName, gameMode: editForm.gameMode as any, maxSlots: parseInt(editForm.maxSlots), status: editForm.status as any, bannerUrl: editForm.bannerUrl || undefined } }, {
      onSuccess: () => { toast({ title: "Tournament updated!" }); setEditTournament(null); queryClient.invalidateQueries({ queryKey: getGetTournamentsQueryKey({ limit: 50 }) }); },
      onError: (err) => toast({ title: "Update failed", description: (err as any)?.error?.message, variant: "destructive" })
    });
  };

  const handleRoomSave = () => {
    if (!roomTournament) return;
    postRoom({ id: roomTournament.id, data: { roomId: roomForm.roomId, roomPassword: roomForm.roomPassword } }, {
      onSuccess: () => { toast({ title: "Room details saved!" }); setRoomTournament(null); queryClient.invalidateQueries({ queryKey: getGetTournamentsQueryKey({ limit: 50 }) }); },
      onError: (err) => toast({ title: "Failed", description: (err as any)?.error?.message, variant: "destructive" })
    });
  };

  const handleCreate = () => {
    createTournament({ data: { title: createForm.title, description: createForm.description || undefined, startDateTime: new Date(createForm.startDateTime).toISOString(), mapName: createForm.mapName as any, gameMode: createForm.gameMode as any, maxSlots: parseInt(createForm.maxSlots), prizePool: parseFloat(createForm.prizePool) || 0, entryFee: parseFloat(createForm.entryFee) || 0, bannerUrl: createForm.bannerUrl || undefined } }, {
      onSuccess: () => { toast({ title: "Tournament created!" }); setCreateForm({ title: "", description: "", startDateTime: "", mapName: "Bermuda", gameMode: "squad", maxSlots: "100", prizePool: "", entryFee: "0", bannerUrl: "" }); queryClient.invalidateQueries({ queryKey: getGetTournamentsQueryKey({ limit: 50 }) }); },
      onError: (err) => toast({ title: "Failed", description: (err as any)?.error?.message, variant: "destructive" })
    });
  };

  const handleBan = (userId: number, currentlyBanned: boolean) => {
    banUser(userId, {
      onSuccess: (data) => toast({ title: data.message }),
      onError: () => toast({ title: "Failed to update user", variant: "destructive" }),
    });
  };

  const handleWithdrawal = (id: number, action: "approve" | "reject") => {
    approveWithdrawal({ id, action }, {
      onSuccess: (data) => toast({ title: data.message }),
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  };

  const statusColor: Record<string, string> = { upcoming: "text-primary border-primary/30", ongoing: "text-secondary border-secondary/30", completed: "text-muted-foreground border-border" };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-3 border-b border-primary/20 pb-4">
        <ShieldAlert className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-black uppercase font-display tracking-wider text-primary">Command Center</h1>
          <p className="text-sm font-mono text-muted-foreground">System Overview & Management</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-primary/30"><CardContent className="p-6"><Users className="h-6 w-6 text-primary mb-2 opacity-80" /><p className="text-sm text-muted-foreground font-mono">Total Players</p><p className="text-2xl font-bold font-display">{stats?.totalPlayers || 0}</p></CardContent></Card>
        <Card className="bg-card/50 border-secondary/30"><CardContent className="p-6"><Trophy className="h-6 w-6 text-secondary mb-2 opacity-80" /><p className="text-sm text-muted-foreground font-mono">Active Tournaments</p><p className="text-2xl font-bold font-display">{stats?.activeTournaments || 0}</p></CardContent></Card>
        <Card className="bg-card/50 border-white/30"><CardContent className="p-6"><IndianRupee className="h-6 w-6 text-white mb-2 opacity-80" /><p className="text-sm text-muted-foreground font-mono">Prize Distributed</p><p className="text-2xl font-bold font-display">₹{stats?.totalPrizeDistributed || 0}</p></CardContent></Card>
        <Card className="bg-card/50 border-yellow-500/30"><CardContent className="p-6"><ShieldAlert className="h-6 w-6 text-yellow-500 mb-2 opacity-80" /><p className="text-sm text-muted-foreground font-mono">Pending Verifications</p><p className="text-2xl font-bold font-display text-yellow-500">{stats?.pendingPayments || 0}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="tournaments" className="w-full">
        <TabsList className="bg-card/80 border border-border/50 rounded-none h-auto p-1 grid grid-cols-5">
          {[["verifications","Verifications"],["tournaments","Tournaments"],["create","Create"],["users","Players"],["financial","Financial"]].map(([val, label]) => (
            <TabsTrigger key={val} value={val} className="font-mono uppercase text-xs py-2.5 rounded-none data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/50">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* VERIFICATIONS */}
        <TabsContent value="verifications" className="mt-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader><CardTitle className="font-display uppercase tracking-wider text-xl text-yellow-500">Pending Payments</CardTitle></CardHeader>
            <CardContent>
              {!pendingRegs?.length ? (
                <p className="text-center font-mono text-muted-foreground py-8">No pending verifications.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="font-mono">
                    <TableHeader><TableRow><TableHead>User / IGN</TableHead><TableHead>Tournament</TableHead><TableHead>Txn ID</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {pendingRegs?.map((reg: any) => (
                        <TableRow key={reg.id}>
                          <TableCell><span className="block font-bold text-white">{reg.user.inGameName}</span><span className="text-xs text-muted-foreground">UID: {reg.user.freeFireUid}</span></TableCell>
                          <TableCell>T#{reg.tournamentId}</TableCell>
                          <TableCell><span className="block text-primary">{reg.transactionId || 'None'}</span>{reg.paymentScreenshotUrl && <a href={reg.paymentScreenshotUrl} target="_blank" rel="noreferrer" className="text-xs text-secondary hover:underline">View Proof</a>}</TableCell>
                          <TableCell className="text-xs">{format(new Date(reg.registeredAt), "MMM d, h:mm a")}</TableCell>
                          <TableCell className="text-right"><div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="h-8 px-2 border-secondary/50 text-secondary hover:bg-secondary/20" onClick={() => handleVerify(reg.id, "verified")}><CheckCircle className="h-4 w-4" /></Button>
                            <Button size="sm" variant="outline" className="h-8 px-2 border-destructive/50 text-destructive hover:bg-destructive/20" onClick={() => handleVerify(reg.id, "rejected")}><XCircle className="h-4 w-4" /></Button>
                          </div></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TOURNAMENTS */}
        <TabsContent value="tournaments" className="mt-6 space-y-4">
          {!tournamentsData?.tournaments?.length ? (
            <Card className="bg-card/50 border-border/50"><CardContent className="py-12 text-center font-mono text-muted-foreground">No tournaments found.</CardContent></Card>
          ) : (
            (tournamentsData.tournaments as Tournament[]).map((t) => (
              <Card key={t.id} className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0"><Swords className="h-5 w-5 text-primary/60" /></div>
                    <div>
                      <h3 className="font-bold font-display uppercase tracking-wider text-foreground">{t.title}</h3>
                      <div className="flex flex-wrap gap-3 mt-1">
                        <span className={`text-xs font-mono px-2 py-0.5 border rounded ${statusColor[t.status] || "text-muted-foreground border-border"}`}>{t.status.toUpperCase()}</span>
                        <span className="text-xs font-mono text-muted-foreground">{format(new Date(t.startDateTime), "MMM d, h:mm a")}</span>
                        <span className="text-xs font-mono text-muted-foreground">{t.filledSlots}/{t.maxSlots} slots · {t.mapName} · {t.gameMode}</span>
                      </div>
                      {t.roomId && <p className="text-xs font-mono text-secondary mt-1">Room: <span className="text-foreground">{t.roomId}</span> | Pass: <span className="text-foreground">{t.roomPassword}</span></p>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 font-mono text-xs" onClick={() => openEdit(t)}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                    <Button size="sm" variant="outline" className="border-secondary/40 text-secondary hover:bg-secondary/10 font-mono text-xs" onClick={() => { setRoomTournament(t); setRoomForm({ roomId: t.roomId ?? "", roomPassword: t.roomPassword ?? "" }); }}><Key className="h-3 w-3 mr-1" /> Room</Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* CREATE */}
        <TabsContent value="create" className="mt-6">
          <Card className="bg-card/50 border-secondary/30">
            <CardHeader><CardTitle className="font-display uppercase tracking-wider text-xl text-secondary flex items-center gap-2"><Plus className="h-5 w-5" /> Create Tournament</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[["Title *","title","text","Tournament name"],["Start Date & Time *","startDateTime","datetime-local",""],["Max Slots *","maxSlots","number","100"],["Entry Fee (₹)","entryFee","number","0"],["Prize Pool (₹)","prizePool","number","0"],["Banner Image URL","bannerUrl","text","https://..."]].map(([label, key, type, placeholder]) => (
                  <div key={key} className="space-y-1">
                    <Label className="font-mono text-xs uppercase text-muted-foreground">{label}</Label>
                    <Input type={type} value={(createForm as any)[key]} onChange={e => setCreateForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder || undefined} className="bg-background/50 border-border/50 font-mono" />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Map</Label>
                  <Select value={createForm.mapName} onValueChange={v => setCreateForm(f => ({ ...f, mapName: v }))}><SelectTrigger className="bg-background/50 border-border/50 font-mono"><SelectValue /></SelectTrigger><SelectContent>{["Bermuda","Kalahari","Purgatory","Alpine"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Game Mode</Label>
                  <Select value={createForm.gameMode} onValueChange={v => setCreateForm(f => ({ ...f, gameMode: v }))}><SelectTrigger className="bg-background/50 border-border/50 font-mono"><SelectValue /></SelectTrigger><SelectContent>{["squad","duo","solo"].map(m => <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Description</Label>
                <Input value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" className="bg-background/50 border-border/50 font-mono" />
              </div>
              <Button onClick={handleCreate} disabled={isCreating || !createForm.title || !createForm.startDateTime} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-widest">
                {isCreating ? "Creating..." : "Create Tournament"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* USERS / PLAYERS */}
        <TabsContent value="users" className="mt-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader><CardTitle className="font-display uppercase tracking-wider text-xl text-primary flex items-center gap-2"><Users className="h-5 w-5" /> Player Management</CardTitle></CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-border/20 rounded animate-pulse" />)}</div>
              ) : !adminUsers?.length ? (
                <p className="text-center font-mono text-muted-foreground py-8">No users found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="font-mono">
                    <TableHeader><TableRow><TableHead>Player</TableHead><TableHead>UID</TableHead><TableHead className="text-right">Wallet</TableHead><TableHead className="text-right">Matches</TableHead><TableHead>Joined</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {adminUsers.filter(u => !u.isAdmin).map(u => (
                        <TableRow key={u.id} className={u.isBanned ? "opacity-50" : ""}>
                          <TableCell>
                            <span className="block font-bold">{u.inGameName}</span>
                            <span className="text-xs text-muted-foreground">{u.email}</span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{u.freeFireUid}</TableCell>
                          <TableCell className="text-right text-secondary font-bold">₹{u.walletBalance}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{u.matchesPlayed}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(u.createdAt), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            {u.isBanned ? (
                              <span className="text-xs text-destructive border border-destructive/30 px-2 py-0.5 rounded">BANNED</span>
                            ) : (
                              <span className="text-xs text-secondary border border-secondary/30 px-2 py-0.5 rounded">ACTIVE</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" className={`h-8 px-3 text-xs font-mono ${u.isBanned ? "border-secondary/50 text-secondary hover:bg-secondary/10" : "border-destructive/50 text-destructive hover:bg-destructive/10"}`} onClick={() => handleBan(u.id, u.isBanned)}>
                              <Ban className="h-3 w-3 mr-1" /> {u.isBanned ? "Unban" : "Ban"}
                            </Button>
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

        {/* FINANCIAL */}
        <TabsContent value="financial" className="mt-6 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card/50 border-secondary/30"><CardContent className="p-5"><p className="text-xs font-mono text-muted-foreground">Total Deposits</p><p className="text-2xl font-bold font-display text-secondary">₹{financial?.totalDeposits || 0}</p><p className="text-xs text-muted-foreground font-mono">{financial?.depositCount || 0} transactions</p></CardContent></Card>
            <Card className="bg-card/50 border-destructive/30"><CardContent className="p-5"><p className="text-xs font-mono text-muted-foreground">Total Withdrawals</p><p className="text-2xl font-bold font-display text-destructive">₹{financial?.totalWithdrawals || 0}</p><p className="text-xs text-muted-foreground font-mono">{financial?.withdrawalCount || 0} requests</p></CardContent></Card>
            <Card className="bg-card/50 border-yellow-500/30"><CardContent className="p-5"><p className="text-xs font-mono text-muted-foreground">Pending Withdrawals</p><p className="text-2xl font-bold font-display text-yellow-500">{financial?.pendingWithdrawals?.length || 0}</p><p className="text-xs text-muted-foreground font-mono">Awaiting approval</p></CardContent></Card>
            <Card className="bg-card/50 border-primary/30"><CardContent className="p-5"><p className="text-xs font-mono text-muted-foreground">Net Balance</p><p className="text-2xl font-bold font-display text-primary">₹{(financial?.totalDeposits || 0) - (financial?.totalWithdrawals || 0)}</p><p className="text-xs text-muted-foreground font-mono">Deposits - Withdrawals</p></CardContent></Card>
          </div>

          {/* Pending Withdrawals */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader><CardTitle className="font-display uppercase tracking-wider text-xl text-yellow-500 flex items-center gap-2"><ArrowUpCircle className="h-5 w-5" /> Pending Withdrawal Requests</CardTitle></CardHeader>
            <CardContent>
              {financialLoading ? (
                <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-12 bg-border/20 rounded animate-pulse" />)}</div>
              ) : !financial?.pendingWithdrawals?.length ? (
                <p className="text-center font-mono text-muted-foreground py-8">No pending withdrawals.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="font-mono">
                    <TableHeader><TableRow><TableHead>Player</TableHead><TableHead>UPI Details</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {financial.pendingWithdrawals.map(w => (
                        <TableRow key={w.id}>
                          <TableCell><span className="font-bold">{w.user?.inGameName || `User #${w.userId}`}</span><span className="block text-xs text-muted-foreground">{w.user?.email}</span></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{w.description}</TableCell>
                          <TableCell className="text-right font-bold text-yellow-500">₹{w.amount}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(w.createdAt), "MMM d, h:mm a")}</TableCell>
                          <TableCell className="text-right"><div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="h-8 px-2 border-secondary/50 text-secondary hover:bg-secondary/20 text-xs" onClick={() => handleWithdrawal(w.id, "approve")}><CheckCircle className="h-3 w-3 mr-1" /> Approve</Button>
                            <Button size="sm" variant="outline" className="h-8 px-2 border-destructive/50 text-destructive hover:bg-destructive/20 text-xs" onClick={() => handleWithdrawal(w.id, "reject")}><XCircle className="h-3 w-3 mr-1" /> Reject</Button>
                          </div></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editTournament} onOpenChange={open => !open && setEditTournament(null)}>
        <DialogContent className="bg-card border-primary/30 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display uppercase tracking-wider text-primary flex items-center gap-2"><Pencil className="h-4 w-4" /> Edit Tournament</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {[["Title","title","text"],["Description","description","text"],["Start Date & Time","startDateTime","datetime-local"],["Max Slots","maxSlots","number"],["Banner URL","bannerUrl","text"]].map(([label, key, type]) => (
              <div key={key} className="space-y-1">
                <Label className="font-mono text-xs uppercase text-muted-foreground">{label}</Label>
                <Input type={type} value={(editForm as any)[key]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} className="bg-background/50 border-border/50 font-mono" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Map</Label>
                <Select value={editForm.mapName} onValueChange={v => setEditForm(f => ({ ...f, mapName: v }))}><SelectTrigger className="bg-background/50 border-border/50 font-mono"><SelectValue /></SelectTrigger><SelectContent>{["Bermuda","Kalahari","Purgatory","Alpine"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Game Mode</Label>
                <Select value={editForm.gameMode} onValueChange={v => setEditForm(f => ({ ...f, gameMode: v }))}><SelectTrigger className="bg-background/50 border-border/50 font-mono"><SelectValue /></SelectTrigger><SelectContent>{["squad","duo","solo"].map(m => <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}><SelectTrigger className="bg-background/50 border-border/50 font-mono"><SelectValue /></SelectTrigger><SelectContent>{["upcoming","ongoing","completed"].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 border-border/50" onClick={() => setEditTournament(null)}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={isUpdating} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest">{isUpdating ? "Saving..." : "Save Changes"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Room Dialog */}
      <Dialog open={!!roomTournament} onOpenChange={open => !open && setRoomTournament(null)}>
        <DialogContent className="bg-card border-secondary/30 max-w-md">
          <DialogHeader><DialogTitle className="font-display uppercase tracking-wider text-secondary flex items-center gap-2"><Key className="h-4 w-4" /> Post Room Details</DialogTitle></DialogHeader>
          <p className="text-xs font-mono text-muted-foreground">For: <span className="text-foreground">{roomTournament?.title}</span></p>
          <div className="space-y-4 pt-2">
            <div className="space-y-1"><Label className="font-mono text-xs uppercase text-muted-foreground">Room ID</Label><Input value={roomForm.roomId} onChange={e => setRoomForm(f => ({ ...f, roomId: e.target.value }))} placeholder="e.g. 1234567" className="bg-background/50 border-border/50 font-mono text-lg tracking-widest" /></div>
            <div className="space-y-1"><Label className="font-mono text-xs uppercase text-muted-foreground">Room Password</Label><Input value={roomForm.roomPassword} onChange={e => setRoomForm(f => ({ ...f, roomPassword: e.target.value }))} placeholder="e.g. ff2024" className="bg-background/50 border-border/50 font-mono text-lg tracking-widest" /></div>
            <p className="text-xs text-muted-foreground font-mono">Only verified players will see these details 15 mins before start.</p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 border-border/50" onClick={() => setRoomTournament(null)}>Cancel</Button>
              <Button onClick={handleRoomSave} disabled={isPostingRoom || !roomForm.roomId || !roomForm.roomPassword} className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-widest">{isPostingRoom ? "Saving..." : "Post Room"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
