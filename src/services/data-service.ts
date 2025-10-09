

import { db, storage, auth } from "@/lib/firebase";
import { collection, getDocs, getDoc, doc, orderBy, query, limit, Timestamp, where, DocumentReference, addDoc, updateDoc, deleteDoc, arrayUnion, runTransaction, writeBatch, setDoc } from "firebase/firestore";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, createUserWithEmailAndPassword } from "firebase/auth";
import type { Activity, Notification, Order, Product, Client, Issuance, Supplier, PurchaseOrder, Shipment, Return, ReturnItem, OutboundReturn, OutboundReturnItem, UserProfile, OrderItem, PurchaseOrderItem, IssuanceItem, Backorder, UserRole, PagePermission, ProductCategory, ProductLocation, Tool, ToolBorrowRecord, SalvagedPart, DisposalRecord, ToolMaintenanceRecord, ToolBookingRequest, Vehicle, Transaction, LaborEntry, Expense, MaterialRequisition, JobOrder, JobOrderItem, Installation } from "@/types";
import { format, subDays, addDays } from 'date-fns';

function timeSince(date: Date) {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;

  if (interval > 1) {
    return Math.floor(interval) + " years ago";
  }
  interval = seconds / 2592000;
  if (interval > 1) {
    return Math.floor(interval) + " months ago";
  }
  interval = seconds / 86400;
  if (interval > 1) {
    return Math.floor(interval) + " days ago";
  }
  interval = seconds / 3600;
  if (interval > 1) {
    return Math.floor(interval) + " hours ago";
  }
  interval = seconds / 60;
  if (interval > 1) {
    return Math.floor(interval) + " minutes ago";
  }
  return Math.floor(seconds) + " seconds ago";
}

async function resolveDoc<T>(docRef: DocumentReference): Promise<T | null> {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
        console.warn(`Document with ref ${docRef.path} does not exist.`);
        return null;
    }
    return { id: docSnap.id, ...docSnap.data() } as T;
}

// Centralized function to create notifications
async function createNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read' >) {
    try {
        const notificationWithDefaults: Omit<Notification, 'id'> = {
            ...notification,
            timestamp: Timestamp.now(),
            read: false,
        };
        await addDoc(collection(db, "notifications"), notificationWithDefaults);
    } catch (error) {
        console.error("Error creating notification:", error);
    }
}


export async function getRecentActivities(count: number = 4): Promise<(Activity & { time: string })[]> {
  try {
    const activitiesCol = collection(db, "activities");
    const q = query(activitiesCol, orderBy("timestamp", "desc"), limit(count));
    const activitySnapshot = await getDocs(q);
    const activityList = activitySnapshot.docs.map(doc => {
      const data = doc.data();
      const timestamp = (data.timestamp as Timestamp).toDate();
      return { 
        id: doc.id,
        ...data,
        timestamp,
        time: timeSince(timestamp),
      } as (Activity & { time: string });
    });
    return activityList;
  } catch (error) {
    console.error("Error fetching recent activities:", error);
    return [];
  }
}

export async function getNotifications(): Promise<(Notification & { time: string })[]> {
  try {
    const notificationsCol = collection(db, "notifications");
    const q = query(notificationsCol, orderBy("timestamp", "desc"));
    const notificationSnapshot = await getDocs(q);
    const notificationList = notificationSnapshot.docs.map(doc => {
      const data = doc.data() as Omit<Notification, 'id'>;
      const timestamp = (data.timestamp as unknown as Timestamp).toDate();
      return { 
        id: doc.id,
        ...data,
        timestamp,
        time: timeSince(timestamp)
      };
    });
    return notificationList;
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const notificationRef = doc(db, "notifications", notificationId);
    await updateDoc(notificationRef, { read: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw new Error("Failed to mark notification as read.");
  }
}

export async function markAllNotificationsAsRead(): Promise<void> {
  try {
    const notificationsCol = collection(db, "notifications");
    const q = query(notificationsCol, where("read", "==", false));
    const querySnapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    querySnapshot.forEach(doc => {
      batch.update(doc.ref, { read: true });
    });
    
    await batch.commit();
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    throw new Error("Failed to mark notifications as read.");
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    const notificationRef = doc(db, "notifications", notificationId);
    await deleteDoc(notificationRef);
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw new Error("Failed to delete notification.");
  }
}

export async function deleteNotifications(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    notificationIds.forEach(id => {
      const notificationRef = doc(db, "notifications", id);
      batch.delete(notificationRef);
    });
    await batch.commit();
  } catch (error) {
    console.error("Error deleting multiple notifications:", error);
    throw new Error("Failed to delete notifications.");
  }
}


export async function getLowStockProducts(): Promise<Product[]> {
    try {
        const productsCol = collection(db, "inventory");
        const productSnapshot = await getDocs(productsCol);
        const allProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        
        // Firestore cannot compare two fields directly, so we filter in code.
        const lowStockProducts = allProducts.filter(p => p.stock > 0 && p.stock <= p.reorderLimit);
        
        // Sort by how far under the limit they are
        return lowStockProducts.sort((a, b) => (a.stock - a.reorderLimit) - (b.stock - b.reorderLimit));
    } catch (error) {
        console.error("Error fetching low stock products:", error);
        return [];
    }
}

export async function getProducts(): Promise<Product[]> {
    try {
        const productsCol = collection(db, "inventory");
        const q = query(productsCol, orderBy("name", "asc"));
        const productSnapshot = await getDocs(q);
        return productSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                lastUpdated: data.lastUpdated, // Keep as Timestamp
                history: data.history?.map((h: any) => ({...h, dateUpdated: h.dateUpdated})) // Keep as Timestamp
            } as Product;
        });
    } catch (error) {
        console.error("Error fetching products:", error);
        return [];
    }
}

async function checkStockAndCreateNotification(product: Omit<Product, 'id' | 'history'>, productId: string) {
  if (product.stock > 0 && product.stock <= product.reorderLimit) {
    const status = "Low Stock";
    const notification: Omit<Notification, 'id' | 'timestamp' | 'read'> = {
      title: `${status} Alert: ${product.name}`,
      description: `${product.name} is ${status.toLowerCase()}.`,
      details: `Product "${product.name}" (SKU: ${product.sku}) has a stock level of ${product.stock}, which is at or below the reorder limit of ${product.reorderLimit}. Please reorder soon.`,
      href: "/inventory",
      icon: "Package",
    };

    try {
      // Check if a recent, unread, similar notification already exists to avoid spam.
      const notificationsCol = collection(db, "notifications");
      
      const q = query(
        notificationsCol, 
        where('title', '==', notification.title)
      );
      const existingNotifsSnapshot = await getDocs(q);
      
      const hasRecent = existingNotifsSnapshot.docs.some(doc => {
          const data = doc.data();
          if (data.timestamp) {
            const timestamp = (data.timestamp as Timestamp).toMillis();
            const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
            return timestamp > fiveMinutesAgo;
          }
          return false;
      });

      if (!hasRecent) {
        // Use the centralized createNotification function
        await createNotification(notification);
      }
    } catch (error) {
      console.error("Error creating stock notification:", error);
    }
  }
}

export async function addProduct(product: Partial<Omit<Product, 'id' | 'lastUpdated' | 'history' | 'maxStockLevel'>> & { maxStockLevel?: number, location?: Partial<ProductLocation> }): Promise<DocumentReference> {
  try {
    const now = Timestamp.now();
    
    const docRef = doc(collection(db, "inventory")); 
    
    const productWithDefaults = {
      ...product,
      name: product.name || "Unnamed Product",
      sku: product.sku || "",
      category: product.category || "Other",
      stock: product.stock || 0,
      price: product.price || 0,
      reorderLimit: product.reorderLimit || 10,
      maxStockLevel: product.maxStockLevel || 100,
      location: product.location || {},
      supplier: product.supplier || "",
      lastUpdated: now,
      history: [],
    };
    
    await setDoc(docRef, productWithDefaults);
    
    await createNotification({
        title: "New Product Added",
        description: `"${productWithDefaults.name}" was added to inventory.`,
        details: `A new product, ${productWithDefaults.name} (SKU: ${productWithDefaults.sku}), has been created.`,
        href: "/inventory",
        icon: "Package",
    });

    return docRef;
  } catch (error) {
    console.error("Error adding product:", error);
    throw new Error("Failed to add product.");
  }
}


export async function updateProduct(productId: string, productData: Partial<Omit<Product, 'id' | 'sku'>>): Promise<void> {
  try {
    const productRef = doc(db, "inventory", productId);
    const originalDoc = await getDoc(productRef);
    if (!originalDoc.exists()) throw new Error("Product not found");
    const originalData = originalDoc.data() as Product;

    const now = Timestamp.now();
    const updatePayload: any = { ...productData, lastUpdated: now };

    if (productData.stock !== undefined && productData.stock !== originalData?.stock) {
        const newHistoryEntry = {
            date: format(now.toDate(), 'yyyy-MM-dd'),
            stock: productData.stock,
            dateUpdated: now
        };
        updatePayload.history = arrayUnion(newHistoryEntry);
    }


    await updateDoc(productRef, updatePayload);

    const updatedDoc = await getDoc(productRef);
    if(updatedDoc.exists()) {
        const fullProduct = updatedDoc.data() as Product;
        await checkStockAndCreateNotification(fullProduct, productId);
    }
    
  } catch (error) {
    console.error("Error updating product:", error);
    throw new Error("Failed to update product.");
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  try {
    const productRef = doc(db, "inventory", productId);
    await deleteDoc(productRef);
  } catch (error) {
    console.error("Error deleting product:", error);
    throw new Error("Failed to delete product.");
  }
}

export async function adjustStock(productId: string, quantity: number, reason: string): Promise<void> {
    const productRef = doc(db, "inventory", productId);
    const now = Timestamp.now();

    try {
        await runTransaction(db, async (transaction) => {
            const productDoc = await transaction.get(productRef);
            if (!productDoc.exists()) {
                throw new Error("Product not found.");
            }
            const productData = productDoc.data() as Product;
            const newStock = productData.stock + quantity;

            if (newStock < 0) {
                throw new Error("Stock cannot be negative.");
            }

            const newHistoryEntry = {
                date: format(now.toDate(), 'yyyy-MM-dd'),
                stock: newStock,
                changeReason: reason,
                dateUpdated: now,
            };

            transaction.update(productRef, {
                stock: newStock,
                lastUpdated: now,
                history: arrayUnion(newHistoryEntry)
            });
        });
        
        const updatedProductDoc = await getDoc(productRef);
        if (updatedProductDoc.exists()) {
            await checkStockAndCreateNotification(updatedProductDoc.data() as Product, productId);
        }

    } catch(error) {
        console.error("Error adjusting stock:", error);
        throw error;
    }
}

export async function getOrders(): Promise<Order[]> {
    try {
        const ordersCol = collection(db, "orders");
        const q = query(ordersCol, orderBy("date", "desc"));
        const orderSnapshot = await getDocs(q);
        
        const orders: Order[] = await Promise.all(orderSnapshot.docs.map(async (orderDoc) => {
            const orderData = orderDoc.data();
            const client = await resolveDoc<Client>(orderData.clientRef);
            if (!client) return null;
            
            const items = await Promise.all(orderData.items.map(async (item: any) => {
                const product = await resolveDoc<Product>(item.productRef);
                if (!product) return null;
                return {
                    quantity: item.quantity,
                    price: item.price,
                    product: product,
                    status: item.status, // Make sure to fetch the status
                };
            }));
            
            if (items.some(i => i === null)) return null;

            return {
                id: orderDoc.id,
                ...orderData,
                date: (orderData.date as Timestamp).toDate(),
                client,
                items: items as OrderItem[],
                purpose: orderData.purpose,
                paymentMilestones: orderData.paymentMilestones
            } as Order;
        }));

        return orders.filter(Boolean) as Order[];
    } catch (error) {
        console.error("Error fetching orders:", error);
        return [];
    }
}

export async function updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
  try {
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, { status });
  } catch (error) {
    console.error("Error updating order status:", error);
    throw new Error("Failed to update order status.");
  }
}

export async function deleteOrder(orderId: string): Promise<void> {
  try {
    const orderRef = doc(db, "orders", orderId);
    await deleteDoc(orderRef);
  } catch (error) {
    console.error("Error deleting order:", error);
    throw new Error("Failed to delete order.");
  }
}

export async function getClients(): Promise<Client[]> {
  try {
    const clientsCol = collection(db, "clients");
    const q = query(clientsCol, orderBy("clientName", "asc"));
    const clientSnapshot = await getDocs(q);
    return clientSnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id, 
            ...data,
            createdAt: data.createdAt // Keep as Timestamp
        } as Client;
    });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return [];
  }
}

