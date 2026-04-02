import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, User, ShieldAlert, LogOut, Swords, Menu, Wallet } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const walletBalance = (user as any)?.walletBalance ?? 0;

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = "/";
      },
      onError: () => {
        queryClient.clear();
        window.location.href = "/";
      }
    });
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <Link href="/tournaments" onClick={onNavigate} className={`hover:text-primary transition-colors ${location === "/tournaments" ? "text-primary neon-text" : "text-muted-foreground"}`}>Tournaments</Link>
      <Link href="/leaderboard" onClick={onNavigate} className={`hover:text-primary transition-colors ${location === "/leaderboard" ? "text-primary neon-text" : "text-muted-foreground"}`}>Leaderboard</Link>
      {isAuthenticated && (
        <>
          <Link href="/my-matches" onClick={onNavigate} className={`hover:text-primary transition-colors flex items-center gap-1 ${location === "/my-matches" ? "text-primary neon-text" : "text-muted-foreground"}`}>
            My Matches
          </Link>
          <Link href="/wallet" onClick={onNavigate} className={`hover:text-primary transition-colors flex items-center gap-1 ${location === "/wallet" ? "text-primary neon-text" : "text-muted-foreground"}`}>
            Wallet
          </Link>
          <Link href="/notifications" onClick={onNavigate} className={`hover:text-primary transition-colors flex items-center gap-1 ${location === "/notifications" ? "text-primary neon-text" : "text-muted-foreground"}`}>
            <Bell className="h-4 w-4" />
          </Link>
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary selection:text-primary-foreground relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background opacity-50" />

      <header className="sticky top-0 z-50 w-full border-b border-primary/20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-[0_4px_20px_rgba(0,245,255,0.05)]">
        <div className="container mx-auto px-4 flex h-16 items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105 z-10">
            <Swords className="h-6 w-6 text-primary drop-shadow-[0_0_8px_rgba(0,245,255,0.8)]" />
            <span className="font-display text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary drop-shadow-[0_0_10px_rgba(0,245,255,0.3)] uppercase">
              FF ARENA
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold uppercase tracking-widest z-10">
            <NavLinks />
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-1 md:gap-3 z-10">
            {isAuthenticated ? (
              <>
                {/* Admin button — desktop only */}
                {user?.isAdmin && (
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="hidden sm:flex border-primary/50 hover:bg-primary/10 hover:text-primary transition-all clip-path-slant rounded-none font-mono">
                      <ShieldAlert className="h-4 w-4 mr-2" />
                      Admin
                    </Button>
                  </Link>
                )}

                {/* Profile — always visible */}
                <Link href="/profile">
                  <Button variant="ghost" size="sm" className="flex items-center gap-1.5 hover:bg-accent hover:text-primary transition-colors font-mono px-2">
                    <User className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline text-sm truncate max-w-[80px]">{user?.inGameName}</span>
                  </Button>
                </Link>

                {/* Wallet icon + balance — always visible */}
                <Link href="/wallet">
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-secondary/40 bg-secondary/8 hover:bg-secondary/20 transition-all shadow-[0_0_10px_rgba(57,255,20,0.1)] hover:shadow-[0_0_14px_rgba(57,255,20,0.25)] min-w-[72px]">
                    <Wallet className="h-4 w-4 text-secondary shrink-0 drop-shadow-[0_0_6px_rgba(57,255,20,0.7)]" />
                    <div className="flex flex-col items-start leading-none">
                      <span className="text-[9px] font-mono text-secondary/60 uppercase tracking-wider">Wallet</span>
                      <span className="text-xs font-mono font-bold text-secondary">
                        ₹{walletBalance.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </button>
                </Link>

                {/* Logout — desktop only (mobile gets it in the hamburger) */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="hidden md:flex hover:text-destructive hover:bg-destructive/10"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" className="hidden sm:flex hover:bg-primary/10 hover:text-primary font-mono uppercase tracking-wider">Login</Button>
                </Link>
                <Link href="/register">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(0,245,255,0.5)] border border-primary/50 clip-path-slant rounded-none font-bold uppercase tracking-wider">
                    Register
                  </Button>
                </Link>
              </div>
            )}

            {/* Hamburger — mobile only */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden ml-1">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-background/95 backdrop-blur border-l-primary/20 flex flex-col">

                {/* Wallet summary at top of menu when logged in */}
                {isAuthenticated && (
                  <Link href="/wallet" onClick={() => setMobileMenuOpen(false)}>
                    <div className="mt-6 mb-2 flex items-center gap-3 p-3 rounded-xl border border-secondary/30 bg-secondary/5 hover:bg-secondary/10 transition-colors">
                      <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-secondary/10 border border-secondary/20">
                        <Wallet className="h-4 w-4 text-secondary" />
                      </div>
                      <div>
                        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Wallet Balance</p>
                        <p className="text-lg font-bold font-mono text-secondary leading-tight">
                          ₹{walletBalance.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                  </Link>
                )}

                <div className="flex flex-col gap-5 mt-4 flex-1 text-sm font-semibold uppercase tracking-widest">
                  <NavLinks onNavigate={() => setMobileMenuOpen(false)} />

                  {!isAuthenticated && (
                    <div className="flex flex-col gap-4 mt-4">
                      <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="text-muted-foreground hover:text-primary uppercase tracking-widest font-semibold">Login</Link>
                      <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="text-muted-foreground hover:text-primary uppercase tracking-widest font-semibold">Register</Link>
                    </div>
                  )}

                  {isAuthenticated && (
                    <>
                      {user?.isAdmin && (
                        <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="text-muted-foreground hover:text-primary uppercase tracking-widest font-semibold flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4" /> Admin Dashboard
                        </Link>
                      )}
                      <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="text-muted-foreground hover:text-primary uppercase tracking-widest font-semibold flex items-center gap-2">
                        <User className="h-4 w-4" /> Profile
                      </Link>
                    </>
                  )}
                </div>

                {/* Logout at the bottom of the mobile menu */}
                {isAuthenticated && (
                  <div className="border-t border-primary/20 pt-5 pb-4 mt-4">
                    <p className="text-xs font-mono text-muted-foreground mb-3 truncate">{user?.inGameName}</p>
                    <Button
                      variant="destructive"
                      className="w-full flex items-center gap-2 font-bold uppercase tracking-wider"
                      onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>

        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 z-10">
        {children}
      </main>

      <footer className="border-t border-primary/20 py-8 bg-card/50 backdrop-blur z-10">
        <div className="container mx-auto px-4 flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2 opacity-80">
            <Swords className="h-5 w-5 text-primary" />
            <span className="font-display text-xl font-bold tracking-wider uppercase text-foreground">FF ARENA</span>
          </div>
          <p className="text-center text-sm text-muted-foreground font-mono">
            Built for competitive mobile gamers. Step into the arena.
          </p>
        </div>
      </footer>
    </div>
  );
}
