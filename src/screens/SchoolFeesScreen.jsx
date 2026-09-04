// School Fees — Manage entity. Mirrors InsuranceScreen.jsx's conventions exactly: BottomSheet
// modals, T/inp/lbl style props, genId/todayStr from the same helper paths, setters passed down
// from App.jsx rather than owned locally.
//
// Every number on this screen comes from src/domain/schoolFees/service.js — this file contains
// NO obligation math, NO settlement math, NO annual-summary math of its own. It reads state,
// calls service functions, and writes back whatever they return. If a calculation looks wrong,
// the bug is in service.js (or the modules it composes), never in this file.
//
// Built from the corrected "Arth Obligations.html" interaction spec — that prototype's VISUAL
// and INTERACTION model is the reference (copy, layout, when the allocation step appears, when
// a period is locked, etc.). Its internal demo JS state (INITIAL_PERIODS, the toy `outstanding()`
// function, etc.) is NOT used here — this file's state is the real feeSchedules[]/feePeriods[]/
// schoolCreditNotes[] arrays passed down from App.jsx, and every transition goes through the
// real service.js functions, never a local re-implementation.

import React, { useState, useMemo } from "react";
import { genId } from "../helpers/idGenerator";
import { todayStr } from "../helpers/dateHelpers";
import BottomSheet from "../components/BottomSheet";
import EmptyState from "../components/EmptyState";
import EntityCard from "../components/EntityCard";
import * as schoolFeesService from "../domain/schoolFees/service";
import { calculateOutstanding } from "../domain/schoolFees/outstanding";
import { classifyPeriod } from "../domain/schoolFees/startingState";
import { calculateAnnualSummary } from "../domain/schoolFees/annualSummary";
import { isPersonArchived } from "../domain/person/archive";
import { resolveSchoolAttribution, attemptSchoolAttributionChange } from "./SchoolFeesScreen.helpers";
import { reconcileScheduleEdit } from "../domain/schoolFees/startingState";

const TEAL = "oklch(58% 0.14 195)";
const TEAL_TEXT = "oklch(38% 0.1 195)";
const GREEN = "oklch(58% 0.13 150)";
const GREEN_TEXT = "oklch(38% 0.11 150)";
const RED = "oklch(58% 0.16 25)";
const RED_TEXT = "oklch(45% 0.14 25)";
const AMBER = "oklch(62% 0.13 80)";
const AMBER_TEXT = "oklch(40% 0.09 80)";

const money = (sym, fmt, n) => `${sym}${fmt(n)}`;

// ============================================================================
// List — every School Fee schedule, entry point for adding a new school year
// ============================================================================

export const SchoolFeeScheduleListModal = ({ onClose, T, sym, fmt, feeSchedules, feePeriods, schoolCreditNotes, setShowAddSchedule, setViewingSchedule }) => {
  const readModel = useMemo(
    () => schoolFeesService.getSchoolFeeReadModel(feeSchedules, feePeriods, schoolCreditNotes),
    [feeSchedules, feePeriods, schoolCreditNotes]
  );
  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="85vh" padding="20px 16px 48px" zIndex={335}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
        <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>School Fees</div>
        <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:16 }}>
        {readModel.length===0 && <EmptyState icon="🎓" title="No school fee schedules yet" subtitle="Set up a school year to track periods, payments, and credits in one place." T={T}/>}
        {readModel.map(({ schedule, summary })=>(
          <EntityCard
            key={schedule.id} icon="🎓" T={T}
            title={schedule.schoolName || "School Fee Schedule"}
            subtitle={`${schedule.schoolYearStart?.slice(0,7)||"?"} – ${schedule.schoolYearEnd?.slice(0,7)||"?"} · ${sym}${fmt(summary.remainingObligation)} outstanding`}
            trailing={summary.availableCredit>0 ? <span style={{ color:TEAL_TEXT,fontSize:10,fontWeight:700 }}>{sym}{fmt(summary.availableCredit)} credit</span> : null}
            onClick={()=>setViewingSchedule(schedule)}
          />
        ))}
      </div>
      <button onClick={()=>setShowAddSchedule(true)} style={{ width:"100%",background:T.accent,border:"none",borderRadius:14,padding:"13px",cursor:"pointer",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif" }}>+ Add School Year</button>
    </BottomSheet>
  );
};

// ============================================================================
// Add School Year — creates the schedule + generates its periods in one step
// ============================================================================