export async function addClient(client: Omit<Client, 'id' | 'createdAt'>): Promise<DocumentReference> {
  try {
    const clientsCol = collection(db, "clients");
    const clientWithDate = {
      ...client,
      createdAt: Timestamp.now(),
    };
    const docRef = await addDoc(clientsCol, clientWithDate);
    
    await createNotification({
        title: "New Client Added",
        description: `${client.clientName} is now a client.`,
        details: `A new client, ${client.clientName} for project "${client.projectName}", has been added to the database.`,
        href: "/clients",
        icon: "UserPlus",
    });

    return docRef;
  } catch (error) {
    console.error("Error adding client:", error);
    throw new Error("Failed to add client.");
  }
}

export async function updateClient(clientId: string, clientData: Partial<Omit<Client, 'id'>>): Promise<void> {
  try {
    const clientRef = doc(db, "clients", clientId);
    await updateDoc(clientRef, clientData);
  } catch (error) {
    console.error("Error updating client:", error);
    throw new Error("Failed to update client.");
  }
}

export async function deleteClient(clientId: string): Promise<void> {
  try {
    const clientRef = doc(db, "clients", clientId);
    await deleteDoc(clientRef);
  } catch (error) {
    console.error("Error deleting client:", error);
    throw new Error("Failed to delete client.");
  }
}

type NewOrderData = {
  clientId: string;
  items: { productId: string; quantity: number }[];
  reorderedFrom?: string;
  purpose?: string;
};

export async function addOrder(orderData: NewOrderData): Promise<DocumentReference> {
  const orderDate = Timestamp.now();

  return runTransaction(db, async (transaction) => {
    // --- 1. READS ---
    const clientRef = doc(db, "clients", orderData.clientId);
    const clientDoc = await transaction.get(clientRef);
    if (!clientDoc.exists()) throw new Error("Client not found.");
    const clientData = clientDoc.data();

    const productRefs = orderData.items.map(item => doc(db, "inventory", item.productId));
    const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));

    // --- 2. LOGIC ---
    const orderRef = doc(collection(db, "orders")); // This is okay, it's just a ref creation
    let total = 0;
    const orderItems: Omit<OrderItem, 'product'>[] = [];
    let hasBackorders = false;
    const backorderItems: any[] = [];

    for (let i = 0; i < orderData.items.length; i++) {
        const item = orderData.items[i];
        const productDoc = productDocs[i];
        if (!productDoc.exists()) throw new Error(`Product with ID ${item.productId} not found.`);
        
        const productData = productDoc.data() as Product;
        total += productData.price * item.quantity;
        const availableStock = productData.stock;

        let itemStatus: OrderItem['status'];

        if (availableStock < item.quantity) {
            hasBackorders = true;
            itemStatus = 'Awaiting Purchase';

            const backorderQty = item.quantity - availableStock;
            
            backorderItems.push({
                orderId: orderRef.id,
                orderRef: orderRef,
                clientRef: clientRef,
                productId: productDoc.ref.id,
                productRef: productDoc.ref,
                productName: productData.name,
                productSku: productData.sku,
                quantity: backorderQty,
                date: orderDate,
                status: 'Pending',
            });

        } else {
            itemStatus = 'Ready for Issuance';
        }

        orderItems.push({
            productRef: productDoc.ref,
            quantity: item.quantity,
            price: productData.price,
            status: itemStatus,
        });
    }

    const overallStatus = hasBackorders ? "Awaiting Purchase" : "Ready for Issuance";
    
    // --- 3. WRITES ---
    // Create Order
    const paymentMilestones: PaymentMilestone[] = [
        { name: "Down Payment", percentage: 50, amount: total * 0.5, status: "Pending" },
        { name: "Mid Payment", percentage: 40, amount: total * 0.4, status: "Pending" },
        { name: "Final Payment", percentage: 10, amount: total * 0.1, status: "Pending" },
    ];

    const newOrder: any = {
      clientRef: clientRef,
      date: orderDate,
      items: orderItems,
      status: overallStatus,
      total: total,
      purpose: orderData.purpose || "",
      paymentMilestones: paymentMilestones,
    };
    if (orderData.reorderedFrom) {
      newOrder.reorderedFrom = orderData.reorderedFrom;
    }
    transaction.set(orderRef, newOrder);

    // Create Backorder records
    for (const backorderItem of backorderItems) {
        const backorderRef = doc(collection(db, 'backorders'));
        transaction.set(backorderRef, backorderItem);
    }
    
    // Create Accounting Transactions
    const accountsReceivableTx = {
        date: orderDate,
        description: `Invoice for Order #${orderRef.id.substring(0,7)}`,
        account: 'Accounts Receivable',
        debit: total,
        credit: 0,
        entity: clientData.clientName,
    };
    const salesRevenueTx = {
        date: orderDate,
        description: `Sales from Order #${orderRef.id.substring(0,7)}`,
        account: 'Sales Revenue',
        debit: 0,
        credit: total,
        entity: clientData.clientName,
    };
    transaction.set(doc(collection(db, 'transactions')), accountsReceivableTx);
    transaction.set(doc(collection(db, 'transactions')), salesRevenueTx);

    
    // Defer notification creation until after the transaction
    return { orderRef, clientName: clientDoc.data().clientName, overallStatus };
  }).then(async ({ orderRef, clientName, overallStatus }) => {
    // This runs AFTER the transaction is successful
    await createNotification({
        title: "New Order Created",
        description: `Order for ${clientName} has been placed.`,
        details: `A new order (${orderRef.id.substring(0, 7)}) for ${clientName} has been created. Status: ${overallStatus}.`,
        href: "/orders",
        icon: "ShoppingCart",
    });
    return orderRef;
  });
}

export async function recordPayment(orderId: string, milestoneName: string): Promise<void> {
  const orderRef = doc(db, "orders", orderId);
  const now = Timestamp.now();

  return runTransaction(db, async (transaction) => {
    // --- 1. READS ---
    const orderDoc = await transaction.get(orderRef);
    if (!orderDoc.exists()) throw new Error("Order not found.");
    const orderData = orderDoc.data() as Order;

    const client = await resolveDoc<Client>(orderData.clientRef as DocumentReference);
    if(!client) throw new Error("Client not found for order.");

    // --- 2. LOGIC ---
    let paymentAmount = 0;
    const updatedMilestones = orderData.paymentMilestones?.map(m => {
      if (m.name === milestoneName) {
        if (m.status === 'Paid') throw new Error("This milestone has already been paid.");
        paymentAmount = m.amount;
        return { ...m, status: 'Paid', receivedDate: now };
      }
      return m;
    });

    if (paymentAmount === 0) throw new Error("Milestone not found or payment amount is zero.");
    
    // --- 3. WRITES ---
    // Update order payment status
    transaction.update(orderRef, { paymentMilestones: updatedMilestones });

    // Create GL entries for the payment
    const cashTx = {
        date: now,
        description: `${milestoneName} for Order #${orderId.substring(0,7)}`,
        account: 'Cash',
        debit: paymentAmount,
        credit: 0,
        entity: client.clientName,
    };
    const accountsReceivableTx = {
        date: now,
        description: `Payment for Order #${orderId.substring(0,7)}`,
        account: 'Accounts Receivable',
        debit: 0,
        credit: paymentAmount,
        entity: client.clientName,
    };
    transaction.set(doc(collection(db, 'transactions')), cashTx);
    transaction.set(doc(collection(db, 'transactions')), accountsReceivableTx);
  });
}


export async function getIssuances(): Promise<Issuance[]> {
    try {
        const issuancesCol = collection(db, "issuances");
        const q = query(issuancesCol, orderBy("date", "desc"));
        const issuanceSnapshot = await getDocs(q);
        
        const issuances: Issuance[] = await Promise.all(issuanceSnapshot.docs.map(async (issuanceDoc) => {
            const issuanceData = issuanceDoc.data();
            const client = await resolveDoc<Client>(issuanceData.clientRef);
            if (!client) return null;
            
            const items = await Promise.all(issuanceData.items.map(async (item: any) => {
                const product = await resolveDoc<Product>(item.productRef);
                if (!product) return null;
                return {
                    quantity: item.quantity,
                    product: product,
                };
            }));

            if (items.some(i => i === null)) return null;
            
            return {
                id: issuanceDoc.id,
                issuanceNumber: issuanceData.issuanceNumber,
                date: (issuanceData.date as Timestamp).toDate(),
                client,
                items: items as IssuanceItem[],
                remarks: issuanceData.remarks,
                issuedBy: issuanceData.issuedBy,
                receivedBy: issuanceData.receivedBy,
                orderId: issuanceData.orderId,
            };
        }));

        return issuances.filter(Boolean) as Issuance[];
    } catch (error) {
        console.error("Error fetching issuances:", error);
        return [];
    }
}

type NewIssuanceData = {
  clientId: string;
  items: { productId: string; quantity: number }[];
  remarks?: string;
  issuedBy: string;
  receivedBy: string;
  orderId?: string;
  materialRequisitionId?: string;
};

export async function addIssuance(issuanceData: NewIssuanceData): Promise<DocumentReference> {
  const issuanceNumber = `IS-${Date.now()}`;
  const issuanceDate = Timestamp.now();
  const clientRef = doc(db, "clients", issuanceData.clientId);
  const allProductIds = issuanceData.items.map(i => i.productId).filter(Boolean);

  const backorderQuery = query(
    collection(db, "backorders"),
    where("productId", "in", allProductIds.length > 0 ? allProductIds : ['dummy-id']),
    where("orderId", "==", "REORDER")
  );
  const backorderSnapshot = await getDocs(backorderQuery);

  let existingReorders = new Map<string, Backorder>();
  backorderSnapshot.docs.forEach(d => {
    existingReorders.set(d.data().productId, d.data() as Backorder);
  });


  return runTransaction(db, async (transaction) => {
    const productRefs = allProductIds.map(id => doc(db, "inventory", id));
    const productDocs = allProductIds.length > 0 ? await Promise.all(productRefs.map(ref => transaction.get(ref))) : [];

    let orderDoc: any;
    if (issuanceData.orderId) {
      const orderRef = doc(db, "orders", issuanceData.orderId);
      orderDoc = await transaction.get(orderRef);
    }
    
    let mrfRef: DocumentReference | null = null;
    if (issuanceData.materialRequisitionId) {
        mrfRef = doc(db, "materialRequisitions", issuanceData.materialRequisitionId);
    }

    const backordersToCreate: any[] = [];
    const jobOrderItems: Omit<JobOrderItem, 'id'>[] = [];

    for (let i = 0; i < issuanceData.items.length; i++) {
      const item = issuanceData.items[i];
      const productDoc = productDocs[i];

      if (!productDoc?.exists()) throw new Error(`Product with ID ${item.productId} not found.`);

      const productData = productDoc.data() as Product;
      
      jobOrderItems.push({ 
        productRef: productDoc.ref, 
        quantity: item.quantity,
        status: 'Pending'
      });

      if (productData.stock < item.quantity) throw new Error(`Insufficient stock for ${productData.name}. Available: ${productData.stock}, Requested: ${item.quantity}`);

      const newStock = productData.stock - item.quantity;
      const newHistoryEntry = {
        date: format(issuanceDate.toDate(), 'yyyy-MM-dd'),
        stock: newStock,
        dateUpdated: issuanceDate
      };

      transaction.update(productDoc.ref, {
        stock: newStock,
        lastUpdated: issuanceDate,
        history: arrayUnion(newHistoryEntry)
      });

      if (newStock <= productData.reorderLimit) {
        const existingReorder = existingReorders.get(productDoc.id);
        const hasActiveReorder = existingReorder && (existingReorder.status === 'Pending' || existingReorder.status === 'Ordered');
        if (!hasActiveReorder) {
          const reorderQty = productData.maxStockLevel - newStock;
          if (reorderQty > 0) {
            backordersToCreate.push({
              orderId: "REORDER",
              orderRef: null,
              clientRef: null,
              productId: productDoc.id,
              productRef: productDoc.ref,
              productName: productData.name,
              productSku: productData.sku,
              quantity: reorderQty,
              date: issuanceDate,
              status: 'Pending',
            });
          }
        }
      }
    }

    backordersToCreate.forEach(b => transaction.set(doc(collection(db, "backorders")), b));

    if (orderDoc && orderDoc.exists()) {
      const orderData = orderDoc.data();
      const updatedItems = orderData.items.map((orderItem: any) => {
        const issuedItem = issuanceData.items.find(i => i.productId === orderItem.productRef.id);
        if (issuedItem) {
          return { ...orderItem, status: 'Fulfilled' };
        }
        return orderItem;
      });

      const allFulfilled = updatedItems.every((item: any) => item.status === 'Fulfilled');
      const newStatus = allFulfilled ? 'Fulfilled' : 'Partially Fulfilled';
      transaction.update(orderDoc.ref, { items: updatedItems, status: newStatus });
    }

    const newIssuance: any = {
      issuanceNumber: issuanceNumber,
      clientRef: clientRef,
      date: issuanceDate,
      items: issuanceData.items.map(item => ({
        productRef: doc(db, "inventory", item.productId),
        quantity: item.quantity,
      })),
      remarks: issuanceData.remarks || "",
      issuedBy: issuanceData.issuedBy,
      receivedBy: issuanceData.receivedBy,
    };
    if (issuanceData.orderId) {
      newIssuance.orderId = issuanceData.orderId;
    }
    if (mrfRef) {
        transaction.update(mrfRef, { status: 'Fulfilled' });
    }

    const docRef = doc(collection(db, "issuances"));
    transaction.set(docRef, newIssuance);
    
    // Create Job Order if it's from an MRF
    if (mrfRef) {
        const jobOrderRef = doc(collection(db, "jobOrders"));
        const newJobOrder = {
            jobOrderNumber: `JO-${Date.now()}`,
            materialRequisitionRef: mrfRef,
            projectRef: (await transaction.get(mrfRef)).data()?.projectRef,
            date: issuanceDate,
            status: "Pending",
            items: jobOrderItems.map(item => ({...item, id: `${Date.now()}-${Math.random()}`})),
        };
        transaction.set(jobOrderRef, newJobOrder);
    }


    for (const productDoc of productDocs) {
      if (productDoc?.exists()) {
        const productData = productDoc.data() as Product;
        const itemData = issuanceData.items.find(i => i.productId === productDoc.id);
        if (itemData) {
          const newStock = productData.stock - itemData.quantity;
          checkStockAndCreateNotification({ ...productData, stock: newStock }, productDoc.id);
        }
      }
    }

    return docRef;
  });
}


