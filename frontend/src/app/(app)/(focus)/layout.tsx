/** Active ride and receipt: full screen, no bottom nav (DESIGN.md section 5). */
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return <main className="relative min-h-0 flex-1">{children}</main>;
}
