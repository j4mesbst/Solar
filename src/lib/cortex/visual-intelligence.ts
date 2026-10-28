import type { CortexVerification, RenderReport } from './types.ts';

export interface ReferenceRaster {
  width:number;height:number;method:'raster-64x40';
  palette:{rgb:number[];share:number}[];
  cells:{x:number;y:number;width:number;height:number;rgb:number[]}[];
}
export interface ReferenceComparison {
  aspectCompatible:boolean;meanError:number;
  cells:{x:number;y:number;width:number;height:number;error:number}[];
}
export function referenceContext(reference?:ReferenceRaster){
  if(!reference)return '';
  return `RÉFÉRENCE MESURÉE : ${reference.width}×${reference.height}, palette ${JSON.stringify(reference.palette.slice(0,6))}, grille raster ${JSON.stringify(reference.cells)}. Les cellules sont des zones d'échantillonnage, pas des composants reconnus. La géométrie des composants, la typographie et les interactions déduites de l'image restent des interprétations à confirmer par le modèle et le DOM rendu.`;
}
export function compareReference(report:RenderReport,maximumError?:number):CortexVerification[]{
  const observed=report.referenceComparison;
  if(maximumError!==undefined&&(!Number.isFinite(maximumError)||maximumError<0||maximumError>1))throw Error('Tolérance de référence hors limites.');
  if(!observed)return maximumError===undefined?[]:[{type:'visual',origin:'user-requirement',validatorId:'v5-reference',status:'unavailable',success:false,output:'Comparaison raster de référence indisponible.'}];
  const known=Number.isFinite(observed.meanError)&&observed.cells.every(cell=>Number.isFinite(cell.error));
  const comparable=known&&observed.aspectCompatible;
  const success=comparable&&(maximumError===undefined||observed.meanError<=maximumError);
  const regions=[...observed.cells].sort((a,b)=>b.error-a.error).slice(0,4).map(cell=>`zone (${cell.x},${cell.y},${cell.width},${cell.height}) écart=${cell.error.toFixed(3)}`).join('; ');
  return [{type:'visual',origin:maximumError===undefined?'deterministic':'user-requirement',validatorId:'v5-reference',validatorVersion:'1',hardConstraint:maximumError!==undefined,comparable,status:!comparable?'unavailable':success?'passed':'failed',success,measurement:comparable?observed.meanError:undefined,qualityMetrics:comparable?{referenceRasterError:observed.meanError}:undefined,output:`Comparaison raster régionale : ${comparable?regions:'proportions incompatibles ou mesures invalides; ne pas comparer les scores'}. ${maximumError===undefined?'Observation non bloquante, sans jugement esthétique ni localisation sémantique.':`Tolérance utilisateur ${maximumError}.`}`}];
}
