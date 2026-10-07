// Conservative reservations, not a claim to know final provider billing.
export function spendSummary(p){
 const generation=p.jobs.filter(j=>j.status!=='planned').reduce((n,j)=>n+j.plan.estimatedCostUsd,0);
 const inference=(p.budget?.reservations??[]).reduce((n,r)=>n+r.estimatedCostUsd,0);
 const limit=p.budget?.maxCostUsd??0;
 return {limitUsd:limit,generationReservedUsd:generation,inferenceReservedUsd:inference,totalReservedUsd:generation+inference,remainingUsd:Math.max(0,limit-generation-inference),basis:'authorized estimates; final provider billing unverified'};
}
export function requireBudget(p,cost){
 if(p.reviewMode!=='supervised')return;
 if(!Number.isFinite(cost)||cost<=0)throw new Error('ACCOUNT_ESTIMATE_REQUIRED: supply a positive sourced request estimate.');
 if(spendSummary(p).totalReservedUsd+cost>(p.budget?.maxCostUsd??0)+1e-9)throw new Error('PROJECT_BUDGET_EXCEEDED: no provider request is permitted; obtain an explicit human budget increase.');
}
