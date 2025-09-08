






import { db } from "@/lib/firebase";
import { collection, getDocs, getDoc, doc, orderBy, query, limit, Timestamp, where, DocumentReference, addDoc, updateDoc, deleteDoc, arrayUnion } from "firebase/firestore";
import type { Activity, Notification, Order, Product, Client } from "@/types";
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

async function resolveDoc<T>(docRef: DocumentReference): Promise<T> {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
        throw new Error(`Document with ref ${docRef.path} does not exist.`);
    }
    return { id: docSnap.id, ...docSnap.data() } as T;
}


export async function getRecentActivities(count: number = 4): Promise<(Activity & { time: string })[]> {
  try {
    const activitiesCol = collection(db, "activities");
    const q = query(activitiesCol, orderBy("timestamp", "desc"), limit(count));
    const activitySnapshot = await getDocs(q);
    const activityList = activitySnapshot.docs.map(doc => {
      const data = doc.data() as Omit<Activity, 'id'>;
      const timestamp = (data.timestamp as unknown as Timestamp).toDate();
      return { 
        id: doc.id,
        ...data,
        timestamp,
        time: timeSince(timestamp),
      };
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

export async function getLowStockProducts(): Promise<Product[]> {
    try {
        const productsCol = collection(db, "inventory");
        const productSnapshot = await getDocs(productsCol);
        const allProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        
        // Firestore cannot compare two fields directly, so we filter in code.
        const lowStockProducts = allProducts.filter(p => p.stock <= p.reorderLimit);
        
        // Sort by how far under the limit they are
        return lowStockProducts.sort((a, b) => (a.stock - a.reorderLimit) - (b.stock - b.reorderLimit));
    } catch (error) {
        console.error("Error fetching low stock products:", error);
        return [];
    }
}

export async function getRecentOrders(count: number): Promise<Order[]> {
    try {
        const ordersCol = collection(db, "orders");
        const q = query(ordersCol, orderBy("date", "desc"), limit(count));
        const orderSnapshot = await getDocs(q);
        
        const orders: Order[] = await Promise.all(orderSnapshot.docs.map(async (orderDoc) => {
            const orderData = orderDoc.data();
            const client = await resolveDoc<Client>(orderData.clientRef);
            
            const items = await Promise.all(orderData.items.map(async (item: any) => {
                const product = await resolveDoc<Product>(item.productRef);
                return {
                    quantity: item.quantity,
                    price: item.price,
                    product: product,
                };
            }));
            
            return {
                id: orderDoc.id,
                date: (orderData.date as Timestamp).toDate(),
                status: orderData.status,
                total: orderData.total,
                client,
                items,
            };
        }));

        return orders;
    } catch (error) {
        console.error("Error fetching recent orders:", error);
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

async function checkStockAndCreateNotification(product: Omit<Product, 'id'>, productId: string) {
  if (product.stock <= product.reorderLimit) {
    const status = product.stock === 0 ? "Out of Stock" : "Low Stock";
    const notification: Omit<Notification, 'id'> = {
      title: `${status} Alert: ${product.name}`,
      description: `${product.name} is ${status.toLowerCase()}.`,
      details: `Product "${product.name}" (SKU: ${product.sku}) has a stock level of ${product.stock}, which is at or below the reorder limit of ${product.reorderLimit}. Please reorder soon.`,
      href: `/inventory`,
      timestamp: Timestamp.now(),
      read: false
    };

    try {
      // Check if a recent, unread, similar notification already exists to avoid spam.
      const notificationsCol = collection(db, "notifications");
      const fiveMinutesAgo = Timestamp.fromMillis(Date.now() - 5 * 60 * 1000);
      const q = query(
        notificationsCol, 
        where('title', '==', notification.title), 
        where('read', '==', false),
        where('timestamp', '>', fiveMinutesAgo)
      );
      const existingNotifs = await getDocs(q);

      if (existingNotifs.empty) {
        await addDoc(notificationsCol, notification);
      }
    } catch (error) {
      console.error("Error creating stock notification:", error);
    }
  }
}

export async function addProduct(product: Omit<Product, 'id'>): Promise<DocumentReference> {
  try {
    const now = Timestamp.now();
    const newHistoryEntry = {
        date: format(now.toDate(), 'yyyy-MM-dd'),
        stock: product.stock,
        dateUpdated: now,
    };

    const productWithHistory = {
        ...product,
        lastUpdated: now,
        history: [newHistoryEntry]
    };

    const productsCol = collection(db, "inventory");
    const docRef = await addDoc(productsCol, productWithHistory);
    await checkStockAndCreateNotification(product, docRef.id);
    return docRef;
  } catch (error) {
    console.error("Error adding product:", error);
    throw new Error("Failed to add product.");
  }
}

export async function updateProduct(productId: string, productData: Partial<Omit<Product, 'id'>>): Promise<void> {
  try {
    const productRef = doc(db, "inventory", productId);
    const originalDoc = await getDoc(productRef);
    const originalData = originalDoc.data() as Product | undefined;

    const now = Timestamp.now();
    const updatePayload: any = { ...productData, lastUpdated: now };

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

    const updatedDoc = await getDoc(productRef);
    if(updatedDoc.exists()) {
        const fullProduct = {id: updatedDoc.id, ...updatedDoc.data()} as Product;
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
            
            const items = await Promise.all(orderData.items.map(async (item: any) => {
                const product = await resolveDoc<Product>(item.productRef);
                return {
                    quantity: item.quantity,
                    price: item.price,
                    product: product,
                };
            }));
            
            return {
                id: orderDoc.id,
                date: (orderData.date as Timestamp).toDate(),
                status: orderData.status,
                total: orderData.total,
                client,
                items,
            };
        }));

        return orders;
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

export async function getClients(): Promise<Client[]> {
  try {
    const clientsCol = collection(db, "clients");
    const q = query(clientsCol, orderBy("clientName", "asc"));
    const clientSnapshot = await getDocs(q);
    return clientSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
  } catch (error) {
    console.error("Error fetching clients:", error);
    return [];
  }
}

export async function addClient(client: Omit<Client, 'id'>): Promise<DocumentReference> {
  try {
    const clientsCol = collection(db, "clients");
    const docRef = await addDoc(clientsCol, client);
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
  status: Order['status'];
};

export async function addOrder(orderData: NewOrderData): Promise<DocumentReference> {
  try {
    // 1. Fetch product details to calculate total
    let total = 0;
    const resolvedItems = await Promise.all(
      orderData.items.map(async (item) => {
        const productRef = doc(db, "inventory", item.productId);
        const productDoc = await getDoc(productRef);
        if (!productDoc.exists()) {
          throw new Error(`Product with ID ${item.productId} not found.`);
        }
        const productData = productDoc.data() as Product;
        total += productData.price * item.quantity;
        return {
          productRef: productRef,
          quantity: item.quantity,
          price: productData.price, // Store price at time of order
        };
      })
    );

    // 2. Create the new order object
    const newOrder = {
      clientRef: doc(db, "clients", orderData.clientId),
      date: Timestamp.now(),
      items: resolvedItems,
      status: orderData.status,
      total: total,
    };

    // 3. Add the order to Firestore
    const ordersCol = collection(db, "orders");
    const docRef = await addDoc(ordersCol, newOrder);
    return docRef;

  } catch (error) {
    console.error("Error adding order:", error);
    throw new Error("Failed to add order.");
  }
}
