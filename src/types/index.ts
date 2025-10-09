
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

export interface ProductLocation {
    zone?: string;
    aisle?: string;
    rack?: string;
    level?: string;
    bin?: string;
}

export interface Product {
    id:string;
    name: string;
    sku: string;
    category: ProductCategory;
    stock: number;
    price: number;
    reorderLimit: number;
    maxStockLevel: number;
    location?: ProductLocation;
    supplier?: string;
    history?: ProductHistory[];
    lastUpdated?: Timestamp;
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

export interface PaymentMilestone {
    name: string;
    percentage: number;
    amount: number;
    status: 'Pending' | 'Paid';
    receivedDate?: Timestamp;
}

export interface Order {
    id: string;
    date: Date;
    status: "Processing" | "Awaiting Purchase" | "Ready for Issuance" | "Fulfilled" | "Cancelled" | "Partially Fulfilled" | "Shipped" | "Completed" | "Delivered";
    total: number;
    client: Client;
    items: OrderItem[];
    reorderedFrom?: string;
    purpose?: string;
    paymentMilestones?: PaymentMilestone[];
    clientRef?: DocumentReference;
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
    status: "Pending" | "Shipped" | "Delivered" | "Completed" | "Cancelled";
    paymentStatus: "Unpaid" | "Paid";
    orderDate: Date;
    expectedDate?: Date;
    receivedDate?: Date;
    poNumber: string;
    docRef?: DocumentReference;
    clientRef?: DocumentReference;
    backorderRef?: DocumentReference;
    total: number;
    supplierRef?: DocumentReference;
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
export type PagePermission = "/" | "/clients" | "/logistics" | "/analytics" | "/orders" | "/purchase-orders" | "/suppliers" | "/inventory" | "/issuance" | "/returns" | "/quality-control" | "/settings" | "/warehouse" | "/tools" | "/tool-maintenance" | "/waste-management" | "/logistics-booking" | "/tool-booking" | "/vehicles" | "/production" | "/general-ledger" | "/accounts-payable" | "/daily-labor" | "/fabrication";

export interface UserProfile {
    uid: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    permissions: PagePermission[];
    dailyRate?: number;
}

export interface Tool {
    id: string;
    name: string;
    serialNumber: string;
    status: 'Available' | 'In Use' | 'Under Maintenance' | 'Assigned';
    condition: 'Good' | 'Needs Repair' | 'Damaged';
    category?: string;
    purchaseDate?: Date;
    purchaseCost?: number;
    location?: ProductLocation;
    borrowDuration?: number; // Duration in days
    createdAt: Timestamp;
    currentBorrowRecord?: ToolBorrowRecord | null;
    assignedToUserId?: string | null;
    assignedToUserName?: string | null;
}

export interface ToolBorrowRecord {
    id: string;
    toolId: string;
    borrowedBy: string; // User ID
    borrowedByName: string; // User's full name
    dateBorrowed: Date;
    dueDate?: Date;
    dateReturned?: Date;
    notes?: string;
    returnCondition?: Tool['condition'];
    releasedBy?: string; // Name of the user who released the tool
}

export interface SalvagedPart {
    id: string;
    originalToolId: string;
    originalToolName: string;
    partName: string;
    quantity: number;
    condition: 'Good' | 'Usable' | 'Poor';
    salvageDate: Timestamp;
    notes?: string;
}

export interface DisposalRecord {
    id: string;
    itemId: string;
    itemName: string;
    itemIdentifier?: string;
    itemType: 'product' | 'tool';
    reason: 'For Parts Out' | 'Recycle' | 'Dispose';
    date: Date;
    source?: string;
    notes?: string;
}

export interface ToolMaintenanceRecord {
    id: string;
    toolId: string;
    toolName: string;
    serialNumber: string;
    dateEntered: Date;
    outcome: "Repaired" | "Disposed";
}

export interface ToolBookingRequest {
    id: string;
    toolId: string;
    toolName: string;
    requestedById: string;
    requestedByName: string;
    startDate: Date;
    endDate: Date;
    notes: string;
    status: 'Pending' | 'Approved' | 'Rejected';
    createdAt: Date;
}

export interface Vehicle {
    id: string;
    type: string;
    plateNumber: string;
    make: string;
    model: string;
    year: number;
    status: "Available" | "In Use" | "Under Maintenance";
    weightLimit?: string;
    sizeLimit?: string;
    description?: string;
    createdAt: Timestamp;
}

export interface Transaction {
  id: string;
  date: Timestamp;
  description: string;
  account: string;
  debit?: number;
  credit?: number;
  balance: number;
  entity?: string;
}

export interface LaborEntry {
    id: string;
    date: Date;
    userId: string;
    userName: string;
    clientId: string;
    projectName: string;
    hoursWorked: number;
    cost: number;
}

export interface Expense {
    id: string;
    date: Date;
    clientId?: string;
    projectName?: string;
    category: string;
    description: string;
    payee: string;
    amount: number;
    paymentMode: string;
}

export interface MaterialRequisitionItem {
    productRef: DocumentReference;
    quantity: number;
}

export interface MaterialRequisition {
    id: string;
    mrfNumber: string;
    projectRef: DocumentReference | null;
    projectName?: string;
    requestedByRef: DocumentReference;
    requestedByName?: string;
    date: Timestamp;
    status: 'Pending' | 'Approved' | 'Rejected' | 'Fulfilled';
    items: MaterialRequisitionItem[];
}

export interface JobOrderItem {
    id: string;
    productRef: DocumentReference;
    quantity: number;
    status: 'Pending' | 'In Progress' | 'Completed' | 'QC Passed' | 'Dispatched';
}

export interface JobOrder {
    id: string;
    jobOrderNumber: string;
    materialRequisitionRef: DocumentReference;
    projectRef: DocumentReference | null;
    projectName?: string;
    assignedToRef?: DocumentReference;
    assignedToName?: string;
    date: Timestamp;
    status: 'Pending' | 'In Progress' | 'Completed' | 'QC Passed' | 'Dispatched';
    items: JobOrderItem[];
}
