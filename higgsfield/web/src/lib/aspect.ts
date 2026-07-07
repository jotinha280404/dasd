import type { AspectRatioValue } from "@dasd/higg-shared";

/** The aspect ratios offered in the composer, in display order. */
export const ASPECT_RATIOS: AspectRatioValue[] = ["16:9", "1:1", "9:16", "4:3", "3:4", "21:9"];

/** Turn an aspect ratio ("16:9") into a CSS `aspect-ratio` value ("16 / 9"). */
export function aspectToCss(ratio: AspectRatioValue): string {
  return ratio.replace(":", " / ");
}
