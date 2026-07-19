// Goals — extracted per the Extraction Readiness Score (all three pieces
// scored under 10 external dependencies, verified mechanically). Each
// component takes only the props it actually uses, per the extraction
// checklist ("imports only what it needs") — AddContributionModal doesn't
// receive GOAL_ICONS or accounts, for example, since it never touches them.

import React, { useState } from "react";
import { GOAL_ICONS } from "../constants/appConstants";
import { genId } from "../helpers/idGenerator";

export const AddGoalModal = ({ existing, onClose, T, inp, lbl, accounts, setGoals }) => {
  const isEdit = Boolean(existing);
  const [name, setName] = useState(existing?.name||"");
  const [icon, setIcon] = useState(existing?.icon||"🎯");
  const [targetAmount, setTargetAmount] = useState(existing?.targetAmount?String(existing.targetAmount):"");
  const [currentAmount, setCurrentAmount] = useState(existing?.currentAmount?String(existing.currentAmount):"");
  const [targetDate, setTargetDate] = useState(existing?.targetDate||"");
  const [linkedAccountId, setLinkedAccountId] = useState(existing?.linkedAccountId||"");
  const canSave = name.trim() && parseFloat(targetAmount)>0;
  const handleSave = () => {
    if(!canSave) return;
    const record = {
      id: existing?.id||genId(), name:name.trim(), icon, targetAmount:parseFloat(targetAmount)||0,
      currentAmount: linkedAccountId ? 0 : (parseFloat(currentAmount)||0), // auto-tracked goals derive progress live from the account, not a stored number
      targetDate:targetDate||null, linkedAccountId:linkedAccountId||null,
      status: existing?.status||"active", createdAt: existing?.createdAt||Date.now(),
    };
    setGoals(prev=>isEdit?prev.map(x=>x.id===existing.id?record:x):[record,...prev]);
    onClose();
  };
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:340,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
      <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 16px 48px",width:"100%",maxWidth:430,maxHeight:"85vh",overflowY:"auto" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>{isEdit?"Edit":"New"} Goal</div>
          <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          <div>
            <span style={lbl}>Icon</span>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {GOAL_ICONS.map(ic=><button key={ic} onClick={()=>setIcon(ic)} style={{ background:icon===ic?T.accent+"22":T.input,border:`1px solid ${icon===ic?T.accent:T.border}`,borderRadius:10,padding:"7px 10px",cursor:"pointer",fontSize:18 }}>{ic}</button>)}
            </div>
          </div>
          <div>
            <span style={lbl}>Name *</span>
            <input style={{ ...inp,fontSize:15,fontWeight:700 }} placeholder="e.g. House Down Payment" value={name} onChange={e=>setName(e.target.value)} autoFocus/>
          </div>
          <div>
            <span style={lbl}>Target Amount *</span>
            <input style={inp} type="number" placeholder="e.g. 2000000" value={targetAmount} onChange={e=>setTargetAmount(e.target.value)}/>
          </div>
          <div>
            <span style={lbl}>Target Date (optional)</span>
            <input style={inp} type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)}/>
          </div>
          <div>
            <span style={lbl}>Track progress from an account (optional)</span>
            <select style={inp} value={linkedAccountId} onChange={e=>setLinkedAccountId(e.target.value)}>
              <option value="">Manual — I'll log contributions myself</option>
              {accounts.filter(a=>a.type!=="cc").map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div style={{ color:T.sub,fontSize:10,marginTop:4 }}>{linkedAccountId?"Progress will always match this account's live balance.":"You'll add contributions manually as you save toward this."}</div>
          </div>
          {!linkedAccountId&&(
            <div>
              <span style={lbl}>Already saved (optional)</span>
              <input style={inp} type="number" placeholder="0" value={currentAmount} onChange={e=>setCurrentAmount(e.target.value)}/>
            </div>
          )}
          <button onClick={handleSave} disabled={!canSave} style={{ background:canSave?T.accent:T.border,border:"none",borderRadius:14,padding:"13px",cursor:canSave?"pointer":"not-allowed",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif",marginTop:4 }}>{isEdit?"Save Changes":"Create Goal"}</button>
        </div>
      </div>
    </div>
  );
};

export const AddContributionModal = ({ goal, onClose, T, inp, btnP, sym, setGoals }) => {
  const [amount, setAmount] = useState("");
  const save = () => {
    const amt = parseFloat(amount)||0;
    if(amt<=0) return;
    setGoals(prev=>prev.map(x=>x.id===goal.id?{...x,currentAmount:Number(x.currentAmount||0)+amt}:x));
    onClose();
  };
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:345,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
      <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 16px 40px",width:"100%",maxWidth:430 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ color:T.text,fontSize:15,fontWeight:900 }}>Add to {goal.icon} {goal.name}</div>
          <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
        </div>
        <input autoFocus style={{ ...inp,fontSize:22,fontWeight:800,marginBottom:14 }} type="number" placeholder={`${sym}0`} value={amount} onChange={e=>setAmount(e.target.value)}/>
        <button onClick={save} disabled={!(parseFloat(amount)>0)} style={{ ...btnP,opacity:parseFloat(amount)>0?1:0.5 }}>Add Contribution</button>
      </div>
    </div>
  );
};

