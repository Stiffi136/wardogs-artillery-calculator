import weaponData from "./weapons.json";

export interface Coordinates {
  x: number;
  y: number;
}
export interface ArtillerySolution {
  artillery: Coordinates;
  target: Coordinates;
  deltaX: number;
  deltaY: number;
  distanceUnits: number;
  distanceMeters: number;
  distanceKilometers: number;
  azimuthDegrees: number;
  weaponId: WeaponId;
  elevationSolutions: ElevationSolution[];
}
export const MAP_CONFIG = {
  metersPerCoordinateUnit: 100,
  maximumCoordinate: 10000,
} as const;
export type WeaponId = "mortar" | "spg";
export type ElevationSolution = { arc: "single" | "low" | "high"; mil: number };
type BallisticTable = readonly (readonly [number, number])[];
type WeaponData = {
  id: WeaponId;
  ballistics: {
    single?: BallisticTable;
    low?: BallisticTable;
    high?: BallisticTable;
  };
};
const WEAPONS = weaponData.weapons as unknown as WeaponData[];
export const WEAPON_IDS = WEAPONS.map(({ id }) => id) as WeaponId[];

function interpolateMil(
  table: BallisticTable,
  distanceMeters: number,
): number | null {
  const sortedTable = [...table].sort(
    ([leftDistance], [rightDistance]) => leftDistance - rightDistance,
  );
  if (
    distanceMeters < sortedTable[0][0] ||
    distanceMeters > sortedTable[sortedTable.length - 1][0]
  )
    return null;
  for (let index = 0; index < sortedTable.length - 1; index += 1) {
    const [leftDistance, leftMil] = sortedTable[index],
      [rightDistance, rightMil] = sortedTable[index + 1];
    if (distanceMeters <= rightDistance)
      return Math.floor(
        leftMil +
          ((distanceMeters - leftDistance) / (rightDistance - leftDistance)) *
            (rightMil - leftMil),
      );
  }
  return sortedTable[sortedTable.length - 1][1];
}

function calculateElevationSolutions(
  weaponId: WeaponId,
  distanceMeters: number,
): ElevationSolution[] {
  const weapon = WEAPONS.find(({ id }) => id === weaponId);
  if (!weapon) return [];
  return (
    [
      ["single", weapon.ballistics.single],
      ["low", weapon.ballistics.low],
      ["high", weapon.ballistics.high],
    ] as const
  ).flatMap(([arc, table]) => {
    const mil = table ? interpolateMil(table, distanceMeters) : null;
    return mil === null ? [] : [{ arc, mil }];
  });
}

export function validateCoordinates(value: Coordinates): string | null {
  for (const [axis, coordinate] of Object.entries(value)) {
    if (
      !Number.isFinite(coordinate) ||
      coordinate < 0 ||
      coordinate > MAP_CONFIG.maximumCoordinate
    )
      return `${axis.toUpperCase()} muss zwischen 0 und ${MAP_CONFIG.maximumCoordinate} liegen.`;
  }
  return null;
}
export function calculateArtillery(
  artillery: Coordinates,
  target: Coordinates,
  weaponId: WeaponId = "mortar",
): ArtillerySolution {
  const artilleryError = validateCoordinates(artillery),
    targetError = validateCoordinates(target);
  if (artilleryError || targetError)
    throw new Error(artilleryError ?? targetError ?? "Ungültige Koordinaten.");
  const deltaX = target.x - artillery.x,
    deltaY = target.y - artillery.y,
    distanceUnits = Math.hypot(deltaX, deltaY),
    azimuthDegrees =
      distanceUnits === 0
        ? 0
        : ((Math.atan2(deltaX, deltaY) * 180) / Math.PI + 360) % 360,
    distanceMeters = distanceUnits * MAP_CONFIG.metersPerCoordinateUnit;
  return {
    artillery,
    target,
    deltaX,
    deltaY,
    distanceUnits,
    distanceMeters,
    distanceKilometers: distanceMeters / 1000,
    azimuthDegrees,
    weaponId,
    elevationSolutions: calculateElevationSolutions(weaponId, distanceMeters),
  };
}
