import { ArrowUpRight } from 'lucide-react';
export function Eyebrow({children}: {children:React.ReactNode}) { return <p className="eyebrow">{children}</p> }
export function SectionTitle({title,detail}: {title:string;detail?:string}) { return <div className="section-title"><h2>{title}</h2>{detail && <span>{detail}</span>}</div> }
export function Stat({label,value,unit}: {label:string;value:React.ReactNode;unit?:string}) { return <div className="stat"><Eyebrow>{label}</Eyebrow><div className="stat-value">{value}{unit && <span>{unit}</span>}</div></div> }
export function PrimaryButton({children,onClick,disabled=false}: {children:React.ReactNode;onClick:()=>void;disabled?:boolean}) { return <button className="primary" onClick={onClick} disabled={disabled}>{children}<ArrowUpRight size={22}/></button> }
