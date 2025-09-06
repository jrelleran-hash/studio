
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

export interface Customer {
    id: string;
    projectName: string;
    clientName: string;
    boqNumber: string;
    address: string;
}

export interface Product {
    id:string;
    name: string;
    sku: string;
    stock: number;
    price: number;
    location?: string;
    imageUrl?: string;
    aiHint?: string;
}

export interface OrderItem {
    quantity: number;
    price: number; // Price at the time of order
    product: Product;
}

export interface Order {
    id: string;
    date: Date;
    status: "Processing" | "Shipped" | "Fulfilled" | "Cancelled";
    total: number;
    customer: Customer;
    items: OrderItem[];
}
