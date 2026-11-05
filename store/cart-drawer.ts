'use client';

import {create} from 'zustand';

// Presentation state only. Opening a browser cart is never a CRM command.
export const useCartDrawerStore=create<{open:boolean;openCart:()=>void;closeCart:()=>void}>()(set=>({
  open:false,
  openCart:()=>set({open:true}),
  closeCart:()=>set({open:false}),
}));
