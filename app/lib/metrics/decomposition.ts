import type {
  QtyPriceInput,
  QtyPriceResult,
  TrafficPerCapitaPriceInput,
  TrafficPerCapitaPriceResult,
  TrafficTicketInput,
  TrafficTicketResult,
} from "./types.js";

/**
 * 客流 × 客单价两因素分解（连环替代法：先替换客流，再替换客单价）。
 *
 *   trafficEffect = (traffic1 - traffic0) × ticket0
 *   ticketEffect  = traffic1 × (ticket1 - ticket0)
 *
 * 两项之和恒等于两期收入差（traffic × ticket）。
 * 口径：docs/domain/revenue-analysis-model.md 3.1 节，替换顺序「先量后价」。
 */
export function chainTrafficTicket({
  traffic0,
  ticket0,
  traffic1,
  ticket1,
}: TrafficTicketInput): TrafficTicketResult {
  const trafficEffect = (traffic1 - traffic0) * ticket0;
  const ticketEffect = traffic1 * (ticket1 - ticket0);
  return { trafficEffect, ticketEffect, total: trafficEffect + ticketEffect };
}

/**
 * 销量 × 单价两因素分解（连环替代法：先替换销量，再替换单价）。
 *
 *   qtyEffect   = (qty1 - qty0) × price0
 *   priceEffect = qty1 × (price1 - price0)
 */
export function chainQtyPrice({
  qty0,
  price0,
  qty1,
  price1,
}: QtyPriceInput): QtyPriceResult {
  const qtyEffect = (qty1 - qty0) * price0;
  const priceEffect = qty1 * (price1 - price0);
  return { qtyEffect, priceEffect, total: qtyEffect + priceEffect };
}

/**
 * 客流 × 人均销量 × 单价三因素分解（连环替代法，替换顺序：客流 → 人均销量 → 单价）。
 *
 *   trafficEffect   = (traffic1 - traffic0) × perCapita0 × price0
 *   perCapitaEffect = traffic1 × (perCapita1 - perCapita0) × price0
 *   priceEffect     = traffic1 × perCapita1 × (price1 - price0)
 *
 * 三项之和恒等于两期收入差（traffic × perCapita × price）。
 */
export function chainTrafficPerCapitaPrice({
  traffic0,
  perCapita0,
  price0,
  traffic1,
  perCapita1,
  price1,
}: TrafficPerCapitaPriceInput): TrafficPerCapitaPriceResult {
  const trafficEffect = (traffic1 - traffic0) * perCapita0 * price0;
  const perCapitaEffect = traffic1 * (perCapita1 - perCapita0) * price0;
  const priceEffect = traffic1 * perCapita1 * (price1 - price0);
  return {
    trafficEffect,
    perCapitaEffect,
    priceEffect,
    total: trafficEffect + perCapitaEffect + priceEffect,
  };
}
