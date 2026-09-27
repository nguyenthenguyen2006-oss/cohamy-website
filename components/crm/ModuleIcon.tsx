"use client";
import {
  AddressBook,
  Storefront,
  Package,
  ShoppingCart,
  Warehouse,
  Handshake,
  Bank,
  Money,
  ChartBar,
  UserList,
  CheckSquare,
  Lightning,
  Bell,
  MagnifyingGlass,
  Database,
  BookOpen,
  Headset,
  ShieldCheck,
  Link as LinkIcon,
  ClockCounterClockwise,
  Truck,
  Tag,
  FileText,
  Users,
  type IconProps,
} from "@phosphor-icons/react";
import type { ModuleIcon } from "@/lib/crm/modules";

const icons: Record<string, React.ComponentType<IconProps>> = {
  customer: AddressBook,
  dealer: Storefront,
  goods: Package,
  order: ShoppingCart,
  warehouse: Warehouse,
  consignment: Handshake,
  debt: Bank,
  cash: Money,
  report: ChartBar,
  account: UserList,
  tasks: CheckSquare,
  automation: Lightning,
  notifications: Bell,
  search: MagnifyingGlass,
  data: Database,
  library: BookOpen,
  support: Headset,
  applications: ShieldCheck,
  invitations: LinkIcon,
  audit: ClockCounterClockwise,
  procurement: Truck,
  pricing: Tag,
  quotations: FileText,
  members: Users,
  cart: ShoppingCart,
};

export function CrmModuleIcon({ name, ...props }: IconProps & { name: ModuleIcon }) {
  const Icon = icons[name] || ChartBar;
  return <Icon {...props} />;
}
