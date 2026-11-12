export interface ExerciseBreakdown {pullUps:number;pushUps:number;airSquats:number}
export function breakdown(reps:number):ExerciseBreakdown {
 if(!Number.isInteger(reps)||reps<0||reps>30)throw new RangeError('Enter 0–30 reps.');
 return {pullUps:Math.min(reps,5),pushUps:Math.min(Math.max(reps-5,0),10),airSquats:Math.max(reps-15,0)};
}
export function partialTotal(b:ExerciseBreakdown):number {
 if(![b.pullUps,b.pushUps,b.airSquats].every(Number.isInteger)||b.pullUps<0||b.pullUps>5||b.pushUps<0||b.pushUps>10||b.airSquats<0||b.airSquats>15||(b.pushUps>0&&b.pullUps!==5)||(b.airSquats>0&&(b.pullUps!==5||b.pushUps!==10)))throw new RangeError('Complete pull-ups, then push-ups, then squats.');
 return b.pullUps+b.pushUps+b.airSquats;
}
