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
import { Wallet, ArrowDownCircle, ArrowUpCircle, IndianRupee, Clock, CheckCircle, XCircle, Smartphone, QrCode, Info, Copy, Gift } from "lucide-react";
import { format } from "date-fns";
import { customFetch } from "@workspace/api-client-react";

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet"] }),
  });
}
function useWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number; upiId: string }) =>
      customFetch<{ walletBalance: number; message: string }>("/api/wallet/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet"] }),
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

  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [paymentTab, setPaymentTab] = useState<"upi" | "qr">("upi");
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

  const handleDeposit = () => {
    if (!depositAmount || parseInt(depositAmount) <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" }); return;
    }
    if (!depositRef.trim()) {
      toast({ title: "Enter UTR / transaction reference", variant: "destructive" }); return;
    }
    deposit.mutate({ amount: parseInt(depositAmount), transactionRef: depositRef.trim(), paymentMethod: paymentTab }, {
      onSuccess: (data) => {
        toast({ title: "Deposit Request Submitted!", description: data.message });
        setShowDeposit(false); setDepositAmount(""); setDepositRef("");
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
            <Button onClick={() => setShowDeposit(true)} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-wider clip-path-slant rounded-none shadow-[0_0_15px_rgba(57,255,20,0.3)]">
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
            onClick={() => { setDepositAmount(String(amt)); setShowDeposit(true); }}>
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

      {/* Deposit Dialog */}
      <Dialog open={showDeposit} onOpenChange={setShowDeposit}>
        <DialogContent className="bg-card border-secondary/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wider text-secondary flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5" /> Add Funds
            </DialogTitle>
          </DialogHeader>

          {/* Info Banner */}
          <div className="bg-blue-950/60 border border-blue-500/30 rounded-lg p-3 flex gap-3 items-start">
            <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs font-mono space-y-1">
              <p className="text-blue-300 font-bold">Payment credited within 5 minutes</p>
              <p className="text-blue-400/80">After admin verification. If it takes longer than 5 minutes, you'll automatically receive a <span className="text-yellow-400 font-bold flex-inline items-center gap-1"><Gift className="h-3 w-3 inline" /> bonus credit!</span></p>
            </div>
          </div>

          {/* Payment Method Tabs */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPaymentTab("upi")}
              className={`flex items-center justify-center gap-2 p-3 rounded border font-mono text-sm font-bold uppercase transition-all ${paymentTab === "upi" ? "bg-secondary/20 border-secondary text-secondary" : "border-border/50 text-muted-foreground hover:border-secondary/40 hover:text-secondary/70"}`}
            >
              <Smartphone className="h-4 w-4" /> UPI
            </button>
            <button
              onClick={() => setPaymentTab("qr")}
              className={`flex items-center justify-center gap-2 p-3 rounded border font-mono text-sm font-bold uppercase transition-all ${paymentTab === "qr" ? "bg-secondary/20 border-secondary text-secondary" : "border-border/50 text-muted-foreground hover:border-secondary/40 hover:text-secondary/70"}`}
            >
              <QrCode className="h-4 w-4" /> QR Code
            </button>
          </div>

          {/* UPI Details */}
          {paymentTab === "upi" && (
            <div className="bg-secondary/10 border border-secondary/30 rounded-lg p-4 font-mono text-sm space-y-2">
              <p className="text-secondary font-bold uppercase tracking-wide text-xs">UPI Payment Details</p>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">UPI ID</p>
                  <p className="text-foreground font-bold text-base">{config?.upiId || "ffarena@upi"}</p>
                </div>
                <Button size="sm" variant="outline" className="border-secondary/40 text-secondary h-8 px-2" onClick={copyUpi}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Name: <span className="text-foreground">{config?.upiName || "FF Arena Official"}</span></p>
              <p className="text-xs text-primary mt-1">Open any UPI app, send payment to the UPI ID above, then enter the UTR / transaction reference below.</p>
            </div>
          )}

          {/* QR Code */}
          {paymentTab === "qr" && (
            <div className="bg-secondary/10 border border-secondary/30 rounded-lg p-4 text-center space-y-3">
              {config?.qrCodeUrl ? (
                <>
                  <p className="text-secondary font-bold font-mono text-xs uppercase tracking-wide">Scan QR Code to Pay</p>
                  <div className="flex justify-center">
                    <img
                      src={config.qrCodeUrl}
                      alt="Payment QR Code"
                      className="w-48 h-48 object-contain bg-white p-2 rounded-lg"
                    />
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">Scan with any UPI app — GPay, PhonePe, Paytm, etc.</p>
                  <div className="flex items-center justify-between gap-2 bg-background/30 rounded p-2">
                    <span className="text-xs font-mono text-foreground">{config.upiId || "ffarena@upi"}</span>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-secondary" onClick={copyUpi}><Copy className="h-3 w-3" /></Button>
                  </div>
                </>
              ) : (
                <div className="py-6">
                  <QrCode className="h-16 w-16 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-mono text-sm">QR code not configured yet.</p>
                  <p className="text-muted-foreground/70 font-mono text-xs mt-1">Use UPI tab to pay, or ask admin to add a QR code.</p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Amount (₹) <span className="text-destructive">*</span></Label>
              <Input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="Enter amount" className="bg-background/50 border-border/50 font-mono text-lg" />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-xs uppercase text-muted-foreground">UTR / Transaction Reference <span className="text-destructive">*</span></Label>
              <Input value={depositRef} onChange={e => setDepositRef(e.target.value)} placeholder="e.g. 123456789012" className="bg-background/50 border-border/50 font-mono" />
              <p className="text-xs text-muted-foreground font-mono">Find this in your UPI app's transaction history after paying.</p>
            </div>
            <Button onClick={handleDeposit} disabled={deposit.isPending || !depositAmount} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-widest h-11">
              {deposit.isPending ? "Submitting..." : "Submit Deposit Request"}
            </Button>
          </div>
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
