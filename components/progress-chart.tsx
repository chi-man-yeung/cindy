'use client';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
export interface ProgressPoint {id:string;date:number;reps:number}
export default function ProgressChart({data}:{data:ProgressPoint[]}) {
 if(!data.length)return <p className="empty-state">Save a workout in this configuration to see your progress.</p>;
 return <div className="chart" role="img" aria-label={`Total reps by session: ${data.map(p=>`${new Date(p.date).toLocaleString()}: ${p.reps} reps`).join('; ')}`}>
  <ResponsiveContainer width="100%" height="100%" minWidth={0}><AreaChart data={data} margin={{top:15,right:10,bottom:0,left:-24}}>
   <defs><linearGradient id="navy" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.18}/><stop offset="100%" stopColor="var(--accent)" stopOpacity={0}/></linearGradient></defs>
   <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5"/>
   <XAxis dataKey="date" type="number" domain={['dataMin','dataMax']} tickFormatter={date=>new Date(date).toLocaleDateString(undefined,{month:'short',day:'numeric'})} tick={{fill:'var(--muted)',fontSize:11}} axisLine={false} tickLine={false} minTickGap={25}/>
   <YAxis domain={[0,'auto']} allowDecimals={false} tick={{fill:'var(--muted)',fontSize:11}} axisLine={false} tickLine={false}/>
   <Tooltip labelFormatter={date=>new Date(Number(date)).toLocaleString()} contentStyle={{background:'var(--bg)',border:'1px solid var(--line)',borderRadius:8,color:'var(--text)'}} formatter={value=>[`${value} reps`,'Score']}/>
   <Area type="linear" dataKey="reps" stroke="var(--accent)" strokeWidth={2} fill="url(#navy)" dot={{r:4,fill:'var(--accent)',strokeWidth:0}} isAnimationActive={false}/>
  </AreaChart></ResponsiveContainer>
 </div>;
}
