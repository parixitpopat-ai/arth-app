// Insurance Policy — Manage entity (ADR-021). Deliberately separate screens from Premium/Bill,
// per the explicit decision this time (learned from the Biller/Bill mistake — combined screens
// that were supposed to be conceptually separate). Policy never creates Transactions (ADR-021
// core rule) — it only creates a Bill; the Bill's own existing payment flow handles Transactions.
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

const POLICY_TYPE_SUGGESTIONS = ["Life","Health","Vehicle","Bike","Travel","Home","Business","Gadget","Pet"];

export const AddInsurancePolicyModal = ({ existing, onClose, T, inp, lbl, setInsurancePolicies, setBills, billers }) => {
  const isEdit = Boolean(existing);
  const [name, setName] = useState(existing?.name||"");
  const [policyType, setPolicyType] = useState(existing?.policyType||"");
  const [provider, setProvider] = useState(existing?.provider||"");
  const [policyNumber, setPolicyNumber] = useState(existing?.policyNumber||"");
  const [insuredPerson, setInsuredPerson] = useState(existing?.insuredPerson||"");
  const [nominee, setNominee] = useState(existing?.nominee||"");
  const [sumInsured, setSumInsured] = useState(existing?.sumInsured?String(existing.sumInsured):"");
  const [premiumAmount, setPremiumAmount] = useState(existing?.premiumAmount?String(existing.premiumAmount):"");
  const [premiumFrequency, setPremiumFrequency] = useState(existing?.premiumFrequency||"annual");
  const [renewalDate, setRenewalDate] = useState(existing?.renewalDate||todayStr());
  const [autopay, setAutopay] = useState(existing?.autopay||false);

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
      documentIds: existing?.documentIds||[],
      createdAt: existing?.createdAt||Date.now(),
    };

    // Policy never creates Transactions (ADR-021) — only ever creates/updates its own linked Bill.
    // The Bill's existing payment flow (isBillPayment/paidBillId) handles Transactions from there,
    // exactly like every other Bill type — no insurance-specific payment logic.
    if(!isEdit){
      const billId = genId();
      record.linkedBillId = billId;
      setBills(prev=>[{
        id: billId, name: `${record.name} Premium`, merchant: record.provider||record.name,
        amount: record.premiumAmount, dueDate: record.renewalDate, status:"unpaid",
        recurring: true, frequency: record.premiumFrequency,
        type: "insurance_premium", linkedPolicyId: policyId,
        catId: null, catIds: [], subId: null, subIds: [],
        createdDate: todayStr(), createdAt: Date.now(),
      }, ...prev]);
    } else if(existing.linkedBillId){
      // Editing: keep the linked Bill's core figures in sync (amount/frequency/dueDate can drift
      // if only edited on one side) - never touches the Bill's paid/unpaid history.
      setBills(prev=>prev.map(b=>b.id===existing.linkedBillId
        ? { ...b, name:`${record.name} Premium`, amount:record.premiumAmount, frequency:record.premiumFrequency }
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
          <div><span style={lbl}>Insured Person</span><input style={inp} value={insuredPerson} onChange={e=>setInsuredPerson(e.target.value)}/></div>
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
        {!isEdit&&<div style={{ color:T.sub,fontSize:10 }}>Saving will automatically create the Premium as a Bill in Outlook — you'll never need to create it separately.</div>}
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

export const InsurancePolicyDetailModal = ({ policy, onClose, T, sym, fmt, bills, setEditingPolicy, setShowAddPolicy, setInsurancePolicies, askConfirm }) => {
  const linkedBill = bills.find(b=>b.id===policy.linkedBillId);
  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="85vh" padding="20px 16px 48px" zIndex={345}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:16 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1 }}>
          <span style={{ fontSize:28,flexShrink:0 }}>🛡️</span>
          <div style={{ minWidth:0 }}>
            <div style={{ color:T.text,fontSize:15,fontWeight:900,wordBreak:"break-word" }}>{policy.name}</div>
            <div style={{ color:T.sub,fontSize:11 }}>{policy.provider}{policy.status==="archived"?" · Archived":""}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif",flexShrink:0 }}>x</button>
      </div>
      <div style={{ background:T.input,borderRadius:14,padding:14,marginBottom:14 }}>
        {[["Policy Number",policy.policyNumber||"—"],["Coverage",policy.sumInsured?`${sym}${fmt(policy.sumInsured)}`:"—"],
          ["Premium",`${sym}${fmt(policy.premiumAmount)} / ${policy.premiumFrequency}`],["Next Renewal",policy.renewalDate],
          ["Nominee",policy.nominee||"—"],["AutoPay",policy.autopay?"Enabled":"Off"]].map(([k,v])=>(
          <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}` }}>
            <span style={{ color:T.sub,fontSize:12 }}>{k}</span><span style={{ color:T.text,fontSize:12,fontWeight:700 }}>{v}</span>
          </div>
        ))}
      </div>
      {linkedBill&&<div style={{ color:T.sub,fontSize:11,marginBottom:14 }}>Premium tracked in Outlook as a Bill — pay it there, this screen only manages the policy itself.</div>}
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
