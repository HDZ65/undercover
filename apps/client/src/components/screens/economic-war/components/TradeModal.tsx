import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { TradeOffer, TradeAuction, ResourceType, VehicleTradeItem, VehicleType, VehicleTier, PublicPlayerInfo, EcoWarPrivatePlayerState, Organization, RegionPurchaseOffer, MilitaryUnitTradeItem } from '@undercover/shared'

// ─── Calcul de la taxe effective (côté client) ─────────────────

const ORG_TRADE_TAX_MIN = 0.10

function computeEffectiveTax(
  sellerId: string,
  buyerId: string,
  organizations: Organization[],
): { taxRate: number; label: string } {
  const sameOrg = organizations.some(
    o => o.type === 'commercial' && o.memberIds.includes(sellerId) && o.memberIds.includes(buyerId),
  )
  if (sameOrg) return { taxRate: 0, label: '0% (membre org)' }

  for (const org of organizations) {
    if (org.type !== 'commercial') continue
    if (!org.memberIds.includes(sellerId)) continue
    const emb = org.activeEmbargos.find(e => e.targetId === buyerId)
    if (emb) return { taxRate: emb.rate, label: `${Math.round(emb.rate * 100)}% (embargo)` }
  }

  return { taxRate: ORG_TRADE_TAX_MIN, label: '10%' }
}

// ─── Resource metadata ────────────────────────────────────────

const RESOURCE_LABELS: Record<ResourceType, { label: string; icon: string; group: string }> = {
  oil:        { label: 'Pétrole',         icon: '🛢️', group: 'Énergie & minerais' },
  iron:       { label: 'Fer',             icon: '🔩', group: 'Énergie & minerais' },
  coal:       { label: 'Charbon',         icon: '🪨', group: 'Énergie & minerais' },
  rareEarths: { label: 'Terres rares',    icon: '✨', group: 'Énergie & minerais' },
  precious:   { label: 'M. précieux',     icon: '💛', group: 'Énergie & minerais' },
  uranium:    { label: 'Uranium',         icon: '☢️', group: 'Énergie & minerais' },
  water:      { label: 'Eau',             icon: '💧', group: 'Énergie & minerais' },
  cereals:    { label: 'Céréales',        icon: '🌾', group: 'Agriculture' },
  vegetables: { label: 'Légumes',         icon: '🥦', group: 'Agriculture' },
  sugarOils:  { label: 'Sucre/Oléag.',    icon: '🌻', group: 'Agriculture' },
  fodder:     { label: 'Fourrage',        icon: '🌿', group: 'Agriculture' },
  redMeat:    { label: 'Viande rouge',    icon: '🥩', group: 'Élevage & pêche' },
  whiteMeat:  { label: 'Viande blanche',  icon: '🍗', group: 'Élevage & pêche' },
  dairy:      { label: 'Lait & Œufs',    icon: '🥛', group: 'Élevage & pêche' },
  fish:       { label: 'Poisson',         icon: '🐟', group: 'Élevage & pêche' },
  steel:                { label: 'Acier',           icon: '⚙️', group: 'Biens manufacturés' },
  fuel:                 { label: 'Carburant',        icon: '⛽', group: 'Biens manufacturés' },
  electronicComponents: { label: 'Composants',       icon: '🔌', group: 'Biens manufacturés' },
  pharmaceuticals:      { label: 'Médicaments',      icon: '💊', group: 'Biens manufacturés' },
  processedFood:        { label: 'Alim. transf.',    icon: '🍞', group: 'Biens manufacturés' },
  fertilizer:           { label: 'Engrais',          icon: '🌱', group: 'Biens manufacturés' },
  phones:               { label: 'Téléphones',       icon: '📱', group: 'Biens manufacturés' },
  computers:            { label: 'Ordinateurs',      icon: '💻', group: 'Biens manufacturés' },
  munitions:            { label: 'Munitions',        icon: '🔴', group: 'Munitions' },
  obus:                 { label: 'Obus',             icon: '🟠', group: 'Munitions' },
  bombs:                { label: 'Bombes',           icon: '💣', group: 'Munitions' },
}

