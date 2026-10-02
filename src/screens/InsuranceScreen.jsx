// Insurance Policy — Manage entity (ADR-021). Deliberately separate screens from Premium/Bill,
// per the explicit decision this time (learned from the Biller/Bill mistake — combined screens
// that were supposed to be conceptually separate). Policy never creates Transactions (ADR-021
// core rule).
//
// WP2 (Arth IA §2/§12) — a NEW policy no longer creates a Bill for its premium. Insurance is a
// domain-specific record, exactly like Membership never becomes a Bill; its renewal now surfaces
// in Payments via domain/insurance/renewalReminders.js instead. A policy saved before WP2 that
// already has a linkedBillId keeps working exactly as before — that Bill, and its real payment
// history, is left alone (never migrated), and editing it still keeps the Bill's core figures in
// sync, same as always. Only NEW policies (no linkedBillId) take the no-Bill path.
//
// Payments v2 (WP18d) F2/F4/F5 — the policy detail screen now shows the renewal as a real Expected
// item (dashed, not payable, Decision #6) with its own "Add renewal notice" action (F4): the ONLY
// sanctioned way that Expected renewal becomes a real Bill. Saving the notice sets linkedBillId,
// which is exactly what makes this screen's "Open bill" card (F5) replace the Expected block —
// one write, read by the same linkedBillId branch this screen already had for pre-WP2 policies.
// See domain/insurance/renewalNotice.js for the (pure, tested) conversion logic itself.
//
// Policy type is NOT hardcoded to a fixed enum — free text with suggestions, since policy types
// (Life/Health/Vehicle/Bike/Travel/Home/Business/Gadget/Pet/Other) will keep growing and a rigid
// dropdown would need code changes for every new type.

import React, { useState } from "react";
import { genId } from "../helpers/idGenerator";
import { todayStr } from "../helpers/dateHelpers";
import BottomSheet from "../components/BottomSheet";
import EmptyState from "../components/EmptyState";
import EntityCard from "../components/EntityCard";
import { getBillBadge } from "../domain/obligations/billBalance";
import { getBadgeText } from "../domain/bills/paymentsView";
import { getInsuranceRenewalReminders } from "../domain/insurance/renewalReminders";
import { DUE_SOON_DAYS } from "../domain/obligations/dueSoonWindow";
import { getPolicyYearRange, getPolicyYearLabel } from "../domain/insurance/policyYear";
import { buildRenewalNoticeBill, applyRenewalNoticeToPolicy, describeRenewalDifference } from "../domain/insurance/renewalNotice";

const POLICY_TYPE_SUGGESTIONS = ["Life","Health","Vehicle","Bike","Travel","Home","Business","Gadget","Pet"];

