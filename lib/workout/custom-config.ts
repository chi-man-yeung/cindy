import type {WorkoutConfiguration} from './engine';
export const TRAINING_EXERCISES=['pull-ups','push-ups','air-squats','sit-ups','burpees','lunges'] as const;
export const exerciseLabel=(name:string)=>({'pull-ups':'Pull-ups','push-ups':'Push-ups','air-squats':'Squats','sit-ups':'Sit-ups',burpees:'Burpees',lunges:'Lunges (total reps)'}[name]??name);
export const isCustomEmom=(c:{id:string})=>c.id==='custom-emom-v1';
export function validConfiguration(value:unknown):value is WorkoutConfiguration {
 if(!value||typeof value!=='object')return false;
 const c=value as WorkoutConfiguration;
 if(typeof c.id!=='string'||!c.id||c.id.length>200||!Number.isFinite(c.durationMs)||c.durationMs<1000||c.durationMs>86400000||c.preparationMs!==5000||!Array.isArray(c.movements))return false;
 if(isCustomEmom(c))return c.training?.kind==='custom-emom'&&[60000,90000].includes(c.training.intervalMs)&&Number.isInteger(c.durationMs/60000)&&c.durationMs>=300000&&c.durationMs<=1800000&&c.movements.length>=1&&c.movements.length<=12&&c.movements.every(m=>m&&TRAINING_EXERCISES.includes(m.name as typeof TRAINING_EXERCISES[number])&&Number.isInteger(m.reps)&&m.reps>=1&&m.reps<=1000)&&c.repsPerRound===c.movements.reduce((sum,m)=>sum+m.reps,0);
 return !c.training&&c.repsPerRound===30&&c.movements.length===3&&c.movements.every((m,i)=>m&&m.name===['pull-ups','push-ups','air-squats'][i]&&m.reps===[5,10,15][i]);
}
export function customConfiguration(minutes:number,intervalSeconds:number,movements:{name:string;reps:number}[]):WorkoutConfiguration {
 const c:WorkoutConfiguration={id:'custom-emom-v1',durationMs:minutes*60000,preparationMs:5000,training:{kind:'custom-emom',intervalMs:intervalSeconds*1000 as 60000|90000},movements:movements.map(m=>({...m})),repsPerRound:movements.reduce((sum,m)=>sum+m.reps,0)};
 if(!validConfiguration(c))throw new Error('Choose 5–30 whole minutes, 60/90-second intervals and 1–12 exercises with 1–1,000 reps each.');
 return c;
}
export const DEFAULT_CUSTOM=customConfiguration(10,60,[{name:'pull-ups',reps:5},{name:'push-ups',reps:10}]);
export function canonicalConfiguration(c:WorkoutConfiguration):WorkoutConfiguration{
 return {id:c.id,durationMs:c.durationMs,preparationMs:5000,repsPerRound:c.repsPerRound,movements:c.movements.map(m=>({name:m.name,reps:m.reps})),...(isCustomEmom(c)?{training:{kind:'custom-emom' as const,intervalMs:c.training!.intervalMs}}:{})};
}
