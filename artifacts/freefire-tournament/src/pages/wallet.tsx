import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Wallet, ArrowDownCircle, ArrowUpCircle, IndianRupee, Clock, CheckCircle, XCircle, QrCode, Info, Copy, Gift, ChevronLeft, ScanLine } from "lucide-react";
import { format } from "date-fns";
import { customFetch, getGetMeQueryKey } from "@workspace/api-client-react";

type Transaction = {
  id: number; type: string; amount: number; status: string; description: string; createdAt: string;
};
type PaymentConfig = { upiId: string; upiName: string; qrCodeUrl: string | null };

function useWallet(enabled: boolean) {
  return useQuery({
    queryKey: ["wallet"],
    queryFn: () => customFetch<{ walletBalance: number; transactions: Transaction[] }>("/api/wallet", { method: "GET" }),
    enabled,
  });
}
function usePaymentConfig() {
  return useQuery({
    queryKey: ["payment-config"],
    queryFn: () => customFetch<PaymentConfig>("/api/payment-config", { method: "GET" }),
    staleTime: 60_000,
  });
}
function useDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number; transactionRef: string; paymentMethod: string }) =>
      customFetch<{ walletBalance: number; message: string }>("/api/wallet/deposit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    },
  });
}
function useWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number; upiId: string }) =>
      customFetch<{ walletBalance: number; message: string }>("/api/wallet/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    },
  });
}

const typeIcon: Record<string, React.ReactNode> = {
  deposit: <ArrowDownCircle className="h-4 w-4 text-secondary" />,
  withdrawal: <ArrowUpCircle className="h-4 w-4 text-destructive" />,
  entry_fee: <ArrowUpCircle className="h-4 w-4 text-yellow-500" />,
  prize: <ArrowDownCircle className="h-4 w-4 text-secondary" />,
};
function statusBadge(status: string) {
  if (status === "completed") return <span className="text-xs font-mono text-secondary flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Completed</span>;
  if (status === "pending") return <span className="text-xs font-mono text-yellow-500 flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</span>;
  return <span className="text-xs font-mono text-destructive flex items-center gap-1"><XCircle className="h-3 w-3" /> Rejected</span>;
}