export async function deleteIssuance(issuanceId: string): Promise<void> {
  const issuanceRef = doc(db, "issuances", issuanceId);
  const now = Timestamp.now();

  try {
    await runTransaction(db, async (transaction) => {
      const issuanceDoc = await transaction.get(issuanceRef);
       if (!issuanceDoc.exists()) {
        console.warn(`Issuance with ID ${issuanceId} not found. Deletion skipped.`);
        return null;
      }
      
      const data = issuanceDoc.data();
      const productRefs = data.items.map((item: any) => item.productRef as DocumentReference);
      const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));

      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        const productDoc = productDocs[i];

        if (productDoc.exists()) {
          const productData = productDoc.data();
          const newStock = productData.stock + item.quantity;
          const newHistoryEntry = {
            date: format(now.toDate(), 'yyyy-MM-dd'),
            stock: newStock,
            changeReason: `Deletion of issuance #${data.issuanceNumber}`,
            dateUpdated: now,
          };
          transaction.update(productDoc.ref, {
            stock: newStock,
            lastUpdated: now,
            history: arrayUnion(newHistoryEntry),
          });
        } else {
          console.warn(`Product with ID ${productDoc.ref.id} not found while deleting issuance. Stock not restored for this item.`);
        }
      }

      transaction.delete(issuanceRef);
      return data;
    }).then(async (issuanceData) => {
        if (issuanceData && issuanceData.orderId) {
            await checkAndUpdateAwaitingOrders();
        }
    });

  } catch (error) {
    console.error("Error deleting issuance:", error);
    throw new Error("Failed to delete issuance. " + (error as Error).message);
  }
}


export async function getSuppliers(): Promise<Supplier[]> {
  try {
    const suppliersCol = collection(db, "suppliers");
    const q = query(suppliersCol, orderBy("name", "asc"));
    const supplierSnapshot = await getDocs(q);
    return supplierSnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id, 
            ...data,
            createdAt: data.createdAt // Keep as Timestamp
        } as Supplier;
    });
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    return [];
  }
}

export async function addSupplier(supplier: Omit<Supplier, 'id' | 'createdAt'>): Promise<DocumentReference> {
  try {
    const suppliersCol = collection(db, "suppliers");
    const supplierWithDate = {
      ...supplier,
      createdAt: Timestamp.now(),
    };
    const docRef = await addDoc(suppliersCol, supplierWithDate);
    return docRef;
  } catch (error) {
    console.error("Error adding supplier:", error);
    throw new Error("Failed to add supplier.");
  }
}

export async function updateSupplier(supplierId: string, supplierData: Partial<Omit<Supplier, 'id'>>): Promise<void> {
  try {
    const supplierRef = doc(db, "suppliers", supplierId);
    await updateDoc(supplierRef, supplierData);
  } catch (error) {
    console.error("Error updating supplier:", error);
    throw new Error("Failed to update supplier.");
  }
}

export async function deleteSupplier(supplierId: string): Promise<void> {
  try {
    const supplierRef = doc(db, "suppliers", supplierId);
    await deleteDoc(supplierRef);
  } catch (error) {
    console.error("Error deleting supplier:", error);
    throw new Error("Failed to delete supplier.");
  }
}

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
    try {
        const poCol = collection(db, "purchaseOrders");
        const q = query(poCol, orderBy("orderDate", "desc"));
        const poSnapshot = await getDocs(q);
        
        const purchaseOrders: PurchaseOrder[] = await Promise.all(poSnapshot.docs.map(async (poDoc) => {
            const poData = poDoc.data();
            const supplier = await resolveDoc<Supplier>(poData.supplierRef);
            if (!supplier) return null;
            
            const client = poData.clientRef ? await resolveDoc<Client>(poData.clientRef) : undefined;
            
            const items = await Promise.all(poData.items.map(async (item: any) => {
                const product = await resolveDoc<Product>(item.productRef);
                 if (!product) return null;
                return {
                    quantity: item.quantity,
                    product: product,
                };
            }));

            if (items.some(i => i === null)) return null;
            
            return {
                id: poDoc.id,
                ...poData,
                orderDate: (poData.orderDate as Timestamp).toDate(),
                expectedDate: poData.expectedDate ? (poData.expectedDate as Timestamp).toDate() : undefined,
                receivedDate: poData.receivedDate ? (poData.receivedDate as Timestamp).toDate() : undefined,
                supplier,
                client,
                items: items as PurchaseOrderItem[],
                total: poData.total || 0,
            } as PurchaseOrder;
        }));

        return purchaseOrders.filter(Boolean) as PurchaseOrder[];
    } catch (error) {
        console.error("Error fetching purchase orders:", error);
        return [];
    }
}

type NewPurchaseOrderData = {
  supplierId: string;
  clientId?: string;
  items: { productId: string; quantity: number, backorderId?: string }[];
};

export async function addPurchaseOrder(poData: NewPurchaseOrderData): Promise<DocumentReference> {
    return runTransaction(db, async (transaction) => {
        const supplierRef = doc(db, "suppliers", poData.supplierId);
        const supplierDoc = await transaction.get(supplierRef);
        if (!supplierDoc.exists()) throw new Error("Supplier not found.");
        
        const productRefs = poData.items.map(item => doc(db, "inventory", item.productId));
        const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));

        const backorderIds = poData.items.map(item => item.backorderId).filter(Boolean) as string[];
        const backorderRefs = backorderIds.map(id => doc(db, 'backorders', id));
        const backorderDocs = backorderRefs.length > 0 ? await Promise.all(backorderRefs.map(ref => transaction.get(ref))) : [];
        
        const uniqueOrderRefsMap = new Map<string, DocumentReference>();
        for (const backorderDoc of backorderDocs) {
            if (backorderDoc.exists()) {
                const backorderData = backorderDoc.data() as Backorder;
                if (backorderData.orderRef) {
                    uniqueOrderRefsMap.set(backorderData.orderRef.id, backorderData.orderRef);
                }
            }
        }
        const uniqueOrderRefs = Array.from(uniqueOrderRefsMap.values());
        const orderDocs = uniqueOrderRefs.length > 0 ? await Promise.all(uniqueOrderRefs.map(ref => transaction.get(ref))) : [];
        const orderDocsMap = new Map(orderDocs.map((doc, i) => [uniqueOrderRefs[i].id, doc]));

        const poRef = doc(collection(db, "purchaseOrders"));
        const poDate = Timestamp.now();

        const ordersToUpdate = new Map<string, { orderRef: DocumentReference; productIds: Set<string>; docData: any }>();

        for (const backorderDoc of backorderDocs) {
            if (backorderDoc.exists()) {
                const backorderData = backorderDoc.data() as Backorder;
                if (backorderData.orderRef) {
                    const orderDoc = orderDocsMap.get(backorderData.orderRef.id);
                    if (orderDoc && orderDoc.exists()) {
                         if (!ordersToUpdate.has(orderDoc.id)) {
                            ordersToUpdate.set(orderDoc.id, {
                                orderRef: orderDoc.ref,
                                productIds: new Set(),
                                docData: orderDoc.data(),
                            });
                        }
                        ordersToUpdate.get(orderDoc.id)!.productIds.add(backorderData.productId);
                    }
                }

                const orderedItem = poData.items.find(i => i.backorderId === backorderDoc.id);
                if (orderedItem && orderedItem.quantity < backorderData.quantity) {
                    const remainderQty = backorderData.quantity - orderedItem.quantity;
                    const newBackorderRef = doc(collection(db, "backorders"));
                    transaction.set(newBackorderRef, {
                        ...backorderData,
                        quantity: remainderQty,
                        date: poDate,
                        status: 'Pending',
                        parentBackorderId: backorderDoc.id
                    });

                    transaction.update(backorderDoc.ref, {
                        status: 'Ordered',
                        purchaseOrderId: poRef.id,
                        quantity: orderedItem.quantity
                    });

                } else {
                    transaction.update(backorderDoc.ref, {
                        status: 'Ordered',
                        purchaseOrderId: poRef.id,
                    });
                }
            }
        }
        
        for (const group of ordersToUpdate.values()) {
            const originalOrderData = group.docData;
            const updatedItems = originalOrderData.items.map((orderItem: any) => {
                if (group.productIds.has(orderItem.productRef.id) && orderItem.status === 'Awaiting Purchase') {
                    return { ...orderItem, status: 'PO Pending' };
                }
                return orderItem;
            });
            
            const hasPendingPO = updatedItems.some((i:any) => i.status === 'PO Pending');
            const newStatus = hasPendingPO ? 'Processing' : originalOrderData.status;

            transaction.update(group.orderRef, { items: updatedItems, status: newStatus });
        }
        
        let total = 0;
        const resolvedItems = productDocs.map((doc, i) => {
          if (!doc.exists()) throw new Error(`Product not found during PO creation.`);
          const productData = doc.data() as Product;
          const quantity = poData.items[i].quantity;
          total += (productData.price || 0) * quantity;
          return {
            productRef: doc.ref,
            quantity: quantity,
          };
        });

        const newPurchaseOrder: any = {
            supplierRef: supplierRef,
            orderDate: poDate,
            status: "Pending",
            paymentStatus: "Unpaid",
            items: resolvedItems,
            total: total,
            poNumber: `PO-${Date.now()}`,
        };
        if (poData.clientId) {
            newPurchaseOrder.clientRef = doc(db, "clients", poData.clientId);
        }
        transaction.set(poRef, newPurchaseOrder);

        return { poRef, supplierName: supplierDoc.data()?.name, poNumber: newPurchaseOrder.poNumber };
    }).then(async ({ poRef, supplierName, poNumber }) => {
        await createNotification({
            title: "New Purchase Order",
            description: `PO for ${supplierName} has been created.`,
            details: `A new purchase order (${poNumber}) has been created for ${supplierName}.`,
            href: "/purchase-orders",
            icon: "ShoppingCart",
        });
        return poRef;
    });
}



export async function deletePurchaseOrder(poId: string): Promise<void> {
    try {
        const poRef = doc(db, "purchaseOrders", poId);
        await deleteDoc(poRef);
    } catch (error) {
        console.error("Error deleting purchase order:", error);
        throw new Error("Failed to delete purchase order.");
    }
}

