// Events — second screen extraction, following the same process as Goals: mechanical
// dependency trace first (all three pieces measured under 20 external dependencies, see
// DEPENDENCY_MAP.md), each component takes only the explicit props it uses.
//
// Per the standing Design System rule (ARCHITECTURE_DECISIONS.md ADR-009 / COMPONENT_INVENTORY.md):
// this is the first screen extraction built AFTER BottomSheet/EmptyState existed, so it uses them
// instead of hand-writing new copies — exactly the case the audit predicted would happen if a
// screen got extracted without the shared components existing first.

import React, { useState } from "react";
import { genId } from "../helpers/idGenerator";
import BottomSheet from "../components/BottomSheet";
import EmptyState from "../components/EmptyState";

export const AddEventModal = ({ existing, onClose, T, inp, lbl, people, setEvents, EVENT_TYPES }) => {
  const isEdit = Boolean(existing);
  const [name, setName] = useState(existing?.name||"");
  const [occasionType, setOccasionType] = useState(existing?.occasionType||"trip");
  const [date, setDate] = useState(existing?.date||new Date().toISOString().split("T")[0]);
  const [selectedPeople, setSelectedPeople] = useState(existing?.peopleIds||[]);
  const [budget, setBudget] = useState(existing?.budget?String(existing.budget):"");
  const canSave = name.trim();
  const handleSave = () => {
    if(!canSave) return;
    const record = { id: existing?.id||genId(), name:name.trim(), occasionType, date, peopleIds:selectedPeople, budget:parseFloat(budget)||0, createdAt:existing?.createdAt||Date.now() };
    setEvents(prev=>isEdit?prev.map(x=>x.id===existing.id?record:x):[record, ...prev]);
    onClose();
  };
  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="85vh" zIndex={340} padding="20px 16px 48px">
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
        <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>{isEdit?"Edit":"Add"} Trip / Outing</div>
        <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        <div>
          <span style={lbl}>Name *</span>
          <input style={{ ...inp,fontSize:15,fontWeight:700 }} placeholder="e.g. Day out to North Goa" value={name} onChange={e=>setName(e.target.value)} autoFocus/>
        </div>
        <div>
          <span style={lbl}>Occasion</span>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {EVENT_TYPES.map(et=>(
              <button key={et.id} onClick={()=>setOccasionType(et.id)} style={{ display:"flex",alignItems:"center",gap:5,background:occasionType===et.id?T.accent+"22":T.input,border:`1px solid ${occasionType===et.id?T.accent:T.border}`,borderRadius:20,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700,color:occasionType===et.id?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{et.icon} {et.label}</button>
            ))}
          </div>
        </div>
        <div>
          <span style={lbl}>Date</span>
          <input style={inp} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
        </div>
        <div>
          <span style={lbl}>Budget (optional)</span>
          <input style={inp} type="number" placeholder="e.g. 60000" value={budget} onChange={e=>setBudget(e.target.value)}/>
        </div>
        <div>
          <span style={lbl}>People (optional)</span>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {people.map(p=>{
              const isOn = selectedPeople.includes(p.id);
              return (
                <button key={p.id} onClick={()=>setSelectedPeople(prev=>isOn?prev.filter(id=>id!==p.id):[...prev,p.id])} style={{ background:isOn?p.color+"22":T.input,border:`1px solid ${isOn?p.color:T.border}`,borderRadius:20,padding:"5px 11px",cursor:"pointer",fontSize:11,fontWeight:700,color:isOn?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>
              );
            })}
          </div>
        </div>
        <button onClick={handleSave} disabled={!canSave} style={{ background:canSave?T.accent:T.border,border:"none",borderRadius:14,padding:"13px",cursor:canSave?"pointer":"not-allowed",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif",marginTop:4 }}>{isEdit?"Save Changes":"Add Trip/Outing"}</button>
      </div>
    </BottomSheet>
  );
};

export const EventDetailModal = ({ event, onClose, T, sym, fmt, txns, getMyExpenseAmount, getPerson, formatShortDate, askConfirm, setEvents, setEditingEvent, setShowAddEvent, setTxnDetailId, EVENT_TYPES }) => {
  const linkedTxns = txns.filter(t=>t.eventId===event.id);
  const total = linkedTxns.reduce((s,t)=>s+(t.type==="expense"?Number(t.amount||0):0),0);
  const myTotal = linkedTxns.reduce((s,t)=>s+(t.type==="expense"?getMyExpenseAmount(t):0),0);
  const et = EVENT_TYPES.find(x=>x.id===event.occasionType)||EVENT_TYPES[EVENT_TYPES.length-1];
  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="85vh" zIndex={340} padding="20px 16px 48px">
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
        <div>
          <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>{et.icon} {event.name}</div>
          <div style={{ color:T.sub,fontSize:11,marginTop:2 }}>{formatShortDate(event.date)||event.date}</div>
        </div>
        <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
      </div>
      {event.peopleIds?.length>0&&(
        <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:14 }}>
          {event.peopleIds.map(pid=>{ const p=getPerson(pid); return <span key={pid} style={{ background:T.input,borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:700,color:T.sub }}>{p.emoji} {p.name}</span>; })}
        </div>
      )}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16 }}>
        <div style={{ background:T.input,borderRadius:14,padding:"14px",textAlign:"center" }}>
          <div style={{ color:T.text,fontSize:20,fontWeight:900 }}>{sym}{fmt(total)}</div>
          <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>OVERALL</div>
        </div>
        <div style={{ background:T.accentSoft,borderRadius:14,padding:"14px",textAlign:"center" }}>
          <div style={{ color:T.accent,fontSize:20,fontWeight:900 }}>{sym}{fmt(myTotal)}</div>
          <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>MY SHARE</div>
        </div>
      </div>
      {event.budget>0&&(
        <div style={{ background:T.input,borderRadius:14,padding:"14px",marginBottom:14 }}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
            <span style={{ color:T.sub,fontSize:11 }}>{sym}{fmt(total)} of {sym}{fmt(event.budget)} budget</span>
            <span style={{ color:total>event.budget?T.danger:T.accent,fontSize:12,fontWeight:900 }}>{Math.round(total/event.budget*100)}%</span>
          </div>
          <div style={{ height:6,background:T.border,borderRadius:3 }}>
            <div style={{ height:"100%",width:`${Math.min(100,Math.round(total/event.budget*100))}%`,background:total>event.budget?T.danger:T.accent,borderRadius:3 }}/>
          </div>
          {total>event.budget&&<div style={{ color:T.danger,fontSize:10,fontWeight:700,marginTop:6 }}>⚠️ Over budget by {sym}{fmt(total-event.budget)}</div>}
        </div>
      )}
      <div style={{ color:T.sub,fontSize:10,textAlign:"center",marginBottom:14 }}>{linkedTxns.length} expense{linkedTxns.length!==1?"s":""} · amounts below show what actually happened, full card charges included</div>
      <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:14 }}>
        {linkedTxns.length===0&&<EmptyState icon="🧳" title="No expenses linked yet" subtitle="Tag an expense to this trip from the transaction form." T={T}/>}
        {linkedTxns.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).map(t=>(
          <div key={t.id} onClick={()=>setTxnDetailId(t.id)} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",background:T.input,borderRadius:12,padding:"10px 14px",cursor:"pointer" }}>
            <div>
              <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{t.merchant||t.who||t.desc||"Expense"}</div>
              <div style={{ color:T.sub,fontSize:10 }}>{formatShortDate(t.date)||t.date}</div>
            </div>
            <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{sym}{fmt(t.amount)}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
        <button onClick={()=>{ setEditingEvent(event); setShowAddEvent(true); onClose(); }} style={{ background:T.accentSoft,border:`1px solid ${T.accent}44`,borderRadius:14,padding:"12px",cursor:"pointer",fontSize:13,fontWeight:800,color:T.accent,fontFamily:"Nunito,sans-serif" }}>✏️ Edit</button>
        <button onClick={()=>askConfirm(`Delete "${event.name}"? Linked expenses stay in your transactions, only the trip grouping is removed.`,()=>{ setEvents(prev=>prev.filter(x=>x.id!==event.id)); onClose(); })} style={{ background:"none",border:`1px solid ${T.danger}44`,borderRadius:14,padding:"12px",cursor:"pointer",fontSize:13,fontWeight:700,color:T.danger,fontFamily:"Nunito,sans-serif" }}>🗑 Delete</button>
      </div>
    </BottomSheet>
  );
};

