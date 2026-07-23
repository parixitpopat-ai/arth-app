// Expected Income — Phase 1 of the Financial Engine plan (ADR-017). Built as an extracted
// screen from the start, same pattern as Goals/Events, rather than adding new code directly to
// App.jsx's closure. Event-driven by design: "Mark Received" only knows how to create a
// Transaction and advance this entry's own next-due date - it has no knowledge of Cash Flow,
// Safe to Spend, or the Financial Engine. Those recompute naturally next time they're read,
// since calculateExpectedIncomeTotal (domain/financialEngine/engine.js) is a pure function over
// fresh state, not a cached value that needs explicit invalidation.
//
// Reuses computeNextDueDate (domain/bills/periodCalculations.js) for date-rolling rather than
// writing a second, parallel date-rolling function - same frequency set Bills already uses
// (monthly/quarterly/halfyearly/annual/custom), so this doesn't invent its own scheduling rules.

import React, { useState } from "react";
import { genId } from "../helpers/idGenerator";
import { todayStr } from "../helpers/dateHelpers";
import { computeNextDueDate } from "../domain/bills/periodCalculations";
import BottomSheet from "../components/BottomSheet";
import EmptyState from "../components/EmptyState";
import { calculateExpectedIncomeTotal } from "../domain/financialEngine/engine";

const FREQUENCIES = ["monthly", "quarterly", "annual"];

export const AddExpectedIncomeModal = ({ existing, onClose, T, inp, lbl, setExpectedIncome }) => {
  const isEdit = Boolean(existing);
  const [name, setName] = useState(existing?.name||"");
  const [amount, setAmount] = useState(existing?.amount?String(existing.amount):"");
  const [frequency, setFrequency] = useState(existing?.frequency||"monthly");
  const [nextDate, setNextDate] = useState(existing?.nextDate||todayStr());
  const canSave = name.trim() && parseFloat(amount)>0;
  const save = () => {
    if(!canSave) return;
    const record = {
      id: existing?.id||genId(), name:name.trim(), amount:parseFloat(amount)||0,
      frequency, nextDate, status:"active", lastReceivedDate: existing?.lastReceivedDate||null,
      createdAt: existing?.createdAt||Date.now(),
    };
    setExpectedIncome(prev=>isEdit?prev.map(x=>x.id===existing.id?record:x):[record, ...prev]);
    onClose();
  };
  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="85vh" padding="20px 16px 48px" zIndex={340}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
        <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>{isEdit?"Edit":"Add"} Expected Income</div>
        <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        <div>
          <span style={lbl}>Source *</span>
          <input style={{ ...inp,fontSize:15,fontWeight:700 }} placeholder="e.g. Salary, Rent, Interest" value={name} onChange={e=>setName(e.target.value)} autoFocus/>
        </div>
        <div>
          <span style={lbl}>Amount *</span>
          <input style={inp} type="number" placeholder="e.g. 95000" value={amount} onChange={e=>setAmount(e.target.value)}/>
        </div>
        <div>
          <span style={lbl}>Frequency</span>
          <div style={{ display:"flex",gap:6 }}>
            {FREQUENCIES.map(f=>(
              <button key={f} onClick={()=>setFrequency(f)} style={{ flex:1,background:frequency===f?T.accent+"22":"none",border:`1px solid ${frequency===f?T.accent:T.border}`,borderRadius:10,padding:"7px 4px",cursor:"pointer",fontSize:11,fontWeight:700,color:frequency===f?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>
            ))}
          </div>
        </div>
        <div>
          <span style={lbl}>Next Expected Date</span>
          <input style={inp} type="date" value={nextDate} onChange={e=>setNextDate(e.target.value)}/>
        </div>
        <button onClick={save} disabled={!canSave} style={{ background:canSave?T.accent:T.border,border:"none",borderRadius:14,padding:"13px",cursor:canSave?"pointer":"not-allowed",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif",marginTop:4 }}>{isEdit?"Save Changes":"Add Expected Income"}</button>
      </div>
    </BottomSheet>
  );
};

export const ExpectedIncomeListModal = ({ onClose, T, sym, fmt, formatShortDate, expectedIncome, setExpectedIncome, setTxns, accounts, setToast, setEditingExpectedIncome, setShowAddExpectedIncome }) => {
  const total = calculateExpectedIncomeTotal(expectedIncome, todayStr().slice(0,7));

  // Event-driven: this handler's only job is "an income was received." It creates a real
  // Transaction and advances this entry's own schedule via the SAME computeNextDueDate Bills
  // already uses - it does not touch Cash Flow, Safe to Spend, or any engine output directly.
  const markReceived = (inc) => {
    const record = {
      id: genId(), type:"income", amount:inc.amount, date:todayStr(),
      merchant:inc.name, desc:inc.name, catId:null, catIds:[], subId:null, subIds:[],
      accId: (accounts.find(a=>a.type==="bank")||accounts[0])?.id||"", people:{}, forPerson:"", groupId:null,
      splitMode:"none", trackingMode:"none", tagMode:null, note:"",
      createdAt:Date.now(), createdDate:todayStr(),
    };
    setTxns(prev=>[record, ...prev]);
    const rolled = computeNextDueDate({ frequency:inc.frequency, dueDate:inc.nextDate }, todayStr());
    setExpectedIncome(prev=>prev.map(x=>x.id===inc.id?{...x,nextDate:rolled,lastReceivedDate:todayStr()}:x));
    setToast?.({ message: `${sym}${fmt(inc.amount)} recorded from ${inc.name}` });
  };

  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="85vh" padding="20px 16px 48px" zIndex={335}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
        <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>Expected Income</div>
        <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
      </div>

      {/* First Financial Engine output rendered anywhere - the vertical slice: Add -> Stored ->
          Engine -> Card updates. */}
      <div style={{ background:T.accentSoft,borderRadius:16,padding:16,marginBottom:16,textAlign:"center" }}>
        <div style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:0.5 }}>EXPECTED THIS MONTH</div>
        <div style={{ color:T.accent,fontSize:26,fontWeight:900,marginTop:4 }}>{sym}{fmt(total)}</div>
      </div>

      <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:14 }}>
        {expectedIncome.length===0&&<EmptyState icon="💰" title="No expected income yet" subtitle="Add your salary, rent, or interest to see it reflected in Cash Flow." T={T}/>}
        {expectedIncome.slice().sort((a,b)=>(a.nextDate||"").localeCompare(b.nextDate||"")).map(inc=>(
          <div key={inc.id} style={{ background:T.input,borderRadius:14,padding:"12px 14px" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div onClick={()=>{ setEditingExpectedIncome(inc); setShowAddExpectedIncome(true); }} style={{ cursor:"pointer" }}>
                <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{inc.name}</div>
                <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{inc.frequency.charAt(0).toUpperCase()+inc.frequency.slice(1)} · next {formatShortDate(inc.nextDate)||inc.nextDate}</div>
              </div>
              <span style={{ color:T.success,fontSize:14,fontWeight:900 }}>{sym}{fmt(inc.amount)}</span>
            </div>
            <button onClick={()=>markReceived(inc)} style={{ marginTop:8,width:"100%",background:T.accentSoft,border:`1px solid ${T.accent}44`,borderRadius:10,padding:"7px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>✓ Mark Received</button>
          </div>
        ))}
      </div>

      <button onClick={()=>{ setEditingExpectedIncome(null); setShowAddExpectedIncome(true); }} style={{ width:"100%",background:T.accent,border:"none",borderRadius:14,padding:"13px",cursor:"pointer",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif" }}>+ Add Expected Income</button>
    </BottomSheet>
  );
};
