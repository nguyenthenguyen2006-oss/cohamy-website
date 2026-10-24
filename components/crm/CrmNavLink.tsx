'use client';
import NextLink, { useLinkStatus } from 'next/link';
import { useState, type ComponentProps } from 'react';

function PendingNavigation() {
  const { pending } = useLinkStatus();
  return pending ? <span className="crm-navigation-progress" role="status"><span className="sr-only">Đang mở trang…</span></span> : null;
}

/** Avoid fetching dozens of private workspaces simply because the sidebar is visible. */
export function CrmNavLink({href,children,prefetch,onMouseEnter,onMouseLeave,onFocus,onBlur,onPointerDown,...props}:ComponentProps<typeof NextLink>) {
  const [intent,setIntent]=useState(false);
  const internal=typeof href==='string'&&(href==='/crm'||href.startsWith('/crm/'));
  const warm=()=>{
    if(internal&&prefetch!==false)setIntent(true);
  };
  return <NextLink {...props} href={href} prefetch={internal?intent&&prefetch!==false:prefetch}
    onMouseEnter={event=>{onMouseEnter?.(event);if(!event.defaultPrevented)warm();}}
    onMouseLeave={event=>{onMouseLeave?.(event);setIntent(false);}}
    onFocus={event=>{onFocus?.(event);if(!event.defaultPrevented)warm();}}
    onBlur={event=>{onBlur?.(event);setIntent(false);}}
    onPointerDown={event=>{onPointerDown?.(event);if(!event.defaultPrevented&&event.pointerType==='touch')warm();}}>
    {children}{internal&&<PendingNavigation/>}
  </NextLink>;
}
