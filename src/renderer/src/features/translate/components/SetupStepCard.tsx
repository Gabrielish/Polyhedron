interface SetupStepCardProps {
  step: string
  children: React.ReactNode
}

export function SetupStepCard({ step, children }: SetupStepCardProps): React.JSX.Element {
  return (
    <section className="relative overflow-hidden rounded-xl border border-neutral-800/80 bg-[#141416] transition-colors hover:border-neutral-700">
      <div className="flex flex-col gap-3.5 p-6">
        <div className="flex items-center gap-2 font-mono text-[13px] font-semibold tracking-[0.08em] text-amber-400">
          <span className="text-base">{step}</span>
          <span className="text-neutral-700">|</span>
        </div>
        {children}
      </div>
    </section>
  )
}
