import { motion } from 'motion/react'

interface RulesModalProps {
  onClose: () => void
}

export function RulesModal({ onClose }: RulesModalProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-black text-amber-400">Regles du Tamalou</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        {/* But du jeu */}
        <Section title="But du jeu">
          Avoir le <b>moins de points</b> possible dans sa main. Le premier joueur a atteindre le score maximum perd, celui avec le moins de points gagne.
        </Section>

        {/* Mise en place */}
        <Section title="Mise en place">
          Chaque joueur recoit <b>4 cartes face cachee</b>. Au debut du tour, vous pouvez <b>regarder 2 de vos 4 cartes</b> puis les reposer. Memorisez-les !
        </Section>

        {/* Deroulement */}
        <Section title="Deroulement d'un tour">
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li><b>Piocher</b> une carte (depuis la pioche ou la defausse)</li>
            <li><b>Choisir</b> : echanger la carte piochee avec une de vos cartes, ou la defausser</li>
            <li>Si vous defaussez et que la carte a un <b>pouvoir special</b>, vous pouvez l'utiliser (ou passer)</li>
          </ol>
        </Section>

        {/* Tamalou */}
        <Section title="Tamalou !">
          Quand c'est votre tour, si vous pensez avoir le score le plus bas, annoncez <b>"Tamalou !"</b>. Chaque autre joueur joue <b>un dernier tour</b>, puis on revele les cartes.
          <ul className="list-disc list-inside text-sm mt-1 space-y-1">
            <li>Si vous avez le score le plus bas : <span className="text-emerald-400 font-semibold">0 points</span></li>
            <li>Sinon : votre score <span className="text-red-400 font-semibold">+ 20 points de penalite</span></li>
          </ul>
        </Section>

        {/* Valeurs */}
        <Section title="Valeur des cartes">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <CardRow label="As" value="1 point" />
            <CardRow label="2 a 10" value="Valeur faciale" />
            <CardRow label="Valet (J)" value="11 points" />
            <CardRow label="Dame (Q)" value="12 points" />
            <CardRow label="Roi (K)" value="0 point" accent="text-emerald-400" />
          </div>
        </Section>

        {/* Pouvoirs */}
        <Section title="Pouvoirs speciaux">
          <p className="text-xs text-slate-400 mb-2">Actifs quand vous <b>defaussez</b> la carte piochee :</p>
          <div className="space-y-2">
            <PowerRow ranks="7 ou 8" power="Regarder une de VOS cartes" color="text-sky-400" emoji="👁️" />
            <PowerRow ranks="9 ou 10" power="Regarder une carte d'un ADVERSAIRE" color="text-purple-400" emoji="🔍" />
            <PowerRow ranks="Valet ou Dame" power="Echanger a l'aveugle une de vos cartes avec celle d'un adversaire" color="text-amber-400" emoji="🔀" />
            <PowerRow ranks="Roi" power="Aucun pouvoir (mais vaut 0 !)" color="text-emerald-400" emoji="👑" />
          </div>
        </Section>

        <button
          onClick={onClose}
          className="w-full mt-4 py-2.5 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-500 transition-colors"
        >
          Compris !
        </button>
      </motion.div>
    </motion.div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-1">{title}</h3>
      <div className="text-slate-400 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

function CardRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <>
      <span className="text-slate-300 font-medium">{label}</span>
      <span className={accent || 'text-slate-400'}>{value}</span>
    </>
  )
}

function PowerRow({ ranks, power, color, emoji }: { ranks: string; power: string; color: string; emoji: string }) {
  return (
    <div className="flex items-start gap-2 bg-slate-900/50 rounded-lg p-2">
      <span className="text-lg">{emoji}</span>
      <div>
        <span className={`font-bold text-sm ${color}`}>{ranks}</span>
        <p className="text-xs text-slate-400">{power}</p>
      </div>
    </div>
  )
}