async function checkAndUpdateAwaitingOrders() {
    const ordersCol = collection(db, "orders");
    const q = query(ordersCol, where("status", "in", ["Awaiting Purchase", "Processing", "PO Pending"]));
    const awaitingOrdersSnapshot = await getDocs(q);

    if (awaitingOrdersSnapshot.empty) {
        return;
    }

    const inventoryCache = new Map<string, Product>();
    const batch = writeBatch(db);

    for (const orderDoc of awaitingOrdersSnapshot.docs) {
        const orderData = orderDoc.data() as any;
        let needsUpdate = false;
        
        const updatedItems = await Promise.all(orderData.items.map(async (item: any) => {
             if (item.status === 'Fulfilled' || item.status === 'Ready for Issuance') {
                return item;
            }
            
            const productRef = item.productRef as DocumentReference;
            let productData: Product | undefined = inventoryCache.get(productRef.id);
            
            if (!productData) {
                const productDoc = await getDoc(productRef);
                if (productDoc.exists()) {
                    productData = { id: productDoc.id, ...productDoc.data() } as Product;
                    inventoryCache.set(productRef.id, productData);
                }
            }

            if (productData && productData.stock >= item.quantity) {
                if (item.status !== 'Ready for Issuance') {
                    needsUpdate = true;
                    return { ...item, status: 'Ready for Issuance' };
                }
            }
            return item;
        }));

        if (needsUpdate) {
            const allItemsReadyOrFulfilled = updatedItems.every(item => item.status === 'Ready for Issuance' || item.status === 'Fulfilled');
            
            let newOverallStatus: Order['status'] = orderData.status;

            if(allItemsReadyOrFulfilled){
                newOverallStatus = 'Ready for Issuance';
            } else {
                 const hasPendingPO = updatedItems.some(item => item.status === 'PO Pending');
                 if(hasPendingPO) {
                     newOverallStatus = 'Processing';
                 } else {
                     newOverallStatus = 'Awaiting Purchase';
                 }
            }

             batch.update(orderDoc.ref, { items: updatedItems, status: newOverallStatus });

            if (newOverallStatus === "Ready for Issuance") {
                await createNotification({
                    title: "Order Ready",
                    description: `Order ${orderDoc.id.substring(0,7)} is ready for issuance.`,
                    details: `All items for order ${orderDoc.id.substring(0,7)} are in stock and are ready to be issued.`,
                    href: "/issuance",
                    icon: "ShoppingCart",
                });
            }
        }
    }
    
    await batch.commit();
}


export async function updatePurchaseOrderStatus(poId: string, status: PurchaseOrder['status']): Promise<void> {
  const poRef = doc(db, "purchaseOrders", poId);
  try {
      const poDoc = await getDoc(poRef);
      if (!poDoc.exists()) throw new Error("Purchase Order not found.");
      const poData = poDoc.data() as any;

      // Prevent re-processing
      const terminalStatuses: PurchaseOrder['status'][] = ["Completed", "Cancelled"];
      if (terminalStatuses.includes(poData.status)) {
        console.warn(`PO ${poId} is already in a terminal state (${poData.status}).`);
        return;
      }
      
      const payload: Partial<PurchaseOrder> & { [key: string]: any } = { status };

      if(status === 'Delivered') {
          payload.receivedDate = Timestamp.now();
      }

      await updateDoc(poRef, payload);
      
      if(status === 'Delivered'){
          await createNotification({
            title: "PO Delivered",
            description: `PO #${poData.poNumber} has been delivered.`,
            details: `Purchase Order #${poData.poNumber} has been marked as delivered and is now awaiting quality control inspection.`,
            href: `/quality-control`,
            icon: "ClipboardCheck",
        });
      }
  } catch (error) {
    console.error("Error updating purchase order status:", error);
    throw new Error(`Failed to update purchase order status. ${(error as Error).message}`);
  }
}

export async function getShipments(): Promise<Shipment[]> {
    try {
        const shipmentsCol = collection(db, "shipments");
        const q = query(shipmentsCol, orderBy("createdAt", "desc"));
        const shipmentSnapshot = await getDocs(q);
        
        const shipments: Shipment[] = await Promise.all(shipmentSnapshot.docs.map(async (shipmentDoc) => {
            const shipmentData = shipmentDoc.data();
            
            const issuanceRef = shipmentData.issuanceRef as DocumentReference;
            const issuanceSnap = await getDoc(issuanceRef);
             if (!issuanceSnap.exists()) {
                console.warn(`Issuance with ref ${issuanceRef.path} does not exist for shipment ${shipmentDoc.id}`);
                return null;
            }
            const issuance = { id: issuanceSnap.id, ...issuanceSnap.data()} as any;

            const client = await resolveDoc<Client>(issuance.clientRef);
            if (!client) return null;
            
            const items = await Promise.all(issuance.items.map(async (item: any) => {
                 const product = await resolveDoc<Product>(item.productRef);
                 if (!product) return null;
                return {
                    quantity: item.quantity,
                    product: product,
                };
            }));

            if (items.some(i => i === null)) return null;

            const resolvedIssuance: Issuance = {
                ...issuance,
                id: shipmentData.issuanceRef.id,
                date: (issuance.date as unknown as Timestamp).toDate(),
                client: client,
                items: items as IssuanceItem[],
            };
            
            return {
                id: shipmentDoc.id,
                shipmentNumber: shipmentData.shipmentNumber,
                status: shipmentData.status,
                shippingProvider: shipmentData.shippingProvider,
                trackingNumber: shipmentData.trackingNumber,
                estimatedDeliveryDate: shipmentData.estimatedDeliveryDate ? (shipmentData.estimatedDeliveryDate as Timestamp).toDate() : undefined,
                actualDeliveryDate: shipmentData.actualDeliveryDate ? (shipmentData.actualDeliveryDate as Timestamp).toDate() : undefined,
                createdAt: (shipmentData.createdAt as Timestamp).toDate(),
                issuance: resolvedIssuance,
            } as Shipment;
        }));

        return shipments.filter(Boolean) as Shipment[];
    } catch (error) {
        console.error("Error fetching shipments:", error);
        return [];
    }
}

export async function getUnshippedIssuances(): Promise<Issuance[]> {
    try {
        // 1. Get all shipment issuance refs to know which ones are already shipped
        const shipmentsCol = collection(db, "shipments");
        const shipmentSnapshot = await getDocs(shipmentsCol);
        const shippedIssuanceIds = new Set(shipmentSnapshot.docs.map(doc => doc.data().issuanceRef.id));

        // 2. Get all issuances
        const issuancesCol = collection(db, "issuances");
        const issuanceSnapshot = await getDocs(query(issuancesCol, orderBy("date", "desc")));

        // 3. Filter out issuances that are already shipped
        const unshippedDocs = issuanceSnapshot.docs.filter(doc => !shippedIssuanceIds.has(doc.id));

        // 4. Resolve the remaining issuance documents fully
        const issuances: Issuance[] = await Promise.all(unshippedDocs.map(async (issuanceDoc) => {
            const issuanceData = issuanceDoc.data();
            const client = await resolveDoc<Client>(issuanceData.clientRef);
            if (!client) return null;
            return {
                id: issuanceDoc.id,
                issuanceNumber: issuanceData.issuanceNumber,
                date: (issuanceData.date as Timestamp).toDate(),
                client: client,
                items: [], // Items are not needed for the dropdown
            } as Issuance;
        }));
        
        return issuances.filter(Boolean) as Issuance[];
    } catch (error) {
        console.error("Error fetching unshipped issuances:", error);
        return [];
    }
}


type NewShipmentData = {
    issuanceId: string;
    shippingProvider: string;
    trackingNumber?: string;
    estimatedDeliveryDate: Date;
}

export async function addShipment(shipmentData: NewShipmentData): Promise<DocumentReference> {
    return runTransaction(db, async (transaction) => {
        // --- 1. READS ---
        const issuanceRef = doc(db, "issuances", shipmentData.issuanceId);
        const issuanceDoc = await transaction.get(issuanceRef);
        if (!issuanceDoc.exists()) {
            throw new Error("Issuance not found.");
        }
        const issuance = issuanceDoc.data();

        let orderRef: DocumentReference | null = null;
        let orderDoc;
        if (issuance.orderId) {
            orderRef = doc(db, "orders", issuance.orderId);
            orderDoc = await transaction.get(orderRef);
            if (!orderDoc.exists()) {
                // If order doesn't exist, we can't update it, but shipment can still proceed
                orderRef = null;
            }
        }

        // --- 2. WRITES ---
        const shipmentNumber = `SH-${Date.now()}`;
        const newShipment = {
            shipmentNumber,
            issuanceRef: issuanceRef,
            status: "In Transit",
            shippingProvider: shipmentData.shippingProvider,
            trackingNumber: shipmentData.trackingNumber || "",
            estimatedDeliveryDate: Timestamp.fromDate(shipmentData.estimatedDeliveryDate),
            createdAt: Timestamp.now(),
        };

        const shipmentRef = doc(collection(db, "shipments"));
        transaction.set(shipmentRef, newShipment);
        
        if (orderRef && orderDoc && orderDoc.exists()) {
            transaction.update(orderRef, { status: "Shipped" });
        }
        
        return { shipmentRef, shipmentNumber };

    }).then(async ({ shipmentRef, shipmentNumber }) => {
        await createNotification({
            title: "Order Shipped",
            description: `Shipment ${shipmentNumber} is on its way.`,
            details: `A new shipment (${shipmentNumber}) has been created and is now in transit.`,
            href: "/logistics",
            icon: "Truck",
        });
        return shipmentRef;
    });
}

export async function updateShipmentStatus(shipmentId: string, status: Shipment['status']): Promise<void> {
    const shipmentRef = doc(db, "shipments", shipmentId);

    await runTransaction(db, async (transaction) => {
        // --- 1. READS ---
        const shipmentDoc = await transaction.get(shipmentRef);
        if (!shipmentDoc.exists()) {
            throw new Error("Shipment not found.");
        }

        const shipmentData = shipmentDoc.data();
        const issuanceRef = shipmentData.issuanceRef as DocumentReference;
        const issuanceDoc = await transaction.get(issuanceRef);
        
        let orderRef: DocumentReference | null = null;
        let orderDoc;
        if (issuanceDoc.exists() && issuanceDoc.data().orderId) {
             orderRef = doc(db, "orders", issuanceDoc.data().orderId);
             orderDoc = await transaction.get(orderRef);
        }
        
        // --- 2. WRITES ---
        const payload: any = { status };
        if (status === 'Delivered') {
            payload.actualDeliveryDate = Timestamp.now();
            if (orderRef && orderDoc && orderDoc.exists()) {
                 const orderData = orderDoc.data();
                 // Only update order status if it's 'Shipped' to avoid overwriting other states
                 if(orderData?.status === 'Shipped') {
                    transaction.update(orderRef, { status: "Completed" });
                 }
            }
        }
        transaction.update(shipmentRef, payload);
    });
}

export async function getReturns(): Promise<Return[]> {
    try {
        const returnsCol = collection(db, "returns");
        const q = query(returnsCol, orderBy("dateInitiated", "desc"));
        const returnsSnapshot = await getDocs(q);
        
        const returns: Return[] = await Promise.all(returnsSnapshot.docs.map(async (returnDoc) => {
            const returnData = returnDoc.data();
            const client = await resolveDoc<Client>(returnData.clientRef);
            if (!client) return null;
            
            return {
                id: returnDoc.id,
                ...returnData,
                dateInitiated: (returnData.dateInitiated as Timestamp).toDate(),
                dateReceived: returnData.dateReceived ? (returnData.dateReceived as Timestamp).toDate() : undefined,
                client,
            } as Return;
        }));

        return returns.filter(Boolean) as Return[];
    } catch (error) {
        console.error("Error fetching returns:", error);
        return [];
    }
}

type NewReturnData = {
  issuanceId: string;
  reason: string;
  items: ReturnItem[];
};

export async function initiateReturn(returnData: NewReturnData): Promise<DocumentReference> {
  try {
    const issuanceRef = doc(db, 'issuances', returnData.issuanceId);
    const issuanceDoc = await getDoc(issuanceRef);
    if (!issuanceDoc.exists()) {
      throw new Error("Original issuance not found.");
    }
    const issuanceData = issuanceDoc.data();

    const newReturn = {
      rmaNumber: `RMA-${Date.now()}`,
      issuanceId: returnData.issuanceId,
      issuanceNumber: issuanceData.issuanceNumber,
      clientRef: issuanceData.clientRef,
      items: returnData.items,
      reason: returnData.reason,
      status: "Pending",
      dateInitiated: Timestamp.now(),
    };

    const returnsCol = collection(db, "returns");
    const docRef = await addDoc(returnsCol, newReturn);
    
    await createNotification({
        title: "Return Initiated",
        description: `RMA ${newReturn.rmaNumber} has been created.`,
        details: `A new return request (${newReturn.rmaNumber}) has been initiated.`,
        href: "/returns",
        icon: "RefreshCcw",
    });

    return docRef;
  } catch (error) {
    console.error("Error initiating return:", error);
    throw new Error("Failed to initiate return.");
  }
}