export const GoalsListModal = ({ onClose, T, sym, fmt, formatShortDate, goals, setGoals, getGoalProgress, setEditingGoal, setShowAddGoal, setShowAddContribution }) => {
  const activeGoals = goals.filter(g=>g.status!=="completed");
  const completedGoals = goals.filter(g=>g.status==="completed");
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:335,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
      <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 16px 48px",width:"100%",maxWidth:430,maxHeight:"85vh",overflowY:"auto" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>🎯 Goals</div>
          <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:16 }}>
          {activeGoals.length===0&&<div style={{ color:T.sub,fontSize:12,textAlign:"center",padding:"16px 0" }}>No goals yet. Give a rupee a purpose.</div>}
          {activeGoals.map(g=>{
            const { current, pct, complete } = getGoalProgress(g);
            return (
              <div key={g.id} style={{ background:T.input,borderRadius:14,padding:"12px 14px" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
                  <div onClick={()=>{ setEditingGoal(g); setShowAddGoal(true); }} style={{ cursor:"pointer" }}>
                    <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{g.icon} {g.name}</div>
                    <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{sym}{fmt(current)} of {sym}{fmt(g.targetAmount)}{g.targetDate?` · by ${formatShortDate(g.targetDate)||g.targetDate}`:""}{g.linkedAccountId?" · auto-tracked":""}</div>
                  </div>
                  <span style={{ color:complete?T.success:T.accent,fontSize:14,fontWeight:900 }}>{pct}%</span>
                </div>
                <div style={{ height:6,background:T.border,borderRadius:3,marginBottom:complete||g.linkedAccountId?0:8 }}>
                  <div style={{ height:"100%",width:`${pct}%`,background:complete?T.success:T.accent,borderRadius:3 }}/>
                </div>
                {complete&&<button onClick={()=>setGoals(prev=>prev.map(x=>x.id===g.id?{...x,status:"completed"}:x))} style={{ marginTop:8,background:T.success+"22",border:`1px solid ${T.success}44`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.success,fontFamily:"Nunito,sans-serif" }}>✓ Mark Complete</button>}
                {!complete&&!g.linkedAccountId&&<button onClick={()=>setShowAddContribution(g)} style={{ marginTop:8,background:"none",border:`1px solid ${T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>+ Add Contribution</button>}
              </div>
            );
          })}
        </div>
        {completedGoals.length>0&&(
          <div style={{ marginBottom:16 }}>
            <div style={{ color:T.sub,fontSize:11,fontWeight:700,letterSpacing:0.5,marginBottom:8 }}>COMPLETED</div>
            {completedGoals.map(g=>(
              <div key={g.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}` }}>
                <span style={{ color:T.text,fontSize:12,fontWeight:700 }}>{g.icon} {g.name}</span>
                <span style={{ color:T.success,fontSize:12,fontWeight:800 }}>✓ {sym}{fmt(g.targetAmount)}</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={()=>{ setEditingGoal(null); setShowAddGoal(true); }} style={{ width:"100%",background:T.accent,border:"none",borderRadius:14,padding:"13px",cursor:"pointer",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif" }}>+ New Goal</button>
      </div>
    </div>
  );
};
