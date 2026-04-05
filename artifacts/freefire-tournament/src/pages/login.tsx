import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import type { ApiError, ErrorResponse } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Swords, Eye, EyeOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutate: login, isPending } = useLogin();
  const { isAuthenticated, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) setLocation("/");
  }, [isAuthenticated, isLoading, setLocation]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    login({ data: values }, {
      onSuccess: (response) => {
        const data = response as unknown as { user?: unknown };
        queryClient.clear();
        if (data?.user) {
          queryClient.setQueryData(getGetMeQueryKey(), data.user);
        }
        setLocation("/");
      },
      onError: (err) => {
        const apiErr = err as ApiError<ErrorResponse & { requiresVerification?: boolean; email?: string }>;
        const payload = apiErr.data as (ErrorResponse & { requiresVerification?: boolean; email?: string }) | null;

        if (payload?.requiresVerification && payload?.email) {
          sessionStorage.setItem("pendingVerificationEmail", payload.email);
          toast({
            title: "Email not verified",
            description: "A new OTP has been sent to your email. Please verify to login.",
          });
          setLocation("/verify-otp");
          return;
        }

        const message =
          payload?.error ||
          (apiErr.status === 401 ? "Invalid email or password" :
           apiErr.status === 403 ? "Your account has been banned. Contact support." :
           apiErr.status >= 500 ? "Server error. Please try again later." :
           "Login failed. Please check your details.");
        toast({ title: "Login failed", description: message, variant: "destructive" });
      },
    });
  };

  if (isLoading || isAuthenticated) return null;

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-md neon-border bg-card/80 backdrop-blur">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit neon-border">
            <Swords className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              Enter The Arena
            </CardTitle>
            <CardDescription className="font-mono mt-2 text-muted-foreground">
              Login to join tournaments and claim your prize.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-primary">EMAIL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="player@example.com"
                        {...field}
                        className="bg-background/50 border-primary/30 focus-visible:ring-primary font-mono"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-primary">PASSWORD</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                          className="bg-background/50 border-primary/30 focus-visible:ring-primary font-mono pr-10"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowPassword(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest clip-path-slant h-12 rounded-none shadow-[0_0_15px_rgba(0,245,255,0.4)]"
                disabled={isPending}
              >
                {isPending ? "Authenticating..." : "Login"}
              </Button>

              <div className="text-center mt-6">
                <p className="text-sm text-muted-foreground font-mono">
                  Don't have an account?{" "}
                  <Link href="/register" className="text-primary hover:text-secondary transition-colors underline decoration-primary/30 underline-offset-4">
                    Register now
                  </Link>
                </p>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
