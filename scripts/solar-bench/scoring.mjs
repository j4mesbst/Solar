import {dimensionWeights} from './advanced-private.mjs';

const round=value=>Math.round(value*10)/10;
export function scoreChecks(checks,criteria=[]){
  const byId=new Map(checks.map(check=>[check.criterionId,check]));
  const dimensions={};let measuredWeight=0,weighted=0;
  for(const [dimension,weight] of Object.entries(dimensionWeights)){
    const applicable=criteria.filter(item=>item.dimension===dimension);
    const measured=applicable.filter(item=>byId.has(item.id)&&byId.get(item.id).status!=='unavailable');
    const possible=measured.reduce((sum,item)=>sum+item.points,0);
    const earned=measured.reduce((sum,item)=>sum+(byId.get(item.id)?.status==='passed'?item.points:0),0);
    const score=possible?round(earned/possible*100):undefined;
    dimensions[dimension]={weight,score,earned,possible,unmeasured:applicable.filter(item=>!measured.includes(item)).map(item=>item.id)};
    if(score!==undefined){measuredWeight+=weight;weighted+=score*weight;}
  }
  const quality=measuredWeight>=70?round(weighted/measuredWeight):undefined;
  return {quality,measuredWeight,dimensions,criteria:criteria.map(item=>({ ...item,status:byId.get(item.id)?.status??'unavailable',output:byId.get(item.id)?.output }))};
}

export function summarizeScores(results){
  const measured=results.filter(result=>Number.isFinite(result.quality));
  const categoryScores=Object.fromEntries([...new Set(results.map(result=>result.domain))].map(domain=>{
    const values=measured.filter(result=>result.domain===domain).map(result=>result.quality);
    return [domain,values.length?round(values.reduce((a,b)=>a+b,0)/values.length):undefined];
  }));
  const sufficient=results.length>0&&measured.length===results.length;
  return {quality:sufficient?round(measured.reduce((a,b)=>a+b.quality,0)/measured.length):undefined,measured:measured.length,total:results.length,categoryScores};
}
