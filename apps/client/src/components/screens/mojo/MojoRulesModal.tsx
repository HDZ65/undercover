import { motion } from 'motion/react'

export function MojoRulesModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl" initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-black text-fuchsia-400">Regles du Mojo</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">&times;</button>
        </div>

        <S title="But du jeu">
          Avoir le <b>moins de points</b> possible. La partie se termine quand un joueur atteint <b>50 points</b>. Celui avec le score le plus bas gagne.
        </S>

        <S title="Les cartes (79)">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <R color="bg-blue-500" label="Bleu : 0, 1" detail="4 de chaque" />
            <R color="bg-emerald-500" label="Vert : 2, 3, 4" detail="5 de chaque" />
            <R color="bg-yellow-400" label="Jaune : 5, 6, 7" detail="6 de chaque" />
            <R color="bg-orange-500" label="Orange : 8, 9, 10" detail="7 de chaque" />
            <R color="bg-red-500" label="Rouge : 11, 12" detail="8 de chaque" />
          </div>
        </S>

        <S title="Mise en place">
          Chaque joueur recoit <b>8 cartes</b>. Une carte est retournee sur la defausse. Le plus jeune commence.
        </S>

        <S title="Jouer une carte">
          Posez une carte de votre main sur la defausse :
          <ul className="list-disc list-inside text-sm mt-1 space-y-1">
            <li><span className="text-emerald-400 font-semibold">Inferieure</span> au sommet → votre tour est fini</li>
            <li><span className="text-red-400 font-semibold">Superieure</span> au sommet → piochez une carte, puis tour fini</li>
            <li><span className="text-amber-400 font-semibold">Egale</span> au sommet → vous DEVEZ rejouer une carte (chaine possible)</li>
          </ul>
        </S>

        <S title="Mojo Time !">
          Quand vous avez <b>3 cartes ou moins</b> en fin de tour :
          <ul className="list-disc list-inside text-sm mt-1 space-y-1">
            <li>Posez vos cartes <b>face cachee</b> devant vous</li>
            <li>Chaque tour suivant, <b>revelez</b> une de vos cartes</li>
            <li>Quand votre derniere carte est revelee → la manche est finie !</li>
          </ul>
          <p className="text-xs text-slate-500 mt-1">(A 2 joueurs : seuil a 2 cartes)</p>
        </S>

        <S title="Carte Mojo">
          Le joueur qui termine la manche recoit la <b>carte Mojo</b> :
          <ul className="list-disc list-inside text-sm mt-1 space-y-1">
            <li>Si son score est le plus bas ou egal : <span className="text-emerald-400 font-bold">0 points</span></li>
            <li>Sinon : score normal <span className="text-red-400 font-bold">+ 10 de penalite</span></li>
          </ul>
        </S>

        <S title="Decompte">
          Pour chaque couleur, gardez <b>seulement la carte la plus haute</b>, puis additionnez.
        </S>

        <S title="Variante : 2 defausses">
          Deux piles de defausse. A chaque tour, choisissez sur laquelle jouer. Pour piocher, vous pouvez prendre la carte du dessus de l'autre defausse.
        </S>

        <button onClick={onClose} className="w-full mt-4 py-2.5 rounded-xl font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-500 transition-colors">Compris !</button>
      </motion.div>
    </motion.div>
  )
}

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mb-4"><h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-1">{title}</h3><div className="text-slate-400 text-sm leading-relaxed">{children}</div></div>
}

function R({ color, label, detail }: { color: string; label: string; detail: string }) {
  return <><span className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded ${color} inline-block`} /><span className="text-slate-300">{label}</span></span><span className="text-slate-500 text-xs">{detail}</span></>
}
