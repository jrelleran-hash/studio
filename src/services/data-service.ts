

import { db, storage } from "@/lib/firebase";
import { collection, getDocs, getDoc, doc, orderBy, query, limit, Timestamp, where, DocumentReference, addDoc, updateDoc, deleteDoc, arrayUnion, runTransaction, writeBatch, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { Activity, Notification, Order, Product, Client, Issuance, Supplier, PurchaseOrder, Shipment, Return, ReturnItem, OutboundReturn, OutboundReturnItem, UserProfile, OrderItem, PurchaseOrderItem, IssuanceItem, Backorder, UserRole } from "@/types";
import { format, subDays } from 'date-fns';

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
      href: `/inventory`,
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

export async function uploadProductPicture(file: File, productId: string): Promise<string> {
    try {
        const fileExtension = file.name.split('.').pop();
        const fileName = `${productId}.${fileExtension}`;
        const storageRef = ref(storage, `product-pictures/${fileName}`);

        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return downloadURL;
    } catch (error) {
        console.error("Error uploading product picture:", error);
        throw new Error("Failed to upload product picture.");
    }
}

export async function addProduct(product: Partial<Omit<Product, 'id' | 'lastUpdated' | 'history' | 'maxStockLevel'>> & { maxStockLevel?: number, photoFile?: File }): Promise<DocumentReference> {
  try {
    const now = Timestamp.now();
    let photoURL = "";
    
    const productsCol = collection(db, "inventory");
    // Create doc ref first to get an ID for the image path
    const docRef = doc(productsCol); 
    
    if (product.photoFile) {
        photoURL = await uploadProductPicture(product.photoFile, docRef.id);
    }
    
    const productWithDefaults = {
      name: product.name || "Unnamed Product",
      sku: product.sku || "",
      stock: product.stock || 0,
      price: product.price || 0,
      reorderLimit: product.reorderLimit || 10,
      maxStockLevel: product.maxStockLevel || 100,
      location: product.location || "",
      supplier: product.supplier || "",
      photoURL: photoURL,
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


export async function updateProduct(productId: string, productData: Partial<Omit<Product, 'id' | 'sku'>> & { photoFile?: File }): Promise<void> {
  try {
    const productRef = doc(db, "inventory", productId);
    const originalDoc = await getDoc(productRef);
    if (!originalDoc.exists()) throw new Error("Product not found");
    const originalData = originalDoc.data() as Product;

    const now = Timestamp.now();
    const { photoFile, ...restOfData } = productData;
    const updatePayload: any = { ...restOfData, lastUpdated: now };

    if (photoFile) {
        updatePayload.photoURL = await uploadProductPicture(photoFile, productId);
    }

    // If stock is being updated, add a new history entry
    if (productData.stock !== undefined && productData.stock !== originalData?.stock) {
        const newHistoryEntry = {
            date: format(now.toDate(), 'yyyy-MM-dd'),
            stock: productData.stock,
            dateUpdated: now
        };
        updatePayload.history = arrayUnion(newHistoryEntry);
    }


    await updateDoc(productRef, updatePayload);

    // Re-fetch the full product to pass to notification check
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
};

export async function addOrder(orderData: NewOrderData): Promise<DocumentReference> {
  const orderDate = Timestamp.now();

  return runTransaction(db, async (transaction) => {
    // --- 1. READS ---
    const clientRef = doc(db, "clients", orderData.clientId);
    const clientDoc = await transaction.get(clientRef);
    if (!clientDoc.exists()) throw new Error("Client not found.");

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
    const newOrder: any = {
      clientRef: clientRef,
      date: orderDate,
      items: orderItems,
      status: overallStatus,
      total: total,
    };
    if (orderData.reorderedFrom) {
      newOrder.reorderedFrom = orderData.reorderedFrom;
    }
    transaction.set(orderRef, newOrder);

    // Create backorder records
    for (const backorderItem of backorderItems) {
        const backorderRef = doc(collection(db, 'backorders'));
        transaction.set(backorderRef, backorderItem);
    }
    
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
};

export async function addIssuance(issuanceData: NewIssuanceData): Promise<DocumentReference> {
  const issuanceNumber = `IS-${Date.now()}`;
  const issuanceDate = Timestamp.now();
  const clientRef = doc(db, "clients", issuanceData.clientId);
  const allProductIds = issuanceData.items.map(i => i.productId).filter(Boolean);

  // Fetch existing reorders outside the transaction
  let existingReorders = new Map<string, Backorder>();
  if (allProductIds.length > 0) {
    const backorderQuery = query(
      collection(db, "backorders"),
      where("productId", "in", allProductIds),
      where("orderId", "==", "REORDER")
    );
    const backorderSnapshot = await getDocs(backorderQuery);
    backorderSnapshot.docs.forEach(d => {
      existingReorders.set(d.data().productId, d.data() as Backorder);
    });
  }

  return runTransaction(db, async (transaction) => {
    const productRefs = allProductIds.map(id => doc(db, "inventory", id));
    const productDocs = allProductIds.length > 0 ? await Promise.all(productRefs.map(ref => transaction.get(ref))) : [];

    let orderDoc: any;
    if (issuanceData.orderId) {
      const orderRef = doc(db, "orders", issuanceData.orderId);
      orderDoc = await transaction.get(orderRef);
    }

    const backordersToCreate: any[] = [];

    for (let i = 0; i < issuanceData.items.length; i++) {
      const item = issuanceData.items[i];
      const productDoc = productDocs[i];

      if (!productDoc?.exists()) throw new Error(`Product with ID ${item.productId} not found.`);

      const productData = productDoc.data() as Product;

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

    const docRef = doc(collection(db, "issuances"));
    transaction.set(docRef, newIssuance);

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

export async function uploadProfilePicture(file: File, userId: string): Promise<string> {
    try {
        const fileExtension = file.name.split('.').pop();
        const fileName = `${userId}.${fileExtension}`;
        const storageRef = ref(storage, `profile-pictures/${fileName}`);

        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return downloadURL;
    } catch (error) {
        console.error("Error uploading profile picture:", error);
        throw new Error("Failed to upload profile picture.");
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
        
        const resolvedItems = poData.items.map(item => ({
            productRef: doc(db, "inventory", item.productId),
            quantity: item.quantity,
        }));

        const newPurchaseOrder: any = {
            supplierRef: supplierRef,
            orderDate: poDate,
            status: "Pending",
            items: resolvedItems,
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
                    details: `All items for order ${orderDoc.id.substring(0,7)} are in stock and ready to be issued.`,
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
            if (poDoc.data().status !== 'Delivered') throw new Error("Can only inspect 'Delivered' purchase orders.");

            const poData = poDoc.data();
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

            transaction.update(poRef, { status: "Completed" });
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
        await setDoc(userRef, data);
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

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { role });
  } catch (error) {
    console.error("Error updating user role:", error);
    throw new Error("Failed to update user role.");
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
    // Do not throw an error that stops the UI, just log it.
    // This is a cleanup operation, not critical path.
  }
}
