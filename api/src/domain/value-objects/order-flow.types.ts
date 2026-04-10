import { OrderFlowState } from '../enums/order-flow-state.enum.js';

export interface OrderFlowItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  notes?: string;
}

export interface OrderFlowData {
  state: OrderFlowState;
  items: OrderFlowItem[];
  deliveryType: 'delivery' | 'pickup' | null;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  estimatedTotal: number | null;
  currency: string | null;
  paymentMethod: string | null;
  customerName: string | null;
  customerPhone: string | null;
  neighborhood: string | null;
  deliveryCost: number | null;
  source: 'web' | 'conversation' | null;
  menuImageSent: boolean;
  updatedAt: Date;
}

export type CustomerInputIntent =
  | 'add_items'
  | 'set_delivery_type'
  | 'set_address'
  | 'set_payment_method'
  | 'confirm_order'
  | 'cancel_order'
  | 'modify_items'
  | 'browse_menu'
  | 'track_order'
  | 'other';

export interface CustomerInput {
  intent: CustomerInputIntent;
  items?: OrderFlowItem[];
  deliveryType?: 'delivery' | 'pickup';
  address?: string;
  deliveryNotes?: string;
  estimatedTotal?: number;
  currency?: string;
  confirmed?: boolean;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
  neighborhood?: string;
  deliveryCost?: number;
  source?: 'web' | 'conversation';
}

export interface TransitionResult {
  newFlow: OrderFlowData;
  directive: string;
  shouldCreateOrder: boolean;
  orderData?: {
    items: OrderFlowItem[];
    type: 'delivery' | 'pickup';
    address?: string;
    notes?: string;
    total?: number;
    currency?: string;
    paymentMethod?: string;
    customerName?: string;
    customerPhone?: string;
    deliveryCost?: number;
    neighborhood?: string;
  };
}

export interface LastOrderDefaults {
  deliveryType?: 'delivery' | 'pickup';
  deliveryAddress?: string;
  neighborhood?: string;
  paymentMethod?: string;
  customerName?: string;
  deliveryCost?: number;
}

export function createDefaultOrderFlow(): OrderFlowData {
  return {
    state: OrderFlowState.IDLE,
    items: [],
    deliveryType: null,
    deliveryAddress: null,
    deliveryNotes: null,
    estimatedTotal: null,
    currency: null,
    paymentMethod: null,
    customerName: null,
    customerPhone: null,
    neighborhood: null,
    deliveryCost: null,
    source: null,
    menuImageSent: false,
    updatedAt: new Date(),
  };
}
