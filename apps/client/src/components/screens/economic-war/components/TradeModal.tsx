import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { TradeOffer, ProductCategory, PublicPlayerInfo } from '@undercover/shared'

const PRODUCT_LABELS: Record<ProductCategory, { label: string; icon: string }> = {
  rawAgricultural: { label: 'Matières agricoles', icon: '🌾' },
  energy: { label: 'Énergie', icon: '⚡' },
  minerals: { label: 'Minerais', icon: '⛏️' },
  manufactured: { label: 'Manufacturé', icon: '🏭' },
  electronics: { label: 'Électronique', icon: '💻' },
  industrialEquipment: { label: 'Équipement industriel', icon: '⚙️' },
  pharmaceutical: { label: 'Pharmaceutique', icon: '💊' },
  armament: { label: 'Armement', icon: '🔫' },
  luxury: { label: 'Luxe', icon: '💎' },
  financial: { label: 'Services financiers', icon: '💰' },
  infrastructure: { label: 'Infrastructure', icon: '🏗️' },
  processedFood: { label: 'Agroalimentaire', icon: '🍔' },
}

const PRODUCT_KEYS = Object.keys(PRODUCT_LABELS) as ProductCategory[]

interface TradeModalProps {
  players: PublicPlayerInfo[]
  currentPlayerId: string | null
  incomingTrades: TradeOffer[]
  onPropose: (
    targetId: string,
    offer: { product: ProductCategory; quantity: number }[],
    moneyAmount: number,
  ) => void
  onRespond: (tradeId: string, accepted: boolean) => void
  onClose: () => void
}

export function TradeModal({
  players,
  currentPlayerId,
  incomingTrades,
  onPropose,
  onRespond,
  onClose,
}: TradeModalProps) {
  const [tab, setTab] = useState<'incoming' | 'market' | 'propose'>('incoming')
  const [targetId, setTargetId] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [offerProduct, setOfferProduct] = useState<ProductCategory>('rawAgricultural')
  const [offerQty, setOfferQty] = useState(10)
  const [price, setPrice] = useState(100)

  const otherPlayers = players.filter(p => p.id !== currentPlayerId && !p.abandoned)

  // Split incoming: private (for me) vs public market
  const privateIncoming = incomingTrades.filter(t => t.toId === currentPlayerId)
  const publicMarket = incomingTrades.filter(t => t.toId === '__public__' && t.fromId !== currentPlayerId)

  const handlePropose = () => {
    if (!isPublic && !targetId) return
    onPropose(
      isPublic ? '__public__' : targetId,
      [{ product: offerProduct, quantity: offerQty }],
      price,
    )
    setTab('incoming')
  }

  const playerById = (id: string) => players.find(p => p.id === id)

  const TradeCard = ({ trade, showRespond }: { trade: TradeOffer; showRespond: boolean }) => {
    const from = playerById(trade.fromId)
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {from?.countryFlag} {from?.name || 'Inconnu'}
          </p>
          {trade.toId === '__public__' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
              Marché public
            </span>
          )}
        </div>
        <div className="flex gap-2 text-xs">
          <div className="flex-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2">
            <p className="font-bold text-emerald-700 dark:text-emerald-300 mb-1">Offre</p>
            {trade.offer.map((o, i) => (
              <p key={i} className="text-emerald-600 dark:text-emerald-400">
                {PRODUCT_LABELS[o.product]?.icon} {o.quantity}× {PRODUCT_LABELS[o.product]?.label}
              </p>
            ))}
          </div>
          <div className="flex-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2 flex flex-col items-center justify-center">
            <p className="font-bold text-amber-700 dark:text-amber-300 mb-1">Prix demandé</p>
            <p className="text-lg font-black text-amber-600 dark:text-amber-400">💰 {trade.moneyAmount} €</p>
          </div>
        </div>
        {showRespond && (
          <div className="flex gap-2">
            <button
              onClick={() => onRespond(trade.id, true)}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-500 active:scale-[0.98] transition-transform"
            >
              Accepter
            </button>
            <button
              onClick={() => onRespond(trade.id, false)}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 active:scale-[0.98] transition-transform"
            >
              Refuser
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md mx-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">📦 Commerce</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setTab('incoming')}
            className={`flex-1 py-2 text-xs font-bold transition-colors ${
              tab === 'incoming'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Reçues {privateIncoming.length > 0 && `(${privateIncoming.length})`}
          </button>
          <button
            onClick={() => setTab('market')}
            className={`flex-1 py-2 text-xs font-bold transition-colors ${
              tab === 'market'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Marché {publicMarket.length > 0 && `(${publicMarket.length})`}
          </button>
          <button
            onClick={() => setTab('propose')}
            className={`flex-1 py-2 text-xs font-bold transition-colors ${
              tab === 'propose'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Proposer
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {tab === 'incoming' ? (
              <motion.div key="incoming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {privateIncoming.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
                    Aucune offre commerciale privée en attente.
                  </p>
                ) : (
                  privateIncoming.map(trade => (
                    <TradeCard key={trade.id} trade={trade} showRespond={true} />
                  ))
                )}
              </motion.div>
            ) : tab === 'market' ? (
              <motion.div key="market" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Offres publiques visibles par tous — achetez aux meilleures conditions.
                </p>
                {publicMarket.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
                    Aucune offre sur le marché public.
                  </p>
                ) : (
                  publicMarket.map(trade => (
                    <TradeCard key={trade.id} trade={trade} showRespond={true} />
                  ))
                )}
              </motion.div>
            ) : (
              <motion.div key="propose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

                {/* Public / private toggle */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPublic(false)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                      !isPublic
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    🔒 Privée
                  </button>
                  <button
                    onClick={() => setIsPublic(true)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                      isPublic
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    📢 Marché public
                  </button>
                </div>

                {/* Target picker (private only) */}
                {!isPublic && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Partenaire</label>
                    <select
                      value={targetId}
                      onChange={e => setTargetId(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Choisir un pays...</option>
                      {otherPlayers.map(p => (
                        <option key={p.id} value={p.id}>{p.countryFlag} {p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {isPublic && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                    📢 Votre offre sera visible par tous les joueurs sur le marché public.
                  </p>
                )}

                {/* Offer */}
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-2">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">Vous offrez</p>
                  <select
                    value={offerProduct}
                    onChange={e => setOfferProduct(e.target.value as ProductCategory)}
                    className="w-full px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                  >
                    {PRODUCT_KEYS.map(k => (
                      <option key={k} value={k}>{PRODUCT_LABELS[k].icon} {PRODUCT_LABELS[k].label}</option>
                    ))}
                  </select>
                  <input
                    type="range" min={1} max={100} step={1} value={offerQty}
                    onChange={e => setOfferQty(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center font-bold">{offerQty} unités</p>
                </div>

                {/* Price */}
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase">Prix demandé (€)</p>
                  <input
                    type="range" min={10} max={5000} step={10} value={price}
                    onChange={e => setPrice(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                  <p className="text-xs text-amber-600 dark:text-amber-400 text-center font-bold">💰 {price} €</p>
                </div>

                <button
                  onClick={handlePropose}
                  disabled={!isPublic && !targetId}
                  className="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
                >
                  {isPublic ? '📢 Publier sur le marché' : 'Proposer l\'échange'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}
