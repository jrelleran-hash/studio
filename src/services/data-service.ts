



import { db } from "@/lib/firebase";
import { collection, getDocs, getDoc, doc, orderBy, query, limit, Timestamp, where, DocumentReference, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import type { Activity, Notification, Order, Product, Customer } from "@/types";
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
            const customer = await resolveDoc<Customer>(orderData.customerRef);
            
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
                customer,
                items,
            };
        }));

        return orders;
    } catch (error) {
        console.error("Error fetching recent orders:", error);
        return [];
    }
}

// Helper to generate mock historical data for the last 7 days
const generateMockHistory = (currentStock: number) => {
    const history = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
        const date = subDays(today, i);
        // Simulate some stock fluctuation
        const stock = Math.max(0, currentStock + Math.floor(Math.random() * 10) - 5);
        history.push({ date: format(date, 'yyyy-MM-dd'), stock });
    }
    return history;
};

export async function getProducts(): Promise<Product[]> {
    try {
        const productsCol = collection(db, "inventory");
        const q = query(productsCol, orderBy("name", "asc"));
        const productSnapshot = await getDocs(q);
        return productSnapshot.docs.map(doc => {
            const data = doc.data() as Product;
            // Add mock history if it doesn't exist, for demonstration purposes
            if (!data.history) {
                data.history = generateMockHistory(data.stock);
            }
            return { id: doc.id, ...data };
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
    const productsCol = collection(db, "inventory");
    const docRef = await addDoc(productsCol, product);
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
    await updateDoc(productRef, productData);

    const updatedDoc = await getDoc(productRef);
    if(updatedDoc.exists()) {
        const fullProduct = { ...updatedDoc.data() as Omit<Product, 'id' | 'id'>, id: productId };
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
            const customer = await resolveDoc<Customer>(orderData.customerRef);
            
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
                customer,
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

export async function getCustomers(): Promise<Customer[]> {
  try {
    const customersCol = collection(db, "customers");
    const q = query(customersCol, orderBy("clientName", "asc"));
    const customerSnapshot = await getDocs(q);
    return customerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
  } catch (error) {
    console.error("Error fetching customers:", error);
    return [];
  }
}

export async function addCustomer(customer: Omit<Customer, 'id'>): Promise<DocumentReference> {
  try {
    const customersCol = collection(db, "customers");
    const docRef = await addDoc(customersCol, customer);
    return docRef;
  } catch (error) {
    console.error("Error adding customer:", error);
    throw new Error("Failed to add customer.");
  }
}

export async function updateCustomer(customerId: string, customerData: Partial<Omit<Customer, 'id'>>): Promise<void> {
  try {
    const customerRef = doc(db, "customers", customerId);
    await updateDoc(customerRef, customerData);
  } catch (error) {
    console.error("Error updating customer:", error);
    throw new Error("Failed to update customer.");
  }
}

export async function deleteCustomer(customerId: string): Promise<void> {
  try {
    const customerRef = doc(db, "customers", customerId);
    await deleteDoc(customerRef);
  } catch (error) {
    console.error("Error deleting customer:", error);
    throw new Error("Failed to delete customer.");
  }
}

type NewOrderData = {
  customerId: string;
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
      customerRef: doc(db, "customers", orderData.customerId),
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