const RESOURCE_GROUPS: { label: string; keys: ResourceType[] }[] = [
  { label: 'Énergie & minerais', keys: ['oil', 'iron', 'coal', 'rareEarths', 'precious', 'uranium', 'water'] },
  { label: 'Agriculture',        keys: ['cereals', 'vegetables', 'sugarOils', 'fodder'] },
  { label: 'Élevage & pêche',    keys: ['redMeat', 'whiteMeat', 'dairy', 'fish'] },
  { label: 'Biens manufacturés', keys: ['steel', 'fuel', 'electronicComponents', 'pharmaceuticals', 'processedFood', 'fertilizer', 'phones', 'computers'] },
  { label: 'Munitions',          keys: ['munitions', 'obus', 'bombs'] },
]

// ─── Vehicle metadata ──────────────────────────────────────────

type VehicleLabel = { label: string; icon: string; capacity: number; cost: number }
const VEHICLE_LABELS: Record<VehicleType, Record<VehicleTier, VehicleLabel>> = {
  truck: {
    1: { label: 'Camion T1',  icon: '🚛', capacity: 100,  cost: 300 },
    2: { label: 'Camion T2',  icon: '🚛', capacity: 250,  cost: 700 },
    3: { label: 'Camion T3',  icon: '🚛', capacity: 500,  cost: 1500 },
  },
  ship: {
    1: { label: 'Bateau T1',  icon: '⚓', capacity: 500,  cost: 600 },
    2: { label: 'Bateau T2',  icon: '⚓', capacity: 1200, cost: 1400 },
    3: { label: 'Bateau T3',  icon: '⚓', capacity: 3000, cost: 3000 },
  },
  plane: {
    1: { label: 'Avion T1',   icon: '✈️', capacity: 300,  cost: 800 },
    2: { label: 'Avion T2',   icon: '✈️', capacity: 700,  cost: 1800 },
    3: { label: 'Avion T3',   icon: '✈️', capacity: 1500, cost: 3500 },
  },
}

const VEHICLE_GROUPS: { type: VehicleType; tier: VehicleTier }[] = [
  { type: 'truck', tier: 1 }, { type: 'truck', tier: 2 }, { type: 'truck', tier: 3 },
  { type: 'ship',  tier: 1 }, { type: 'ship',  tier: 2 }, { type: 'ship',  tier: 3 },
  { type: 'plane', tier: 1 }, { type: 'plane', tier: 2 }, { type: 'plane', tier: 3 },
]

// ─── Props ────────────────────────────────────────────────────

interface TradeModalProps {
  players: PublicPlayerInfo[]
  currentPlayerId: string | null
  incomingTrades: TradeOffer[]
  myPrivateState: EcoWarPrivatePlayerState | null
  organizations: Organization[]
  activeAuctions: TradeAuction[]
  onPropose: (
    targetId: string,
    offer: { resource: ResourceType; quantity: number }[],
    moneyAmount: number,
    vehicles?: VehicleTradeItem[],
    maintenanceParts?: { tier: 1 | 2 | 3 | 4; quantity: number }[],
    militaryUnits?: MilitaryUnitTradeItem[],
  ) => void
  onRespond: (tradeId: string, accepted: boolean) => void
  onBid: (auctionId: string) => void
  incomingRegionPurchases: RegionPurchaseOffer[]
  onRespondRegionPurchase: (offerId: string, accepted: boolean) => void
  onClose: () => void
}

// ─── Component ───────────────────────────────────────────────