export const AddSchoolYearModal = ({ onClose, T, inp, lbl, existing, feePeriods, feeSchedules, setFeeSchedules, setFeePeriods, people, billerAccounts, setBillerAccounts, schoolRelationships, setSchoolRelationships }) => {
  const isEdit = !!existing;
  // P1 — reconstruct "base rate + overrides" for prefill from the schedule's
  // flat rateRules array. The create flow always appends the base rule
  // LAST (extraRules first) — reversing that ordering is the only evidence
  // available for which entry was "the base," since rateRules itself makes
  // no such distinction once saved.
  const existingRules = existing?.rateRules || [];
  const [schoolName, setSchoolName] = useState(existing?.schoolName || "");
  const [schoolYearStart, setSchoolYearStart] = useState(existing?.schoolYearStart || "");
  const [schoolYearEnd, setSchoolYearEnd] = useState(existing?.schoolYearEnd || "");
  const [baseRate, setBaseRate] = useState(isEdit && existingRules.length ? String(existingRules[existingRules.length-1].monthlyRate) : "");
  // Optional rate-rule overrides beyond the base rate, e.g. a mid-year fee change.
  const [extraRules, setExtraRules] = useState(isEdit ? existingRules.slice(0, -1).map(r=>({ from:r.from, to:r.to, monthlyRate:String(r.monthlyRate) })) : []);
  const [error, setError] = useState("");
  // PPL-006 WP-4 — Person attribution, deliberately NOT required. "" means
  // "not linked to a saved person": the schedule still gets created exactly
  // as it always has (billerAccountId/personId both null) — the locked
  // invariant (financial attribution != saved Person) means this must stay
  // a fully legitimate, unpenalized choice, not a degraded fallback. This
  // mirrors AddMembershipModal's "For" picker, with one deliberate
  // difference: Membership always defaults to "__me__" (every membership
  // belongs to someone); School does not, because unlike a membership
  // payment, a School Fees schedule is routinely created before anyone has
  // decided whether to track a Person relationship for it at all.
  const [selectedPersonId, setSelectedPersonId] = useState(existing?.personId || "");

  // P1 — impact-summary confirmation, shown only when reconcileScheduleEdit
  // finds real impact (per your "never confirm a no-op" decision).
  const [pendingImpact, setPendingImpact] = useState(null);

  const addExtraRule = () => setExtraRules(prev=>[...prev, { from:"", to:"", monthlyRate:"" }]);
  const updateExtraRule = (idx, field, value) => setExtraRules(prev=>prev.map((r,i)=>i===idx?{...r,[field]:value}:r));
  const removeExtraRule = (idx) => setExtraRules(prev=>prev.filter((_,i)=>i!==idx));

  const canSave = schoolName.trim() && schoolYearStart && schoolYearEnd && Number(baseRate)>0;

  const buildRateRules = () => [
    // Base rate covers the whole range by default; extra rules layered on top
    // are placed AFTER the base rule so a real override (matching month) wins —
    // periodGeneration.js takes the FIRST matching rule, so overrides must come first.
    ...extraRules.filter(r=>r.from && r.to && Number(r.monthlyRate)>0).map(r=>({ from:r.from, to:r.to, monthlyRate:Number(r.monthlyRate) })),
    { from: schoolYearStart.slice(0,7), to: schoolYearEnd.slice(0,7), monthlyRate: Number(baseRate) },
  ];

  // P1 — Person attribution save, structurally separate from schedule
  // reconciliation, exactly as required: its own function call, its own
  // result, applied independently. Never merged into the reconciliation
  // path below, even though both are triggered by the same Save button.
  const savePersonAttribution = () => {
    const currentPersonId = existing.personId || null;
    const targetPersonId = selectedPersonId || null;
    if (currentPersonId === targetPersonId) return true; // no-op
    const result = attemptSchoolAttributionChange({
      billerAccountId: existing.billerAccountId, currentPersonId, targetPersonId,
      startDate: schoolYearStart, feeSchedules, schoolRelationships, genId,
    });
    if (!result.ok) { setError(result.error); return false; }
    if (existing.billerAccountId) {
      setBillerAccounts(prev=>prev.map(ba=>ba.id===existing.billerAccountId?{...ba, attributedTo: result.attributedTo||"", attributeType: result.attributedTo?"person":ba.attributeType}:ba));
    }
    if (result.endedRelationship) setSchoolRelationships(prev=>prev.map(r=>r.id===result.endedRelationship.id?result.endedRelationship:r));
    if (result.newOrReusedRelationship) setSchoolRelationships(prev=>[...prev, result.newOrReusedRelationship]);
    setFeeSchedules(prev=>prev.map(s=>s.id===existing.id?{...s, personId: result.attributedTo}:s));
    return true;
  };

  const applyScheduleReconciliation = (impact) => {
    const trimmedName = schoolName.trim();
    setFeeSchedules(prev=>prev.map(s=>s.id===existing.id?{...s, schoolName: trimmedName, schoolYearStart, schoolYearEnd, rateRules: buildRateRules()}:s));
    if (impact) {
      const removeIds = new Set(impact.periodsToRemove.map(p=>p.id));
      const updateMap = new Map(impact.periodsToUpdate.map(p=>[p.id, p]));
      setFeePeriods(prev => {
        const kept = prev
          .filter(p => p.scheduleId!==existing.id || !removeIds.has(p.id))
          .map(p => (p.scheduleId===existing.id && updateMap.has(p.id)) ? updateMap.get(p.id) : p);
        const added = impact.periodsToAdd.map(p => ({ ...p, scheduleId: existing.id }));
        return [...kept, ...added];
      });
    }
  };

  const save = () => {
    setError("");
    if(!canSave) return;
    const trimmedName = schoolName.trim();

    if (isEdit) {
      const scheduleChanged = schoolYearStart!==existing.schoolYearStart || schoolYearEnd!==existing.schoolYearEnd
        || JSON.stringify(buildRateRules())!==JSON.stringify(existing.rateRules||[]);
      try {
        if (scheduleChanged) {
          const schedulePeriods = (feePeriods||[]).filter(p=>p.scheduleId===existing.id);
          const impact = reconcileScheduleEdit({
            feePeriods: schedulePeriods, newSchoolYearStart: schoolYearStart, newSchoolYearEnd: schoolYearEnd,
            newRateRules: buildRateRules(), todayStr: todayStr(),
          });
          const hasRealImpact = impact.periodsToRemove.length>0 || impact.periodsToAdd.length>0
            || impact.periodsToUpdate.length>0 || impact.protectedOutOfRange.length>0;
          if (hasRealImpact) { setPendingImpact(impact); return; } // wait for explicit confirm — never a silent apply
          applyScheduleReconciliation(null);
        } else {
          // Name-only change, or truly nothing changed — no reconciliation needed.
          setFeeSchedules(prev=>prev.map(s=>s.id===existing.id?{...s, schoolName: trimmedName}:s));
        }
        if (!savePersonAttribution()) return; // error already set by the helper
        onClose();
      } catch(e) {
        setError(e.message || "Could not save these changes.");
      }
      return;
    }

    // --- Create (unchanged from WP-4) ---
    const rateRules = buildRateRules();

    // PPL-006 WP-4 — resolve the canonical School identity (billerAccounts.id)
    // via the extracted, tested helper. No person selected returns exactly
    // today's pre-WP-4 behaviour unchanged (both ids null, nothing created).
    const { billerAccountId: resolvedBillerAccountId, newBillerAccount, newRelationship } =
      resolveSchoolAttribution({
        personId: selectedPersonId || null,
        schoolName: trimmedName,
        startDate: schoolYearStart,
        billerAccounts,
        schoolRelationships,
        genId,
      });
    if (newBillerAccount) setBillerAccounts(prev=>[...prev, newBillerAccount]);
    if (newRelationship) setSchoolRelationships(prev=>[...prev, newRelationship]);

    try {
      const { schedule, periods } = schoolFeesService.createSchoolFeeSchedule(
        { billerAccountId: resolvedBillerAccountId, personId: selectedPersonId||null, schoolYearStart, schoolYearEnd, rateRules },
        genId
      );
      const scheduleWithName = { ...schedule, schoolName: trimmedName };
      setFeeSchedules(prev=>[scheduleWithName, ...prev]);
      setFeePeriods(prev=>[...periods, ...prev]);
      onClose();
    } catch(e) {
      setError(e.message || "Could not create this schedule — check the school year and rate coverage.");
    }
  };

  const confirmImpactAndSave = () => {
    applyScheduleReconciliation(pendingImpact);
    setPendingImpact(null);
    if (!savePersonAttribution()) return;
    onClose();
  };

  if (pendingImpact) {
    const fmtMonth = mk => { const [y,m]=mk.split("-"); return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(m)-1]} ${y}`; };
    return (
      <BottomSheet onClose={()=>setPendingImpact(null)} T={T} maxWidth={430} maxHeight="85vh" padding="20px 16px 48px" zIndex={341}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>This will:</div>
          <button onClick={()=>setPendingImpact(null)} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:16 }}>
          {pendingImpact.periodsToAdd.length>0 && (
            <div style={{ color:T.text,fontSize:13 }}>+ Add {pendingImpact.periodsToAdd.length} period{pendingImpact.periodsToAdd.length===1?"":"s"}: {pendingImpact.periodsToAdd.map(p=>fmtMonth(p.periodStart.slice(0,7))).join(", ")}</div>
          )}
          {pendingImpact.periodsToUpdate.length>0 && (
            <div style={{ color:T.text,fontSize:13 }}>~ Update {pendingImpact.periodsToUpdate.length} future period{pendingImpact.periodsToUpdate.length===1?"":"s"} to the new rate</div>
          )}
          {pendingImpact.periodsToRemove.length>0 && (
            <div style={{ color:T.warn,fontSize:13 }}>- Remove {pendingImpact.periodsToRemove.length} unpaid period{pendingImpact.periodsToRemove.length===1?"":"s"} no longer in range: {pendingImpact.periodsToRemove.map(p=>fmtMonth(p.periodStart.slice(0,7))).join(", ")}</div>
          )}
          {pendingImpact.protectedOutOfRange.length>0 && (
            <div style={{ color:T.sub,fontSize:13 }}>&bull; Keep {pendingImpact.protectedOutOfRange.length} period{pendingImpact.protectedOutOfRange.length===1?"":"s"} outside your new range unchanged, because they have real financial history: {pendingImpact.protectedOutOfRange.map(p=>fmtMonth(p.periodStart.slice(0,7))).join(", ")}</div>
          )}
        </div>
        {error && <div style={{ color:T.warn,fontSize:11,marginBottom:10 }}>{error}</div>}
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={()=>setPendingImpact(null)} style={{ flex:1,background:"none",border:`1px solid ${T.border}`,borderRadius:14,padding:"13px",cursor:"pointer",fontSize:13,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>Cancel</button>
          <button onClick={confirmImpactAndSave} style={{ flex:1,background:T.accent,border:"none",borderRadius:14,padding:"13px",cursor:"pointer",fontSize:13,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif" }}>Confirm changes</button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="85vh" padding="20px 16px 48px" zIndex={340}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
        <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>{isEdit?"Edit School Fee Schedule":"Add School Year"}</div>
        <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        <div>
          <span style={lbl}>School Name *</span>
          <input style={{ ...inp,fontSize:15,fontWeight:700 }} placeholder="e.g. Springdale Academy" value={schoolName} onChange={e=>setSchoolName(e.target.value)} autoFocus/>
        </div>
        <div>
          <span style={lbl}>For</span>
          <select style={inp} value={selectedPersonId} onChange={e=>setSelectedPersonId(e.target.value)}>
            <option value="">Not linked to a saved person</option>
            <option value="__me__">Me</option>
            {(people||[]).filter(p=>!p.isMe && !isPersonArchived(p)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div style={{ color:T.sub,fontSize:10,marginTop:4 }}>Optional — the schedule works either way. Link a person only if you want this school to show up on their profile.</div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
          <div><span style={lbl}>School Year Start *</span><input style={inp} type="date" value={schoolYearStart} onChange={e=>setSchoolYearStart(e.target.value)}/></div>
          <div><span style={lbl}>School Year End *</span><input style={inp} type="date" value={schoolYearEnd} onChange={e=>setSchoolYearEnd(e.target.value)}/></div>
        </div>
        <div>
          <span style={lbl}>Base Monthly Fee *</span>
          <input style={inp} type="number" placeholder="e.g. 4500" value={baseRate} onChange={e=>setBaseRate(e.target.value)}/>
          <div style={{ color:T.sub,fontSize:10,marginTop:4 }}>Applied to every month in range unless overridden below.</div>
        </div>

        {extraRules.map((r,idx)=>(
          <div key={idx} style={{ background:T.input,borderRadius:12,padding:10,display:"flex",flexDirection:"column",gap:6 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <span style={{ color:T.sub,fontSize:10,fontWeight:700 }}>RATE OVERRIDE</span>
              <button onClick={()=>removeExtraRule(idx)} style={{ background:"none",border:"none",color:T.warn,cursor:"pointer",fontSize:11,fontFamily:"Nunito,sans-serif" }}>Remove</button>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
              <input style={inp} type="month" value={r.from} onChange={e=>updateExtraRule(idx,"from",e.target.value)}/>
              <input style={inp} type="month" value={r.to} onChange={e=>updateExtraRule(idx,"to",e.target.value)}/>
            </div>
            <input style={inp} type="number" placeholder="Monthly fee for this range" value={r.monthlyRate} onChange={e=>updateExtraRule(idx,"monthlyRate",e.target.value)}/>
          </div>
        ))}
        <button onClick={addExtraRule} style={{ background:"none",border:`1px dashed ${T.border}`,borderRadius:10,padding:"9px",cursor:"pointer",fontSize:11.5,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>+ Add a rate override for part of the year</button>

        {error && <div style={{ color:T.warn,fontSize:11 }}>{error}</div>}
        <div style={{ color:T.sub,fontSize:10 }}>{isEdit?"Changes to dates or rates only affect future, unsettled periods — real payment history is never rewritten.":"Saving generates one fee period per month in range. Each period can be individually corrected, discounted, or written off later — nothing here is final."}</div>
        <button onClick={save} disabled={!canSave} style={{ background:canSave?T.accent:T.border,border:"none",borderRadius:14,padding:"13px",cursor:canSave?"pointer":"not-allowed",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif",marginTop:4 }}>{isEdit?"Save Changes":"Create Schedule"}</button>
      </div>
    </BottomSheet>
  );
};

// ============================================================================
// Schedule Detail — the main screen: annual summary, credit banner, undeclared
// banner, period ledger, discount/write-off, multi-select settlement bar
// ============================================================================

export const SchoolFeeScheduleDetailModal = ({
  schedule, onClose, T, sym, fmt,
  feePeriods, setFeePeriods, schoolCreditNotes, setSchoolCreditNotes,
  setViewingPeriod, setShowSettle, setShowCreditNote,
  selectedPeriodIds, setSelectedPeriodIds,
  createRealTxn, // injected: (amount) => txnId — the real expense-transaction flow, App.jsx's own
  people, billerAccounts, setEditingSchoolSchedule,
}) => {
  const periods = useMemo(()=>feePeriods.filter(p=>p.scheduleId===schedule.id), [feePeriods, schedule.id]);
  const creditNotes = useMemo(()=>schoolCreditNotes.filter(n=>n.scheduleId===schedule.id), [schoolCreditNotes, schedule.id]);
  const summary = useMemo(
    ()=>calculateAnnualSummary(schedule.id, feePeriods, schoolCreditNotes),
    [schedule.id, feePeriods, schoolCreditNotes]
  );
  const needingDeclaration = useMemo(()=>schoolFeesService.getPeriodsNeedingDeclaration(periods), [periods]);
  const availableCredit = summary.availableCredit;

  // P1 — Person attribution now lives inside the combined Edit screen
  // (AddSchoolYearModal, existing=schedule). This box is read-only display
  // only — the standalone "Change" flow WP-6 built here is superseded, not
  // duplicated: attemptSchoolAttributionChange is still the only function
  // that ever writes attribution, called from the Edit screen's save path.
  const currentPersonName = useMemo(()=>{
    if(!schedule.personId) return "Not linked to a saved person";
    if(schedule.personId==="__me__") return "Me";
    return (people||[]).find(p=>p.id===schedule.personId)?.name || "Unknown person";
  }, [people, schedule.personId]);

  const toggleSelect = (periodId) => setSelectedPeriodIds(prev=>prev.includes(periodId) ? prev.filter(id=>id!==periodId) : [...prev, periodId]);

  const selectedTotal = useMemo(()=>{
    if(selectedPeriodIds.length===0) return 0;
    try { return schoolFeesService.calculateSelectedTotal(feePeriods, selectedPeriodIds); } catch { return 0; }
  }, [feePeriods, selectedPeriodIds]);

  const applyCreditToOldest = () => {
    const targetPeriod = periods.find(p=>p.startingStateDeclared && calculateOutstanding(p)>0);
    if(!targetPeriod) return;
    const note = creditNotes.find(n=>{
      const applied = (n.applications||[]).reduce((s,a)=>s+a.amount,0);
      return (n.amount - applied) > 0;
    });
    if(!note) return;
    const amountToApply = Math.min(availableCredit, calculateOutstanding(targetPeriod));
    const { updatedCreditNotes, updatedFeePeriods } = schoolFeesService.applyCredit(schoolCreditNotes, feePeriods, note.id, targetPeriod.id, amountToApply);
    setSchoolCreditNotes(updatedCreditNotes);
    setFeePeriods(updatedFeePeriods);
  };

  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="90vh" padding="20px 16px 48px" zIndex={345}>
      <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16 }}>
        <span style={{ fontSize:28 }}>🎓</span>
        <div style={{ minWidth:0,flex:1 }}>
          <div style={{ color:T.accent,fontSize:10,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" }}>School fee schedule</div>
          <div style={{ color:T.text,fontSize:18,fontWeight:900,wordBreak:"break-word" }}>{schedule.schoolName}</div>
        </div>
        <button onClick={()=>setEditingSchoolSchedule(schedule)} style={{ background:T.accentSoft,border:`1px solid ${T.accent}44`,borderRadius:10,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif",flexShrink:0 }}>✏️ Edit</button>
        <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
      </div>

      {/* P1 — read-only display. Person attribution now edits through the
          combined Edit screen (above), which calls attemptSchoolAttributionChange
          as a separate operation on save — this box no longer has its own
          edit state or save path. */}
      <div style={{ background:T.input,borderRadius:14,padding:"12px 14px",marginBottom:12 }}>
        <div style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase" }}>For</div>
        <div style={{ color:T.text,fontSize:13,fontWeight:700,marginTop:2 }}>{currentPersonName}</div>
      </div>

      {/* Annual commitment card */}
      <div style={{ background:T.input,borderRadius:18,padding:16,marginBottom:12 }}>
        <div style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase" }}>Annual tuition commitment</div>
        <div style={{ color:T.text,fontSize:26,fontWeight:800,margin:"4px 0 6px",fontFamily:"monospace" }}>{sym}{fmt(summary.grossAnnualCommitment)}</div>
        <div style={{ color:T.sub,fontSize:10.5,lineHeight:1.5,marginBottom:12 }}>Summed from {periods.length} fee periods — not a flat monthly multiple. Any overridden period is reflected here exactly.</div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
          <div><div style={{ color:T.sub,fontSize:10 }}>Paid</div><div style={{ color:GREEN_TEXT,fontSize:15,fontWeight:800,fontFamily:"monospace" }}>{sym}{fmt(summary.amountPaid)}</div></div>
          <div><div style={{ color:T.sub,fontSize:10 }}>Outstanding</div><div style={{ color:T.text,fontSize:15,fontWeight:800,fontFamily:"monospace" }}>{sym}{fmt(summary.remainingObligation)}</div></div>
          <div><div style={{ color:T.sub,fontSize:10 }}>Discounts</div><div style={{ color:T.text,fontSize:13,fontWeight:700,fontFamily:"monospace" }}>{sym}{fmt(summary.discounts)}</div></div>
          <div><div style={{ color:T.sub,fontSize:10 }}>Write-offs</div><div style={{ color:T.text,fontSize:13,fontWeight:700,fontFamily:"monospace" }}>{sym}{fmt(summary.writeOffs)}</div></div>
        </div>
      </div>

      {availableCredit>0 && (
        <div style={{ background:T.accentSoft,border:`1px solid ${T.accent}44`,borderRadius:16,padding:14,marginBottom:12 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline" }}>
            <span style={{ color:TEAL_TEXT,fontSize:12.5,fontWeight:700 }}>School credit available</span>
            <span style={{ color:TEAL_TEXT,fontSize:15,fontWeight:800,fontFamily:"monospace" }}>{sym}{fmt(availableCredit)}</span>
          </div>
          <div style={{ color:T.sub,fontSize:10.5,lineHeight:1.5,margin:"6px 0 10px" }}>Arth suggests applying this to the next outstanding period — it will not apply this on its own.</div>
          <button onClick={applyCreditToOldest} style={{ background:T.accent,border:"none",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:11.5,fontWeight:700,color:"#fff",fontFamily:"Nunito,sans-serif" }}>Apply to next outstanding period</button>
        </div>
      )}

      {needingDeclaration.length>0 && (
        <div style={{ border:`1px dashed ${T.border}`,borderRadius:16,padding:14,marginBottom:12 }}>
          <div style={{ color:T.text,fontSize:12.5,fontWeight:700,marginBottom:5 }}>{needingDeclaration.length} period(s) have no established status</div>
          <div style={{ color:T.sub,fontSize:10.5,lineHeight:1.5 }}>This schedule was created after the school year began. Arth does not know whether these were paid, and will not count them as outstanding or as paid. Open each one to record what actually happened.</div>
        </div>
      )}

      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"4px 2px 8px" }}>
        <span style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase" }}>Fee periods</span>
        <span style={{ color:T.sub,fontSize:10 }}>Tap to open · select to settle</span>
      </div>

      {periods.map(p=>{
        const und = !p.startingStateDeclared;
        const out = calculateOutstanding(p);
        const selected = selectedPeriodIds.includes(p.id);
        const selectable = !und && out>0;
        const settled = !und && out<=0;
        return (
          <div key={p.id} style={{ display:"flex",gap:9,marginBottom:7 }}>
            {selectable && (
              <button onClick={()=>toggleSelect(p.id)} style={{ width:26,flexShrink:0,display:"grid",placeItems:"center",background:selected?T.accent:T.card,border:`1.5px solid ${selected?T.accent:T.border}`,borderRadius:8,cursor:"pointer",color:"#fff" }}>{selected?"✓":""}</button>
            )}
            <button onClick={()=>setViewingPeriod(p)} style={{ flex:1,minWidth:0,display:"flex",alignItems:"center",gap:11,padding:"13px 14px",background:und?"transparent":T.card,border:und?`1px dashed ${T.border}`:`1px solid ${T.border}`,borderRadius:16,cursor:"pointer",textAlign:"left",fontFamily:"Nunito,sans-serif" }}>
              <span style={{ flex:1,minWidth:0 }}>
                <div style={{ color:und?T.sub:T.text,fontSize:14,fontWeight:700 }}>{p.label}</div>
                <div style={{ color:und?T.sub:(settled?GREEN_TEXT:(out<p.obligationAmount?RED_TEXT:T.sub)),fontSize:10.5,marginTop:2 }}>
                  {und ? "Status not established · set status" : settled ? "Settled in full" : (p.paidAmount>0 ? `Part paid · ${sym}${fmt(out)} outstanding` : "Unpaid")}
                </div>
              </span>
              <span style={{ textAlign:"right" }}>
                <div style={{ color:und?T.sub:T.text,fontSize:14,fontWeight:700,fontFamily:"monospace" }}>{sym}{fmt(p.obligationAmount)}</div>
                <div style={{ color:und?T.sub:(settled?GREEN_TEXT:T.sub),fontSize:10.5,fontFamily:"monospace" }}>{und ? "not counted" : settled ? "settled" : `${sym}${fmt(out)} due`}</div>
              </span>
            </button>
          </div>
        );
      })}

      <div style={{ color:T.sub,fontSize:10.5,lineHeight:1.5,margin:"8px 0 4px" }}>Open a period below to record a discount or write-off against it specifically.</div>
      <button onClick={()=>setShowCreditNote(true)} style={{ background:"none",border:`1px dashed ${T.border}`,borderRadius:10,padding:"9px",cursor:"pointer",fontSize:11.5,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif",marginTop:8,width:"100%" }}>+ New Credit Note</button>

      {selectedPeriodIds.length>0 && (
        <div style={{ position:"sticky",bottom:0,marginTop:14,padding:"12px 0 0",background:T.bg,borderTop:`1px solid ${T.border}` }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10 }}>
            <span style={{ color:T.sub,fontSize:12 }}>{selectedPeriodIds.length} selected</span>
            <span style={{ color:T.text,fontSize:18,fontWeight:800,fontFamily:"monospace" }}>{sym}{fmt(selectedTotal)}</span>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={()=>setShowSettle(true)} style={{ flex:1,padding:13,borderRadius:12,background:T.accent,border:"none",fontSize:13.5,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"Nunito,sans-serif" }}>Record payment</button>
            <button onClick={()=>setSelectedPeriodIds([])} style={{ padding:"13px 16px",borderRadius:12,background:"none",border:`1px solid ${T.border}`,fontSize:13,fontWeight:600,color:T.sub,cursor:"pointer",fontFamily:"Nunito,sans-serif" }}>Clear</button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
};

// ============================================================================
// Settle Payment — deterministic when amount matches selection, explicit
// allocation required when it doesn't. No auto-allocation is ever applied.
// ============================================================================

export const SettlePaymentModal = ({
  onClose, T, sym, fmt,
  feePeriods, setFeePeriods, selectedPeriodIds, setSelectedPeriodIds,
  accounts, // real Arth accounts[], for the account picker — payment must record where it came from
  cats, // real Arth cats[] (spending categories) — required so this transaction is a normal,
        // categorized expense like any other, never Uncategorized. Never defaulted/guessed —
        // the real category list is the only source of truth for what's appropriate here.
  createRealTxn, // (amount, accId, catId, linkedFeePeriods) => txnId
}) => {
  const selectedTotal = useMemo(()=>{
    try { return schoolFeesService.calculateSelectedTotal(feePeriods, selectedPeriodIds); } catch { return 0; }
  }, [feePeriods, selectedPeriodIds]);

  const [payAmount, setPayAmount] = useState(String(selectedTotal));
  const [accId, setAccId] = useState("");
  const [catId, setCatId] = useState("");
  const [alloc, setAlloc] = useState({});
  const [error, setError] = useState("");

  const payNum = parseInt(payAmount||"0", 10) || 0;
  const needsAllocation = payNum>0 && payNum!==selectedTotal && selectedPeriodIds.length>1;
  const allocSum = Object.values(alloc).reduce((s,v)=>s+(parseInt(v||"0",10)||0), 0);
  const unalloc = payNum - allocSum;

  const selectedPeriods = feePeriods.filter(p=>selectedPeriodIds.includes(p.id));

  const autoSuggest = () => {
    let rest = payNum;
    const next = {};
    selectedPeriods.forEach(p=>{
      const out = calculateOutstanding(p);
      const take = Math.min(rest, out);
      next[p.id] = String(take);
      rest -= take;
    });
    setAlloc(next);
  };

  const confirmDisabled = payNum<=0 || !accId || !catId || (needsAllocation && unalloc!==0);

  const confirm = () => {
    setError("");
    try {
      const explicitAllocations = needsAllocation
        ? selectedPeriodIds.map(id=>({ periodId:id, amount: parseInt(alloc[id]||"0",10)||0 }))
        : undefined; // exact-match case: resolved below, deterministically, same logic settlePeriods itself uses
      // Resolve the FINAL per-period allocation before the transaction exists — this is what
      // makes the reverse link (linkedFeePeriods) correct even in the deterministic case, where
      // this screen doesn't otherwise know the per-period split until settlement runs it.
      const resolved = schoolFeesService.resolveAllocations(feePeriods, selectedPeriodIds, payNum, explicitAllocations);
      const linkedFeePeriods = resolved.filter(a=>a.amount>0); // symmetric with settlementLinks' own zero-skip
      const txnId = createRealTxn(payNum, accId, catId, linkedFeePeriods); // real Transaction, real category, real reverse link
      const updated = schoolFeesService.settlePeriods(feePeriods, selectedPeriodIds, payNum, txnId, explicitAllocations);
      setFeePeriods(updated);
      setSelectedPeriodIds([]);
      onClose();
    } catch(e) {
      setError(e.message || "Could not record this payment.");
    }
  };

  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="88vh" padding="20px 16px 48px" zIndex={350}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
        <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>Record Payment</div>
        <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
      </div>

      <div style={{ background:T.input,borderRadius:16,padding:15,marginBottom:12 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:11 }}>
          <span style={{ color:T.sub,fontSize:12 }}>Outstanding on {selectedPeriodIds.length} period(s)</span>
          <span style={{ color:T.text,fontSize:16,fontWeight:800,fontFamily:"monospace" }}>{sym}{fmt(selectedTotal)}</span>
        </div>
        <span style={{ display:"block",color:T.sub,fontSize:9.5,fontWeight:700,textTransform:"uppercase",marginBottom:6 }}>Amount actually paid</span>
        <input type="number" value={payAmount} onChange={e=>{ setPayAmount(e.target.value); setAlloc({}); }} placeholder="0" style={{ width:"100%",border:`1.5px solid ${T.accent}55`,background:T.bg,borderRadius:12,padding:"11px 14px",fontSize:20,fontWeight:700,color:T.text,fontFamily:"monospace",outline:"none" }}/>
        <div style={{ color:T.sub,fontSize:11,marginTop:8 }}>
          {payNum===0 ? "Enter what was actually paid."
            : payNum===selectedTotal ? "Covers the selection in full — no allocation needed."
            : selectedPeriodIds.length>1 ? "Less than the total. Allocate it below."
            : `Leaves ${sym}${fmt(Math.max(0,selectedTotal-payNum))} outstanding on this period.`}
        </div>
        <span style={{ display:"block",color:T.sub,fontSize:9.5,fontWeight:700,textTransform:"uppercase",margin:"12px 0 6px" }}>Paid from</span>
        <select value={accId} onChange={e=>setAccId(e.target.value)} style={{ width:"100%",border:`1px solid ${T.border}`,background:T.bg,borderRadius:10,padding:"10px 12px",fontSize:13,fontWeight:600,color:T.text,fontFamily:"Nunito,sans-serif",outline:"none" }}>
          <option value="">Select an account…</option>
          {(accounts||[]).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <span style={{ display:"block",color:T.sub,fontSize:9.5,fontWeight:700,textTransform:"uppercase",margin:"12px 0 6px" }}>Category</span>
        <select value={catId} onChange={e=>setCatId(e.target.value)} style={{ width:"100%",border:`1px solid ${T.border}`,background:T.bg,borderRadius:10,padding:"10px 12px",fontSize:13,fontWeight:600,color:T.text,fontFamily:"Nunito,sans-serif",outline:"none" }}>
          <option value="">Select a category…</option>
          {(cats||[]).map(c=><option key={c.id} value={c.id}>{c.name||c.id}</option>)}
        </select>
        <div style={{ color:T.sub,fontSize:10,marginTop:6 }}>This makes the payment a normal expense — it'll show up in Budget and Insights like any other spend.</div>
      </div>

      {needsAllocation && (
        <div style={{ background:T.accentSoft,border:`1px solid ${T.accent}44`,borderRadius:16,padding:15,marginBottom:12 }}>
          <div style={{ color:T.text,fontSize:13,fontWeight:700,marginBottom:4 }}>Allocate this payment</div>
          <div style={{ color:T.sub,fontSize:11,lineHeight:1.5,marginBottom:13 }}>You are paying {sym}{fmt(payNum)} toward {sym}{fmt(selectedTotal)} outstanding. Arth will not decide how it splits — set each period yourself.</div>
          {selectedPeriods.map(p=>{
            const out = calculateOutstanding(p);
            const v = parseInt(alloc[p.id]||"0",10) || 0;
            const left = out - v;
            return (
              <div key={p.id} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"12px 13px",marginBottom:8 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8 }}>
                  <span style={{ color:T.text,fontSize:13,fontWeight:700 }}>{p.label}</span>
                  <span style={{ color:T.sub,fontSize:11,fontFamily:"monospace" }}>{sym}{fmt(out)} outstanding</span>
                </div>
                <input type="number" value={alloc[p.id]||""} onChange={e=>setAlloc(prev=>({...prev,[p.id]:e.target.value}))} placeholder="0" style={{ width:"100%",border:`1px solid ${T.border}`,background:T.bg,borderRadius:10,padding:"8px 11px",fontSize:14,fontWeight:700,color:T.text,fontFamily:"monospace",outline:"none" }}/>
                <div style={{ color:v===0?T.sub:(left<=0?GREEN_TEXT:RED_TEXT),fontSize:10.5,marginTop:6 }}>
                  {v===0 ? `Nothing allocated — stays ${sym}${fmt(out)} outstanding` : left<=0 ? `Settles ${p.label.split(" ")[0]} in full` : `${sym}${fmt(left)} will remain outstanding`}
                </div>
              </div>
            );
          })}
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 13px",background:unalloc===0?T.accentSoft:"transparent",borderRadius:12 }}>
            <span style={{ color:unalloc===0?GREEN_TEXT:RED_TEXT,fontSize:12,fontWeight:700 }}>{unalloc===0?"Fully allocated":unalloc>0?"Still to allocate":"Over-allocated"}</span>
            <span style={{ color:unalloc===0?GREEN_TEXT:RED_TEXT,fontSize:14,fontWeight:800,fontFamily:"monospace" }}>{sym}{fmt(Math.abs(unalloc))}</span>
          </div>
          <button onClick={autoSuggest} style={{ width:"100%",marginTop:9,padding:10,borderRadius:10,background:"none",border:`1px dashed ${T.accent}88`,fontSize:11.5,fontWeight:700,color:TEAL_TEXT,cursor:"pointer",fontFamily:"Nunito,sans-serif" }}>Suggest a split (oldest period first)</button>
        </div>
      )}

      {error && <div style={{ color:T.warn,fontSize:11,marginBottom:10 }}>{error}</div>}
      <button onClick={confirm} disabled={confirmDisabled} style={{ width:"100%",padding:15,borderRadius:12,background:confirmDisabled?T.border:T.accent,border:"none",fontSize:13.5,fontWeight:700,color:confirmDisabled?T.sub:"#fff",cursor:confirmDisabled?"not-allowed":"pointer",fontFamily:"Nunito,sans-serif" }}>
        {needsAllocation && unalloc!==0 ? "Allocate the full amount to continue" : `Confirm payment of ${sym}${fmt(payNum)}`}
      </button>
    </BottomSheet>
  );
};

// ============================================================================
// Period Detail — undeclared prompt, fee edit (only if untouched), ledger,
// and the Future Money projection this period contributes (or doesn't).
// ============================================================================

export const PeriodDetailModal = ({ period, schedule, onClose, T, sym, fmt, setFeePeriods, feePeriods, setShowAdjust, setAdjustKind, setAdjustTargetPeriodId, txns, accounts, onViewTransaction }) => {
  const [feeDraft, setFeeDraft] = useState(String(period.obligationAmount));
  const [error, setError] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  const und = !period.startingStateDeclared;
  const out = calculateOutstanding(period);
  // P1 — domain/UI boundary correction. This used to reimplement the
  // touched/editable rule inline (a duplicate of editFeePeriodObligationAmount's
  // own guard, which drifted out of sync with P0's fix). classifyPeriod is
  // now the single source of truth: the domain decides "protected" /
  // "correctable" / "historical-editable" / "future"; this component only
  // decides how to present whichever one comes back. No boolean logic about
  // what's editable is computed here anymore, anywhere.
  const classification = classifyPeriod(period, todayStr());

  const setStatus = (wasPaid) => {
    try {
      const updated = schoolFeesService.declareStartingState(feePeriods, period.id, wasPaid);
      setFeePeriods(updated);
      onClose();
    } catch(e) { setError(e.message); }
  };

  const correctPeriod = () => {
    setError("");
    if(!correctionReason.trim()){ setError("A reason is required to correct this."); return; }
    try {
      const updated = schoolFeesService.correctStartingState(feePeriods, period.id, false, correctionReason.trim());
      setFeePeriods(updated);
      onClose();
    } catch(e) { setError(e.message); }
  };

  const saveFee = () => {
    const v = parseInt(feeDraft||"0", 10);
    if(!v) return;
    try {
      const updated = schoolFeesService.editPeriodAmount(feePeriods, period.id, v);
      setFeePeriods(updated);
      onClose();
    } catch(e) { setError(e.message); }
  };

  // Read-only projection preview — proves WP-8's real adapter, never a
  // second calculation of its own.
  const projected = schoolFeesService.getSchoolFeeCommitments([period])[0] || null;

  // Payment provenance — the core of this correction. A period's paidAmount
  // can come from two fundamentally different facts:
  //   1. settlementLinks[] entries — each backed by a REAL transaction,
  //      looked up here, never re-derived or duplicated.
  //   2. paidAmount>0 with EMPTY settlementLinks — the historical
  //      starting-state declaration (WP-3). Arth has no transaction for
  //      this, and must never present it as if it did.
  const paymentEvents = (period.settlementLinks||[]).map(link=>{
    const txn = (txns||[]).find(t=>t.id===link.txnId);
    const acc = txn ? (accounts||[]).find(a=>a.id===txn.accId) : null;
    return { link, txn, acc };
  });
  const hasRealPayments = paymentEvents.length>0;
  const isHistoricalOnly = !hasRealPayments && period.paidAmount>0;

  const ledger = [
    { label:"Fee", value: `${sym}${fmt(period.obligationAmount)}`, color:T.text },
    { label:"Paid", value: `${sym}${fmt(period.paidAmount)}`, color: period.paidAmount>0?GREEN_TEXT:T.sub },
  ];
  if(period.appliedCreditAmount>0) ledger.push({ label:"Credit applied", value:`${sym}${fmt(period.appliedCreditAmount)}`, color:TEAL_TEXT });
  if(period.discountAmount>0) ledger.push({ label:"Discount", value:`${sym}${fmt(period.discountAmount)}`, color:TEAL_TEXT });
  if(period.writeOffAmount>0) ledger.push({ label:"Write-off", value:`${sym}${fmt(period.writeOffAmount)}`, color:T.sub });
  ledger.push(und
    ? { label:"Outstanding", value:"—", color:T.sub }
    : { label:"Outstanding", value:`${sym}${fmt(out)}`, color: out>0?RED_TEXT:GREEN_TEXT }
  );

  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="88vh" padding="20px 16px 48px" zIndex={355}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14 }}>
        <div>
          <div style={{ color:T.accent,fontSize:10,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" }}>Fee period</div>
          <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>{period.label}</div>
          <div style={{ color:T.sub,fontSize:11.5,marginTop:2 }}>{schedule?.schoolName}</div>
        </div>
        <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
      </div>

      {und && (
        <div style={{ border:`1px dashed ${T.border}`,borderRadius:16,padding:15,marginBottom:12 }}>
          <div style={{ color:T.text,fontSize:13.5,fontWeight:700,marginBottom:5 }}>Status not established</div>
          <div style={{ color:T.sub,fontSize:11.5,lineHeight:1.5,marginBottom:13 }}>This period predates the schedule. Arth has no record of whether it was paid, and will not assume it was outstanding.</div>
          <div style={{ color:T.text,fontSize:12.5,fontWeight:700,marginBottom:8 }}>Was this fee paid?</div>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={()=>setStatus(true)} style={{ flex:1,padding:12,borderRadius:12,background:GREEN,border:"none",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"Nunito,sans-serif" }}>Yes — paid</button>
            <button onClick={()=>setStatus(false)} style={{ flex:1,padding:12,borderRadius:12,background:T.card,border:`1px solid ${T.border}`,fontSize:13,fontWeight:700,color:T.text,cursor:"pointer",fontFamily:"Nunito,sans-serif" }}>No — unpaid</button>
          </div>
        </div>
      )}

      {!und && (
        <div style={{ background:T.input,borderRadius:16,padding:15,marginBottom:12 }}>
          {classification==="correctable" ? (
            <>
              <div style={{ color:T.text,fontSize:13,fontWeight:700,marginBottom:6 }}>Marked paid at setup — no transaction on file</div>
              <div style={{ color:T.sub,fontSize:11.5,lineHeight:1.5,marginBottom:12 }}>This period was marked paid when the schedule was set up, but Arth has no actual payment on record for it — this is a starting-balance claim, not a witnessed transaction. If that was entered incorrectly, you can correct it.</div>
              <span style={{ display:"block",color:T.sub,fontSize:9.5,fontWeight:700,textTransform:"uppercase",marginBottom:6 }}>Reason for correction *</span>
              <input value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)} placeholder="e.g. Marked paid by mistake at setup" style={{ width:"100%",border:`1px solid ${T.border}`,background:T.bg,borderRadius:10,padding:"10px 12px",fontSize:13,fontWeight:600,color:T.text,fontFamily:"Nunito,sans-serif",outline:"none",marginBottom:11 }}/>
              <button onClick={correctPeriod} disabled={!correctionReason.trim()} style={{ width:"100%",padding:12,borderRadius:12,background:correctionReason.trim()?T.accent:T.border,border:"none",fontSize:13,fontWeight:700,color:"#fff",cursor:correctionReason.trim()?"pointer":"not-allowed",fontFamily:"Nunito,sans-serif" }}>Correct — mark as actually unpaid</button>
            </>
          ) : classification==="protected" ? (
            <>
              <div style={{ color:T.text,fontSize:26,fontWeight:800,fontFamily:"monospace" }}>{sym}{fmt(period.obligationAmount)}</div>
              <div style={{ color:T.sub,fontSize:11,lineHeight:1.5,marginTop:8 }}>This period has been settled or adjusted. Editing the fee would rewrite history — use a discount, write-off, or credit note instead.</div>
            </>
          ) : (
            <>
              <input type="number" value={feeDraft} onChange={e=>setFeeDraft(e.target.value)} style={{ width:"100%",border:`1.5px solid ${T.accent}55`,background:T.bg,borderRadius:12,padding:"11px 14px",fontSize:22,fontWeight:700,color:T.text,fontFamily:"monospace",outline:"none",marginBottom:9 }}/>
              <div style={{ color:T.sub,fontSize:11,lineHeight:1.5,marginBottom:11 }}>Changes only this period. It does not touch any other period, and does not alter any payment already recorded — this is a future obligation, not history.</div>
              <button onClick={saveFee} style={{ width:"100%",padding:12,borderRadius:12,background:T.accent,border:"none",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"Nunito,sans-serif" }}>Save fee for {period.label}</button>
            </>
          )}
        </div>
      )}

      <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden",marginBottom:12 }}>
        {ledger.map((l,i)=>(
          <div key={i} style={{ display:"flex",justifyContent:"space-between",padding:"12px 14px",borderBottom:i<ledger.length-1?`1px solid ${T.border}`:"none" }}>
            <span style={{ color:T.sub,fontSize:12.5,fontWeight:600 }}>{l.label}</span>
            <span style={{ color:l.color,fontSize:14,fontWeight:700,fontFamily:"monospace" }}>{l.value}</span>
          </div>
        ))}
      </div>

      {hasRealPayments && (
        <div style={{ marginBottom:12 }}>
          <div style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",padding:"2px 2px 8px" }}>Payment record</div>
          {paymentEvents.map(({ link, txn, acc }, i)=>(
            <div key={i} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"12px 14px",marginBottom:8 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4 }}>
                <span style={{ color:GREEN_TEXT,fontSize:13,fontWeight:700 }}>Paid {sym}{fmt(link.amount)}</span>
              </div>
              {txn ? (
                <>
                  <div style={{ color:T.sub,fontSize:11 }}>Paid on {txn.date || "—"}{acc ? ` · ${acc.name}` : ""}</div>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8 }}>
                    <span style={{ color:T.sub,fontSize:10.5,fontFamily:"monospace" }}>TXN-{String(txn.id).slice(-8).toUpperCase()}</span>
                    {onViewTransaction && (
                      <button onClick={()=>onViewTransaction(txn.id)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>View transaction →</button>
                    )}
                  </div>
                </>
              ) : (
                // A settlementLinks entry exists but its transaction can't be found (e.g.
                // deleted elsewhere in Money). Say so plainly — do not fabricate a date/account.
                <div style={{ color:T.warn,fontSize:11 }}>Linked transaction not found — it may have been deleted or edited elsewhere.</div>
              )}
            </div>
          ))}
        </div>
      )}

      {isHistoricalOnly && (
        <div style={{ border:`1px dashed ${T.border}`,borderRadius:14,padding:"12px 14px",marginBottom:12 }}>
          <div style={{ color:T.text,fontSize:13,fontWeight:700,marginBottom:3 }}>Paid historically</div>
          <div style={{ color:T.sub,fontSize:11,lineHeight:1.5 }}>Marked paid at setup · No transaction on file. Arth has no record of the original payment — this is what you told Arth when this schedule was created, not something Arth witnessed.</div>
        </div>
      )}

      {!und && out>0 && (
        <div style={{ display:"flex",gap:8,marginBottom:12 }}>
          <button onClick={()=>{ setAdjustTargetPeriodId(period.id); setAdjustKind("discount"); setShowAdjust(true); onClose(); }} style={{ flex:1,padding:11,borderRadius:12,background:T.input,border:`1px solid ${T.border}`,fontSize:11.5,fontWeight:700,color:T.text,cursor:"pointer",fontFamily:"Nunito,sans-serif" }}>Record discount</button>
          <button onClick={()=>{ setAdjustTargetPeriodId(period.id); setAdjustKind("writeoff"); setShowAdjust(true); onClose(); }} style={{ flex:1,padding:11,borderRadius:12,background:T.input,border:`1px solid ${T.border}`,fontSize:11.5,fontWeight:700,color:T.text,cursor:"pointer",fontFamily:"Nunito,sans-serif" }}>Write off</button>
        </div>
      )}

      <div style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",padding:"2px 2px 9px" }}>Contributes to</div>
      <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"13px 14px" }}>
        {projected ? (
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <div>
              <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>Committed Spending</div>
              <div style={{ color:T.sub,fontSize:10.5,marginTop:1 }}>Future Money · source: School Fees</div>
            </div>
            <span style={{ color:TEAL_TEXT,fontSize:13,fontWeight:700,fontFamily:"monospace" }}>{sym}{fmt(projected.amount)}</span>
          </div>
        ) : (
          <div style={{ color:T.sub,fontSize:11.5,lineHeight:1.5 }}>{und ? "Not projected — status isn't established yet." : "Not projected — this period is fully settled."}</div>
        )}
      </div>

      {error && <div style={{ color:T.warn,fontSize:11,marginTop:10 }}>{error}</div>}
    </BottomSheet>
  );
};

// ============================================================================
// Discount / Write-off entry
// ============================================================================

export const AdjustmentModal = ({ kind, feePeriods, setFeePeriods, targetPeriodId, onClose, T, inp, lbl }) => {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const period = feePeriods.find(p=>p.id===targetPeriodId);
  const isDiscount = kind==="discount";

  const confirm = () => {
    setError("");
    const v = parseInt(amount||"0",10);
    if(!v || !reason.trim() || !period) { setError("Amount and reason are both required."); return; }
    try {
      const updated = isDiscount
        ? schoolFeesService.discountPeriod(feePeriods, period.id, v, reason.trim())
        : schoolFeesService.writeOffPeriod(feePeriods, period.id, v, reason.trim());
      setFeePeriods(updated);
      onClose();
    } catch(e) { setError(e.message); }
  };

  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="80vh" padding="20px 16px 48px" zIndex={360}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
        <div>
          <div style={{ color:isDiscount?T.accent:T.warn,fontSize:10,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" }}>School fee adjustment</div>
          <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>{isDiscount?"Record a discount":"Write off an amount"}</div>
        </div>
        <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
      </div>
      <div style={{ color:T.sub,fontSize:11.5,lineHeight:1.55,marginBottom:14 }}>
        {isDiscount
          ? "The school is charging less than the schedule says. This reduces the obligation and is not a payment — it will not appear in payment history."
          : "Arth will never collect this amount. A write-off is not a payment and not a discount from the school."}
      </div>
      <span style={lbl}>Period</span>
      <div style={{ ...inp,display:"flex",alignItems:"center",marginBottom:10 }}>{period?.label || "Select a period"}</div>
      <span style={lbl}>Amount</span>
      <input style={{ ...inp,fontSize:20,fontWeight:700,fontFamily:"monospace" }} type="number" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)}/>
      <span style={{ ...lbl,marginTop:10 }}>Reason</span>
      <input style={inp} placeholder="e.g. Sibling concession" value={reason} onChange={e=>setReason(e.target.value)}/>
      {error && <div style={{ color:T.warn,fontSize:11,marginTop:10 }}>{error}</div>}
      <button onClick={confirm} style={{ width:"100%",padding:14,borderRadius:12,background:T.accent,border:"none",fontSize:13.5,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"Nunito,sans-serif",marginTop:14 }}>{isDiscount?"Record discount":"Record write-off"}</button>
    </BottomSheet>
  );
};

// ============================================================================
// Credit Note — create, standalone from any period; apply, explicit only
// ============================================================================

export const CreditNoteModal = ({ schedule, feePeriods, setFeePeriods, schoolCreditNotes, setSchoolCreditNotes, onClose, T, inp, lbl }) => {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const create = () => {
    setError("");
    const v = parseInt(amount||"0",10);
    if(!v || !reason.trim()) { setError("Amount and reason are both required."); return; }
    try {
      const note = schoolFeesService.createCreditNote(schedule.id, v, reason.trim(), genId);
      setSchoolCreditNotes(prev=>[note, ...prev]);
      onClose();
    } catch(e) { setError(e.message); }
  };

  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="80vh" padding="20px 16px 48px" zIndex={360}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
        <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>New Credit Note</div>
        <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
      </div>
      <div style={{ color:T.sub,fontSize:11.5,lineHeight:1.55,marginBottom:14 }}>A credit note is a separate fact from any payment. It never touches a historical transaction, and is never applied automatically — you choose where it goes.</div>
      <span style={lbl}>Amount</span>
      <input style={{ ...inp,fontSize:20,fontWeight:700,fontFamily:"monospace" }} type="number" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)}/>
      <span style={{ ...lbl,marginTop:10 }}>Reason</span>
      <input style={inp} placeholder="e.g. School issued a refund credit" value={reason} onChange={e=>setReason(e.target.value)}/>
      {error && <div style={{ color:T.warn,fontSize:11,marginTop:10 }}>{error}</div>}
      <button onClick={create} style={{ width:"100%",padding:14,borderRadius:12,background:T.accent,border:"none",fontSize:13.5,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"Nunito,sans-serif",marginTop:14 }}>Create Credit Note</button>
    </BottomSheet>
  );
};