// `prefill` (name/policyType/vehicleId) seeds a NEW policy only — e.g. opened from a Vehicle
// profile's "Add insurance policy". Ignored whenever `existing` is set; editing an existing
// policy never has its fields silently overridden by a leftover prefill.
export const AddInsurancePolicyModal = ({ existing, prefill, onClose, T, inp, lbl, setInsurancePolicies, setBills, billers }) => {
  const isEdit = Boolean(existing);
  const seed = isEdit ? existing : (prefill || {});
  const [name, setName] = useState(seed?.name||"");
  const [policyType, setPolicyType] = useState(seed?.policyType||"");
  const [provider, setProvider] = useState(existing?.provider||"");
  const [policyNumber, setPolicyNumber] = useState(existing?.policyNumber||"");
  const [insuredPerson, setInsuredPerson] = useState(existing?.insuredPerson||"");
  const [nominee, setNominee] = useState(existing?.nominee||"");
  const [sumInsured, setSumInsured] = useState(existing?.sumInsured?String(existing.sumInsured):"");
  const [premiumAmount, setPremiumAmount] = useState(existing?.premiumAmount?String(existing.premiumAmount):"");
  const [premiumFrequency, setPremiumFrequency] = useState(existing?.premiumFrequency||"annual");
  const [renewalDate, setRenewalDate] = useState(existing?.renewalDate||todayStr());
  const [autopay, setAutopay] = useState(existing?.autopay||false);
  // F2 "Policy schedule · PDF" — the policy document itself (distinct from F4's renewal notice
  // document, which belongs to the Bill, not the policy).
  const [scheduleDoc, setScheduleDoc] = useState(existing?.scheduleDocBase64||null);

  const canSave = name.trim() && Number(premiumAmount)>0 && renewalDate;

  const save = () => {
    if(!canSave) return;
    const policyId = existing?.id||genId();
    const record = {
      id: policyId, name:name.trim(), policyType:policyType.trim()||"Other", provider:provider.trim(),
      policyNumber:policyNumber.trim(), insuredPerson:insuredPerson.trim(), nominee:nominee.trim(),
      sumInsured:parseFloat(sumInsured)||0, premiumAmount:parseFloat(premiumAmount)||0,
      premiumFrequency, renewalDate, autopay, status:"active",
      linkedBillId: existing?.linkedBillId||null,
      renewalNoticeAddedDate: existing?.renewalNoticeAddedDate||null,
      documentIds: existing?.documentIds||[],
      scheduleDocBase64: scheduleDoc||null,
      claims: existing?.claims||[],
      // Optional link back to the Vehicle it insures (Vehicle Experience brief). Preserves the
      // existing record's vehicleId edits never touch, and only a NEW policy's prefill sets it —
      // a policy is never silently vehicle-linked any other way.
      vehicleId: existing?.vehicleId ?? prefill?.vehicleId ?? null,
      createdAt: existing?.createdAt||Date.now(),
    };

    // WP2: a NEW policy no longer creates a Bill — its renewal surfaces in Payments via
    // domain/insurance/renewalReminders.js instead (record.linkedBillId stays null). A policy
    // saved before WP2, or one that's since had a renewal notice added (F4), keeps its existing
    // linked Bill working exactly as before (never migrated); editing it still keeps that Bill's
    // core figures in sync, same as always.
    if(isEdit && existing.linkedBillId){
      // Editing: keep the linked Bill's core figures in sync (amount/frequency/dueDate can drift
      // if only edited on one side) - never touches the Bill's paid/unpaid history.
      setBills(prev=>prev.map(b=>b.id===existing.linkedBillId
        ? { ...b, name:`${record.name} Renewal`, amount:record.premiumAmount, frequency:record.premiumFrequency }
        : b));
    }

    setInsurancePolicies(prev=>isEdit?prev.map(x=>x.id===existing.id?record:x):[record, ...prev]);
    onClose();
  };

  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="85vh" padding="20px 16px 48px" zIndex={340}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
        <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>{isEdit?"Edit":"Add"} Insurance Policy</div>
        <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        <div>
          <span style={lbl}>Policy Name *</span>
          <input style={{ ...inp,fontSize:15,fontWeight:700 }} placeholder="e.g. LIC Jeevan Anand" value={name} onChange={e=>setName(e.target.value)} autoFocus/>
        </div>
        <div>
          <span style={lbl}>Policy Type</span>
          <input style={inp} placeholder="e.g. Life, Health, Vehicle..." value={policyType} onChange={e=>setPolicyType(e.target.value)} list="policy-type-suggestions"/>
          <datalist id="policy-type-suggestions">
            {POLICY_TYPE_SUGGESTIONS.map(t=><option key={t} value={t}/>)}
          </datalist>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
          <div><span style={lbl}>Provider</span><input style={inp} placeholder="e.g. LIC" value={provider} onChange={e=>setProvider(e.target.value)}/></div>
          <div><span style={lbl}>Policy Number</span><input style={inp} value={policyNumber} onChange={e=>setPolicyNumber(e.target.value)}/></div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
          <div><span style={lbl}>Covers</span><input style={inp} placeholder="e.g. Me, Spouse, Vyom" value={insuredPerson} onChange={e=>setInsuredPerson(e.target.value)}/></div>
          <div><span style={lbl}>Nominee</span><input style={inp} value={nominee} onChange={e=>setNominee(e.target.value)}/></div>
        </div>
        <div>
          <span style={lbl}>Sum Insured</span>
          <input style={inp} type="number" placeholder="e.g. 10000000" value={sumInsured} onChange={e=>setSumInsured(e.target.value)}/>
        </div>
        <div>
          <span style={lbl}>Premium Amount *</span>
          <input style={inp} type="number" placeholder="e.g. 18000" value={premiumAmount} onChange={e=>setPremiumAmount(e.target.value)}/>
        </div>
        <div>
          <span style={lbl}>Premium Frequency</span>
          <div style={{ display:"flex",gap:6 }}>
            {["monthly","quarterly","halfyearly","annual"].map(f=>(
              <button key={f} onClick={()=>setPremiumFrequency(f)} style={{ flex:1,background:premiumFrequency===f?T.accent+"22":"none",border:`1px solid ${premiumFrequency===f?T.accent:T.border}`,borderRadius:10,padding:"7px 4px",cursor:"pointer",fontSize:10,fontWeight:700,color:premiumFrequency===f?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>
            ))}
          </div>
        </div>
        <div>
          <span style={lbl}>Next Renewal Date *</span>
          <input style={inp} type="date" value={renewalDate} onChange={e=>setRenewalDate(e.target.value)}/>
        </div>
        <div onClick={()=>setAutopay(v=>!v)} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer" }}>
          <span style={{ color:T.text,fontSize:13,fontWeight:700 }}>AutoPay Enabled</span>
          <div style={{ width:40,height:22,borderRadius:20,background:autopay?T.accent:T.border,position:"relative" }}>
            <div style={{ width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:autopay?20:2,transition:"left 0.15s" }}/>
          </div>
        </div>
        <div style={{ background:T.input,borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10 }}>
          <span>📄</span>
          <span style={{ color:T.sub,fontSize:13,fontWeight:700,flex:1 }}>Policy schedule (optional)</span>
          <label style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>
            {scheduleDoc?"Change":"Upload"}
            <input type="file" accept="image/*,application/pdf" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>setScheduleDoc(ev.target.result); r.readAsDataURL(f); }}/>
          </label>
          {scheduleDoc&&<button onClick={()=>setScheduleDoc(null)} style={{ background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:16 }}>✕</button>}
        </div>
        {!isEdit&&<div style={{ color:T.sub,fontSize:10 }}>The premium will appear in Payments → Insurance as an Expected renewal — no Bill is created until a renewal notice is added.</div>}
        <button onClick={save} disabled={!canSave} style={{ background:canSave?T.accent:T.border,border:"none",borderRadius:14,padding:"13px",cursor:canSave?"pointer":"not-allowed",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif",marginTop:4 }}>{isEdit?"Save Changes":"Add Policy"}</button>
      </div>
    </BottomSheet>
  );
};

export const InsurancePolicyListModal = ({ onClose, T, sym, fmt, insurancePolicies, setEditingPolicy, setShowAddPolicy, setViewingPolicy }) => (
  <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="85vh" padding="20px 16px 48px" zIndex={335}>
    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
      <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>Insurance</div>
      <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
    </div>
    <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:16 }}>
      {insurancePolicies.length===0&&<EmptyState icon="🛡️" title="No insurance policies yet" subtitle="Track premiums, renewals, and coverage in one place." T={T}/>}
      {insurancePolicies.map(p=>(
        <EntityCard
          key={p.id} icon="🛡️" T={T}
          title={p.name}
          subtitle={`${p.policyType} · ${sym}${fmt(p.premiumAmount)}/${p.premiumFrequency}`}
          trailing={<span style={{ color:T.sub,fontSize:10 }}>Renews {p.renewalDate}</span>}
          onClick={()=>setViewingPolicy(p)}
        />
      ))}
    </div>
    <button onClick={()=>{ setEditingPolicy(null); setShowAddPolicy(true); }} style={{ width:"100%",background:T.accent,border:"none",borderRadius:14,padding:"13px",cursor:"pointer",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif" }}>+ Add Insurance Policy</button>
  </BottomSheet>
);

// F4 — "Add renewal notice". Opened from F2's Expected renewal block. Prefilled from the Expected
// item itself (amount, due date, policy year) — Amount and Due date stay required, the document
// is optional. The difference from the expected amount is plain text, never styled as a warning
// (Decision #6 / F4's own spec text). Save converts the Expected item into a Bill — replaces it,
// never duplicates it (see domain/insurance/renewalNotice.js).
export const AddInsuranceRenewalNoticeModal = ({ policy, expected, onClose, T, inp, lbl, sym, fmt, setBills, setInsurancePolicies, onSaved }) => {
  const [amount, setAmount] = useState(expected?.amount ? String(expected.amount) : (policy.premiumAmount ? String(policy.premiumAmount) : ""));
  const [dueDate, setDueDate] = useState(policy.renewalDate || todayStr());
  const [document, setDocument] = useState(null);
  const policyYear = getPolicyYearRange(policy.renewalDate, policy.premiumFrequency);

  const canSave = Number(amount) > 0 && dueDate;
  const diff = describeRenewalDifference(expected?.amount ?? policy.premiumAmount, amount);

  const save = () => {
    if (!canSave) return;
    const bill = buildRenewalNoticeBill({ policy, amount: Number(amount), dueDate, documentBase64: document, today: todayStr(), id: genId() });
    setBills(prev => [bill, ...prev]);
    setInsurancePolicies(prev => prev.map(p => p.id === policy.id ? applyRenewalNoticeToPolicy(p, bill) : p));
    onSaved && onSaved(bill);
    onClose();
  };

  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="88vh" padding="20px 16px 48px" zIndex={350}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
        <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>Add renewal notice</div>
        <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
      </div>
      <div style={{ background:T.input,borderRadius:14,padding:14,marginBottom:16 }}>
        <div style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:0.5,marginBottom:4 }}>EXPECTED RENEWAL</div>
        <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{policy.renewalDate}</div>
        <div style={{ color:T.sub,fontSize:11,marginTop:2 }}>Renewal premium · from the policy schedule</div>
        <div style={{ color:T.text,fontSize:15,fontWeight:900,marginTop:4 }}>~{sym}{fmt(policy.premiumAmount)}</div>
      </div>
      <div style={{ color:T.sub,fontSize:11,marginBottom:14 }}>Saving becomes a real Bill — the Expected item above is replaced, not duplicated.</div>
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        <div>
          <span style={lbl}>Amount on notice *</span>
          <input style={inp} type="number" value={amount} onChange={e=>setAmount(e.target.value)} autoFocus/>
          {diff && <div style={{ color:T.sub,fontSize:11,marginTop:4 }}>{sym}{fmt(diff.amount)} {diff.direction} than expected</div>}
        </div>
        <div>
          <span style={lbl}>Due date *</span>
          <input style={inp} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/>
        </div>
        <div style={{ background:T.input,borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10 }}>
          <span>📎</span>
          <span style={{ color:T.sub,fontSize:13,fontWeight:700,flex:1 }}>Notice document (optional)</span>
          <label style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>
            {document?"Change":"Upload"}
            <input type="file" accept="image/*,application/pdf" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>setDocument(ev.target.result); r.readAsDataURL(f); }}/>
          </label>
          {document&&<button onClick={()=>setDocument(null)} style={{ background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:16 }}>✕</button>}
        </div>
        {policyYear && (
          <div style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",borderTop:`1px solid ${T.border}` }}>
            <span style={{ color:T.sub,fontSize:12 }}>Policy year</span>
            <span style={{ color:T.text,fontSize:12,fontWeight:700 }}>{policyYear.start} – {policyYear.end}</span>
          </div>
        )}
        <div style={{ display:"flex",justifyContent:"space-between",padding:"6px 0" }}>
          <span style={{ color:T.sub,fontSize:12 }}>Sum insured</span>
          <span style={{ color:T.text,fontSize:12,fontWeight:700 }}>{sym}{fmt(policy.sumInsured)}</span>
        </div>
        <button onClick={save} disabled={!canSave} style={{ background:canSave?T.accent:T.border,border:"none",borderRadius:14,padding:"13px",cursor:canSave?"pointer":"not-allowed",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif",marginTop:4 }}>Save as bill</button>
      </div>
    </BottomSheet>
  );
};

