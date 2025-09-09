

import { Timestamp, DocumentReference } from "firebase/firestore";

export interface Activity {
  id: string;
  title: string;
  timestamp: Timestamp;
  details: string;
  icon: "ShoppingCart" | "UserPlus" | "Package";
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  details: string;
  href: string;
  timestamp: Timestamp;
  read: boolean;
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
  cellphoneNumber?: string;
  address: string;
  createdAt: Timestamp;
}

export interface ProductHistory {
    date: string; // YYYY-MM-DD
    stock: number;
    dateUpdated: Timestamp;
}

export interface Product {
    id:string;
    name: string;
    sku: string;
    stock: number;
    price: number;
    reorderLimit: number;
    location?: string;
    supplier?: string;
    history?: ProductHistory[];
    lastUpdated?: Timestamp;
}

export interface OrderItem {
    quantity: number;
    price: number; // Price at the time of order
    product: Product;
}

export interface Order {
    id: string;
    date: Date;
    status: "Processing" | "Awaiting Purchase" | "Ready for Issuance" | "Fulfilled" | "Cancelled";
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
    items: PurchaseOrderItem[];
    status: "Pending" | "Shipped" | "Received";
    orderDate: Date;
    expectedDate?: Date;
    receivedDate?: Date;
    poNumber: string;
    docRef?: DocumentReference;
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
    orderId?: string;
}
