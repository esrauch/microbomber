/**
 * Barrel export of all indexed GBC background tiles, blob terrain kits, landmark stamps,
 * and 6-colour sprites (`gbcPalette.ts`, `chr8.ts`, `gbcTiles.ts`, `gbcSprites.ts`).
 */
export {
  type BgTile,
  type BlobKit,
  type Chr8,
  type NeighbourMask,
  composeBg,
  resolveBlobTile,
} from './chr8';
export {
  BG_TILES as BG,
  type BgTileName,
  CRYPT_FLOOR_BLOB,
  PATH_BLOB,
  THICKET_BLOB,
  PIT_BLOB,
  STAMP_DEFS,
  type StampTilePlacement,
  WATER_BLOB,
} from './gbcTiles';
export { OBJ_SPRITES as OBJ, type ObjSprite, type ObjSpriteName } from './gbcSprites';
