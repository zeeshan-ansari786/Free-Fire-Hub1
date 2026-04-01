import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { 
  useGetAdminStats, getGetAdminStatsQueryKey,
  useGetPendingRegistrations, getGetPendingRegistrationsQueryKey,
  useVerifyRegistration,
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Users, Trophy, IndianRupee, CheckCircle, XCircle, Pencil, Key, Plus, Swords, Ban, ArrowUpCircle, ArrowDownCircle, UserX, Eye, Settings, QrCode, Smartphone, Upload, Loader2 } from "lucide-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { getDefaultBanner } from "@/lib/tournament-defaults";

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

type PlayerReg = {
  id: number; userId: number; tournamentId: number; paymentStatus: string;
  transactionId: string | null; adminNote: string | null; registeredAt: string;
  teamMembers: Array<{ uid: string; name: string }> | null;
  user: UserEntry | null;
};

type PendingTxn = { id: number; userId: number; amount: number; description: string; createdAt: string; user: UserEntry | null };
type FinancialData = {
  totalDeposits: number; depositCount: number; totalWithdrawals: number; withdrawalCount: number;
  pendingWithdrawals: PendingTxn[]; pendingDeposits: PendingTxn[];
};
type AdminPaymentConfig = { upiId: string; upiName: string; qrCodeUrl: string | null };

function useAdminConfig(enabled = true) {
  return useQuery({ queryKey: ["admin-config"], queryFn: () => customFetch<AdminPaymentConfig>("/api/admin/config", { method: "GET" }), enabled });
}
function useUpdateAdminConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { upiId?: string; upiName?: string }) =>
      customFetch<{ message: string }>("/api/admin/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-config"] }); qc.invalidateQueries({ queryKey: ["payment-config"] }); },
  });
}
function useUploadQrCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData(); fd.append("qrCode", file);
      return customFetch<{ qrCodeUrl: string; message: string }>("/api/admin/config/qr-code", { method: "POST", body: fd });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-config"] }); qc.invalidateQueries({ queryKey: ["payment-config"] }); },
  });
}
function useUploadBannerImage() {
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData(); fd.append("image", file);
      return customFetch<{ url: string; message: string }>("/api/admin/upload/image", { method: "POST", body: fd });
    },
  });
}
function useAdminUsers(enabled = true) {
  return useQuery({ queryKey: ["admin-users"], queryFn: () => customFetch<UserEntry[]>("/api/admin/users", { method: "GET" }), enabled });
}
function useAdminFinancial(enabled = true) {
  return useQuery({ queryKey: ["admin-financial"], queryFn: () => customFetch<FinancialData>("/api/admin/financial", { method: "GET" }), enabled });
}
function useTournamentPlayers(tournamentId: number | null) {
  return useQuery({
    queryKey: ["tournament-players", tournamentId],
    queryFn: () => customFetch<PlayerReg[]>(`/api/tournaments/${tournamentId}/players`, { method: "GET" }),
    enabled: !!tournamentId,
  });
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
function useKickPlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tournamentId, regId, reason }: { tournamentId: number; regId: number; reason: string }) =>
      customFetch<{ message: string }>(`/api/tournaments/${tournamentId}/players/${regId}/kick`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["tournament-players", vars.tournamentId] });
      qc.invalidateQueries({ queryKey: getGetTournamentsQueryKey({ limit: 50 }) });
    },
  });
}
function useTournamentRegistrations(tournamentId: number | null) {
  return useQuery({
    queryKey: ["tournament-registrations", tournamentId],
    queryFn: () => customFetch<PlayerReg[]>(`/api/tournaments/${tournamentId}/registrations`, { method: "GET" }),
    enabled: !!tournamentId,
  });
}
function usePostLeaderboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tournamentId, entries }: { tournamentId: number; entries: Array<{ userId: number; kills: number; placement: number; prize?: number }> }) =>
      customFetch<any[]>(`/api/tournaments/${tournamentId}/leaderboard`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries }) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["tournament-leaderboard", vars.tournamentId] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}
function useCreateTournamentDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      customFetch<Tournament>("/api/tournaments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getGetTournamentsQueryKey({ limit: 50 }) });
      qc.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
    },
  });
}

const statusColor: Record<string, string> = { upcoming: "text-primary border-primary/30", ongoing: "text-secondary border-secondary/30", completed: "text-muted-foreground border-border" };
const payStatusColor: Record<string, string> = { verified: "text-secondary", free: "text-secondary", pending: "text-yellow-500", rejected: "text-destructive" };

