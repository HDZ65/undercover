import type { SidePot } from '@undercover/shared'

interface PotDisplayProps {
  mainPot: number
  sidePots?: SidePot[]
}

export function PotDisplay({ mainPot, sidePots = [] }: PotDisplayProps) {
  const formatChips = (centimes: number) => {
    return (centimes / 100).toFixed(2)
  }

  const totalPot = mainPot + sidePots.reduce((sum, pot) => sum + pot.amount, 0)

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Main Pot */}
      <div className="bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 rounded-lg px-4 py-2 border-2 border-amber-400 dark:border-amber-600 shadow-lg">
        <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold">POT</p>
        <p className="text-2xl md:text-3xl font-bold text-amber-900 dark:text-amber-100 font-mono">
          ${formatChips(mainPot)}
        </p>
      </div>

      {/* Side Pots */}
      {sidePots.length > 0 && (
        <div className="flex flex-col gap-1 w-full">
          {sidePots.map((pot, idx) => (
            <div
              key={idx}
              className="bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 rounded px-3 py-1 border border-orange-400 dark:border-orange-600 text-center"
            >
              <p className="text-xs text-orange-700 dark:text-orange-300 font-semibold">
                Side Pot {idx + 1}
              </p>
              <p className="text-lg font-bold text-orange-900 dark:text-orange-100 font-mono">
                ${formatChips(pot.amount)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Total Pot */}
      {sidePots.length > 0 && (
        <div className="text-center text-xs text-slate-600 dark:text-slate-400 font-semibold">
          Total: ${formatChips(totalPot)}
        </div>
      )}
    </div>
  )
}
