import { normalizeVendorText } from "./textHelpers";

export const investmentFreqLabel = freq => {
  if(freq==="daily") return "Daily";
  if(freq==="weekly") return "Weekly";
  if(freq==="monthly") return "Monthly";
  if(freq==="halfyearly") return "Half-yearly";
  if(freq==="quarterly") return "Quarterly";
  if(freq==="yearly") return "Yearly";
  if(freq==="one-time") return "One-time";
  return "";
};

export const getInvestmentBudgetMeta = type => {
  if(type==="mf") return { catId:"financial", subId:"fi1" };
  if(type==="stocks" || type==="crypto" || type==="gold") return { catId:"financial", subId:"fi2" };
  if(type==="ppf" || type==="fd" || type==="realestate") return { catId:"financial", subId:"fi3" };
  return { catId:"financial", subId:null };
};

export const getInvestmentMetricConfig = type => {
  if(type==="mf") return { show:true, label:"NAV", placeholder:"e.g. 23.45", hint:"Track the latest NAV per unit for this fund.", shortLabel:"NAV" };
  if(type==="stocks") return { show:true, label:"Units", placeholder:"e.g. 10", hint:"Track how many shares or units were bought.", shortLabel:"Units" };
  if(type==="gold") return { show:true, label:"Weight (grams)", placeholder:"e.g. 12.5", hint:"Track gold weight in grams.", shortLabel:"Gold" };
  if(type==="crypto") return { show:true, label:"Units", placeholder:"e.g. 0.015", hint:"Track the number of coins or tokens.", shortLabel:"Units" };
  if(type==="ppf") return { show:false, label:"", placeholder:"", hint:"PPF / NPS is tracked by contribution amount; no NAV is required. If you created a PPF account, record the money movement as a Transfer into that account.", shortLabel:"" };
  if(type==="fd") return { show:false, label:"", placeholder:"", hint:"FD is tracked by deposit value; no NAV is required.", shortLabel:"" };
  if(type==="realestate") return { show:false, label:"", placeholder:"", hint:"Real estate is tracked by current value; no NAV is required.", shortLabel:"" };
  return { show:false, label:"", placeholder:"", hint:"This holding is tracked by amount or current value.", shortLabel:"" };
};

export const getInvestmentGroupMeta = inv => {
  const type = String(inv?.type || "custom");
  const folioNo = String(inv?.folioNo || "").trim();
  const name = String(inv?.name || "Investment").trim() || "Investment";
  if(type === "mf" && folioNo) return { key:`${type}|folio|${folioNo.toLowerCase()}`, folioNo, primaryName:name };
  const normalizedName = normalizeVendorText(name);
  if(normalizedName) return { key:`${type}|name|${normalizedName}`, folioNo:"", primaryName:name };
  return { key:`${type}|single|${String(inv?.linkedInvestmentId || inv?.id || name)}`, folioNo:"", primaryName:name };
};

export const inferInvestmentTypeId = value => {
  const text = normalizeVendorText(value);
  if(!text) return "custom";
  if(/mutual fund|sip\b|mf\b/.test(text)) return "mf";
  if(/stocks?|share|equity|demat/.test(text)) return "stocks";
  if(/ppf|nps|pf\b|provident|retirement/.test(text)) return "ppf";
  if(/fd\b|fixed deposit|term deposit/.test(text)) return "fd";
  if(/gold|sovereign/.test(text)) return "gold";
  if(/crypto|bitcoin|btc|eth/.test(text)) return "crypto";
  if(/real estate|property|house|flat|plot/.test(text)) return "realestate";
  return "custom";
};
