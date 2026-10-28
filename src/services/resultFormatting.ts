/** Presentation only: exact numeric values remain available to assistive tech. */
export function compactCount(value:number){
 if(!Number.isFinite(value)||value<0)return '—';
 const scale=value>=999950?1e6:value>=1000?1e3:1;
 return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:scale===1?0:1}).format(value/scale)+(scale===1e6?'M':scale===1e3?'K':'');
}
export function resultDate(value?:string,timeOnly=false){
 if(!value)return '';
 const allDay=/^\d{4}-\d{2}-\d{2}$/.test(value);
 const date=new Date(allDay?value+'T12:00:00':value);
 if(!Number.isFinite(date.valueOf()))return '';
 return new Intl.DateTimeFormat('fr-FR',allDay?{weekday:'long',day:'numeric',month:'long'}:timeOnly?{hour:'2-digit',minute:'2-digit'}:{weekday:'long',day:'numeric',month:'long'}).format(date);
}
