export enum SceneTargets {
  NONE = 0,
  BACKGROUND = 1 << 0,
  CHARACTER_1 = 1 << 1,
  CHARACTER_2 = 1 << 2,
  CHARACTER_3 = 1 << 3,
  CHARACTER_4 = 1 << 4,
  CHARACTER_5 = 1 << 5,
  ALL = ~(~0 << 6),
}