export async function processReturn(returnId: string, status: "Received" | "Cancelled", processedBy: string): Promise<void> {
  const returnRef = doc(db, "returns", returnId);
  
  try {
    await runTransaction(db, async (transaction) => {
      const returnDoc = await transaction.get(returnRef);
      if (!returnDoc.exists()) {
        throw new Error("Return record not found.");
      }
      const returnData = returnDoc.data();
      
      const now = Timestamp.now();
      const payload: any = { status, processedBy };

      if (status === 'Received') {
        if(returnData.status !== 'Pending') throw new Error("Can only mark 'Pending' returns as 'Received'.");
        payload.dateReceived = now;
      } else if (status === 'Cancelled') {
        if(returnData.status !== 'Pending') throw new Error("Can only cancel a 'Pending' return.");
      }
      
      transaction.update(returnRef, payload);
    });
  } catch(error) {
     console.error("Error processing return:", error);
     throw error;
  }
}

export async function deleteReturn(returnId: string): Promise<void> {
    try {
        const returnRef = doc(db, "returns", returnId);
        const returnDoc = await getDoc(returnRef);
        if (!returnDoc.exists()) {
            throw new Error("Return record not found.");
        }
        if (returnDoc.data().status === 'Completed') {
            throw new Error("Cannot delete a completed return as inventory has been adjusted.");
        }
        await deleteDoc(returnRef);
    } catch (error) {
        console.error("Error deleting return:", error);
        throw error;
    }
}

type InspectionData = {
  productId: string;
  restockQuantity: number;
  disposalQuantity: number;
}

export async function completeInspection(returnId: string, inspectionItems: InspectionData[]): Promise<void> {
  const returnRef = doc(db, "returns", returnId);
  const now = Timestamp.now();

  try {
    await runTransaction(db, async (transaction) => {
      // --- 1. READS ---
      const returnDoc = await transaction.get(returnRef);
      if (!returnDoc.exists()) throw new Error("Return not found.");
      if (returnDoc.data().status !== 'Received') throw new Error("Can only inspect 'Received' returns.");

      const productRefs = inspectionItems
        .filter(item => item.restockQuantity > 0)
        .map(item => doc(db, "inventory", item.productId));
      
      const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));

      // --- 2. WRITES ---
      for (let i = 0; i < productDocs.length; i++) {
        const productDoc = productDocs[i];
        const inspectionItem = inspectionItems.find(item => item.productId === productDoc.id);

        if (productDoc.exists() && inspectionItem && inspectionItem.restockQuantity > 0) {
          const productData = productDoc.data();
          const newStock = productData.stock + inspectionItem.restockQuantity;
          const newHistoryEntry = {
            date: format(now.toDate(), 'yyyy-MM-dd'),
            stock: newStock,
            changeReason: `Restock from RMA #${returnDoc.data().rmaNumber}`,
            dateUpdated: now,
          };
          transaction.update(productDoc.ref, { 
            stock: newStock,
            lastUpdated: now,
            history: arrayUnion(newHistoryEntry)
          });
        }
      }

      transaction.update(returnRef, {
        status: "Completed",
        inspection: {
          date: now,
          items: inspectionItems,
        }
      });
    });
    
    // --- 3. POST-TRANSACTION NOTIFICATION ---
    const returnDoc = await getDoc(returnRef);
    if(returnDoc.exists()){
      await createNotification({
          title: "Inspection Completed",
          description: `Return ${returnDoc.data().rmaNumber} has been inspected.`,
          details: `The inspection for return ${returnDoc.data().rmaNumber} is complete. Inventory has been updated.`,
          href: "/quality-control",
          icon: "ClipboardCheck",
      });
    }

  } catch (error) {
    console.error("Error completing inspection:", error);
    throw error;
  }
}


type POInspectionItem = {
    productId: string;
    receivedQuantity: number;
}

export async function completePOInspection(poId: string, inspectionItems: POInspectionItem[]): Promise<void> {
    const poRef = doc(db, "purchaseOrders", poId);
    const now = Timestamp.now();

    try {
        await runTransaction(db, async (transaction) => {
            // --- 1. READS ---
            const poDoc = await transaction.get(poRef);
            if (!poDoc.exists()) throw new Error("Purchase order not found.");
            const poData = poDoc.data() as PurchaseOrder;
            if (poData.status !== 'Delivered') throw new Error("Can only inspect 'Delivered' purchase orders.");

            const supplier = await resolveDoc<Supplier>(poData.supplierRef as DocumentReference);
            if (!supplier) throw new Error("Supplier not found for PO.");

            const productRefs = inspectionItems.map(item => doc(db, "inventory", item.productId));
            const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));

            // --- 2. WRITES ---
            for (let i = 0; i < inspectionItems.length; i++) {
                const item = inspectionItems[i];
                const productDoc = productDocs[i];

                if (item.receivedQuantity > 0 && productDoc.exists()) {
                    const productData = productDoc.data();
                    const newStock = productData.stock + item.receivedQuantity;
                    const newHistoryEntry = {
                        date: format(now.toDate(), 'yyyy-MM-dd'),
                        stock: newStock,
                        changeReason: `Received PO #${poData.poNumber}`,
                        dateUpdated: now,
                    };
                    transaction.update(productDoc.ref, {
                        stock: newStock,
                        lastUpdated: now,
                        history: arrayUnion(newHistoryEntry)
                    });
                }
            }

            transaction.update(poRef, { status: "Completed", paymentStatus: "Unpaid" });

            // Create Accounting Transactions
            const inventoryTx = {
                date: now,
                description: `Inventory from PO #${poData.poNumber}`,
                account: 'Inventory',
                debit: poData.total,
                credit: 0,
                entity: supplier.name,
            };
            const accountsPayableTx = {
                date: now,
                description: `Payable for PO #${poData.poNumber}`,
                account: 'Accounts Payable',
                debit: 0,
                credit: poData.total,
                entity: supplier.name,
            };
            transaction.set(doc(collection(db, 'transactions')), inventoryTx);
            transaction.set(doc(collection(db, 'transactions')), accountsPayableTx);

        });

        // After the main transaction, check if this fulfilled any backorders
        await checkAndUpdateAwaitingOrders();

        const poDoc = await getDoc(poRef);
        if (poDoc.exists()) {
            await createNotification({
                title: "PO Inspected & Stocked",
                description: `PO #${poDoc.data().poNumber} items have been added to inventory.`,
                details: `Items from Purchase Order #${poDoc.data().poNumber} have passed inspection and are now in stock.`,
                href: "/inventory",
                icon: "Package",
            });
        }
    } catch (error) {
        console.error("Error completing PO inspection:", error);
        throw error;
    }
}


export async function getOutboundReturns(): Promise<OutboundReturn[]> {
    try {
        const returnsCol = collection(db, "outboundReturns");
        const q = query(returnsCol, orderBy("dateInitiated", "desc"));
        const returnsSnapshot = await getDocs(q);
        
        const returns: OutboundReturn[] = await Promise.all(returnsSnapshot.docs.map(async (returnDoc) => {
            const returnData = returnDoc.data();
            const supplier = await resolveDoc<Supplier>(returnData.supplierRef);
            if (!supplier) return null;
            
            return {
                id: returnDoc.id,
                ...returnData,
                dateInitiated: (returnData.dateInitiated as Timestamp).toDate(),
                dateShipped: returnData.dateShipped ? (returnData.dateShipped as Timestamp).toDate() : undefined,
                supplier,
            } as OutboundReturn;
        }));

        return returns.filter(Boolean) as OutboundReturn[];
    } catch (error) {
        console.error("Error fetching outbound returns:", error);
        return [];
    }
}

type NewOutboundReturnData = {
  purchaseOrderId: string;
  reason: string;
  items: OutboundReturnItem[];
};

export async function initiateOutboundReturn(returnData: NewOutboundReturnData): Promise<DocumentReference> {
  const rtsNumber = `RTS-${Date.now()}`;
  const dateInitiated = Timestamp.now();

  return runTransaction(db, async (transaction) => {
    // --- 1. READS ---
    const poRef = doc(db, 'purchaseOrders', returnData.purchaseOrderId);
    const poDoc = await transaction.get(poRef);
    if (!poDoc.exists()) throw new Error("Original purchase order not found.");

    const poData = poDoc.data();
    const productRefs = returnData.items.map(item => doc(db, "inventory", item.productId));
    const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));

    // --- 2. LOGIC ---
    for (let i = 0; i < returnData.items.length; i++) {
      const item = returnData.items[i];
      const productDoc = productDocs[i];
      if (!productDoc.exists()) throw new Error(`Product with ID ${item.productId} not found.`);
      
      const productData = productDoc.data();
      if (productData.stock < item.quantity) {
        throw new Error(`Insufficient stock to return for ${productData.name}. Available: ${productData.stock}, Returning: ${item.quantity}`);
      }
    }

    // --- 3. WRITES ---
    for (let i = 0; i < returnData.items.length; i++) {
      const item = returnData.items[i];
      const productDoc = productDocs[i];
      const productData = productDoc.data();

      const newStock = productData.stock - item.quantity;
      const newHistoryEntry = {
        date: format(dateInitiated.toDate(), 'yyyy-MM-dd'),
        stock: newStock,
        changeReason: `Return to Supplier #${rtsNumber}`,
        dateUpdated: dateInitiated,
      };
      transaction.update(productDoc.ref, {
        stock: newStock,
        lastUpdated: dateInitiated,
        history: arrayUnion(newHistoryEntry)
      });
    }

    const newReturn = {
      rtsNumber: rtsNumber,
      purchaseOrderId: returnData.purchaseOrderId,
      poNumber: poData.poNumber,
      supplierRef: poData.supplierRef,
      items: returnData.items,
      reason: returnData.reason,
      status: "Pending",
      dateInitiated: dateInitiated,
    };

    const returnsCol = collection(db, "outboundReturns");
    const docRef = doc(returnsCol);
    transaction.set(docRef, newReturn);
    
    return docRef;
  });
}


export async function createUserProfile(uid: string, data: Omit<UserProfile, 'uid'>) {
    try {
        const userRef = doc(db, "users", uid);
        await setDoc(userRef, { ...data, uid });
    } catch (error) {
        console.error("Error creating user profile:", error);
        throw new Error("Failed to create user profile.");
    }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
        const userRef = doc(db, "users", uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            return { uid, ...docSnap.data() } as UserProfile;
        }
        return null;
    } catch (error) {
        console.error("Error getting user profile:", error);
        return null;
    }
}

export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const usersCol = collection(db, "users");
    const userSnapshot = await getDocs(usersCol);
    return userSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
  } catch (error) {
    console.error("Error fetching all users:", error);
    return [];
  }
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, data);
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw new Error("Failed to update user profile.");
  }
}


export async function deleteUser(uid: string): Promise<void> {
    try {
        const userRef = doc(db, "users", uid);
        await deleteDoc(userRef);
    } catch (error) {
        console.error("Error deleting user profile:", error);
        throw new Error("Failed to delete user profile.");
    }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error("No user is currently signed in.");
  }

  try {
    // Re-authenticate the user
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // If re-authentication is successful, update the password
    await updatePassword(user, newPassword);
  } catch (error) {
    console.error("Error changing password:", error);
    // Provide a more user-friendly error message
    if ((error as any).code === 'auth/wrong-password') {
        throw new Error("The current password you entered is incorrect.");
    }
    throw new Error("Failed to change password. Please try again.");
  }
}


export async function getBackorders(): Promise<Backorder[]> {
    try {
        const backordersCol = collection(db, "backorders");
        const q = query(backordersCol);
        const snapshot = await getDocs(q);
        const backorders = await Promise.all(snapshot.docs.map(async (doc) => {
            const data = doc.data();
            let clientRef = data.clientRef;

            // If clientRef is null (for REORDER items), we don't need to resolve it.
            if(clientRef === null) {
                return {
                    id: doc.id,
                    ...data,
                } as Backorder;
            }
            // For backorders that came from a customer order, resolve the client.
            const client = await resolveDoc<Client>(data.clientRef);
            if (!client) {
                // If the client is somehow deleted, we can still show the backorder
                // but maybe log this as a data integrity issue.
                console.warn(`Client for backorder ${doc.id} not found.`);
            }

            return {
                id: doc.id,
                ...data,
                client: client || { id: 'unknown', clientName: 'Unknown Client', projectName: '', boqNumber: '', address: '', createdAt: Timestamp.now() } // fallback
            } as Backorder;
        }));

        // Sort manually after fetching and resolving
        return backorders.sort((a, b) => a.date.toMillis() - b.date.toMillis());

    } catch (error) {
        console.error("Error fetching backorders:", error);
        return [];
    }
}


export async function deleteBackorder(backorderId: string): Promise<void> {
    try {
        const backorderRef = doc(db, "backorders", backorderId);
        await deleteDoc(backorderRef);
    } catch (error) {
        console.error("Error deleting backorder:", error);
        throw new Error("Failed to delete reorder request.");
    }
}

