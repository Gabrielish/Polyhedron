interface SetupStepCardProps {
  step: string
  children: React.ReactNode
  flat?: boolean
  compactTop?: boolean
}

export function SetupStepCard({
  step,
  children,
  flat = false,
  compactTop = false
}: SetupStepCardProps): React.JSX.Element {
  return (
    <section
      className={
        flat
          ? 'merge-step-flat relative'
          : 'translate-idle-step relative overflow-hidden rounded-xl border border-neutral-800/80 bg-[#141416] transition-colors hover:border-neutral-700'
      }
    >
      <div
        className={
          flat
            ? `flex flex-col gap-5 px-0 ${compactTop ? 'pt-2 pb-6' : 'py-6'}`
            : 'flex flex-col gap-3.5 p-6'
        }
      >
        <div data-step={step}>{children}</div>
      </div>
    </section>
  )
}