export default function WalletPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // "amount" = step 1: enter amount, "payment" = step 2: QR + UTR on same screen
  const [depositStep, setDepositStep] = useState<"amount" | "payment" | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositRef, setDepositRef] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [upiId, setUpiId] = useState("");

  const { data: wallet, isLoading: walletLoading } = useWallet(isAuthenticated);
  const { data: config } = usePaymentConfig();
  const deposit = useDeposit();
  const withdraw = useWithdraw();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) setLocation("/login");
  }, [isLoading, isAuthenticated]);

  if (!isLoading && !isAuthenticated) return null;

  const copyUpi = () => {
    navigator.clipboard.writeText(config?.upiId || "ffarena@upi");
    toast({ title: "UPI ID copied!" });
  };

  const openDeposit = (presetAmount?: string) => {
    if (presetAmount) setDepositAmount(presetAmount);
    setDepositStep("amount");
  };

  const proceedToPayment = () => {
    const amt = parseInt(depositAmount);
    if (!depositAmount || isNaN(amt) || amt < 30) {
      toast({ title: "Minimum deposit is ₹30", variant: "destructive" }); return;
    }
    setDepositStep("payment");
  };

  const handleDeposit = () => {
    const amt = parseInt(depositAmount);
    if (!depositAmount || isNaN(amt) || amt < 30) {
      toast({ title: "Minimum deposit is ₹30", variant: "destructive" }); return;
    }
    if (!depositRef.trim()) {
      toast({ title: "Enter UTR / Transaction ID", variant: "destructive" }); return;
    }
    deposit.mutate({ amount: amt, transactionRef: depositRef.trim(), paymentMethod: "qr" }, {
      onSuccess: (data) => {
        toast({ title: "Deposit Request Submitted!", description: data.message });
        setDepositStep(null); setDepositAmount(""); setDepositRef("");
      },
      onError: (err: any) => toast({ title: "Failed", description: err?.data?.error || "Deposit failed", variant: "destructive" }),
    });
  };

  const handleWithdraw = () => {
    withdraw.mutate({ amount: parseInt(withdrawAmount), upiId }, {
      onSuccess: (data) => {
        toast({ title: "Withdrawal Requested!", description: data.message });
        setShowWithdraw(false); setWithdrawAmount(""); setUpiId("");
      },
      onError: (err: any) => toast({ title: "Failed", description: err?.data?.error || "Withdrawal failed", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 border-b border-primary/20 pb-4">
        <Wallet className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-black uppercase font-display tracking-wider text-primary">My Wallet</h1>
          <p className="text-sm font-mono text-muted-foreground">Manage your funds</p>
        </div>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-card border-primary/30 neon-border">
        <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-1">Current Balance</p>
            {walletLoading ? (
              <div className="h-12 w-48 bg-border/30 rounded animate-pulse" />
            ) : (
              <div className="flex items-center gap-2">
                <IndianRupee className="h-8 w-8 text-primary" />
                <span className="text-5xl font-black font-display text-primary neon-text">{wallet?.walletBalance ?? 0}</span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button onClick={() => openDeposit()} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-wider clip-path-slant rounded-none shadow-[0_0_15px_rgba(57,255,20,0.3)]">
              <ArrowDownCircle className="h-4 w-4 mr-2" /> Deposit
            </Button>
            <Button onClick={() => setShowWithdraw(true)} variant="outline" className="border-primary/50 text-primary hover:bg-primary/10 font-bold uppercase tracking-wider clip-path-slant rounded-none">
              <ArrowUpCircle className="h-4 w-4 mr-2" /> Withdraw
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Deposit Amounts */}
      <div className="grid grid-cols-4 gap-3">
        {[100, 250, 500, 1000].map(amt => (
          <Button key={amt} variant="outline" className="border-secondary/30 text-secondary hover:bg-secondary/10 font-mono rounded-none"
            onClick={() => openDeposit(String(amt))}>
            +₹{amt}
          </Button>
        ))}
      </div>

      {/* Transaction History */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-wider text-xl text-primary">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {walletLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-border/20 rounded animate-pulse" />)}</div>
          ) : !wallet?.transactions?.length ? (
            <p className="text-center font-mono text-muted-foreground py-8">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="font-mono">
                <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {wallet.transactions.map(txn => (
                    <TableRow key={txn.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {typeIcon[txn.type] ?? <IndianRupee className="h-4 w-4" />}
                          <span className="capitalize text-xs uppercase">{txn.type.replace("_", " ")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">{txn.description}</TableCell>
                      <TableCell className={`font-bold ${txn.type === "deposit" || txn.type === "prize" ? "text-secondary" : "text-destructive"}`}>
                        {txn.type === "deposit" || txn.type === "prize" ? "+" : "-"}₹{txn.amount}
                      </TableCell>
                      <TableCell>{statusBadge(txn.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(txn.createdAt), "MMM d, h:mm a")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deposit Dialog — Two-step: enter amount → QR + UTR form */}
      <Dialog open={depositStep !== null} onOpenChange={open => { if (!open) { setDepositStep(null); setDepositAmount(""); setDepositRef(""); } }}>
        <DialogContent className="bg-card border-secondary/30 max-w-md overflow-hidden p-0">

          {/* ── STEP 1: Enter Amount ── */}
          {depositStep === "amount" && (
            <div className="flex flex-col">
              <div className="px-6 pt-6 pb-4 border-b border-secondary/20">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownCircle className="h-5 w-5 text-secondary drop-shadow-[0_0_6px_rgba(57,255,20,0.8)]" />
                  <span className="font-display text-lg font-bold uppercase tracking-wider text-secondary">Add Funds</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground">Step 1 of 2 — Enter the amount you want to deposit</p>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Quick-fill */}
                <div>
                  <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Quick select</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[100, 250, 500, 1000].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setDepositAmount(String(amt))}
                        className={`py-2.5 text-sm font-mono font-bold rounded border transition-all ${depositAmount === String(amt) ? "bg-secondary/20 border-secondary text-secondary shadow-[0_0_10px_rgba(57,255,20,0.2)]" : "border-border/40 text-muted-foreground hover:border-secondary/40 hover:text-secondary/70"}`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount input */}
                <div className="space-y-1.5">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">
                    Amount (₹) <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-lg">₹</span>
                    <Input
                      type="number"
                      min="30"
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && proceedToPayment()}
                      placeholder="0"
                      className="bg-background/50 border-border/50 font-mono text-xl h-14 pl-8 focus:border-secondary/60"
                    />
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3 text-yellow-500" />
                    Minimum deposit: <span className="text-yellow-400 font-bold">₹30</span>
                  </p>
                </div>

                {/* Info banner */}
                <div className="bg-blue-950/50 border border-blue-500/25 rounded-lg p-3 flex gap-2.5 items-start">
                  <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-xs font-mono space-y-0.5">
                    <p className="text-blue-300 font-bold">Funds credited within 5 minutes</p>
                    <p className="text-blue-400/80">After admin confirmation. Late payments get a <span className="text-yellow-400 font-semibold"><Gift className="h-3 w-3 inline" /> bonus!</span></p>
                  </div>
                </div>

                <Button
                  className="w-full h-12 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold text-base uppercase tracking-widest shadow-[0_0_20px_rgba(57,255,20,0.35)]"
                  onClick={proceedToPayment}
                  disabled={!depositAmount || parseInt(depositAmount) < 30}
                >
                  Proceed to Pay →
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 2: QR Code + UTR Form ── */}
          {depositStep === "payment" && (
            <div className="flex flex-col">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-secondary/20">
                <button
                  onClick={() => setDepositStep("amount")}
                  className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors mb-3"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Change amount
                </button>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ScanLine className="h-5 w-5 text-secondary drop-shadow-[0_0_6px_rgba(57,255,20,0.8)]" />
                    <span className="font-display text-lg font-bold uppercase tracking-wider text-secondary">Scan & Pay</span>
                  </div>
                  <div className="bg-secondary/15 border border-secondary/30 rounded-lg px-3 py-1">
                    <span className="font-mono font-black text-secondary text-lg">₹{depositAmount}</span>
                  </div>
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-1">Step 2 of 2 — Scan, pay, then enter your Transaction ID</p>
              </div>

              <div className="px-6 py-5 space-y-4">
                {/* QR Code */}
                <div className="rounded-xl border border-secondary/25 bg-secondary/5 p-4 flex flex-col items-center gap-3">
                  {config?.qrCodeUrl ? (
                    <>
                      <div className="bg-white rounded-xl p-3 shadow-[0_0_25px_rgba(57,255,20,0.2)]">
                        <img src={config.qrCodeUrl} alt="Payment QR Code" className="w-48 h-48 object-contain" />
                      </div>
                      <p className="text-xs font-mono text-muted-foreground text-center">
                        Scan with <span className="text-foreground font-bold">GPay · PhonePe · Paytm</span> or any UPI app
                      </p>
                    </>
                  ) : (
                    <div className="py-6 text-center space-y-2">
                      <QrCode className="h-16 w-16 text-muted-foreground/20 mx-auto" />
                      <p className="text-muted-foreground font-mono text-sm">QR code not configured yet.</p>
                    </div>
                  )}

                  {/* UPI ID */}
                  <div className="w-full bg-background/50 border border-border/40 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">UPI ID</p>
                      <p className="font-mono font-bold text-sm text-foreground truncate">{config?.upiId || "ffarena@upi"}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="shrink-0 h-8 px-2 text-secondary hover:text-secondary hover:bg-secondary/10" onClick={copyUpi}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* UTR input */}
                <div className="space-y-1.5">
                  <Label className="font-mono text-xs uppercase text-muted-foreground">
                    Transaction ID / UTR <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={depositRef}
                    onChange={e => setDepositRef(e.target.value)}
                    placeholder="Enter UTR after payment (e.g. 123456789012)"
                    className="bg-background/50 border-border/50 font-mono h-12"
                  />
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Find this in your UPI app → Transactions → Payment to FF Arena
                  </p>
                </div>

                {/* Submit */}
                <Button
                  onClick={handleDeposit}
                  disabled={deposit.isPending || !depositRef.trim()}
                  className="w-full h-12 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(57,255,20,0.25)]"
                >
                  {deposit.isPending ? "Submitting..." : "Submit for Verification"}
                </Button>
                <p className="text-[11px] font-mono text-muted-foreground text-center">
                  Admin will verify and credit ₹{depositAmount} to your wallet within 5 minutes.
                </p>
              </div>
            </div>
          )}

        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdraw} onOpenChange={setShowWithdraw}>
        <DialogContent className="bg-card border-primary/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wider text-primary flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5" /> Withdraw Funds
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-background/50 border border-border/30 rounded p-3 font-mono text-xs text-muted-foreground">
              Minimum withdrawal: <span className="text-foreground font-bold">₹100</span>. Processed within 24 hours after admin approval.
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Amount (₹)</Label>
              <Input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="Enter amount" className="bg-background/50 border-border/50 font-mono text-lg" />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Your UPI ID</Label>
              <Input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@upi" className="bg-background/50 border-border/50 font-mono" />
            </div>
            <Button onClick={handleWithdraw} disabled={withdraw.isPending || !withdrawAmount || !upiId} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest">
              {withdraw.isPending ? "Processing..." : "Request Withdrawal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
