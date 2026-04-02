import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { MessageCircle, Instagram, HeadphonesIcon, Clock, Shield, Zap, Loader2 } from "lucide-react";

type SupportConfig = { instagram: string; whatsapp: string };

function useSupportConfig() {
  return useQuery({
    queryKey: ["support-config"],
    queryFn: () => customFetch<SupportConfig>("/api/support-config", { method: "GET" }),
    staleTime: 60_000,
  });
}

export default function Support() {
  const { data, isLoading } = useSupportConfig();

  const instagram = data?.instagram ?? "Sufi33k";
  const whatsapp = data?.whatsapp ?? "917777915823";

  const whatsappUrl = `https://wa.me/${whatsapp}?text=Hi%2C%20I%20need%20help%20with%20FF%20Arena.`;
  const instagramUrl = `https://instagram.com/${instagram}`;

  return (
    <div className="max-w-2xl mx-auto space-y-10 py-4">

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/30 shadow-[0_0_30px_rgba(0,245,255,0.15)]">
            <HeadphonesIcon className="h-10 w-10 text-primary drop-shadow-[0_0_8px_rgba(0,245,255,0.8)]" />
          </div>
        </div>
        <h1 className="font-display text-4xl font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
          Customer Support
        </h1>
        <p className="text-muted-foreground font-mono text-sm">
          We're here to help you — anytime.
        </p>
      </div>

      {/* Support description */}
      <div className="bg-card/60 border border-primary/20 rounded-2xl p-6 text-center space-y-2 backdrop-blur shadow-[0_0_20px_rgba(0,245,255,0.05)]">
        <p className="text-foreground/90 font-mono text-sm leading-relaxed">
          Need help? Our support team is always ready to assist you.
          Whether it's tournament issues, payments, or account queries,
          feel free to contact us anytime.
        </p>
        <p className="text-muted-foreground font-mono text-sm leading-relaxed">
          We aim to provide fast, reliable, and friendly support to ensure
          the best experience for all our players.
        </p>
      </div>

      {/* Contact options */}
      <div className="space-y-4">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground text-center">
          Reach Us On
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground font-mono text-sm">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading contact info...
          </div>
        ) : (
          <>
            {/* WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-5 p-5 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/5 hover:bg-[#25D366]/10 hover:border-[#25D366]/60 transition-all shadow-[0_0_10px_rgba(37,211,102,0.05)] hover:shadow-[0_0_20px_rgba(37,211,102,0.2)] cursor-pointer"
            >
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 shrink-0 group-hover:scale-105 transition-transform">
                <MessageCircle className="h-7 w-7 text-[#25D366] drop-shadow-[0_0_6px_rgba(37,211,102,0.8)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-lg uppercase tracking-wider text-[#25D366]">
                  Chat on WhatsApp
                </p>
                <p className="text-muted-foreground font-mono text-xs mt-0.5">
                  +{whatsapp} · Fastest response
                </p>
              </div>
              <div className="shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                <svg className="w-5 h-5 text-[#25D366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </a>

            {/* Instagram */}
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-5 p-5 rounded-2xl border border-[#E1306C]/30 bg-[#E1306C]/5 hover:bg-[#E1306C]/10 hover:border-[#E1306C]/60 transition-all shadow-[0_0_10px_rgba(225,48,108,0.05)] hover:shadow-[0_0_20px_rgba(225,48,108,0.2)] cursor-pointer"
            >
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-[#833AB4]/20 via-[#E1306C]/20 to-[#F77737]/20 border border-[#E1306C]/30 shrink-0 group-hover:scale-105 transition-transform">
                <Instagram className="h-7 w-7 text-[#E1306C] drop-shadow-[0_0_6px_rgba(225,48,108,0.8)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-lg uppercase tracking-wider text-[#E1306C]">
                  Contact on Instagram
                </p>
                <p className="text-muted-foreground font-mono text-xs mt-0.5">
                  @{instagram} · DM us anytime
                </p>
              </div>
              <div className="shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                <svg className="w-5 h-5 text-[#E1306C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </a>
          </>
        )}
      </div>

      {/* Trust badges */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/40 border border-primary/10 text-center">
          <Zap className="h-5 w-5 text-primary" />
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wide">Fast Response</p>
        </div>
        <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/40 border border-primary/10 text-center">
          <Clock className="h-5 w-5 text-secondary" />
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wide">24/7 Available</p>
        </div>
        <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/40 border border-primary/10 text-center">
          <Shield className="h-5 w-5 text-primary" />
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wide">Trusted Support</p>
        </div>
      </div>

      {/* Topics we help with */}
      <div className="bg-card/40 border border-border/40 rounded-2xl p-5 space-y-3">
        <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          We can help with
        </h3>
        <ul className="space-y-2">
          {[
            "Tournament registration & room code issues",
            "Wallet deposits, withdrawals & payment queries",
            "Account verification & profile problems",
            "Match results & leaderboard disputes",
            "General questions & feedback",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 font-mono text-sm text-foreground/80">
              <span className="text-primary">›</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}
