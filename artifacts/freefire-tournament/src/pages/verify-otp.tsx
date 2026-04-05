import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, customFetch } from "@workspace/api-client-react";
import { ShieldCheck, MailOpen, RotateCcw, Timer } from "lucide-react";

const RESEND_COOLDOWN = 60;

export default function VerifyOtp() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState<string>("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Read email from session storage (set by register/login pages)
  useEffect(() => {
    const stored = sessionStorage.getItem("pendingVerificationEmail");
    if (!stored) {
      setLocation("/register");
      return;
    }
    setEmail(stored);
  }, [setLocation]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ["", "", "", "", "", ""];
    text.split("").forEach((d, i) => { next[i] = d; });
    setOtp(next);
    inputRefs.current[Math.min(text.length, 5)]?.focus();
  };

  const otpValue = otp.join("");

  const handleVerify = async () => {
    if (otpValue.length < 6) {
      toast({ title: "Enter the 6-digit OTP", description: "Please fill in all digits.", variant: "destructive" });
      return;
    }
    setIsVerifying(true);
    try {
      const data = await customFetch<{ user?: unknown; message: string }>("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpValue }),
      });
      sessionStorage.removeItem("pendingVerificationEmail");
      queryClient.clear();
      if (data?.user) {
        queryClient.setQueryData(getGetMeQueryKey(), data.user);
      }
      toast({ title: "Email verified!", description: data.message });
      setLocation("/");
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string }; status?: number };
      toast({
        title: "Verification failed",
        description: apiErr.data?.error ?? "Invalid OTP. Please try again.",
        variant: "destructive",
      });
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setIsResending(true);
    try {
      await customFetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      toast({ title: "OTP sent!", description: "A new OTP has been sent to your email." });
      setCooldown(RESEND_COOLDOWN);
      setCanResend(false);
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      toast({
        title: "Resend failed",
        description: apiErr.data?.error ?? "Could not resend OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[75vh]">
      <Card className="w-full max-w-md neon-border bg-card/80 backdrop-blur">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-secondary/10 p-4 rounded-full w-fit neon-border-green">
            <ShieldCheck className="h-8 w-8 text-secondary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-secondary to-primary">
              Verify Your Email
            </CardTitle>
            <CardDescription className="font-mono mt-2 text-muted-foreground text-sm">
              We sent a 6-digit OTP to
            </CardDescription>
            <div className="flex items-center justify-center gap-2 mt-1">
              <MailOpen className="h-4 w-4 text-primary" />
              <span className="font-mono text-primary text-sm font-semibold">{email}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* OTP input boxes */}
          <div className="flex justify-center gap-3" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <Input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="w-12 h-14 text-center text-2xl font-bold font-mono bg-background/50 border-primary/30 focus-visible:ring-secondary focus-visible:border-secondary caret-transparent"
                style={{ letterSpacing: 0 }}
              />
            ))}
          </div>

          <Button
            onClick={handleVerify}
            className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-widest clip-path-slant h-12 rounded-none shadow-[0_0_15px_rgba(57,255,20,0.4)]"
            disabled={isVerifying || otpValue.length < 6}
          >
            {isVerifying ? "Verifying..." : "Verify & Enter Arena"}
          </Button>

          {/* Resend */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground font-mono">Didn't receive the OTP?</p>
            {canResend ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={isResending}
                className="text-primary hover:text-secondary font-mono gap-2"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {isResending ? "Sending..." : "Resend OTP"}
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground font-mono">
                <Timer className="h-3.5 w-3.5" />
                Resend in {cooldown}s
              </div>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground/60 font-mono">
            OTP expires in 5 minutes. Check spam/junk if you don't see it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