export function TradeModal({
  players,
  currentPlayerId,
  incomingTrades,
  myPrivateState,
  organizations,
  activeAuctions,
  onPropose,
  onRespond,
  onBid,
  incomingRegionPurchases,
  onRespondRegionPurchase,
  onClose,
}: TradeModalProps) {
  const [tab, setTab] = useState<'incoming' | 'market' | 'propose'>('incoming')
  const [targetId, setTargetId] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [price, setPrice] = useState(100)
  // Article unique sélectionné : clé "res:oil" | "veh:truck-1" | "part:2"
  const [selectedKey, setSelectedKey] = useState<string>('res:oil')
  const [offerQty, setOfferQty] = useState(1)

  const otherPlayers = players.filter(p => p.id !== currentPlayerId && !p.abandoned)
  const privateIncoming = incomingTrades.filter(t => t.toId === currentPlayerId)
  const publicMarket = incomingTrades.filter(t => t.toId === '__public__' && t.fromId !== currentPlayerId)

  // Recalculate from vehicles array to avoid stale totalCapacity
  const fleetCapacity = (myPrivateState?.fleet?.vehicles ?? []).reduce((s, v) => s + (v.capacity ?? 0), 0)

  // ─── Helpers ──────────────────────────────────────────────────

  const MILITARY_UNIT_LABELS: Record<string, { label: string; icon: string }> = {
    'tanks-1': { label: 'Chars T1', icon: '🪖' },
    'tanks-2': { label: 'Chars T2', icon: '🪖' },
    'tanks-3': { label: 'Chars T3', icon: '🪖' },
    'planes-1': { label: 'Av. Guerre T1', icon: '🛩️' },
    'planes-2': { label: 'Av. Guerre T2', icon: '🛩️' },
    'planes-3': { label: 'Av. Guerre T3', icon: '🛩️' },
    'warships-1': { label: 'Bat. Guerre T1', icon: '⚓' },
    'warships-2': { label: 'Bat. Guerre T2', icon: '⚓' },
    'warships-3': { label: 'Bat. Guerre T3', icon: '⚓' },
  }

  const getStock = (key: string): number => {
    if (key.startsWith('res:')) return Math.floor(myPrivateState?.resources[key.slice(4) as ResourceType] ?? 0)
    if (key.startsWith('veh:')) {
      const [type, tier] = key.slice(4).split('-')
      return (myPrivateState?.fleet?.vehicles ?? []).filter(v => v.type === type && v.tier === Number(tier)).length
    }
    if (key.startsWith('part:')) {
      const tier = Number(key.slice(5))
      return (myPrivateState?.maintenanceParts ?? []).filter(p => p.tier === tier).reduce((s, p) => s + p.quantity, 0)
    }
    if (key.startsWith('mil:')) {
      const [unitType, tier] = key.slice(4).split('-') as [string, string]
      const units = myPrivateState?.military?.units as Record<string, number[]> | undefined
      return units?.[unitType]?.[Number(tier) - 1] ?? 0
    }
    return 0
  }

  const getItemInfo = (key: string): { label: string; icon: string } => {
    if (key.startsWith('res:')) return RESOURCE_LABELS[key.slice(4) as ResourceType]
    if (key.startsWith('veh:')) {
      const [type, tier] = key.slice(4).split('-')
      const info = VEHICLE_LABELS[type as VehicleType]?.[Number(tier) as VehicleTier]
      return { label: info?.label ?? key, icon: info?.icon ?? '🚗' }
    }
    if (key.startsWith('mil:')) return MILITARY_UNIT_LABELS[key.slice(4)] ?? { label: key, icon: '⚔️' }
    return { label: `Pièces T${key.slice(5)}`, icon: '🔧' }
  }

  const selectedStock = getStock(selectedKey)
  // Military units and parts don't need fleet capacity
  const isMilitary = selectedKey.startsWith('mil:') || selectedKey.startsWith('part:') || selectedKey.startsWith('veh:')
  const maxQty = isMilitary ? selectedStock : (fleetCapacity > 0 ? Math.min(selectedStock, fleetCapacity) : 0)

  const blockReason: string | null = (() => {
    if (!isPublic && !targetId) return '❌ Sélectionnez un destinataire (ou activez "Marché public")'
    if (selectedStock === 0) return '❌ Stock vide — vous n\'avez pas cet article en stock'
    if (!isMilitary && fleetCapacity === 0) return '🚛 Flotte vide — construisez des camions pour transporter des ressources'
    if (offerQty <= 0) return '❌ Quantité invalide'
    return null
  })()

  const handleSelect = (key: string) => {
    setSelectedKey(key)
    setOfferQty(prev => Math.max(1, Math.min(prev, getStock(key))))
  }

  const handlePropose = () => {
    if (!isPublic && !targetId) return
    if (offerQty <= 0 || maxQty === 0) return

    const key = selectedKey
    onPropose(
      isPublic ? '__public__' : targetId,
      key.startsWith('res:') ? [{ resource: key.slice(4) as ResourceType, quantity: offerQty }] : [],
      price,
      key.startsWith('veh:') ? (() => {
        const [type, tier] = key.slice(4).split('-')
        return [{ vehicleType: type as VehicleType, tier: Number(tier) as VehicleTier, quantity: offerQty }]
      })() : undefined,
      key.startsWith('part:') ? [{ tier: Number(key.slice(5)) as 1 | 2 | 3 | 4, quantity: offerQty }] : undefined,
      key.startsWith('mil:') ? (() => {
        const [unitType, tier] = key.slice(4).split('-')
        return [{ unitType: unitType as 'tanks' | 'planes' | 'warships', tier: Number(tier) as 1 | 2 | 3, quantity: offerQty }]
      })() : undefined,
    )
    setOfferQty(1)
    setTab('incoming')
  }

  const playerById = (id: string) => players.find(p => p.id === id)

  // ─── Trade card ───────────────────────────────────────────

  const TradeCard = ({ trade, showRespond }: { trade: TradeOffer; showRespond: boolean }) => {
    const from = playerById(trade.fromId)
    const buyerId = currentPlayerId ?? ''
    const { taxRate, label: taxLabel } = computeEffectiveTax(trade.fromId, buyerId, organizations)
    const taxAmount = Math.floor(trade.moneyAmount * taxRate)
    const totalPrice = trade.moneyAmount + taxAmount

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
            {trade.offer.map((o, i) => {
              const info = RESOURCE_LABELS[o.resource as ResourceType]
              return (
                <p key={i} className="text-emerald-600 dark:text-emerald-400">
                  {info?.icon} {o.quantity}× {info?.label ?? o.resource}
                </p>
              )
            })}
            {trade.vehicles?.map((v, i) => {
              const info = VEHICLE_LABELS[v.vehicleType]?.[v.tier as VehicleTier]
              return (
                <p key={`v${i}`} className="text-blue-600 dark:text-blue-400">
                  {info?.icon} {v.quantity}× {info?.label}
                </p>
              )
            })}
            {trade.maintenanceParts?.map((p, i) => (
              <p key={`p${i}`} className="text-purple-600 dark:text-purple-400">
                🔧 {p.quantity}× Pièces T{p.tier}
              </p>
            ))}
            {trade.militaryUnits?.map((u, i) => {
              const info = MILITARY_UNIT_LABELS[`${u.unitType}-${u.tier}`]
              return (
                <p key={`m${i}`} className="text-red-600 dark:text-red-400">
                  {info?.icon ?? '⚔️'} {u.quantity}× {info?.label ?? `${u.unitType} T${u.tier}`}
                </p>
              )
            })}
          </div>
          <div className="flex-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2 flex flex-col items-center justify-center gap-0.5">
            <p className="font-bold text-amber-700 dark:text-amber-300 mb-0.5">Prix vendeur</p>
            <p className="text-base font-black text-amber-600 dark:text-amber-400">💰 {trade.moneyAmount} €</p>
            <div className="border-t border-amber-200 dark:border-amber-800/40 w-full my-0.5" />
            <p className="font-bold text-red-600 dark:text-red-400">Vous payez</p>
            <p className="text-base font-black text-red-600 dark:text-red-400">💸 {totalPrice} €</p>
            <p className="text-[9px] text-slate-500 dark:text-slate-400">taxe {taxLabel}</p>
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

  // ─── Auction countdown ───────────────────────────────────
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (activeAuctions.length === 0) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [activeAuctions.length])

  const AuctionCard = ({ auction }: { auction: TradeAuction }) => {
    const secondsLeft = Math.max(0, Math.floor((auction.expiresAt - now) / 1000))
    const isSeller    = currentPlayerId === auction.fromId
    const isWinner    = currentPlayerId === auction.currentWinnerId
    const { taxRate, label: taxLabel } = computeEffectiveTax(auction.fromId, currentPlayerId ?? '', organizations)
    const taxAmount  = Math.floor(auction.currentPrice * taxRate)
    const totalPrice = auction.currentPrice + taxAmount

    return (
      <div className="rounded-xl border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black text-amber-700 dark:text-amber-300">⚡ Enchère en cours</p>
          <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-full ${
            secondsLeft <= 10
              ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400'
              : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
          }`}>
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </span>
        </div>
        <div className="flex gap-2 text-xs">
          <div className="flex-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2">
            <p className="font-bold text-emerald-700 dark:text-emerald-300 mb-1">
              {auction.fromName} vend
            </p>
            {auction.offer.map((o, i) => {
              const info = RESOURCE_LABELS[o.resource as ResourceType]
              return (
                <p key={i} className="text-emerald-600 dark:text-emerald-400">
                  {info?.icon} {o.quantity}× {info?.label ?? o.resource}
                </p>
              )
            })}
            {auction.vehicles?.map((v, i) => {
              const info = VEHICLE_LABELS[v.vehicleType]?.[v.tier as VehicleTier]
              return (
                <p key={`v${i}`} className="text-blue-600 dark:text-blue-400">
                  {info?.icon} {v.quantity}× {info?.label}
                </p>
              )
            })}
            {(auction as TradeAuction & { maintenanceParts?: { tier: number; quantity: number }[] }).maintenanceParts?.map((p, i) => (
              <p key={`p${i}`} className="text-purple-600 dark:text-purple-400">
                🔧 {p.quantity}× Pièces T{p.tier}
              </p>
            ))}
            {(auction as TradeAuction & { militaryUnits?: MilitaryUnitTradeItem[] }).militaryUnits?.map((u, i) => {
              const info = MILITARY_UNIT_LABELS[`${u.unitType}-${u.tier}`]
              return (
                <p key={`m${i}`} className="text-red-600 dark:text-red-400">
                  {info?.icon ?? '⚔️'} {u.quantity}× {info?.label ?? `${u.unitType} T${u.tier}`}
                </p>
              )
            })}
          </div>
          <div className="flex-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2 flex flex-col items-center justify-center gap-0.5">
            <p className="font-bold text-amber-700 dark:text-amber-300">Meilleure offre</p>
            <p className="text-base font-black text-amber-600 dark:text-amber-400">💰 {auction.currentPrice} €</p>
            <p className="text-[9px] text-slate-500 dark:text-slate-400">
              par {auction.currentWinnerName}
            </p>
            {!isSeller && (
              <>
                <div className="border-t border-amber-200 dark:border-amber-800/40 w-full my-0.5" />
                <p className="text-[9px] text-slate-500 dark:text-slate-400">
                  Vous paieriez : {totalPrice} € (taxe {taxLabel})
                </p>
              </>
            )}
          </div>
        </div>
        {isSeller ? (
          <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 italic">
            🏷️ Votre offre est aux enchères — le meilleur enchérisseur gagne à la fin du chrono.
          </p>
        ) : isWinner ? (
          <p className="text-[10px] text-center font-bold text-emerald-600 dark:text-emerald-400">
            ✅ Vous êtes en tête ! Attendez la fin du chrono pour remporter l'échange.
          </p>
        ) : (
          <button
            onClick={() => onBid(auction.id)}
            className="w-full py-2 rounded-lg text-xs font-black text-white bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg active:scale-[0.98] transition-transform"
          >
            ⚡ Surenchérir — {auction.currentPrice + 15} €
          </button>
        )}
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────

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

        {/* Active auctions */}
        {activeAuctions.length > 0 && (
          <div className="px-4 pt-3 pb-1 space-y-2 border-b border-amber-200 dark:border-amber-800/40">
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              ⚡ Enchères actives ({activeAuctions.length})
            </p>
            {activeAuctions.map(auction => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {(['incoming', 'market', 'propose'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-bold transition-colors ${
                tab === t
                  ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t === 'incoming' && `Reçues${privateIncoming.length > 0 ? ` (${privateIncoming.length})` : ''}`}
              {t === 'market' && `Marché${publicMarket.length > 0 ? ` (${publicMarket.length})` : ''}`}
              {t === 'propose' && 'Proposer'}
            </button>
          ))}
        </div>

        <div className="p-4 max-h-[65vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {tab === 'incoming' && (
              <motion.div key="incoming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {/* Region purchase offers */}
                {incomingRegionPurchases.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">🏴 Offres d'achat de région</p>
                    {incomingRegionPurchases.map(offer => {
                      const buyer = players.find(p => p.id === offer.fromId)
                      return (
                        <div key={offer.id} className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 space-y-2">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {buyer ? `${buyer.countryFlag} ${buyer.name}` : 'Pays inconnu'} veut acheter
                          </p>
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            🗺️ <strong>{offer.regionName}</strong> pour <strong>{offer.price.toLocaleString('fr-FR')} €</strong>
                          </p>
                          <div className="flex gap-2">
                            <button type="button"
                              onClick={() => onRespondRegionPurchase(offer.id, true)}
                              className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors">
                              ✅ Accepter
                            </button>
                            <button type="button"
                              onClick={() => onRespondRegionPurchase(offer.id, false)}
                              className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors">
                              ❌ Refuser
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {/* Resource/vehicle trade offers */}
                {privateIncoming.length === 0 && incomingRegionPurchases.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
                    Aucune offre en attente.
                  </p>
                ) : privateIncoming.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase">📦 Offres commerciales</p>
                    {privateIncoming.map(trade => <TradeCard key={trade.id} trade={trade} showRespond={true} />)}
                  </div>
                )}
              </motion.div>
            )}

            {tab === 'market' && (
              <motion.div key="market" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Offres publiques visibles par tous — achetez aux meilleures conditions.
                </p>
                {publicMarket.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
                    Aucune offre sur le marché public.
                  </p>
                ) : (
                  publicMarket.map(trade => <TradeCard key={trade.id} trade={trade} showRespond={true} />)
                )}
              </motion.div>
            )}

            {tab === 'propose' && (
              <motion.div key="propose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

                {/* Public / private toggle */}
                <div className="flex gap-2">
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

                {/* Partner picker */}
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

                {/* ── Offre unifiée ── */}
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-3">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">Vous offrez</p>

                  {/* Ressources */}
                  {RESOURCE_GROUPS.map(group => (
                    <div key={group.label}>
                      <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{group.label}</p>
                      <div className="grid grid-cols-4 gap-1">
                        {group.keys.map(r => {
                          const key = `res:${r}`
                          const stock = getStock(key)
                          const info = RESOURCE_LABELS[r]
                          const selected = selectedKey === key
                          return (
                            <button
                              key={r}
                              onClick={() => handleSelect(key)}
                              className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-[9px] font-bold transition-all border ${
                                selected
                                  ? 'bg-emerald-500 text-white border-emerald-500 scale-[1.04]'
                                  : stock <= 0
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-40'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                              }`}
                            >
                              <span className="text-sm">{info.icon}</span>
                              <span className="text-center leading-tight">{info.label.split(' ')[0]}</span>
                              <span className={`font-mono text-[8px] ${selected ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'}`}>{stock}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Véhicules */}
                  {(() => {
                    const myVehicles = myPrivateState?.fleet?.vehicles ?? []
                    return (
                      <div>
                        <p className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">🚛 Véhicules</p>
                        <div className="grid grid-cols-3 gap-1">
                          {VEHICLE_GROUPS.map(({ type, tier }) => {
                            const key = `veh:${type}-${tier}`
                            const owned = myVehicles.filter(v => v.type === type && v.tier === tier).length
                            const info = VEHICLE_LABELS[type][tier]
                            const selected = selectedKey === key
                            return (
                              <button
                                key={key}
                                onClick={() => handleSelect(key)}
                                className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-[9px] font-bold transition-all border ${
                                  selected
                                    ? 'bg-blue-500 text-white border-blue-500 scale-[1.04]'
                                    : owned === 0
                                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-40'
                                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-blue-200 dark:border-blue-800/40 hover:border-blue-400'
                                }`}
                              >
                                <span className="text-sm">{info.icon}</span>
                                <span className="text-center leading-tight">{info.label}</span>
                                <span className={`font-mono text-[8px] ${selected ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>{owned}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Pièces d'entretien */}
                  {(() => {
                    const partsByTier: Record<number, number> = {}
                    for (const p of myPrivateState?.maintenanceParts ?? []) {
                      partsByTier[p.tier] = (partsByTier[p.tier] ?? 0) + p.quantity
                    }
                    return (
                      <div>
                        <p className="text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase mb-0.5">🔧 Pièces d'entretien</p>
                        <p className="text-[8px] text-purple-400 dark:text-purple-500 mb-1">Seuls les véhicules fabriqués par votre pays peuvent être entretenus avec ces pièces.</p>
                        <div className="grid grid-cols-4 gap-1">
                          {([1, 2, 3, 4] as const).map(tier => {
                            const owned = partsByTier[tier] ?? 0
                            const key = `part:${tier}`
                            const selected = selectedKey === key
                            return (
                              <button
                                key={tier}
                                onClick={() => handleSelect(key)}
                                className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-[9px] font-bold transition-all border ${
                                  selected
                                    ? 'bg-purple-500 text-white border-purple-500 scale-[1.04]'
                                    : owned === 0
                                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-40'
                                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-purple-200 dark:border-purple-800/40 hover:border-purple-400'
                                }`}
                              >
                                <span className="text-sm">🔧</span>
                                <span>T{tier}</span>
                                <span className={`font-mono text-[8px] ${selected ? 'text-purple-100' : 'text-slate-400 dark:text-slate-500'}`}>{owned}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Unités militaires */}
                  {(() => {
                    const milUnits = myPrivateState?.military?.units as Record<string, number[]> | undefined
                    const MIL_GROUPS: { key: string; unitType: 'tanks' | 'planes' | 'warships'; tier: 1 | 2 | 3 }[] = [
                      { key: 'mil:tanks-1', unitType: 'tanks', tier: 1 },
                      { key: 'mil:tanks-2', unitType: 'tanks', tier: 2 },
                      { key: 'mil:tanks-3', unitType: 'tanks', tier: 3 },
                      { key: 'mil:planes-1', unitType: 'planes', tier: 1 },
                      { key: 'mil:planes-2', unitType: 'planes', tier: 2 },
                      { key: 'mil:planes-3', unitType: 'planes', tier: 3 },
                      { key: 'mil:warships-1', unitType: 'warships', tier: 1 },
                      { key: 'mil:warships-2', unitType: 'warships', tier: 2 },
                      { key: 'mil:warships-3', unitType: 'warships', tier: 3 },
                    ]
                    return (
                      <div>
                        <p className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase mb-1">⚔️ Unités militaires</p>
                        <div className="grid grid-cols-3 gap-1">
                          {MIL_GROUPS.map(({ key, unitType, tier }) => {
                            const owned = milUnits?.[unitType]?.[tier - 1] ?? 0
                            const info = MILITARY_UNIT_LABELS[key.slice(4)]
                            const selected = selectedKey === key
                            return (
                              <button
                                key={key}
                                onClick={() => handleSelect(key)}
                                className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-[9px] font-bold transition-all border ${
                                  selected
                                    ? 'bg-red-500 text-white border-red-500 scale-[1.04]'
                                    : owned === 0
                                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-40'
                                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-red-200 dark:border-red-800/40 hover:border-red-400'
                                }`}
                              >
                                <span className="text-sm">{info?.icon ?? '⚔️'}</span>
                                <span className="text-center leading-tight">{info?.label ?? key}</span>
                                <span className={`font-mono text-[8px] ${selected ? 'text-red-100' : 'text-slate-400 dark:text-slate-500'}`}>{owned}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Slider quantité */}
                  {maxQty > 0 ? (
                    <div>
                      <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 mb-1">
                        <span>{getItemInfo(selectedKey).icon} {getItemInfo(selectedKey).label}</span>
                        <span className="font-mono font-bold">{offerQty} / {selectedStock}</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={maxQty}
                        step={1}
                        value={Math.min(offerQty, maxQty)}
                        onChange={e => setOfferQty(Number(e.target.value))}
                        className={`w-full ${
                          selectedKey.startsWith('veh:') ? 'accent-blue-500'
                          : selectedKey.startsWith('part:') ? 'accent-purple-500'
                          : 'accent-emerald-500'
                        }`}
                      />
                      {selectedStock > fleetCapacity && (
                        <p className="text-[8px] text-amber-600 dark:text-amber-400 mt-0.5">
                          🚛 Limité à {fleetCapacity} par la capacité de transport
                        </p>
                      )}
                    </div>
                  ) : selectedStock === 0 ? (
                    <p className="text-xs text-slate-400 text-center italic">Stock insuffisant.</p>
                  ) : (
                    <p className="text-xs text-red-500 dark:text-red-400 text-center italic">🚛 Flotte vide — construisez des véhicules pour pouvoir vendre.</p>
                  )}
                </div>

                {/* Prix */}
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase">Prix demandé (€)</p>
                  <input
                    type="range" min={10} max={5000} step={10} value={price}
                    onChange={e => setPrice(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                  <p className="text-xs text-amber-600 dark:text-amber-400 text-center font-bold">💰 {price} €</p>
                </div>

                {blockReason && (
                  <p className="text-xs text-red-500 dark:text-red-400 text-center font-semibold">{blockReason}</p>
                )}
                <button
                  onClick={handlePropose}
                  disabled={blockReason !== null}
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
