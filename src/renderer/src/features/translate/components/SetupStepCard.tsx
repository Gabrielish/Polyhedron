interface SetupStepCardProps {
  step: string
  children: React.ReactNode
}

export function SetupStepCard({ step, children }: SetupStepCardProps): React.JSX.Element {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#272b33] bg-[#111317] shadow-[0_10px_28px_rgb(0_0_0_/_16%)] transition-colors hover:border-amber-500/30">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.035] via-transparent to-amber-500/[0.025]" />
      <span className="absolute right-5 top-5 rounded-md border border-neutral-700/70 bg-[#0b0c0f]/80 px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.12em] text-neutral-500">
        {step}
      </span>
      <div className="relative flex flex-col gap-4 p-5 sm:p-6">{children}</div>
    </section>
  )
}
