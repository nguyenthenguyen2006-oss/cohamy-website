"use client";
import { AddressBook, Storefront, Package, ShoppingCart, Warehouse, Handshake, Bank, Money, ChartBar, UserList, type IconProps } from "@phosphor-icons/react";
import type { ModuleIcon } from "@/lib/crm/modules";
const icons = { customer: AddressBook, dealer: Storefront, goods: Package, order: ShoppingCart, warehouse: Warehouse, consignment: Handshake, debt: Bank, cash: Money, report: ChartBar, account: UserList };
export function CrmModuleIcon({ name, ...props }: IconProps & { name: ModuleIcon }) { const Icon = icons[name]; return <Icon {...props} />; }
