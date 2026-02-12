import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createActor,
  type ActorRefFrom,
  type SnapshotFrom,
  type EventFromLogic,
} from 'xstate'
import { gameMachine } from '../machines/gameMachine'
import { useLocalStorage } from './useLocalStorage'

const STORAGE_KEY = 'undercover-game-state'

type GameActorRef = ActorRefFrom<typeof gameMachine>
type GameSnapshot = SnapshotFrom<typeof gameMachine>
type GameEvent = EventFromLogic<typeof gameMachine>

type UseGameActorReturn = [GameSnapshot, (event: GameEvent) => void, GameActorRef]

let sharedActorRef: GameActorRef | null = null
let hasPersistenceSubscription = false

const createActorFromStorage = (
  persistedSnapshot: unknown,
  onCorruptedSnapshot: () => void,
): GameActorRef => {
  if (persistedSnapshot === null || typeof persistedSnapshot !== 'object') {
    const actor = createActor(gameMachine)
    actor.start()
    return actor
  }

  try {
    const actor = createActor(gameMachine, {
      snapshot: persistedSnapshot as ReturnType<GameActorRef['getPersistedSnapshot']>,
    })

    actor.start()
    return actor
  } catch {
    onCorruptedSnapshot()
    const actor = createActor(gameMachine)
    actor.start()
    return actor
  }
}

export const useGameActor = (): UseGameActorReturn => {
  const [persistedSnapshot, setPersistenceSnapshot] = useLocalStorage<unknown>(STORAGE_KEY, null)

  const actorRef = useMemo(() => {
    if (sharedActorRef !== null) {
      return sharedActorRef
    }

    sharedActorRef = createActorFromStorage(persistedSnapshot, () => setPersistenceSnapshot(null))

    if (!hasPersistenceSubscription) {
      sharedActorRef.subscribe(() => {
        setPersistenceSnapshot(sharedActorRef?.getPersistedSnapshot())
      })
      hasPersistenceSubscription = true
    }

    return sharedActorRef
  }, [persistedSnapshot, setPersistenceSnapshot])

  const [snapshot, setSnapshot] = useState(() => actorRef.getSnapshot())

  useEffect(() => {
    const subscription = actorRef.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [actorRef])

  const send = useCallback(
    (event: GameEvent) => {
      actorRef.send(event)
    },
    [actorRef],
  )

  return [snapshot, send, actorRef]
}
