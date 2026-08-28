interface SetupStepCardProps {
  step: string
  children: React.ReactNode
}

export function SetupStepCard({ step, children }: SetupStepCardProps): React.JSX.Element {
  return (
    <section className="relative overflow-hidden rounded-xl border border-neutral-800/80 bg-[#141416] transition-colors hover:border-neutral-700">
      <span className="absolute right-5 top-5 rounded-md border border-neutral-800 bg-[#0f1114] px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.12em] text-neutral-500">
        {step}
      </span>
      <div className="flex flex-col gap-3.5 p-6">{children}</div>
    </section>
  )
}
