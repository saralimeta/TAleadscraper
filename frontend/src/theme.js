export const NAVY = "#15233A";
export const GOLD = "#C9A227";
export const GOLD_LIGHT = "#F4EED4";
export const SLATE = "#4A5568";
export const WHITE = "#FFFFFF";
export const SUCCESS = "#22543D";
export const SUCCESS_BG = "#F0FFF4";

export function priorityOf(reviews) {
  return reviews >= 100 ? "HIGH" : reviews >= 20 ? "MED" : "LOW";
}
