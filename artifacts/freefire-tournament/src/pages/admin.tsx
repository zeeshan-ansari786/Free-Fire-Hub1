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
import { ShieldAlert, Users, Trophy, IndianRupee, CheckCircle, XCircle, Pencil, Key, Plus, Swords } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type Tournament = {
  id: number;
  title: string;
  description?: string | null;
  startDateTime: string;
  mapName: string;
  gameMode: string;
  maxSlots: number;
  filledSlots: number;
  status: string;
  prizePool: number;
  entryFee: number;
  bannerUrl?: string | null;
  roomId?: string | null;
  roomPassword?: string | null;
};

export default function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editTournament, setEditTournament] = useState<Tournament | null>(null);
  const [roomTournament, setRoomTournament] = useState<Tournament | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [editForm, setEditForm] = useState({
    title: "", description: "", startDateTime: "", mapName: "",
    gameMode: "", maxSlots: "", status: "", bannerUrl: "",
  });

  const [roomForm, setRoomForm] = useState({ roomId: "", roomPassword: "" });

  const [createForm, setCreateForm] = useState({
    title: "", description: "", startDateTime: "", mapName: "Bermuda",
    gameMode: "squad", maxSlots: "100", prizePool: "", entryFee: "0", bannerUrl: "",
  });

  const { data: stats } = useGetAdminStats({ query: { enabled: !!user?.isAdmin, queryKey: getGetAdminStatsQueryKey() } });
  const { data: pendingRegs } = useGetPendingRegistrations({ query: { enabled: !!user?.isAdmin, queryKey: getGetPendingRegistrationsQueryKey() } });
  const { data: tournamentsData } = useGetTournaments({ limit: 50 }, { query: { enabled: !!user?.isAdmin, queryKey: getGetTournamentsQueryKey({ limit: 50 }) } });

  const { mutate: verifyReg } = useVerifyRegistration();
  const { mutate: updateTournament, isPending: isUpdating } = useUpdateTournament();
  const { mutate: postRoom, isPending: isPostingRoom } = usePostRoomDetails();
  const { mutate: createTournament, isPending: isCreating } = useCreateTournament();

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
      onError: (err) => toast({ title: "Error", description: (err as any)?.error?.message, variant: "destructive" })
    });
  };

  const openEdit = (t: Tournament) => {
    setEditTournament(t);
    setEditForm({
      title: t.title,
      description: t.description ?? "",
      startDateTime: format(new Date(t.startDateTime), "yyyy-MM-dd'T'HH:mm"),
      mapName: t.mapName,
      gameMode: t.gameMode,
      maxSlots: String(t.maxSlots),
      status: t.status,
      bannerUrl: t.bannerUrl ?? "",
    });
  };

  const openRoom = (t: Tournament) => {
    setRoomTournament(t);
    setRoomForm({ roomId: t.roomId ?? "", roomPassword: t.roomPassword ?? "" });
  };

  const handleEditSave = () => {
    if (!editTournament) return;
    updateTournament({
      id: editTournament.id,
      data: {
        title: editForm.title,
        description: editForm.description || undefined,
        startDateTime: new Date(editForm.startDateTime).toISOString(),
        mapName: editForm.mapName,
        gameMode: editForm.gameMode as any,
        maxSlots: parseInt(editForm.maxSlots),
        status: editForm.status as any,
        bannerUrl: editForm.bannerUrl || undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Tournament updated!" });
        setEditTournament(null);
        queryClient.invalidateQueries({ queryKey: getGetTournamentsQueryKey({ limit: 50 }) });
      },
      onError: (err) => toast({ title: "Update failed", description: (err as any)?.error?.message, variant: "destructive" })
    });
  };

  const handleRoomSave = () => {
    if (!roomTournament) return;
    postRoom({
      id: roomTournament.id,
      data: { roomId: roomForm.roomId, roomPassword: roomForm.roomPassword }
    }, {
      onSuccess: () => {
        toast({ title: "Room details saved!" });
        setRoomTournament(null);
        queryClient.invalidateQueries({ queryKey: getGetTournamentsQueryKey({ limit: 50 }) });
      },
      onError: (err) => toast({ title: "Failed", description: (err as any)?.error?.message, variant: "destructive" })
    });
  };

  const handleCreate = () => {
    createTournament({
      data: {
        title: createForm.title,
        description: createForm.description || undefined,
        startDateTime: new Date(createForm.startDateTime).toISOString(),
        mapName: createForm.mapName as any,
        gameMode: createForm.gameMode as any,
        maxSlots: parseInt(createForm.maxSlots),
        prizePool: parseFloat(createForm.prizePool) || 0,
        entryFee: parseFloat(createForm.entryFee) || 0,
        bannerUrl: createForm.bannerUrl || undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Tournament created!" });
        setCreateForm({ title: "", description: "", startDateTime: "", mapName: "Bermuda", gameMode: "squad", maxSlots: "100", prizePool: "", entryFee: "0", bannerUrl: "" });
        queryClient.invalidateQueries({ queryKey: getGetTournamentsQueryKey({ limit: 50 }) });
      },
      onError: (err) => toast({ title: "Failed", description: (err as any)?.error?.message, variant: "destructive" })
    });
  };

  const statusColor: Record<string, string> = {
    upcoming: "text-primary border-primary/30",
    ongoing: "text-secondary border-secondary/30",
    completed: "text-muted-foreground border-border",
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

      <Tabs defaultValue="tournaments" className="w-full">
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

        {/* VERIFICATIONS TAB */}
        <TabsContent value="verifications" className="mt-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="font-display uppercase tracking-wider text-xl text-yellow-500">Pending Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {!pendingRegs?.length ? (
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

        {/* TOURNAMENTS TAB */}
        <TabsContent value="tournaments" className="mt-6 space-y-4">
          {!tournamentsData?.tournaments?.length ? (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="py-12 text-center font-mono text-muted-foreground">No tournaments found.</CardContent>
            </Card>
          ) : (
            tournamentsData.tournaments.map((t: Tournament) => (
              <Card key={t.id} className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Swords className="h-5 w-5 text-primary/60" />
                    </div>
                    <div>
                      <h3 className="font-bold font-display uppercase tracking-wider text-foreground">{t.title}</h3>
                      <div className="flex flex-wrap gap-3 mt-1">
                        <span className={`text-xs font-mono px-2 py-0.5 border rounded ${statusColor[t.status] || "text-muted-foreground border-border"}`}>
                          {t.status.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {format(new Date(t.startDateTime), "MMM d, h:mm a")}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {t.filledSlots}/{t.maxSlots} slots
                        </span>
                        <span className="text-xs font-mono text-muted-foreground capitalize">
                          {t.mapName} · {t.gameMode}
                        </span>
                      </div>
                      {t.roomId && (
                        <p className="text-xs font-mono text-secondary mt-1">
                          Room: <span className="text-foreground">{t.roomId}</span> | Pass: <span className="text-foreground">{t.roomPassword}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 font-mono text-xs" onClick={() => openEdit(t)}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="border-secondary/40 text-secondary hover:bg-secondary/10 font-mono text-xs" onClick={() => openRoom(t)}>
                      <Key className="h-3 w-3 mr-1" /> Room
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* CREATE TAB */}
        <TabsContent value="create" className="mt-6">
          <Card className="bg-card/50 border-secondary/30">
            <CardHeader>
              <CardTitle className="font-display uppercase tracking-wider text-xl text-secondary flex items-center gap-2">
                <Plus className="h-5 w-5" /> Create Tournament
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Title *</Label>
                  <Input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="Tournament name" className="bg-background/50 border-border/50 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Start Date & Time *</Label>
                  <Input type="datetime-local" value={createForm.startDateTime} onChange={e => setCreateForm(f => ({ ...f, startDateTime: e.target.value }))} className="bg-background/50 border-border/50 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Map</Label>
                  <Select value={createForm.mapName} onValueChange={v => setCreateForm(f => ({ ...f, mapName: v }))}>
                    <SelectTrigger className="bg-background/50 border-border/50 font-mono"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bermuda">Bermuda</SelectItem>
                      <SelectItem value="Kalahari">Kalahari</SelectItem>
                      <SelectItem value="Purgatory">Purgatory</SelectItem>
                      <SelectItem value="Alpine">Alpine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Game Mode</Label>
                  <Select value={createForm.gameMode} onValueChange={v => setCreateForm(f => ({ ...f, gameMode: v }))}>
                    <SelectTrigger className="bg-background/50 border-border/50 font-mono"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="squad">Squad</SelectItem>
                      <SelectItem value="duo">Duo</SelectItem>
                      <SelectItem value="solo">Solo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Max Slots *</Label>
                  <Input type="number" value={createForm.maxSlots} onChange={e => setCreateForm(f => ({ ...f, maxSlots: e.target.value }))} className="bg-background/50 border-border/50 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Entry Fee (₹)</Label>
                  <Input type="number" value={createForm.entryFee} onChange={e => setCreateForm(f => ({ ...f, entryFee: e.target.value }))} className="bg-background/50 border-border/50 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Prize Pool (₹)</Label>
                  <Input type="number" value={createForm.prizePool} onChange={e => setCreateForm(f => ({ ...f, prizePool: e.target.value }))} placeholder="0" className="bg-background/50 border-border/50 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Banner Image URL</Label>
                  <Input value={createForm.bannerUrl} onChange={e => setCreateForm(f => ({ ...f, bannerUrl: e.target.value }))} placeholder="https://..." className="bg-background/50 border-border/50 font-mono" />
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
      </Tabs>

      {/* EDIT TOURNAMENT DIALOG */}
      <Dialog open={!!editTournament} onOpenChange={open => !open && setEditTournament(null)}>
        <DialogContent className="bg-card border-primary/30 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wider text-primary flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Edit Tournament
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Title</Label>
              <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="bg-background/50 border-border/50 font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Description</Label>
              <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="bg-background/50 border-border/50 font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Start Date & Time</Label>
              <Input type="datetime-local" value={editForm.startDateTime} onChange={e => setEditForm(f => ({ ...f, startDateTime: e.target.value }))} className="bg-background/50 border-border/50 font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Map</Label>
                <Select value={editForm.mapName} onValueChange={v => setEditForm(f => ({ ...f, mapName: v }))}>
                  <SelectTrigger className="bg-background/50 border-border/50 font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bermuda">Bermuda</SelectItem>
                    <SelectItem value="Kalahari">Kalahari</SelectItem>
                    <SelectItem value="Purgatory">Purgatory</SelectItem>
                    <SelectItem value="Alpine">Alpine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Game Mode</Label>
                <Select value={editForm.gameMode} onValueChange={v => setEditForm(f => ({ ...f, gameMode: v }))}>
                  <SelectTrigger className="bg-background/50 border-border/50 font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="squad">Squad</SelectItem>
                    <SelectItem value="duo">Duo</SelectItem>
                    <SelectItem value="solo">Solo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Max Slots</Label>
                <Input type="number" value={editForm.maxSlots} onChange={e => setEditForm(f => ({ ...f, maxSlots: e.target.value }))} className="bg-background/50 border-border/50 font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="bg-background/50 border-border/50 font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Banner Image URL</Label>
              <Input value={editForm.bannerUrl} onChange={e => setEditForm(f => ({ ...f, bannerUrl: e.target.value }))} placeholder="https://..." className="bg-background/50 border-border/50 font-mono" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 border-border/50" onClick={() => setEditTournament(null)}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={isUpdating} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest">
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ROOM DETAILS DIALOG */}
      <Dialog open={!!roomTournament} onOpenChange={open => !open && setRoomTournament(null)}>
        <DialogContent className="bg-card border-secondary/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wider text-secondary flex items-center gap-2">
              <Key className="h-4 w-4" /> Post Room Details
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs font-mono text-muted-foreground">For: <span className="text-foreground">{roomTournament?.title}</span></p>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Room ID</Label>
              <Input value={roomForm.roomId} onChange={e => setRoomForm(f => ({ ...f, roomId: e.target.value }))} placeholder="e.g. 1234567" className="bg-background/50 border-border/50 font-mono text-lg tracking-widest" />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Room Password</Label>
              <Input value={roomForm.roomPassword} onChange={e => setRoomForm(f => ({ ...f, roomPassword: e.target.value }))} placeholder="e.g. ff2024" className="bg-background/50 border-border/50 font-mono text-lg tracking-widest" />
            </div>
            <p className="text-xs text-muted-foreground font-mono">Only verified players will see these details.</p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 border-border/50" onClick={() => setRoomTournament(null)}>Cancel</Button>
              <Button onClick={handleRoomSave} disabled={isPostingRoom || !roomForm.roomId || !roomForm.roomPassword} className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-widest">
                {isPostingRoom ? "Saving..." : "Post Room"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
