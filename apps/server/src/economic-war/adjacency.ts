/**
 * Charge l'adjacence des provinces depuis game-provinces.json (généré par build_game_provinces.mjs).
 * Utilisé pour valider les ordres d'attaque et de déplacement côté serveur.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

type AdjacencyMap = Map<string, Set<string>>;
import type { TerrainType } from '@undercover/shared';
type ProvinceData = { name: string; terrain: TerrainType };
type ProvinceDataMap = Map<string, ProvinceData>;

let _adjacency: AdjacencyMap | null = null;
let _provinceData: ProvinceDataMap | null = null;

function resolveProvincesPath(): string {
  // En dev: apps/client/public/game-provinces.json (relatif à la racine du projet)
  const candidates = [
    join(process.cwd(), 'apps/client/public/game-provinces.json'),
    join(process.cwd(), '../client/public/game-provinces.json'),
    join(import.meta.dirname ?? '', '../../../../apps/client/public/game-provinces.json'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0]; // fallback
}

export function loadAdjacency(): AdjacencyMap {
  if (_adjacency) return _adjacency;

  const path = resolveProvincesPath();
  if (!existsSync(path)) {
    console.warn('[adjacency] game-provinces.json not found at', path, '— adjacency disabled');
    _adjacency = new Map();
    return _adjacency;
  }

  const data = JSON.parse(readFileSync(path, 'utf8')) as {
    features: Array<{ id: string; properties: { adjacentTo: string[]; name?: string; terrain?: string } }>;
  };

  const map: AdjacencyMap = new Map();
  const pdata: ProvinceDataMap = new Map();
  for (const f of data.features) {
    const id = f.id as string;
    if (!map.has(id)) map.set(id, new Set());
    for (const neighbor of (f.properties?.adjacentTo ?? [])) {
      map.get(id)!.add(neighbor);
      if (!map.has(neighbor)) map.set(neighbor, new Set());
      map.get(neighbor)!.add(id);
    }
    const rawTerrain = f.properties?.terrain ?? 'plains';
    const terrain = (['plains','mountain','urban','coast','forest'] as const).includes(rawTerrain as TerrainType)
      ? rawTerrain as TerrainType
      : 'plains';
    pdata.set(id, { name: f.properties?.name ?? id, terrain });
  }

  _adjacency = map;
  _provinceData = pdata;
  console.log(`[adjacency] Loaded ${map.size} provinces with adjacency data`);
  return _adjacency;
}

export function areAdjacent(regionA: string, regionB: string): boolean {
  const map = loadAdjacency();
  return map.get(regionA)?.has(regionB) ?? false;
}

export function getProvinceData(regionId: string): ProvinceData {
  loadAdjacency(); // ensures _provinceData is populated
  return _provinceData?.get(regionId) ?? { name: regionId, terrain: 'plains' as TerrainType };
}
