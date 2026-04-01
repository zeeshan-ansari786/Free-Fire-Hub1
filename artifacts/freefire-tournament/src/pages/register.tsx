import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegister, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserPlus, Eye, EyeOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(6),
  freeFireUid: z.string().min(5),
  inGameName: z.string().min(3),
  whatsappNumber: z.string().min(10),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutate: register, isPending } = useRegister();
  const { isAuthenticated } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) {
    setLocation("/");
    return null;
  }

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      freeFireUid: "",
      inGameName: "",
      whatsappNumber: "",
    },
  });

  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    register({ data: values }, {
      onSuccess: () => {
        toast({
          title: "Registration successful!",
          description: "Welcome to the arena.",
        });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/");
      },
      onError: (err) => {
        toast({
          title: "Registration failed",
          description: err.error?.message || "An error occurred",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-2xl neon-border bg-card/80 backdrop-blur">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-secondary/10 p-4 rounded-full w-fit neon-border-green">
            <UserPlus className="h-8 w-8 text-secondary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-secondary to-primary">
              Join The Ranks
            </CardTitle>
            <CardDescription className="font-mono mt-2 text-muted-foreground">
              Create your profile to start competing.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-primary">USERNAME</FormLabel>
                      <FormControl>
                        <Input placeholder="pro_gamer99" {...field} className="bg-background/50 border-primary/30 font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-primary">EMAIL</FormLabel>
                      <FormControl>
                        <Input placeholder="player@example.com" {...field} className="bg-background/50 border-primary/30 font-mono" />
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
                            className="bg-background/50 border-primary/30 font-mono pr-10"
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
                <FormField
                  control={form.control}
                  name="freeFireUid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-secondary">FREE FIRE UID</FormLabel>
                      <FormControl>
                        <Input placeholder="1234567890" {...field} className="bg-background/50 border-secondary/30 focus-visible:ring-secondary font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="inGameName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-secondary">IN-GAME NAME (IGN)</FormLabel>
                      <FormControl>
                        <Input placeholder="KILLER_X" {...field} className="bg-background/50 border-secondary/30 focus-visible:ring-secondary font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="whatsappNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-primary">WHATSAPP NUMBER</FormLabel>
                      <FormControl>
                        <Input placeholder="+91 9876543210" {...field} className="bg-background/50 border-primary/30 font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-widest clip-path-slant h-12 rounded-none shadow-[0_0_15px_rgba(57,255,20,0.4)] mt-8"
                disabled={isPending}
              >
                {isPending ? "Registering..." : "Create Account"}
              </Button>

              <div className="text-center mt-6">
                <p className="text-sm text-muted-foreground font-mono">
                  Already registered?{" "}
                  <Link href="/login" className="text-secondary hover:text-primary transition-colors underline decoration-secondary/30 underline-offset-4">
                    Login here
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
