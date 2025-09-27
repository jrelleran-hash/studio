
import { Timestamp, DocumentReference } from "firebase/firestore";

export interface Activity {
  id: string;
  title: string;
  timestamp: Timestamp;
  details: string;
  icon: "ShoppingCart" | "UserPlus" | "Package";
}

export interface Notification {
  id:string;
  title: string;
  description: string;
  details: string;
  href: string;
  timestamp: Timestamp;
  read: boolean;
  icon?: "ShoppingCart" | "UserPlus" | "Package" | "Truck" | "RefreshCcw" | "ClipboardCheck";
}

export interface Client {
    id: string;
    projectName: string;
    clientName: string;
    boqNumber: string;
    address: string;
    createdAt: Timestamp;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  createdAt: Timestamp;
  cellphoneNumber?: string;
}

export interface ProductHistory {
    date: string; // YYYY-MM-DD
    stock: number;
    dateUpdated: Timestamp;
    changeReason?: string;
}

export type ProductCategory = "Tools" | "Consumables" | "Raw Materials" | "Finished Goods" | "Other";

export interface Product {
    id:string;
    name: string;
    sku: string;
    category: ProductCategory;
    stock: number;
    price: number;
    reorderLimit: number;
    maxStockLevel: number;
    location?: string;
    supplier?: string;
    history?: ProductHistory[];
    lastUpdated?: Timestamp;
    photoURL?: string;
}

export interface OrderItem {
    quantity: number;
    price: number; // Price at the time of order
    product: Product;
    status: 'Ready for Issuance' | 'Awaiting Purchase' | 'Fulfilled' | 'PO Pending';
}

export interface Backorder {
    id: string;
    orderId: string;
    orderRef: DocumentReference | null;
    clientRef: DocumentReference | null;
    productId: string;
    productRef: DocumentReference;
    productName: string;
    productSku: string;
    quantity: number;
    date: Timestamp;
    status: 'Pending' | 'Ordered' | 'Fulfilled';
    purchaseOrderId?: string;
    parentBackorderId?: string;
}


export interface Order {
    id: string;
    date: Date;
    status: "Processing" | "Awaiting Purchase" | "Ready for Issuance" | "Fulfilled" | "Cancelled" | "Partially Fulfilled" | "Shipped" | "Completed" | "Delivered";
    total: number;
    client: Client;
    items: OrderItem[];
    reorderedFrom?: string;
}

export interface PurchaseOrderItem {
    quantity: number;
    product: Product;
}

export interface PurchaseOrder {
    id: string;
    supplier: Supplier;
    client?: Client;
    items: PurchaseOrderItem[];
    status: "Pending" | "Shipped" | "Delivered" | "Completed" | "Cancelled" | "PO Shipped" | "PO Delivered";
    orderDate: Date;
    expectedDate?: Date;
    receivedDate?: Date;
    poNumber: string;
    docRef?: DocumentReference;
    clientRef?: DocumentReference;
    backorderRef?: DocumentReference;
}

export interface IssuanceItem {
    quantity: number;
    product: Product;
}

export interface Issuance {
    id: string;
    issuanceNumber: string;
    date: Date;
    client: Client;
    items: IssuanceItem[];
    remarks?: string;
    issuedBy: string;
    receivedBy?: string;
    orderId?: string;
}

export interface Shipment {
    id: string;
    shipmentNumber: string;
    issuance: Issuance;
    status: "Pending" | "In Transit" | "Delivered" | "Delayed" | "Cancelled";
    shippingProvider: string;
    trackingNumber?: string;
    estimatedDeliveryDate?: Date;
    actualDeliveryDate?: Date;
    createdAt: Date;
}

export interface ReturnItem {
    productId: string;
    name: string;
    sku: string;
    quantity: number;
}

export interface Return {
    id: string;
    rmaNumber: string;
    issuanceId: string;
    issuanceNumber: string;
    client: Client;
    items: ReturnItem[];
    reason: string;
    status: "Pending" | "Received" | "Completed" | "Cancelled";
    dateInitiated: Date;
    dateReceived?: Date;
    processedBy?: string;
    inspection?: {
      date: Timestamp;
      items: {
        productId: string;
        restockQuantity: number;
        disposalQuantity: number;
      }[];
    }
}

export interface OutboundReturnItem {
    productId: string;
    name: string;
    sku: string;
    quantity: number;
}

export interface OutboundReturn {
    id: string;
    rtsNumber: string; // Return to Supplier
    purchaseOrderId: string;
    poNumber: string;
    supplier: Supplier;
    items: OutboundReturnItem[];
    reason: string;
    status: "Pending" | "Shipped" | "Completed" | "Cancelled";
    dateInitiated: Date;
    dateShipped?: Date;
}

export type UserRole = "Admin" | "Manager" | "Staff";
export type PagePermission = "/" | "/clients" | "/logistics" | "/analytics" | "/orders" | "/purchase-orders" | "/suppliers" | "/inventory" | "/issuance" | "/returns" | "/quality-control" | "/reports";

export interface UserProfile {
    uid: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    permissions: PagePermission[];
}