export const InsurancePolicyDetailModal = ({ policy, onClose, T, sym, fmt, formatShortDate, bills, contributions, txns, accounts, setEditingPolicy, setShowAddPolicy, setInsurancePolicies, askConfirm, onAddRenewalNotice, onRecordPayment, onOpenBill, justConverted, onDismissJustConverted }) => {
  // The CURRENT open-bill cycle, not necessarily the exact Bill F4 created: once that Bill is
  // paid, its own `recurring:true` regenerates the next cycle as a new Bill (the same pre-
  // existing mechanism a pre-WP2 linked policy already relied on) — but that regeneration never
  // rewrites policy.linkedBillId, so resolving strictly by id would keep showing last cycle's
  // paid Bill forever. Resolving by "latest due date among this policy's own Bills" instead means
  // the Open bill card always tracks the real current cycle, across any number of renewals, with
  // no change needed to the shared Bill-regeneration code. policy.linkedBillId itself still stays
  // the single source of truth for "has a notice ever been added" (what gates the Expected row).
  const policyBills = policy.linkedBillId ? (bills||[]).filter(b=>b.insurancePolicyId===policy.id) : [];
  const linkedBill = policyBills.length ? [...policyBills].sort((a,b2)=>String(b2.dueDate||"").localeCompare(String(a.dueDate||"")))[0] : null;
  const fmtDate = d => (formatShortDate ? (formatShortDate(d)||d) : d);
  const policyYear = getPolicyYearRange(policy.renewalDate, policy.premiumFrequency);
  // F2's own "Add renewal notice" is offered only while there's still a real Expected item to
  // convert — reuses getInsuranceRenewalReminders unmodified, the same read model Payments Home
  // already uses, so this can never offer the action on a policy that isn't actually Expected
  // (e.g. linkedBillId already set, or archived).
  const expected = linkedBill ? null : getInsuranceRenewalReminders({ insurancePolicies: [policy], today: todayStr(), forwardDays: 36500 })[0] || { amount: policy.premiumAmount, dueDate: policy.renewalDate, kind: "renewing", days: null };
  const badge = linkedBill ? getBillBadge(linkedBill, contributions||[]) : null;
  const badgeText = badge ? getBadgeText(badge, linkedBill) : null;
  // "Premiums paid" — every paid Bill this policy's renewal notice (or its own recurring
  // regeneration, once started) has ever produced. Never derived from the policy's own fields;
  // this is the Bill machinery's real payment history, same as any other Bill.
  const premiumsPaid = (bills||[]).filter(b=>b.insurancePolicyId===policy.id && b.status==="paid").sort((a,b2)=>String(b2.paidDate||"").localeCompare(String(a.paidDate||"")));
  const paidWithLabel = b => {
    const txn = (txns||[]).find(t=>String(t.id)===String(b.paidByTxnId));
    const acc = txn ? (accounts||[]).find(a=>String(a.id)===String(txn.accId)) : null;
    return acc?.name || "";
  };

  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="88vh" padding="20px 16px 48px" zIndex={345}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:16 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1 }}>
          <span style={{ fontSize:28,flexShrink:0 }}>🛡️</span>
          <div style={{ minWidth:0 }}>
            <div style={{ color:T.text,fontSize:15,fontWeight:900,wordBreak:"break-word" }}>{policy.name}</div>
            <div style={{ color:T.sub,fontSize:11 }}>{policy.policyType}{policy.provider?` · ${policy.provider}`:""}{policy.status==="archived"?" · Archived":""}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif",flexShrink:0 }}>x</button>
      </div>

      {/* F5 — one-time confirmation strip, shown once right after Add renewal notice is saved. */}
      {justConverted && (
        <div style={{ background:T.success+"18",border:`1px solid ${T.success}44`,borderRadius:12,padding:"10px 12px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8 }}>
          <span style={{ color:T.success,fontSize:12,fontWeight:700 }}>✅ Renewal notice saved · now a bill</span>
          <button onClick={onDismissJustConverted} style={{ background:"none",border:"none",color:T.success,cursor:"pointer",fontSize:14 }}>✕</button>
        </div>
      )}

      <div style={{ background:T.input,borderRadius:14,padding:14,marginBottom:14 }}>
        {[["Sum insured",policy.sumInsured?`${sym}${fmt(policy.sumInsured)}`:"—"],
          ["Covers",policy.insuredPerson||"—"],
          ["Policy year",policyYear?`${fmtDate(policyYear.start)} – ${fmtDate(policyYear.end)}`:"—"],
          ["Premium",`${sym}${fmt(policy.premiumAmount)} / ${policy.premiumFrequency}`],
          ["Nominee",policy.nominee||"—"],["AutoPay",policy.autopay?"Enabled":"Off"]].map(([k,v])=>(
          <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}` }}>
            <span style={{ color:T.sub,fontSize:12 }}>{k}</span><span style={{ color:T.text,fontSize:12,fontWeight:700 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* F2/F5 — Renewal: Expected (dashed, no Record payment) until a notice is added, then the
          Open bill card (solid, Record payment, follows the 14-day badge rule). These two states
          are mutually exclusive and driven by the same linkedBillId this screen has always used. */}
      {linkedBill ? (
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:14,marginBottom:14 }}>
          <div style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:0.5,marginBottom:6 }}>OPEN BILL</div>
          <div onClick={()=>onOpenBill&&onOpenBill(linkedBill)} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",cursor:onOpenBill?"pointer":"default",marginBottom:10 }}>
            <div>
              <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{linkedBill.name}</div>
              <div style={{ color:T.sub,fontSize:11,marginTop:2 }}>{policy.renewalNoticeAddedDate?`Notice added ${fmtDate(policy.renewalNoticeAddedDate)}`:""}{linkedBill.dueDate?` · Due ${fmtDate(linkedBill.dueDate)}`:""}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ color:T.text,fontSize:14,fontWeight:900 }}>{sym}{fmt(linkedBill.amount)}</div>
              {badgeText && <div style={{ color:badgeText.tone==="negative"?T.danger:badgeText.tone==="attention"?T.warn:badgeText.tone==="positive"?T.success:T.sub,fontSize:10,fontWeight:700,marginTop:2 }}>{badgeText.text}</div>}
            </div>
          </div>
          {badge && badge.kind!=="paid" && (
            <button onClick={()=>onRecordPayment&&onRecordPayment(linkedBill)} style={{ width:"100%",background:T.accent,border:"none",borderRadius:12,padding:"11px",cursor:"pointer",fontSize:13,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif" }}>Record payment</button>
          )}
        </div>
      ) : (
        <div style={{ background:T.card,border:`1px dashed ${T.border}`,borderRadius:14,padding:14,marginBottom:14,opacity:0.85 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
            <div style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:0.5 }}>RENEWAL · EXPECTED</div>
            <div style={{ background:T.border,borderRadius:20,padding:"2px 9px" }}><span style={{ color:T.sub,fontSize:9,fontWeight:700 }}>{expected.kind==="overdue"?"Overdue":"Coming up"}</span></div>
          </div>
          <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{fmtDate(policy.renewalDate)}</div>
          <div style={{ color:T.sub,fontSize:11,marginTop:2 }}>Renewal premium · from the policy schedule</div>
          <div style={{ color:T.sub,fontSize:14,fontWeight:800,marginTop:2 }}>~{sym}{fmt(policy.premiumAmount)}</div>
          <div style={{ color:T.sub,fontSize:10,marginTop:8 }}>The renewal can't be paid until the notice is added, which turns it into a real Bill with Record payment.</div>
          {policy.status!=="archived"&&(
            <button onClick={()=>onAddRenewalNotice&&onAddRenewalNotice(policy)} style={{ width:"100%",marginTop:10,background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:12,padding:"10px",cursor:"pointer",fontSize:12,fontWeight:800,color:T.accent,fontFamily:"Nunito,sans-serif" }}>+ Add renewal notice</button>
          )}
        </div>
      )}

      {/* F2 — Premiums paid history: real payments only, never the Expected estimate above. */}
      {premiumsPaid.length>0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ color:T.sub,fontSize:11,fontWeight:700,letterSpacing:0.5,marginBottom:8 }}>PREMIUMS PAID</div>
          {premiumsPaid.slice(0,5).map(b=>{
            const year = getPolicyYearRange(b.dueDate, policy.premiumFrequency);
            const paidWith = paidWithLabel(b);
            return (
              <div key={b.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}` }}>
                <div>
                  <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{year?getPolicyYearLabel(year):"Premium"}</div>
                  <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{fmtDate(b.paidDate)}{paidWith?` · ${paidWith}`:""}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{sym}{fmt(b.amount)}</div>
                  <div style={{ color:T.success,fontSize:10,fontWeight:700 }}>Paid</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* F2 — Policy schedule document and claims count. Claims has no management flow in this
          WP's scope (F1-F5 never specifies one) — shown as plain information only. */}
      <div style={{ marginBottom:14 }}>
        {policy.scheduleDocBase64 && (
          <div onClick={()=>window.open(policy.scheduleDocBase64,"_blank")} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`,cursor:"pointer" }}>
            <span style={{ color:T.text,fontSize:12,fontWeight:700 }}>📄 Policy schedule</span>
            <span style={{ color:T.sub,fontSize:11 }}>View ›</span>
          </div>
        )}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0" }}>
          <span style={{ color:T.text,fontSize:12,fontWeight:700 }}>Claims</span>
          <span style={{ color:T.sub,fontSize:11 }}>{(policy.claims||[]).length}</span>
        </div>
      </div>

      <div style={{ display:"flex",gap:8 }}>
        <button onClick={()=>{ setEditingPolicy(policy); setShowAddPolicy(true); onClose(); }} style={{ flex:1,background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:12,padding:"10px",cursor:"pointer",fontSize:12,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>✏️ Edit</button>
        <button onClick={()=>{
          askConfirm(`Archive ${policy.name}? It stays visible in history, just marked inactive.`, ()=>{
            setInsurancePolicies(prev=>prev.map(x=>x.id===policy.id?{...x,status:"archived"}:x));
            onClose();
          });
        }} style={{ flex:1,background:"none",border:`1px solid ${T.warn}44`,borderRadius:12,padding:"10px",cursor:"pointer",fontSize:12,fontWeight:700,color:T.warn,fontFamily:"Nunito,sans-serif" }}>🗄 Archive</button>
      </div>
    </BottomSheet>
  );
};
