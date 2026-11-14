import {openWorkoutDatabase} from './storage';
import {canonicalConfiguration,isCustomEmom,validConfiguration} from './custom-config';
import type {WorkoutConfiguration} from './engine';
export interface TrainingPreset {schemaVersion:1;id:string;name:string;configuration:WorkoutConfiguration;createdAt:number;updatedAt:number}
function validate(value:TrainingPreset):TrainingPreset{
 if(!value||value.schemaVersion!==1||typeof value.id!=='string'||!value.id||value.id.length>200||typeof value.name!=='string'||!value.name.trim()||value.name.length>80||!validConfiguration(value.configuration)||!isCustomEmom(value.configuration)||!Number.isSafeInteger(value.createdAt)||value.createdAt<0||!Number.isSafeInteger(value.updatedAt)||value.updatedAt<value.createdAt)throw new Error('Invalid training preset.');
 return {...value,name:value.name.trim(),configuration:canonicalConfiguration(value.configuration)};
}
export async function listPresets():Promise<TrainingPreset[]>{
 const db=await openWorkoutDatabase();return new Promise((resolve,reject)=>{
  const tx=db.transaction('presets');const request=tx.objectStore('presets').getAll();
  tx.oncomplete=()=>{try{resolve(request.result.map(validate).sort((a,b)=>b.updatedAt-a.updatedAt))}catch(e){reject(e)}};
  tx.onerror=tx.onabort=()=>reject(tx.error??new Error('Could not load presets.'));
 });
}
export async function savePreset(name:string,configuration:WorkoutConfiguration,id?:string):Promise<TrainingPreset>{
 const now=Date.now();const candidate=validate({schemaVersion:1,id:id??crypto.randomUUID(),name,configuration,createdAt:now,updatedAt:now});
 const db=await openWorkoutDatabase();return new Promise((resolve,reject)=>{
  const tx=db.transaction('presets','readwrite');const store=tx.objectStore('presets');const old=store.get(candidate.id);let result=candidate;let failure:Error|null=null;
  old.onsuccess=()=>{try{result=validate({...candidate,createdAt:old.result?.createdAt??now,updatedAt:Math.max(now,old.result?.updatedAt??now)});store.put(result,result.id)}catch(error){failure=error as Error;tx.abort()}};
  tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(failure??tx.error??new Error('Preset was not saved.'));
 });
}