export const EventsListModal = ({ onClose, T, sym, fmt, events, txns, formatShortDate, setViewingEvent, setEditingEvent, setShowAddEvent, EVENT_TYPES }) => {
  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="85vh" zIndex={335} padding="20px 16px 48px">
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
        <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>Trips & Outings</div>
        <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:14 }}>
        {events.length===0&&<EmptyState icon="🧳" title="No trips or outings yet" T={T}/>}
        {events.sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(ev=>{
          const et = EVENT_TYPES.find(x=>x.id===ev.occasionType)||EVENT_TYPES[EVENT_TYPES.length-1];
          const total = txns.filter(t=>t.eventId===ev.id&&t.type==="expense").reduce((s,t)=>s+Number(t.amount||0),0);
          return (
            <div key={ev.id} onClick={()=>{ setViewingEvent(ev); onClose(); }} style={{ background:T.input,borderRadius:14,padding:"12px 14px",cursor:"pointer" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <div>
                  <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{et.icon} {ev.name}</div>
                  <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{formatShortDate(ev.date)||ev.date}</div>
                </div>
                <div style={{ color:T.accent,fontSize:13,fontWeight:800 }}>{sym}{fmt(total)}</div>
              </div>
              {ev.budget>0&&(
                <div style={{ marginTop:8 }}>
                  <div style={{ height:4,background:T.border,borderRadius:2 }}>
                    <div style={{ height:"100%",width:`${Math.min(100,Math.round(total/ev.budget*100))}%`,background:total>ev.budget?T.danger:T.accent,borderRadius:2 }}/>
                  </div>
                  <div style={{ color:T.sub,fontSize:9,marginTop:3 }}>{Math.round(total/ev.budget*100)}% of {sym}{fmt(ev.budget)}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button onClick={()=>{ setEditingEvent(null); setShowAddEvent(true); onClose(); }} style={{ width:"100%",background:T.accent,border:"none",borderRadius:14,padding:"13px",cursor:"pointer",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif" }}>+ Add Trip / Outing</button>
    </BottomSheet>
  );
};
