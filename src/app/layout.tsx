// Root layout passthrough. html/body live in [locale]/layout.tsx so the locale (and dir/lang) are known.
// Next.js requires a root layout to exist; this one renders children only.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
