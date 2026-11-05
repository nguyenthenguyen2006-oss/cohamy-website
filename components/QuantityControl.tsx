'use client';

import {useState} from 'react';
import {useLocale} from 'next-intl';
import {Minus,Plus} from 'lucide-react';
import type {Locale} from '@/lib/types';
import './product-purchase.css';

const labels={
  vi:{decrease:'Giảm',increase:'Tăng'},
  en:{decrease:'Decrease',increase:'Increase'},
  zh:{decrease:'减少',increase:'增加'},
  ko:{decrease:'줄이기',increase:'늘리기'},
  ja:{decrease:'減らす',increase:'増やす'},
} as const;
const bounded=(value:number)=>Number.isFinite(value)?Math.min(100,Math.max(1,Math.trunc(value))):1;

export function QuantityControl({value,onChange,label,disabled=false,compact=false}:{value:number;onChange:(value:number)=>void;label:string;disabled?:boolean;compact?:boolean}) {
  const locale=useLocale() as Locale,copy=labels[locale];
  const [draft,setDraft]=useState<string|null>(null);
  const current=bounded(value);
  function update(next:number){setDraft(null);onChange(bounded(next));}
  function commit(){if(draft!==null)update(Number(draft));}
  return <div className={`quantity-control${compact?' quantity-control--compact':''}`} role="group" aria-label={label}>
    <button type="button" disabled={disabled||current<=1} aria-label={`${copy.decrease} ${label}`} onClick={()=>update(current-1)}><Minus size={20} aria-hidden="true"/></button>
    <input type="number" inputMode="numeric" min={1} max={100} step={1} value={draft??current} aria-label={label} disabled={disabled}
      onChange={event=>{
        const raw=event.currentTarget.value;
        if(raw===''){setDraft('');return;}
        const next=bounded(Number(raw));setDraft(String(next));onChange(next);
      }}
      onBlur={commit}
      onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();commit();}}}
    />
    <button type="button" disabled={disabled||current>=100} aria-label={`${copy.increase} ${label}`} onClick={()=>update(current+1)}><Plus size={20} aria-hidden="true"/></button>
  </div>;
}
