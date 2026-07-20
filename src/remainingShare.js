// Not Bills-specific — used for person/group settlement shares too. Lives in domain/shared
// rather than domain/bills because it was the first function actually audited for extraction,
// not because it belongs to Bills conceptually. Moved out of the original calculations.js (which
// mixed it in with Bills' date functions) after that grouping was flagged as a "miscellaneous
// bucket" risk — same instinct the Function Extraction Checklist exists to catch before it
// compounds into another god-file, just one level down (a god-module instead of a god-App.jsx).

export const remainingShare = info => {
  if(!info) return 0;
  if(info.settled) return 0;
  return Math.max(0, Number(info?.remainingAmt ?? info?.amount ?? 0));
};
