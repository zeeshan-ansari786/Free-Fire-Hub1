export const DEFAULT_BANNERS: Record<string, string> = {
  solo: "https://images.unsplash.com/photo-1616588589676-62b3bd4ff6d2?w=800&q=80&fit=crop&crop=center",
  duo: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&q=80&fit=crop&crop=center",
  squad: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80&fit=crop&crop=center",
};

export const MODE_GRADIENTS: Record<string, string> = {
  solo: "from-red-900/80 via-orange-900/60 to-card",
  duo: "from-blue-900/80 via-indigo-900/60 to-card",
  squad: "from-emerald-900/80 via-teal-900/60 to-card",
};

export const MODE_COLORS: Record<string, string> = {
  solo: "text-orange-400",
  duo: "text-blue-400",
  squad: "text-emerald-400",
};

export const MODE_LABELS: Record<string, string> = {
  solo: "Solo",
  duo: "Duo",
  squad: "Squad",
};

export function getDefaultBanner(gameMode: string): string {
  return DEFAULT_BANNERS[gameMode] ?? DEFAULT_BANNERS.squad;
}