// Tool Management
export async function getTools(): Promise<Tool[]> {
    try {
        const toolsCol = collection(db, "tools");
        const toolSnapshot = await getDocs(query(toolsCol, orderBy("name", "asc")));
        
        const tools = await Promise.all(toolSnapshot.docs.map(async (doc) => {
            const data = doc.data();
            const toolId = doc.id;
            
            let currentBorrowRecord: ToolBorrowRecord | null = null;
            if (data.status === 'In Use') {
                const borrowRecordsCol = collection(db, "toolBorrowRecords");
                const q = query(
                    borrowRecordsCol, 
                    where("toolId", "==", toolId), 
                    where("dateReturned", "==", null),
                    limit(1)
                );
                const activeBorrowsSnapshot = await getDocs(q);
                if (!activeBorrowsSnapshot.empty) {
                    const borrowDoc = activeBorrowsSnapshot.docs[0];
                    const borrowData = borrowDoc.data();
                    currentBorrowRecord = { 
                        id: borrowDoc.id, 
                        ...borrowData,
                        dateBorrowed: (borrowData.dateBorrowed as Timestamp).toDate(),
                        dueDate: borrowData.dueDate ? (borrowData.dueDate as Timestamp).toDate() : undefined,
                        dateReturned: borrowData.dateReturned ? (borrowData.dateReturned as Timestamp).toDate() : undefined,
                    } as ToolBorrowRecord;
                }
            }

            return { 
                id: toolId, 
                ...data,
                purchaseDate: data.purchaseDate ? (data.purchaseDate as Timestamp).toDate() : undefined,
                createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined,
                currentBorrowRecord: currentBorrowRecord
            } as Tool;
        }));
        
        return tools;
    } catch (error) {
        console.error("Error fetching tools:", error);
        return [];
    }
}

export async function addTool(tool: Partial<Omit<Tool, 'id' | 'status' | 'currentBorrowRecord' | 'assignedToUserId' | 'assignedToUserName' | 'createdAt'>>): Promise<DocumentReference> {
  try {
    const toolWithDefaults = {
      name: tool.name || "Unnamed Tool",
      serialNumber: tool.serialNumber || "",
      category: tool.category || "Other",
      condition: tool.condition || "Good",
      purchaseDate: tool.purchaseDate || null,
      purchaseCost: typeof tool.purchaseCost === 'number' && !isNaN(tool.purchaseCost) ? tool.purchaseCost : 0,
      borrowDuration: tool.borrowDuration || 7,
      location: tool.location || {},
      status: 'Available' as const,
      createdAt: Timestamp.now(),
    };
    return await addDoc(collection(db, "tools"), toolWithDefaults);
  } catch (error) {
    console.error("Error adding tool:", error);
    throw new Error("Failed to add tool.");
  }
}

export async function updateTool(toolId: string, data: Partial<Omit<Tool, 'id'>>): Promise<void> {
  try {
    const toolRef = doc(db, "tools", toolId);
    await updateDoc(toolRef, data);
  } catch (error) {
    console.error("Error updating tool:", error);
    throw new Error("Failed to update tool.");
  }
}

export async function deleteTool(toolId: string): Promise<void> {
    try {
        const toolRef = doc(db, "tools", toolId);
        await deleteDoc(toolRef);
    } catch (error) {
        console.error("Error deleting tool:", error);
        throw new Error("Failed to delete tool.");
    }
}

export async function borrowTool(toolId: string, borrowedBy: string, releasedBy: string, notes?: string): Promise<void> {
    const toolRef = doc(db, "tools", toolId);
    const userRef = doc(db, "users", borrowedBy);

    await runTransaction(db, async (transaction) => {
        const toolDoc = await transaction.get(toolRef);
        const userDoc = await transaction.get(userRef);

        if (!toolDoc.exists()) throw new Error("Tool not found.");
        if (!userDoc.exists()) throw new Error("User not found.");

        const toolData = toolDoc.data() as Tool;
        if (toolData.status !== 'Available') throw new Error("Tool is not available for borrowing.");

        const userData = userDoc.data() as UserProfile;
        const dateBorrowed = new Date();
        const dueDate = toolData.borrowDuration ? addDays(dateBorrowed, toolData.borrowDuration) : undefined;
        
        const newBorrowRecord = {
            toolId: toolId,
            borrowedBy: borrowedBy,
            borrowedByName: `${userData.firstName} ${userData.lastName}`,
            releasedBy,
            dateBorrowed: Timestamp.fromDate(dateBorrowed),
            dueDate: dueDate ? Timestamp.fromDate(dueDate) : null,
            dateReturned: null,
            notes: notes || "",
        };

        const borrowRecordRef = doc(collection(db, "toolBorrowRecords"));
        transaction.set(borrowRecordRef, newBorrowRecord);
        transaction.update(toolRef, { status: "In Use" });
    });
}

export async function returnTool(toolId: string, condition: Tool['condition'], notes?: string): Promise<void> {
    const borrowRecordsQuery = query(
        collection(db, "toolBorrowRecords"),
        where("toolId", "==", toolId),
        where("dateReturned", "==", null)
    );

    const snapshot = await getDocs(borrowRecordsQuery);
    if (snapshot.empty) {
        const toolDoc = await getDoc(doc(db, "tools", toolId));
        if (toolDoc.exists() && toolDoc.data().status !== "In Use") {
             console.warn(`Tool ${toolId} is already returned or in a non-borrowed state.`);
             return;
        }
        throw new Error("No active borrow record found for this tool.");
    }
    const activeBorrowRecordDoc = snapshot.docs[0];
    
    const borrowRecordRef = activeBorrowRecordDoc.ref;
    const toolRef = doc(db, "tools", toolId);

    await runTransaction(db, async (transaction) => {
        const toolDoc = await transaction.get(toolRef);
        if (!toolDoc.exists()) throw new Error("Tool not found.");
        
        let status: Tool['status'];
        if (condition === "Good") {
            status = "Available";
        } else { // Needs Repair or Damaged
            status = "Under Maintenance";
        }

        transaction.update(borrowRecordRef, {
            dateReturned: Timestamp.now(),
            returnCondition: condition,
            notes: notes || activeBorrowRecordDoc.data().notes,
        });

        transaction.update(toolRef, { status, condition });
    });
}

export async function updateToolConditionAndStatus(toolId: string, condition: Tool['condition'], status: Tool['status']): Promise<void> {
  try {
    const toolRef = doc(db, "tools", toolId);
    await updateDoc(toolRef, { condition, status });
  } catch (error) {
    console.error("Error updating tool condition and status:", error);
    throw new Error("Failed to update tool.");
  }
}


export async function getToolHistory(toolId: string): Promise<ToolBorrowRecord[]> {
    try {
        const q = query(collection(db, "toolBorrowRecords"), where("toolId", "==", toolId), orderBy("dateBorrowed", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
             return { 
                id: doc.id, 
                ...data,
                dateBorrowed: (data.dateBorrowed as Timestamp).toDate(),
                dueDate: data.dueDate ? (data.dueDate as Timestamp).toDate() : undefined,
                dateReturned: data.dateReturned ? (data.dateReturned as Timestamp).toDate() : undefined,
            } as ToolBorrowRecord;
        });
    } catch (error) {
        console.error("Error fetching tool history:", error);
        return [];
    }
}

export async function assignToolForAccountability(toolId: string, userId: string): Promise<void> {
    const toolRef = doc(db, "tools", toolId);
    const userRef = doc(db, "users", userId);

    return runTransaction(db, async (transaction) => {
        const toolDoc = await transaction.get(toolRef);
        if (!toolDoc.exists()) throw new Error("Tool not found.");
        if (toolDoc.data().status !== 'Available') throw new Error("Tool must be available to be assigned.");
        
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User not found.");
        const userData = userDoc.data() as UserProfile;

        transaction.update(toolRef, {
            status: "Assigned",
            assignedToUserId: userId,
            assignedToUserName: `${userData.firstName} ${userData.lastName}`
        });
    });
}

export async function recallTool(toolId: string, condition: Tool['condition'], notes?: string): Promise<void> {
    const toolRef = doc(db, "tools", toolId);
    
    await runTransaction(db, async (transaction) => {
        const toolDoc = await transaction.get(toolRef);
        if (!toolDoc.exists()) throw new Error("Tool not found.");
        if (toolDoc.data().status !== 'Assigned') throw new Error("Can only recall an assigned tool.");
        
        const newStatus: Tool['status'] = (condition === 'Good') ? 'Available' : 'Under Maintenance';
        
        transaction.update(toolRef, {
            status: newStatus,
            condition: condition,
            assignedToUserId: null,
            assignedToUserName: null,
        });

        // Optionally, create a history record for the recall
        const historyRef = doc(collection(db, "toolHistory"));
        transaction.set(historyRef, {
            toolId: toolId,
            type: "Recall",
            date: Timestamp.now(),
            notes: `Recalled with condition: ${condition}. ${notes || ''}`,
            userId: toolDoc.data().assignedToUserId
        });
    });
}

export async function getDisposalItems() {
    const returnsCol = collection(db, "returns");
    const q = query(returnsCol, where("status", "==", "Completed"));
    const snapshot = await getDocs(q);

    const disposalItems: any[] = [];
    
    for (const doc of snapshot.docs) {
        const returnData = doc.data() as Return;
        if (returnData.inspection && returnData.inspection.items) {
            for (const item of returnData.inspection.items) {
                if (item.disposalQuantity > 0) {
                     // Need to get product name/sku as it's not stored on the return item
                    const inspectionItem = returnData.items.find(i => i.productId === item.productId);
                    disposalItems.push({
                        returnId: doc.id,
                        productId: item.productId,
                        productName: inspectionItem?.name || "Unknown Product",
                        productSku: inspectionItem?.sku || "N/A",
                        disposalQuantity: item.disposalQuantity,
                        inspectionDate: (returnData.inspection.date as Timestamp).toDate(),
                        rmaNumber: returnData.rmaNumber,
                    });
                }
            }
        }
    }
    return disposalItems;
}

export async function disposeItemsAndTools(
  items: { id: string; type: 'product' | 'tool'; name: string, identifier?: string, sourceId: string }[], 
  reason: string
): Promise<void> {
    const batch = writeBatch(db);
    const now = Timestamp.now();

    for (const item of items) {
        if (item.type === 'tool') {
            const toolRef = doc(db, "tools", item.id);
            batch.delete(toolRef);

        } else if (item.type === 'product') {
            const returnRef = doc(db, "returns", item.sourceId);
            // We don't delete the return, just log that its items were disposed.
            // A better approach might be to update a field on the return item.
        }

         // Create a record of the disposal
        const disposalRecordRef = doc(collection(db, "disposalRecords"));
        batch.set(disposalRecordRef, {
            itemId: item.id,
            itemName: item.name,
            itemIdentifier: item.identifier,
            itemType: item.type,
            reason: reason,
            date: now,
            source: item.type === 'product' ? `RMA from return ${item.sourceId}` : `Tool ID ${item.sourceId}`
        });
    }

    await batch.commit();
}


type SalvagedPartData = Omit<SalvagedPart, 'id' | 'salvageDate' | 'originalToolId' | 'originalToolName'>;

export async function partOutTools(toolIds: string[], parts: SalvagedPartData[], notes?: string): Promise<void> {
    const batch = writeBatch(db);
    const now = Timestamp.now();

    const toolDocs = await Promise.all(toolIds.map(id => getDoc(doc(db, "tools", id))));

    for (let i = 0; i < toolIds.length; i++) {
        const toolId = toolIds[i];
        const toolDoc = toolDocs[i];

        if (toolDoc.exists()) {
            const toolData = toolDoc.data() as Tool;

            // Log the salvaged parts
            for (const part of parts) {
                const salvagedPartRef = doc(collection(db, "salvagedParts"));
                batch.set(salvagedPartRef, {
                    ...part,
                    salvageDate: now,
                    originalToolId: toolId,
                    originalToolName: toolData.name,
                    notes: notes,
                });
            }

            // Create a disposal record for the original tool
            const disposalRecordRef = doc(collection(db, "disposalRecords"));
            batch.set(disposalRecordRef, {
                itemId: toolId,
                itemName: toolData.name,
                itemIdentifier: toolData.serialNumber,
                itemType: 'tool',
                reason: 'For Parts Out',
                date: now,
                notes: `Salvaged ${parts.length} part types. ${notes || ''}`
            });
            
            // Delete the original tool
            batch.delete(toolDoc.ref);
        }
    }

    await batch.commit();
}
    

export async function getDisposalRecords(): Promise<DisposalRecord[]> {
    try {
        const recordsCol = collection(db, "disposalRecords");
        const q = query(recordsCol, orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: (data.date as Timestamp).toDate(),
            } as DisposalRecord;
        });
    } catch (error) {
        console.error("Error fetching disposal records:", error);
        return [];
    }
}

