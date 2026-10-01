interface ModListEmptyProps {
  message: string
}

export function ModListEmpty({ message }: ModListEmptyProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-center py-10 text-sm text-neutral-500">{message}</div>
  )
}
