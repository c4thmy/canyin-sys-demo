export * from "./types.js";
export { resolvePeriodPair, amountFor, optionalAmountFor } from "./period.js";
export { aggregate } from "./aggregate.js";
export { splitSameNewStore } from "./same-store.js";
export {
  chainTrafficTicket,
  chainQtyPrice,
  chainTrafficPerCapitaPrice,
} from "./decomposition.js";
export { funnelRates, funnelSummary } from "./funnel.js";
export { topContributors } from "./contributors.js";
export { channelRoi, ROI_THRESHOLDS } from "./roi.js";
export { profitBridge } from "./profit-bridge.js";
export { storeStructure, regionStructure } from "./structure.js";
export {
  decomposeStoreTraffic,
  sameStoreRows,
  summarizeSameStore,
  timeSlotGroups,
  peerBenchmark,
} from "./traffic.js";
export { channelRevenue } from "./channel.js";
export { acquisitionHealth, ACQUISITION_THRESHOLDS } from "./acquisition.js";
export {
  categoryMix,
  bundleDecompose,
  bundleKindOf,
  bundleKindSummary,
  BUNDLE_LEADGEN_KEYWORDS,
} from "./product.js";
export { generateInsights, INSIGHT_THRESHOLDS } from "./insights.js";
export type {
  Action,
  ChannelHealthFact,
  ChannelHealthStatus,
  Insight,
  InsightCategory,
  InsightEvidence,
  InsightOrigin,
  InsightSeverity,
  InsightsFacts,
  InsightsInput,
  InsightsResult,
  LeadgenFact,
  ProfitDragFact,
} from "./insights.js";