export async function deleteDisposalRecord(recordId: string): Promise<void> {
    try {
        const recordRef = doc(db, "disposalRecords", recordId);
        await deleteDoc(recordRef);
    } catch (error) {
        console.error("Error deleting disposal record:", error);
        throw new Error("Failed to delete disposal record.");
    }
}


export async function getToolMaintenanceHistory(): Promise<ToolMaintenanceRecord[]> {
    try {
        const borrowRecordsCol = collection(db, "toolBorrowRecords");
        const maintenanceBorrowQuery = query(
        borrowRecordsCol,
        where("returnCondition", "in", ["Needs Repair", "Damaged"])
        );
        const borrowSnapshot = await getDocs(maintenanceBorrowQuery);

        const maintenanceMap = new Map<string, ToolMaintenanceRecord>();

        borrowSnapshot.forEach(doc => {
            const data = doc.data() as ToolBorrowRecord;
            maintenanceMap.set(data.toolId, {
                id: doc.id,
                toolId: data.toolId,
                toolName: '', // Will be filled later
                serialNumber: '', // Will be filled later
                dateEntered: (data.dateReturned as Timestamp)?.toDate(),
                outcome: 'Repaired' // Default to Repaired
            });
        });

        const disposalRecordsCol = collection(db, "disposalRecords");
        const disposedToolsQuery = query(disposalRecordsCol, where("itemType", "==", "tool"));
        const disposalSnapshot = await getDocs(disposedToolsQuery);

        const toolIds = Array.from(maintenanceMap.keys());
        
        disposalSnapshot.docs.forEach(doc => {
            const disposalData = doc.data() as DisposalRecord;
            if (disposalData.itemId && !maintenanceMap.has(disposalData.itemId)) {
                toolIds.push(disposalData.itemId);
            }
        });

        const toolDetailsMap = new Map<string, {name: string, serialNumber: string}>();
        if (toolIds.length > 0) {
            // Firestore 'in' query has a limit of 30 elements.
            // For a real-world app, you might need to batch this.
            const toolQuery = query(collection(db, "tools"), where("__name__", "in", toolIds.slice(0, 30)));
            const toolSnapshot = await getDocs(toolQuery);
            toolSnapshot.docs.forEach(doc => {
                const data = doc.data();
                toolDetailsMap.set(doc.id, { name: data.name, serialNumber: data.serialNumber });
            });
        }
        
        disposalSnapshot.docs.forEach(doc => {
        const disposalData = doc.data() as DisposalRecord;
        if (disposalData.itemId) {
            if (maintenanceMap.has(disposalData.itemId)) {
                maintenanceMap.get(disposalData.itemId)!.outcome = 'Disposed';
            } else {
                maintenanceMap.set(disposalData.itemId, {
                    id: doc.id,
                    toolId: disposalData.itemId,
                    toolName: disposalData.itemName,
                    serialNumber: disposalData.itemIdentifier || 'N/A',
                    dateEntered: disposalData.date,
                    outcome: 'Disposed',
                });
            }
        }
        });
        
        maintenanceMap.forEach((record, toolId) => {
            const details = toolDetailsMap.get(toolId);
            if (details) {
                record.toolName = details.name;
                record.serialNumber = details.serialNumber;
            } else if (!record.toolName) {
                const disposalRecord = disposalSnapshot.docs.find(d => d.data().itemId === toolId)?.data() as DisposalRecord;
                if (disposalRecord) {
                    record.toolName = disposalRecord.itemName;
                    record.serialNumber = disposalRecord.itemIdentifier || 'N/A';
                }
            }
        });

        const history = Array.from(maintenanceMap.values());
        return history.sort((a,b) => b.dateEntered.getTime() - a.dateEntered.getTime());
    } catch (error) {
        console.error("Error fetching tool maintenance history:", error);
        return [];
    }
}

export async function deleteMaintenanceRecords(recordIds: string[]): Promise<void> {
  if (recordIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    recordIds.forEach(id => {
      // These records are derived, so we delete from the source collections
      const borrowRecordRef = doc(db, "toolBorrowRecords", id);
      const disposalRecordRef = doc(db, "disposalRecords", id);
      
      // We don't know which collection the ID belongs to, so we try to delete from both.
      // Firestore's batch delete doesn't throw an error if the doc doesn't exist.
      batch.delete(borrowRecordRef);
      batch.delete(disposalRecordRef);
    });
    await batch.commit();
  } catch (error) {
    console.error("Error deleting maintenance records:", error);
    throw new Error("Failed to delete maintenance history records.");
  }
}


type NewBookingRequestData = {
    toolId: string;
    requestedById: string;
    startDate: Date;
    endDate: Date;
    notes?: string;
};

export async function createToolBookingRequest(data: NewBookingRequestData): Promise<void> {
    try {
        const toolRef = doc(db, "tools", data.toolId);
        const userRef = doc(db, "users", data.requestedById);

        const [toolDoc, userDoc] = await Promise.all([getDoc(toolRef), getDoc(userRef)]);

        if (!toolDoc.exists()) throw new Error("Tool not found.");
        if (toolDoc.data().status !== 'Available') throw new Error("Tool is not currently available for booking.");
        if (!userDoc.exists()) throw new Error("Requesting user not found.");

        const toolData = toolDoc.data() as Tool;
        const userData = userDoc.data() as UserProfile;

        const newRequest = {
            toolId: data.toolId,
            toolName: toolData.name,
            requestedById: data.requestedById,
            requestedByName: `${userData.firstName} ${userData.lastName}`,
            startDate: Timestamp.fromDate(data.startDate),
            endDate: Timestamp.fromDate(data.endDate),
            notes: data.notes || "",
            status: "Pending",
            createdAt: Timestamp.now(),
        };

        await addDoc(collection(db, "toolBookingRequests"), newRequest);

        await createNotification({
            title: "New Tool Request",
            description: `${newRequest.requestedByName} requested to borrow the ${newRequest.toolName}.`,
            details: `A new tool booking request has been submitted for approval.`,
            href: "/tools",
            icon: "Package",
        });
    } catch (error) {
        console.error("Error creating tool booking request:", error);
        throw error;
    }
}

export async function getToolBookingRequests(): Promise<ToolBookingRequest[]> {
    try {
        const requestsCol = collection(db, "toolBookingRequests");
        const q = query(requestsCol, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                startDate: (data.startDate as Timestamp).toDate(),
                endDate: (data.endDate as Timestamp).toDate(),
                createdAt: (data.createdAt as Timestamp).toDate(),
            } as ToolBookingRequest;
        });
    } catch (error) {
        console.error("Error fetching tool booking requests:", error);
        return [];
    }
}

export async function approveToolBookingRequest(requestId: string, approvedBy: string): Promise<void> {
    const requestRef = doc(db, "toolBookingRequests", requestId);
    
    await runTransaction(db, async (transaction) => {
        const requestDoc = await transaction.get(requestRef);
        if (!requestDoc.exists()) throw new Error("Booking request not found.");
        
        const requestData = requestDoc.data();
        if (requestData.status !== 'Pending') throw new Error("This request has already been actioned.");
        
        const toolRef = doc(db, "tools", requestData.toolId);
        const toolDoc = await transaction.get(toolRef);
        if (!toolDoc.exists()) throw new Error("Requested tool no longer exists.");
        if (toolDoc.data().status !== 'Available') throw new Error("Tool is no longer available.");

        // Update the tool's status
        transaction.update(toolRef, { status: 'In Use' });

        // Create a new borrow record
        const borrowRecordRef = doc(collection(db, "toolBorrowRecords"));
        transaction.set(borrowRecordRef, {
            toolId: requestData.toolId,
            borrowedBy: requestData.requestedById,
            borrowedByName: requestData.requestedByName,
            dateBorrowed: requestData.startDate, // Use the requested start date
            dueDate: requestData.endDate, // Use the requested end date
            dateReturned: null,
            notes: `Booked via request. ${requestData.notes || ''}`,
            releasedBy: approvedBy,
        });

        // Update the request status
        transaction.update(requestRef, { status: 'Approved' });
    });
}

export async function rejectToolBookingRequest(requestId: string): Promise<void> {
    const requestRef = doc(db, "toolBookingRequests", requestId);
    const requestDoc = await getDoc(requestRef);
    if (!requestDoc.exists()) throw new Error("Request not found.");
    if (requestDoc.data().status !== 'Pending') throw new Error("Request has already been actioned.");

    await updateDoc(requestRef, { status: 'Rejected' });
}

export async function getVehicles(): Promise<Vehicle[]> {
    try {
        const vehiclesCol = collection(db, "vehicles");
        const q = query(vehiclesCol, orderBy("make", "asc"));
        const vehicleSnapshot = await getDocs(q);
        return vehicleSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt,
            } as Vehicle;
        });
    } catch (error) {
        console.error("Error fetching vehicles:", error);
        return [];
    }
}

export async function addVehicle(vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'status'>): Promise<DocumentReference> {
  try {
    const vehicleWithDefaults = {
      ...vehicle,
      status: 'Available' as const,
      createdAt: Timestamp.now(),
    };
    return await addDoc(collection(db, "vehicles"), vehicleWithDefaults);
  } catch (error) {
    console.error("Error adding vehicle:", error);
    throw new Error("Failed to add vehicle.");
  }
}

export async function getTransactions(): Promise<Transaction[]> {
    try {
        const transactionsCol = collection(db, "transactions");
        const q = query(transactionsCol, orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        
        let runningBalance = 0;
        const transactions: Transaction[] = [];
        
        // Go through docs in reverse to calculate running balance correctly
        const docs = snapshot.docs.reverse();
        for (const doc of docs) {
            const data = doc.data();
            const transactionAmount = data.credit ? data.credit : -(data.debit || 0);
            runningBalance += transactionAmount;
            transactions.push({
                id: doc.id,
                balance: runningBalance,
                ...data
            } as Transaction);
        }
        
        // Reverse back to get descending date order
        return transactions.reverse();

    } catch (error) {
        console.error("Error fetching transactions:", error);
        return [];
    }
}

export async function payPurchaseOrder(poId: string, amount: number): Promise<void> {
  const poRef = doc(db, "purchaseOrders", poId);
  const now = Timestamp.now();

  return runTransaction(db, async (transaction) => {
    // --- 1. READS ---
    const poDoc = await transaction.get(poRef);
    if (!poDoc.exists()) throw new Error("Purchase Order not found.");
    const poData = poDoc.data() as PurchaseOrder;

    const supplier = await resolveDoc<Supplier>(poData.supplierRef as DocumentReference);
    if(!supplier) throw new Error("Supplier not found for PO.");

    // --- 2. LOGIC ---
    if (poData.paymentStatus === 'Paid') throw new Error("This Purchase Order has already been paid.");
    
    // --- 3. WRITES ---
    // Update PO payment status
    transaction.update(poRef, { paymentStatus: 'Paid' });

    // Create GL entries for the payment
    const cashTx = {
        date: now,
        description: `Payment for PO #${poData.poNumber}`,
        account: 'Cash',
        debit: 0,
        credit: amount,
        entity: supplier.name,
    };
    const accountsPayableTx = {
        date: now,
        description: `Payment to ${supplier.name} for PO #${poData.poNumber}`,
        account: 'Accounts Payable',
        debit: amount,
        credit: 0,
        entity: supplier.name,
    };
    transaction.set(doc(collection(db, 'transactions')), cashTx);
    transaction.set(doc(collection(db, 'transactions')), accountsPayableTx);
  });
}

export async function getLaborEntries(): Promise<LaborEntry[]> {
    try {
        const laborCol = collection(db, "laborEntries");
        const q = query(laborCol, orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: (data.date as Timestamp).toDate(),
            } as LaborEntry;
        });
    } catch (error) {
        console.error("Error fetching labor entries:", error);
        return [];
    }
}

