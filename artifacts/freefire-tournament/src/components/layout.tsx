import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, User, ShieldAlert, LogOut, Swords, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const logout = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      }
    });
  };

  const NavLinks = () => (
    <>
      <Link href="/tournaments" className={`hover:text-primary transition-colors ${location === "/tournaments" ? "text-primary neon-text" : "text-muted-foreground"}`}>Tournaments</Link>
      <Link href="/leaderboard" className={`hover:text-primary transition-colors ${location === "/leaderboard" ? "text-primary neon-text" : "text-muted-foreground"}`}>Leaderboard</Link>
      {isAuthenticated && (
        <Link href="/notifications" className={`hover:text-primary transition-colors flex items-center gap-1 ${location === "/notifications" ? "text-primary neon-text" : "text-muted-foreground"}`}>
          Notifications <Bell className="h-4 w-4" />
        </Link>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary selection:text-primary-foreground relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background opacity-50" />
      
      <header className="sticky top-0 z-50 w-full border-b border-primary/20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-[0_4px_20px_rgba(0,245,255,0.05)]">
        <div className="container mx-auto px-4 flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105 z-10">
            <Swords className="h-6 w-6 text-primary drop-shadow-[0_0_8px_rgba(0,245,255,0.8)]" />
            <span className="font-display text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary drop-shadow-[0_0_10px_rgba(0,245,255,0.3)] uppercase">
              FF ARENA
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold uppercase tracking-widest z-10">
            <NavLinks />
          </nav>

          <div className="flex items-center gap-2 md:gap-4 z-10">
            {isAuthenticated ? (
              <div className="flex items-center gap-2 md:gap-3">
                {user?.isAdmin && (
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="hidden sm:flex border-primary/50 hover:bg-primary/10 hover:text-primary transition-all clip-path-slant rounded-none font-mono">
                      <ShieldAlert className="h-4 w-4 mr-2" />
                      Admin
                    </Button>
                  </Link>
                )}
                <Link href="/profile">
                  <Button variant="ghost" className="flex items-center gap-2 hover:bg-accent hover:text-primary transition-colors font-mono">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{user?.inGameName}</span>
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="hover:text-destructive hover:bg-destructive/10">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
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

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-background/95 backdrop-blur border-l-primary/20">
                <div className="flex flex-col gap-6 mt-8">
                  <NavLinks />
                  {!isAuthenticated && (
                    <Link href="/login" className="text-muted-foreground hover:text-primary uppercase tracking-widest font-semibold mt-4">Login</Link>
                  )}
                  {isAuthenticated && user?.isAdmin && (
                    <Link href="/admin" className="text-muted-foreground hover:text-primary uppercase tracking-widest font-semibold mt-4 flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" /> Admin Dashboard
                    </Link>
                  )}
                </div>
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
            <span className="font-display text-xl font-bold tracking-wider uppercase text-foreground">
              FF ARENA
            </span>
          </div>
          <p className="text-center text-sm text-muted-foreground font-mono">
            Built for competitive mobile gamers. Step into the arena.
          </p>
        </div>
      </footer>
    </div>
  );
}