export default function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Must be before any conditional returns — redirect non-admins after auth loads
  // This uses useEffect to avoid setState-during-render React error
  const shouldRedirect = !authLoading && !user?.isAdmin;
  if (shouldRedirect && typeof window !== "undefined") {
    // Defer redirect to avoid setState-in-render issue
    Promise.resolve().then(() => setLocation("/"));
  }
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editTournament, setEditTournament] = useState<Tournament | null>(null);
  const [roomTournament, setRoomTournament] = useState<Tournament | null>(null);
  const [playersTournament, setPlayersTournament] = useState<Tournament | null>(null);
  const [kickDialog, setKickDialog] = useState<{ reg: PlayerReg; tournamentId: number } | null>(null);
  const [kickReason, setKickReason] = useState("");
  const [editForm, setEditForm] = useState({ title: "", description: "", startDateTime: "", mapName: "", gameMode: "", maxSlots: "", status: "", bannerUrl: "" });
  const [roomForm, setRoomForm] = useState({ roomId: "", roomPassword: "" });
  const [createForm, setCreateForm] = useState({ title: "", description: "", startDateTime: "", mapName: "Bermuda", gameMode: "squad", maxSlots: "100", prizePool: "0", entryFee: "0", bannerUrl: "" });
  const [resultsTournamentId, setResultsTournamentId] = useState<number | null>(null);
  const [resultRows, setResultRows] = useState<Array<{ userId: number; inGameName: string; kills: number; placement: number; prize: number }>>([]);
  const [upiForm, setUpiForm] = useState({ upiId: "", upiName: "" });
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const { data: stats } = useGetAdminStats({ query: { enabled: !!user?.isAdmin, queryKey: getGetAdminStatsQueryKey() } });
  const { data: pendingRegs } = useGetPendingRegistrations({ query: { enabled: !!user?.isAdmin, queryKey: getGetPendingRegistrationsQueryKey() } });
  const { data: tournamentsData } = useGetTournaments({ limit: 50 }, { query: { enabled: !!user?.isAdmin, queryKey: getGetTournamentsQueryKey({ limit: 50 }) } });
  const { data: adminUsers, isLoading: usersLoading } = useAdminUsers(!!user?.isAdmin);
  const { data: financial, isLoading: financialLoading } = useAdminFinancial(!!user?.isAdmin);
  const { data: tournamentPlayers, isLoading: playersLoading } = useTournamentPlayers(playersTournament?.id ?? null);
  const { data: adminConfig, isLoading: configLoading } = useAdminConfig(!!user?.isAdmin);

  const { mutate: verifyReg } = useVerifyRegistration();
  const { mutate: updateTournament, isPending: isUpdating } = useUpdateTournament();
  const { mutate: postRoom, isPending: isPostingRoom } = usePostRoomDetails();
  const { mutate: createTournament, isPending: isCreating } = useCreateTournamentDirect();
  const { mutate: banUser } = useBanUser();
  const { mutate: approveWithdrawal } = useApproveWithdrawal();
  const { mutate: kickPlayer, isPending: isKicking } = useKickPlayer();
  const { mutate: updateConfig, isPending: isUpdatingConfig } = useUpdateAdminConfig();
  const { mutate: uploadQr, isPending: isUploadingQr } = useUploadQrCode();
  const { mutate: uploadBanner, isPending: isUploadingBanner } = useUploadBannerImage();
  const { data: resultsRegistrations, isLoading: resultsRegsLoading } = useTournamentRegistrations(resultsTournamentId);
  const { mutate: postLeaderboard, isPending: isPostingLeaderboard } = usePostLeaderboard();

  // Redirect non-admins after auth loads
  if (!authLoading && !user?.isAdmin) {
    return null; // useEffect below handles the redirect
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
    if (!createForm.title.trim()) { toast({ title: "Tournament title is required", variant: "destructive" }); return; }
    if (!createForm.startDateTime) { toast({ title: "Start date & time is required", variant: "destructive" }); return; }
    createTournament({
      title: createForm.title.trim(),
      description: createForm.description.trim() || undefined,
      startDateTime: new Date(createForm.startDateTime).toISOString(),
      mapName: createForm.mapName,
      gameMode: createForm.gameMode,
      maxSlots: parseInt(createForm.maxSlots) || 100,
      prizePool: parseFloat(createForm.prizePool) || 0,
      entryFee: parseFloat(createForm.entryFee) || 0,
      bannerUrl: createForm.bannerUrl.trim() || undefined,
    }, {
      onSuccess: () => {
        toast({ title: "Tournament created!", description: `"${createForm.title}" is now live.` });
        setCreateForm({ title: "", description: "", startDateTime: "", mapName: "Bermuda", gameMode: "squad", maxSlots: "100", prizePool: "0", entryFee: "0", bannerUrl: "" });
      },
      onError: (err: any) => toast({ title: "Failed to create", description: err?.data?.error || err?.message || "Something went wrong", variant: "destructive" }),
    });
  };

  const handleBan = (userId: number) => {
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

  const handleSelectResultsTournament = (id: number) => {
    setResultsTournamentId(id);
    setResultRows([]);
  };

  const handleInitResultRows = () => {
    if (!resultsRegistrations) return;
    const verified = resultsRegistrations.filter(r => r.paymentStatus === "verified" || r.paymentStatus === "free");
    setResultRows(verified.map(r => ({
      userId: r.userId,
      inGameName: r.user?.inGameName || `Player #${r.userId}`,
      kills: 0,
      placement: 99,
      prize: 0,
    })));
  };

  const handleSubmitLeaderboard = () => {
    if (!resultsTournamentId || !resultRows.length) return;
    postLeaderboard({ tournamentId: resultsTournamentId, entries: resultRows.map(r => ({ userId: r.userId, kills: r.kills, placement: r.placement, prize: r.prize })) }, {
      onSuccess: () => toast({ title: "Results saved!", description: "Tournament leaderboard updated successfully." }),
      onError: () => toast({ title: "Failed to save results", variant: "destructive" }),
    });
  };

  const handleSaveUpi = () => {
    updateConfig({ upiId: upiForm.upiId || adminConfig?.upiId, upiName: upiForm.upiName || adminConfig?.upiName }, {
      onSuccess: () => toast({ title: "Payment config updated!" }),
      onError: () => toast({ title: "Failed to update config", variant: "destructive" }),
    });
  };

  const handleQrUpload = () => {
    if (!qrFile) return;
    uploadQr(qrFile, {
      onSuccess: (data) => { toast({ title: "QR code updated!", description: data.message }); setQrFile(null); setQrPreview(null); },
      onError: () => toast({ title: "Failed to upload QR code", variant: "destructive" }),
    });
  };

  const handleBannerUpload = () => {
    if (!bannerFile) return;
    uploadBanner(bannerFile, {
      onSuccess: (data) => {
        setCreateForm(f => ({ ...f, bannerUrl: data.url }));
        toast({ title: "Banner uploaded!", description: "URL applied to form" });
        setBannerFile(null);
      },
      onError: () => toast({ title: "Failed to upload image", variant: "destructive" }),
    });
  };

  const handleKick = () => {
    if (!kickDialog) return;
    kickPlayer({ tournamentId: kickDialog.tournamentId, regId: kickDialog.reg.id, reason: kickReason || "Disqualified by admin" }, {
      onSuccess: () => {
        toast({ title: "Player disqualified", description: `${kickDialog.reg.user?.inGameName} removed from tournament` });
        setKickDialog(null);
        setKickReason("");
      },
      onError: () => toast({ title: "Failed to kick player", variant: "destructive" }),
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-primary/30"><CardContent className="p-6"><Users className="h-6 w-6 text-primary mb-2 opacity-80" /><p className="text-sm text-muted-foreground font-mono">Total Players</p><p className="text-2xl font-bold font-display">{stats?.totalPlayers || 0}</p></CardContent></Card>
        <Card className="bg-card/50 border-secondary/30"><CardContent className="p-6"><Trophy className="h-6 w-6 text-secondary mb-2 opacity-80" /><p className="text-sm text-muted-foreground font-mono">Active Tournaments</p><p className="text-2xl font-bold font-display">{stats?.activeTournaments || 0}</p></CardContent></Card>
        <Card className="bg-card/50 border-white/30"><CardContent className="p-6"><IndianRupee className="h-6 w-6 text-white mb-2 opacity-80" /><p className="text-sm text-muted-foreground font-mono">Prize Distributed</p><p className="text-2xl font-bold font-display">₹{stats?.totalPrizeDistributed || 0}</p></CardContent></Card>
        <Card className="bg-card/50 border-yellow-500/30"><CardContent className="p-6"><ShieldAlert className="h-6 w-6 text-yellow-500 mb-2 opacity-80" /><p className="text-sm text-muted-foreground font-mono">Pending Verifications</p><p className="text-2xl font-bold font-display text-yellow-500">{stats?.pendingPayments || 0}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="tournaments" className="w-full">
        <TabsList className="bg-card/80 border border-border/50 rounded-none h-auto p-1 grid grid-cols-7">
          {[["verifications","Verifications"],["tournaments","Tournaments"],["create","Create"],["users","Players"],["financial","Financial"],["results","Results"],["settings","Settings"]].map(([val, label]) => (
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
                          <TableCell className="text-xs">T#{reg.tournamentId}</TableCell>
                          <TableCell><span className="block text-primary text-xs">{reg.transactionId || 'None'}</span>{reg.paymentScreenshotUrl && <a href={reg.paymentScreenshotUrl} target="_blank" rel="noreferrer" className="text-xs text-secondary hover:underline">View Proof</a>}</TableCell>
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
        <TabsContent value="tournaments" className="mt-6 space-y-3">
          {!tournamentsData?.tournaments?.length ? (
            <Card className="bg-card/50 border-border/50"><CardContent className="py-12 text-center font-mono text-muted-foreground">No tournaments found.</CardContent></Card>
          ) : (
            (tournamentsData.tournaments as Tournament[]).map((t) => (
              <Card key={t.id} className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors overflow-hidden">
                <CardContent className="p-0 flex flex-col sm:flex-row sm:items-center gap-0">
                  <div className="w-full sm:w-20 h-16 sm:h-full shrink-0">
                    <img
                      src={t.bannerUrl || getDefaultBanner(t.gameMode)}
                      alt={t.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = getDefaultBanner("squad"); }}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 flex-1">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold font-display uppercase tracking-wide text-foreground text-sm truncate">{t.title}</h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className={`text-xs font-mono px-1.5 py-0.5 border rounded ${statusColor[t.status] || ""}`}>{t.status.toUpperCase()}</span>
                        <span className="text-xs font-mono text-muted-foreground">{format(new Date(t.startDateTime), "MMM d, h:mm a")}</span>
                        <span className="text-xs font-mono text-muted-foreground">{t.filledSlots}/{t.maxSlots} · {t.mapName} · {t.gameMode.toUpperCase()}</span>
                      </div>
                      {t.roomId && <p className="text-xs font-mono text-secondary mt-1">Room: <span className="text-foreground">{t.roomId}</span> | <span className="text-foreground">{t.roomPassword}</span></p>}
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      <Button size="sm" variant="outline" className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 font-mono text-xs h-8" onClick={() => setPlayersTournament(t)}><Eye className="h-3 w-3 mr-1" /> Players</Button>
                      <Button size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 font-mono text-xs h-8" onClick={() => openEdit(t)}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                      <Button size="sm" variant="outline" className="border-secondary/40 text-secondary hover:bg-secondary/10 font-mono text-xs h-8" onClick={() => { setRoomTournament(t); setRoomForm({ roomId: t.roomId ?? "", roomPassword: t.roomPassword ?? "" }); }}><Key className="h-3 w-3 mr-1" /> Room</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* CREATE */}
        <TabsContent value="create" className="mt-6">
          <Card className="bg-card/50 border-secondary/30">
            <CardHeader><CardTitle className="font-display uppercase tracking-wider text-xl text-secondary flex items-center gap-2"><Plus className="h-5 w-5" /> Create New Tournament</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Title <span className="text-destructive">*</span></Label>
                  <Input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Friday Night Battleground" className="bg-background/50 border-border/50 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Start Date & Time <span className="text-destructive">*</span></Label>
                  <Input type="datetime-local" value={createForm.startDateTime} onChange={e => setCreateForm(f => ({ ...f, startDateTime: e.target.value }))} className="bg-background/50 border-border/50 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Max Slots</Label>
                  <Input type="number" value={createForm.maxSlots} onChange={e => setCreateForm(f => ({ ...f, maxSlots: e.target.value }))} className="bg-background/50 border-border/50 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Entry Fee (₹)</Label>
                  <Input type="number" value={createForm.entryFee} onChange={e => setCreateForm(f => ({ ...f, entryFee: e.target.value }))} placeholder="0 for free tournament" className="bg-background/50 border-border/50 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Prize Pool (₹)</Label>
                  <Input type="number" value={createForm.prizePool} onChange={e => setCreateForm(f => ({ ...f, prizePool: e.target.value }))} className="bg-background/50 border-border/50 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Map</Label>
                  <Select value={createForm.mapName} onValueChange={v => setCreateForm(f => ({ ...f, mapName: v }))}>
                    <SelectTrigger className="bg-background/50 border-border/50 font-mono"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Bermuda","Kalahari","Purgatory","Alpine"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Game Mode</Label>
                  <Select value={createForm.gameMode} onValueChange={v => setCreateForm(f => ({ ...f, gameMode: v }))}>
                    <SelectTrigger className="bg-background/50 border-border/50 font-mono"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="squad">Squad (4 Players)</SelectItem>
                      <SelectItem value="duo">Duo (2 Players)</SelectItem>
                      <SelectItem value="solo">Solo (1 Player)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Banner Image <span className="text-muted-foreground text-xs normal-case">(optional — default mode image used if none uploaded)</span></Label>
                  <input ref={bannerInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) { setBannerFile(file); setBannerPreview(URL.createObjectURL(file)); }
                    }} />
                  {bannerPreview || createForm.bannerUrl ? (
                    <div className="flex items-center gap-3">
                      <img src={bannerPreview || createForm.bannerUrl} alt="Banner preview" className="w-24 h-14 object-cover rounded border border-border/50" onError={(e) => { (e.target as HTMLImageElement).src = getDefaultBanner(createForm.gameMode); }} />
                      <div className="flex-1">
                        {bannerFile && (
                          <Button size="sm" onClick={handleBannerUpload} disabled={isUploadingBanner} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold text-xs mr-2">
                            {isUploadingBanner ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Uploading...</> : "Upload Image"}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="border-border/50 text-xs" onClick={() => { setBannerFile(null); setBannerPreview(null); setCreateForm(f => ({ ...f, bannerUrl: "" })); if (bannerInputRef.current) bannerInputRef.current.value = ""; }}>Remove</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" className="border-border/50 text-muted-foreground hover:text-foreground" onClick={() => bannerInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" /> Upload Banner Image
                    </Button>
                  )}
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">Description <span className="text-muted-foreground text-xs normal-case">(optional)</span></Label>
                  <Input value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Rules, format, special notes..." className="bg-background/50 border-border/50 font-mono" />
                </div>
              </div>
              {/* Preview */}
              {createForm.gameMode && (
                <div className="flex items-center gap-3 p-3 bg-background/30 border border-border/30 rounded">
                  <img src={createForm.bannerUrl || getDefaultBanner(createForm.gameMode)} alt="Preview" className="w-16 h-10 object-cover rounded" onError={(e) => { (e.target as HTMLImageElement).src = getDefaultBanner("squad"); }} />
                  <p className="text-xs font-mono text-muted-foreground">Default banner preview for <span className="text-foreground uppercase">{createForm.gameMode}</span> mode</p>
                </div>
              )}
              <Button onClick={handleCreate} disabled={isCreating} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-widest h-12 text-base">
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
                          <TableCell><span className="block font-bold">{u.inGameName}</span><span className="text-xs text-muted-foreground">{u.email}</span></TableCell>
                          <TableCell className="text-muted-foreground text-xs">{u.freeFireUid}</TableCell>
                          <TableCell className="text-right text-secondary font-bold">₹{u.walletBalance}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{u.matchesPlayed}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(u.createdAt), "MMM d, yyyy")}</TableCell>
                          <TableCell>{u.isBanned ? <span className="text-xs text-destructive border border-destructive/30 px-2 py-0.5 rounded">BANNED</span> : <span className="text-xs text-secondary border border-secondary/30 px-2 py-0.5 rounded">ACTIVE</span>}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" className={`h-8 px-3 text-xs font-mono ${u.isBanned ? "border-secondary/50 text-secondary hover:bg-secondary/10" : "border-destructive/50 text-destructive hover:bg-destructive/10"}`} onClick={() => handleBan(u.id)}>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card/50 border-secondary/30"><CardContent className="p-5"><p className="text-xs font-mono text-muted-foreground">Total Deposits</p><p className="text-2xl font-bold font-display text-secondary">₹{financial?.totalDeposits || 0}</p><p className="text-xs text-muted-foreground font-mono">{financial?.depositCount || 0} approved</p></CardContent></Card>
            <Card className="bg-card/50 border-destructive/30"><CardContent className="p-5"><p className="text-xs font-mono text-muted-foreground">Total Withdrawals</p><p className="text-2xl font-bold font-display text-destructive">₹{financial?.totalWithdrawals || 0}</p><p className="text-xs text-muted-foreground font-mono">{financial?.withdrawalCount || 0} paid out</p></CardContent></Card>
            <Card className="bg-card/50 border-blue-500/30"><CardContent className="p-5"><p className="text-xs font-mono text-muted-foreground">Pending Deposits</p><p className="text-2xl font-bold font-display text-blue-400">{financial?.pendingDeposits?.length || 0}</p><p className="text-xs text-muted-foreground font-mono">Awaiting approval</p></CardContent></Card>
            <Card className="bg-card/50 border-yellow-500/30"><CardContent className="p-5"><p className="text-xs font-mono text-muted-foreground">Pending Withdrawals</p><p className="text-2xl font-bold font-display text-yellow-500">{financial?.pendingWithdrawals?.length || 0}</p><p className="text-xs text-muted-foreground font-mono">Awaiting approval</p></CardContent></Card>
          </div>

          {/* Pending Deposits */}
          <Card className="bg-card/50 border-blue-500/30">
            <CardHeader><CardTitle className="font-display uppercase tracking-wider text-xl text-blue-400 flex items-center gap-2"><ArrowDownCircle className="h-5 w-5" /> Pending Deposit Requests</CardTitle></CardHeader>
            <CardContent>
              {financialLoading ? <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-12 bg-border/20 rounded animate-pulse" />)}</div>
              : !financial?.pendingDeposits?.length ? <p className="text-center font-mono text-muted-foreground py-8">No pending deposits. All caught up!</p>
              : (
                <div className="overflow-x-auto">
                  <Table className="font-mono">
                    <TableHeader><TableRow><TableHead>Player</TableHead><TableHead>Reference / Details</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {financial.pendingDeposits.map(d => (
                        <TableRow key={d.id}>
                          <TableCell><span className="font-bold">{d.user?.inGameName || `User #${d.userId}`}</span><span className="block text-xs text-muted-foreground">{d.user?.email}</span></TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{d.description}</TableCell>
                          <TableCell className="text-right font-bold text-blue-400">₹{d.amount}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(d.createdAt), "MMM d, h:mm a")}</TableCell>
                          <TableCell className="text-right"><div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="h-8 px-2 border-secondary/50 text-secondary hover:bg-secondary/20 text-xs" onClick={() => handleWithdrawal(d.id, "approve")}><CheckCircle className="h-3 w-3 mr-1" /> Approve</Button>
                            <Button size="sm" variant="outline" className="h-8 px-2 border-destructive/50 text-destructive hover:bg-destructive/20 text-xs" onClick={() => handleWithdrawal(d.id, "reject")}><XCircle className="h-3 w-3 mr-1" /> Reject</Button>
                          </div></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Withdrawals */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader><CardTitle className="font-display uppercase tracking-wider text-xl text-yellow-500 flex items-center gap-2"><ArrowUpCircle className="h-5 w-5" /> Pending Withdrawal Requests</CardTitle></CardHeader>
            <CardContent>
              {financialLoading ? <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-12 bg-border/20 rounded animate-pulse" />)}</div>
              : !financial?.pendingWithdrawals?.length ? <p className="text-center font-mono text-muted-foreground py-8">No pending withdrawals.</p>
              : (
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

        {/* RESULTS */}
        <TabsContent value="results" className="mt-6 space-y-6">
          <Card className="bg-card/50 border-secondary/30">
            <CardHeader><CardTitle className="font-display uppercase tracking-wider text-xl text-secondary flex items-center gap-2"><Trophy className="h-5 w-5" /> Post Tournament Results</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Select Tournament</Label>
                <Select value={resultsTournamentId?.toString() || ""} onValueChange={val => handleSelectResultsTournament(parseInt(val, 10))}>
                  <SelectTrigger className="bg-background/50 border-border/50 font-mono"><SelectValue placeholder="Pick a tournament to set results..." /></SelectTrigger>
                  <SelectContent>
                    {tournamentsData?.tournaments?.map(t => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        <span className={`mr-2 text-xs font-mono ${t.status === "completed" ? "text-muted-foreground" : t.status === "ongoing" ? "text-secondary" : "text-primary"}`}>[{t.status.toUpperCase()}]</span>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {resultsTournamentId && (
                <>
                  {resultsRegsLoading ? (
                    <div className="h-20 bg-border/20 rounded animate-pulse" />
                  ) : !resultsRegistrations?.length ? (
                    <p className="text-center font-mono text-muted-foreground py-4">No registrations for this tournament.</p>
                  ) : resultRows.length === 0 ? (
                    <div className="space-y-3">
                      <div className="bg-background/40 border border-border/30 rounded p-3 font-mono text-xs text-muted-foreground">
                        <span className="text-foreground font-bold">{resultsRegistrations.filter(r => r.paymentStatus === "verified" || r.paymentStatus === "free").length}</span> eligible players found (verified/free registrations).
                      </div>
                      <Button onClick={handleInitResultRows} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-widest">
                        Load Players &amp; Enter Results
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs font-mono text-muted-foreground">Enter each player's stats. Placement 1 = Booyah (wins +12 pts). Points auto-calculated.</p>
                      <div className="overflow-x-auto">
                        <Table className="font-mono">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Player</TableHead>
                              <TableHead className="w-28">Placement</TableHead>
                              <TableHead className="w-24">Kills</TableHead>
                              <TableHead className="w-28">Prize (₹)</TableHead>
                              <TableHead className="text-right w-24">Points</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {resultRows.map((row, i) => {
                              const pts = (row.placement === 1 ? 12 : 0) + row.kills;
                              return (
                                <TableRow key={row.userId}>
                                  <TableCell className="font-bold">{row.inGameName}</TableCell>
                                  <TableCell>
                                    <Select value={row.placement.toString()} onValueChange={val => setResultRows(prev => prev.map((r, idx) => idx === i ? { ...r, placement: parseInt(val) } : r))}>
                                      <SelectTrigger className="h-8 bg-background/50 border-border/50 text-xs"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="1">🏆 1st (Booyah)</SelectItem>
                                        <SelectItem value="2">2nd</SelectItem>
                                        <SelectItem value="3">3rd</SelectItem>
                                        {[4,5,6,7,8,9,10,11,12].map(n => <SelectItem key={n} value={n.toString()}>{n}th</SelectItem>)}
                                        <SelectItem value="99">Not Placed</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Input type="number" min="0" value={row.kills} onChange={e => setResultRows(prev => prev.map((r, idx) => idx === i ? { ...r, kills: parseInt(e.target.value) || 0 } : r))} className="h-8 bg-background/50 border-border/50 text-xs w-20" />
                                  </TableCell>
                                  <TableCell>
                                    <Input type="number" min="0" value={row.prize} onChange={e => setResultRows(prev => prev.map((r, idx) => idx === i ? { ...r, prize: parseInt(e.target.value) || 0 } : r))} className="h-8 bg-background/50 border-border/50 text-xs w-24" />
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-primary">{pts}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex gap-3">
                        <Button onClick={handleSubmitLeaderboard} disabled={isPostingLeaderboard} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-widest">
                          {isPostingLeaderboard ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Results & Update Leaderboard"}
                        </Button>
                        <Button variant="outline" className="border-border/50" onClick={() => setResultRows([])}>Reset</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SETTINGS */}
        <TabsContent value="settings" className="mt-6 space-y-6">
          {/* UPI Config */}
          <Card className="bg-card/50 border-secondary/30">
            <CardHeader><CardTitle className="font-display uppercase tracking-wider text-xl text-secondary flex items-center gap-2"><Smartphone className="h-5 w-5" /> UPI Payment Config</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {configLoading ? <div className="h-20 bg-border/20 rounded animate-pulse" /> : (
                <>
                  <div className="bg-background/40 border border-border/30 rounded p-3 font-mono text-xs text-muted-foreground">
                    <span className="text-foreground font-bold">Current: </span>{adminConfig?.upiName || "FF Arena Official"} — <span className="text-secondary">{adminConfig?.upiId || "ffarena@upi"}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="font-mono text-xs uppercase text-muted-foreground">UPI ID</Label>
                      <Input value={upiForm.upiId} onChange={e => setUpiForm(f => ({ ...f, upiId: e.target.value }))} placeholder={adminConfig?.upiId || "ffarena@upi"} className="bg-background/50 border-border/50 font-mono" />
                    </div>
                    <div className="space-y-1">
                      <Label className="font-mono text-xs uppercase text-muted-foreground">Display Name</Label>
                      <Input value={upiForm.upiName} onChange={e => setUpiForm(f => ({ ...f, upiName: e.target.value }))} placeholder={adminConfig?.upiName || "FF Arena Official"} className="bg-background/50 border-border/50 font-mono" />
                    </div>
                  </div>
                  <Button onClick={handleSaveUpi} disabled={isUpdatingConfig} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-widest">
                    {isUpdatingConfig ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save UPI Config"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* QR Code Upload */}
          <Card className="bg-card/50 border-primary/30">
            <CardHeader><CardTitle className="font-display uppercase tracking-wider text-xl text-primary flex items-center gap-2"><QrCode className="h-5 w-5" /> QR Code for Payments</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Current QR */}
                <div className="shrink-0">
                  <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Current QR Code</p>
                  {adminConfig?.qrCodeUrl ? (
                    <div className="bg-white p-3 rounded-lg w-40 h-40 flex items-center justify-center">
                      <img src={adminConfig.qrCodeUrl} alt="QR Code" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="bg-background/50 border border-dashed border-border rounded-lg w-40 h-40 flex flex-col items-center justify-center gap-2">
                      <QrCode className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-xs font-mono text-muted-foreground text-center">No QR code set</p>
                    </div>
                  )}
                </div>
                {/* Upload New QR */}
                <div className="flex-1 space-y-3">
                  <p className="text-sm font-mono text-muted-foreground">Upload a new QR code image. This will replace the current one and be shown to players when they choose to pay via QR.</p>
                  <input
                    ref={qrInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) { setQrFile(file); setQrPreview(URL.createObjectURL(file)); }
                    }}
                  />
                  {qrPreview ? (
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded-lg w-40 h-40 flex items-center justify-center">
                        <img src={qrPreview} alt="New QR preview" className="w-full h-full object-contain" />
                      </div>
                      <p className="text-xs font-mono text-secondary">{qrFile?.name}</p>
                      <div className="flex gap-2">
                        <Button onClick={handleQrUpload} disabled={isUploadingQr} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest">
                          {isUploadingQr ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</> : "Upload QR Code"}
                        </Button>
                        <Button variant="outline" className="border-border/50" onClick={() => { setQrFile(null); setQrPreview(null); if (qrInputRef.current) qrInputRef.current.value = ""; }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10" onClick={() => qrInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" /> Choose QR Code Image
                    </Button>
                  )}
                  <p className="text-xs font-mono text-muted-foreground">Supported: JPG, PNG, WebP — Max 5MB</p>
                </div>
              </div>
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
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Map</Label>
                <Select value={editForm.mapName} onValueChange={v => setEditForm(f => ({ ...f, mapName: v }))}><SelectTrigger className="bg-background/50 border-border/50 font-mono text-xs"><SelectValue /></SelectTrigger><SelectContent>{["Bermuda","Kalahari","Purgatory","Alpine"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Mode</Label>
                <Select value={editForm.gameMode} onValueChange={v => setEditForm(f => ({ ...f, gameMode: v }))}><SelectTrigger className="bg-background/50 border-border/50 font-mono text-xs"><SelectValue /></SelectTrigger><SelectContent>{["squad","duo","solo"].map(m => <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}><SelectTrigger className="bg-background/50 border-border/50 font-mono text-xs"><SelectValue /></SelectTrigger><SelectContent>{["upcoming","ongoing","completed"].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</SelectItem>)}</SelectContent></Select>
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

      {/* Players Dialog */}
      <Dialog open={!!playersTournament} onOpenChange={open => !open && setPlayersTournament(null)}>
        <DialogContent className="bg-card border-blue-500/30 max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wider text-blue-400 flex items-center gap-2"><Eye className="h-5 w-5" /> Tournament Players</DialogTitle>
            <p className="text-xs font-mono text-muted-foreground mt-1">{playersTournament?.title} · {playersTournament?.filledSlots}/{playersTournament?.maxSlots} slots filled</p>
          </DialogHeader>
          {playersLoading ? (
            <div className="space-y-3 pt-4">{[1,2,3].map(i => <div key={i} className="h-14 bg-border/20 rounded animate-pulse" />)}</div>
          ) : !tournamentPlayers?.length ? (
            <p className="text-center font-mono text-muted-foreground py-10">No players registered yet.</p>
          ) : (
            <div className="overflow-x-auto pt-2">
              <Table className="font-mono text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Player / IGN</TableHead>
                    <TableHead>UID</TableHead>
                    <TableHead>Team Members</TableHead>
                    <TableHead>Txn ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tournamentPlayers.map(reg => (
                    <TableRow key={reg.id} className={reg.paymentStatus === "rejected" ? "opacity-40" : ""}>
                      <TableCell>
                        <span className="block font-bold">{reg.user?.inGameName ?? `User #${reg.userId}`}</span>
                        <span className="text-xs text-muted-foreground">{reg.user?.email}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{reg.user?.freeFireUid}</TableCell>
                      <TableCell>
                        {reg.teamMembers && reg.teamMembers.length > 0 ? (
                          <div className="space-y-0.5">
                            {reg.teamMembers.map((m, i) => (
                              <div key={i} className="text-xs text-muted-foreground">{m.name} <span className="text-foreground/50">({m.uid})</span></div>
                            ))}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{reg.transactionId || '—'}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-mono px-2 py-0.5 border rounded ${payStatusColor[reg.paymentStatus] || "text-muted-foreground border-border"} border-current/30`}>
                          {reg.paymentStatus.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {reg.paymentStatus !== "rejected" && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-destructive/50 text-destructive hover:bg-destructive/10"
                            onClick={() => { setKickDialog({ reg, tournamentId: playersTournament!.id }); setKickReason(""); }}>
                            <UserX className="h-3 w-3 mr-1" /> Kick
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Kick Confirm Dialog */}
      <Dialog open={!!kickDialog} onOpenChange={open => !open && setKickDialog(null)}>
        <DialogContent className="bg-card border-destructive/30 max-w-md">
          <DialogHeader><DialogTitle className="font-display uppercase tracking-wider text-destructive flex items-center gap-2"><UserX className="h-5 w-5" /> Disqualify Player</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-destructive/10 border border-destructive/30 rounded p-3 font-mono text-sm">
              <p className="font-bold text-foreground">{kickDialog?.reg.user?.inGameName}</p>
              <p className="text-xs text-muted-foreground">UID: {kickDialog?.reg.user?.freeFireUid}</p>
            </div>
            <p className="text-sm font-mono text-muted-foreground">This will remove the player from the tournament. If they paid an entry fee, it will be refunded to their wallet.</p>
            <div className="space-y-1">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Reason (optional)</Label>
              <Input value={kickReason} onChange={e => setKickReason(e.target.value)} placeholder="e.g. Hacking, cheating, no-show..." className="bg-background/50 border-border/50 font-mono" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 border-border/50" onClick={() => setKickDialog(null)}>Cancel</Button>
              <Button onClick={handleKick} disabled={isKicking} className="flex-1 bg-destructive hover:bg-destructive/90 text-white font-bold uppercase tracking-widest">
                {isKicking ? "Disqualifying..." : "Confirm Kick"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