export async function addLaborEntry(entryData: Omit<LaborEntry, 'id' | 'cost' | 'userName' | 'projectName'>): Promise<void> {
  const now = Timestamp.now();

  return runTransaction(db, async (transaction) => {
    // --- 1. READS ---
    const userRef = doc(db, 'users', entryData.userId);
    const clientRef = doc(db, 'clients', entryData.clientId);
    
    const [userDoc, clientDoc] = await Promise.all([
      transaction.get(userRef),
      transaction.get(clientRef)
    ]);
    
    if (!userDoc.exists()) throw new Error("Worker not found.");
    if (!clientDoc.exists()) throw new Error("Project not found.");

    const userData = userDoc.data() as UserProfile;
    const clientData = clientDoc.data() as Client;
    
    // --- 2. LOGIC ---
    const dailyRate = userData.dailyRate || 0; // Default to 0 if not set
    const hourlyRate = dailyRate / 8; // Assuming an 8-hour workday
    const cost = entryData.hoursWorked * hourlyRate;

    // --- 3. WRITES ---
    const laborEntryRef = doc(collection(db, 'laborEntries'));
    transaction.set(laborEntryRef, {
      ...entryData,
      date: Timestamp.fromDate(entryData.date),
      userName: `${userData.firstName} ${userData.lastName}`,
      projectName: clientData.projectName,
      cost: cost,
    });
    
    // Create GL entry for the labor cost
    const wagesTx = {
      date: now,
      description: `Wages for ${userData.firstName} ${userData.lastName} on project ${clientData.projectName}`,
      account: 'Wages Expense',
      debit: cost,
      credit: 0,
      entity: `${userData.firstName} ${userData.lastName}`,
    };
    transaction.set(doc(collection(db, 'transactions')), wagesTx);

    const cashTx = {
      date: now,
      description: `Cash payment for labor: ${userData.firstName} ${userData.lastName}`,
      account: 'Cash',
      debit: 0,
      credit: cost,
      entity: `${userData.firstName} ${userData.lastName}`,
    };
    transaction.set(doc(collection(db, 'transactions')), cashTx);
  });
}

export async function getExpenses(): Promise<Expense[]> {
    try {
        const expensesCol = collection(db, "expenses");
        const q = query(expensesCol, orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        
        const expenses: Expense[] = await Promise.all(snapshot.docs.map(async (doc) => {
            const data = doc.data();
            let projectName: string | undefined;
            if (data.clientId) {
                const client = await resolveDoc<Client>(doc(db, 'clients', data.clientId));
                projectName = client?.projectName;
            }
            return {
                id: doc.id,
                ...data,
                date: (data.date as Timestamp).toDate(),
                projectName,
            } as Expense;
        }));
        return expenses;

    } catch (error) {
        console.error("Error fetching expenses:", error);
        return [];
    }
}

type NewExpenseData = Omit<Expense, 'id' | 'projectName'>;
export async function addExpense(expenseData: NewExpenseData): Promise<void> {
  const now = Timestamp.now();

  return runTransaction(db, async (transaction) => {
    let clientName = 'General';
    if(expenseData.clientId && expenseData.clientId !== 'none') {
        const clientRef = doc(db, 'clients', expenseData.clientId);
        const clientDoc = await transaction.get(clientRef);
        if(clientDoc.exists()) {
            clientName = clientDoc.data().clientName;
        }
    }
    
    const finalExpenseData: any = {...expenseData};
    if (expenseData.clientId === 'none') {
        delete finalExpenseData.clientId;
    }
    
    const expenseRef = doc(collection(db, 'expenses'));
    transaction.set(expenseRef, {
        ...finalExpenseData,
        date: Timestamp.fromDate(expenseData.date),
    });

    const expenseTx = {
      date: now,
      description: expenseData.description,
      account: expenseData.category,
      debit: expenseData.amount,
      credit: 0,
      entity: expenseData.payee,
    };
    transaction.set(doc(collection(db, 'transactions')), expenseTx);

    const cashTx = {
      date: now,
      description: `Payment to ${expenseData.payee} for ${expenseData.description}`,
      account: 'Cash',
      debit: 0,
      credit: expenseData.amount,
      entity: expenseData.payee,
    };
    transaction.set(doc(collection(db, 'transactions')), cashTx);
  });
}

export async function getMaterialRequisitions(): Promise<MaterialRequisition[]> {
    try {
        const requisitionsCol = collection(db, "materialRequisitions");
        const q = query(requisitionsCol, orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        const requisitions = await Promise.all(snapshot.docs.map(async doc => {
            const data = doc.data();
            
            const project = data.projectRef ? await resolveDoc<Client>(data.projectRef) : null;
            const requester = data.requestedByRef ? await resolveDoc<UserProfile>(data.requestedByRef) : null;

            const items = await Promise.all(data.items.map(async (item: any) => {
                const productDoc = await getDoc(item.productRef);
                const productData = productDoc.exists() ? {id: productDoc.id, ...productDoc.data()} : null;
                return { ...item, productRef: { ...productData } };
            }));

            return {
                id: doc.id,
                ...data,
                date: (data.date as Timestamp),
                projectName: project ? project.projectName : 'General Use',
                requestedByName: requester ? `${requester.firstName} ${requester.lastName}` : 'Unknown',
                items: items,
            } as MaterialRequisition;
        }));
        return requisitions;
    } catch (error) {
        console.error("Error fetching material requisitions:", error);
        return [];
    }
}

type NewMaterialRequisitionData = {
    projectId: string;
    requestedBy: string;
    items: { productId: string, quantity: number }[];
}

export async function addMaterialRequisition(data: NewMaterialRequisitionData): Promise<void> {
  const requisitionRef = doc(collection(db, "materialRequisitions"));
  const now = Timestamp.now();

  await runTransaction(db, async (transaction) => {
    let projectRef: DocumentReference | null = null;
    let clientRef: DocumentReference | null = null;
    let clientDoc: any = null;

    if (data.projectId !== 'general-use') {
      projectRef = doc(db, "clients", data.projectId);
      clientRef = projectRef;
      clientDoc = await transaction.get(clientRef);
      if (!clientDoc.exists()) throw new Error("Project/Client not found.");
    }

    const productRefs = data.items.map(item => doc(db, 'inventory', item.productId));
    const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));

    const backorderItems: any[] = [];
    const itemsForRequisition = data.items.map((item, index) => {
      const productDoc = productDocs[index];
      if (!productDoc.exists()) throw new Error(`Product with ID ${item.productId} not found.`);
      
      const productData = productDoc.data() as Product;
      const stockNeeded = item.quantity;
      const stockAvailable = productData.stock;

      if (stockAvailable < stockNeeded) {
        const backorderQty = stockNeeded - stockAvailable;
        backorderItems.push({
          orderId: requisitionRef.id,
          orderRef: null, // MRFs don't have an order ref in the same way
          clientRef: clientRef,
          productId: productDoc.id,
          productRef: productDoc.ref,
          productName: productData.name,
          productSku: productData.sku,
          quantity: backorderQty,
          date: now,
          status: 'Pending',
        });
      }

      return {
        productRef: productDoc.ref,
        quantity: item.quantity,
      };
    });

    const newRequisition = {
      mrfNumber: `MRF-${Date.now()}`,
      projectRef: projectRef,
      requestedByRef: doc(db, 'users', data.requestedBy),
      date: now,
      status: 'Pending',
      items: itemsForRequisition
    };

    transaction.set(requisitionRef, newRequisition);

    // Create Backorder records for shortfalls
    for (const backorderItem of backorderItems) {
      const backorderRef = doc(collection(db, 'backorders'));
      transaction.set(backorderRef, backorderItem);
    }
  });

   await createNotification({
        title: "Material Request Submitted",
        description: `A new material requisition has been submitted.`,
        details: `A new material requisition (MRF-${now.toMillis()}) has been submitted for approval.`,
        href: "/production",
        icon: "Package",
    });
}


export async function getJobOrders(): Promise<JobOrder[]> {
    try {
        const jobsCol = collection(db, "jobOrders");
        const q = query(jobsCol, orderBy("date", "desc"));
        const snapshot = await getDocs(q);

        const jobs: JobOrder[] = await Promise.all(snapshot.docs.map(async doc => {
            const data = doc.data();
            
            const project = data.projectRef ? await resolveDoc<Client>(data.projectRef) : null;
            const assignedTo = data.assignedToRef ? await resolveDoc<UserProfile>(data.assignedToRef) : null;
            
             const items = await Promise.all((data.items || []).map(async (item: any) => {
                const productDoc = await getDoc(item.productRef);
                const productData = productDoc.exists() ? {id: productDoc.id, ...productDoc.data()} : null;
                return { ...item, productRef: { ...productData } };
            }));

            return {
                id: doc.id,
                ...data,
                date: data.date,
                projectName: project ? project.projectName : 'General Use',
                assignedToName: assignedTo ? `${assignedTo.firstName} ${assignedTo.lastName}` : undefined,
                items,
            } as JobOrder;
        }));
        return jobs;
    } catch (error) {
        console.error("Error fetching job orders:", error);
        return [];
    }
}

export async function updateJobOrderItemStatus(jobOrderId: string, itemId: string, newStatus: JobOrderItem['status'], qcNotes?: string): Promise<void> {
    const jobOrderRef = doc(db, "jobOrders", jobOrderId);
    await runTransaction(db, async (transaction) => {
        const jobOrderDoc = await transaction.get(jobOrderRef);
        if (!jobOrderDoc.exists()) throw new Error("Job Order not found.");

        const jobOrderData = jobOrderDoc.data() as JobOrder;
        const items = jobOrderData.items;
        
        const itemIndex = items.findIndex(i => i.id === itemId);
        if (itemIndex === -1) throw new Error("Job order item not found.");
        
        items[itemIndex].status = newStatus;
        if (qcNotes) {
            items[itemIndex].qcNotes = qcNotes;
        }

        // Optionally, update the overall job order status
        const allItemsCompleted = items.every(i => i.status === 'QC Passed' || i.status === 'Dispatched');
        const newJobStatus = allItemsCompleted ? 'Completed' : jobOrderData.status;

        transaction.update(jobOrderRef, { items: items, status: newJobStatus });
    });
}

export async function getInstallations(): Promise<Installation[]> {
    try {
        const installationsCol = collection(db, "installations");
        const q = query(installationsCol, orderBy("scheduledStartDate", "desc"));
        const snapshot = await getDocs(q);

        const installations: Installation[] = await Promise.all(snapshot.docs.map(async doc => {
            const data = doc.data();
            const assignedCrew = await resolveDoc<UserProfile>(data.assignedCrewRef);

            // For simplicity, we'll derive the project name from the first job order
            let projectName = 'Multiple Projects';
            if (data.jobOrderRefs && data.jobOrderRefs.length > 0) {
                const firstJobOrder = await resolveDoc<JobOrder>(data.jobOrderRefs[0]);
                if (firstJobOrder?.projectRef) {
                    const project = await resolveDoc<Client>(firstJobOrder.projectRef);
                    if(project) projectName = project.projectName;
                } else if (firstJobOrder) {
                    projectName = 'General Use';
                }
            }
            
            return {
                id: doc.id,
                ...data,
                assignedCrewName: assignedCrew ? `${assignedCrew.firstName} ${assignedCrew.lastName}` : 'Unassigned',
                projectName: projectName,
                scheduledStartDate: (data.scheduledStartDate as Timestamp).toDate(),
                scheduledEndDate: (data.scheduledEndDate as Timestamp).toDate(),
            } as Installation;
        }));

        return installations;
    } catch (error) {
        console.error("Error fetching installations:", error);
        return [];
    }
}

type NewInstallationData = {
    assignedCrewId: string;
    startDate: Date;
    endDate: Date;
    items: { jobId: string, itemId: string }[];
};

export async function addInstallation(data: NewInstallationData): Promise<void> {
    const installationRef = doc(collection(db, "installations"));
    
    await runTransaction(db, async (transaction) => {
        const jobOrderRefsMap = new Map<string, DocumentReference>();
        data.items.forEach(item => {
            if (!jobOrderRefsMap.has(item.jobId)) {
                jobOrderRefsMap.set(item.jobId, doc(db, "jobOrders", item.jobId));
            }
        });

        const jobOrderDocs = await Promise.all(Array.from(jobOrderRefsMap.values()).map(ref => transaction.get(ref)));

        for (const jobDoc of jobOrderDocs) {
            if (!jobDoc.exists()) throw new Error(`Job Order with ID ${jobDoc.id} not found.`);
            const jobData = jobDoc.data() as JobOrder;
            
            const updatedItems = jobData.items.map(item => {
                if (data.items.some(i => i.jobId === jobDoc.id && i.itemId === item.id)) {
                    if (item.status !== 'QC Passed') throw new Error(`Item ${item.id} is not ready for installation.`);
                    return { ...item, status: 'Dispatched' };
                }
                return item;
            });
            transaction.update(jobDoc.ref, { items: updatedItems });
        }
        
        const newInstallation = {
            installationNumber: `INSTALL-${Date.now()}`,
            jobOrderRefs: Array.from(jobOrderRefsMap.values()),
            assignedCrewRef: doc(db, "users", data.assignedCrewId),
            scheduledStartDate: Timestamp.fromDate(data.startDate),
            scheduledEndDate: Timestamp.fromDate(data.endDate),
            status: "Scheduled",
            punchlist: [],
        };
        
        transaction.set(installationRef, newInstallation);
    });
}
    
