

import { db } from "@/lib/firebase";
import { collection, getDocs, getDoc, doc, orderBy, query, limit, Timestamp, where, DocumentReference, addDoc, updateDoc } from "firebase/firestore";
import type { Activity, Notification, Order, Product, Customer } from "@/types";

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

export async function getLowStockProducts(stockLimit: number): Promise<Product[]> {
    try {
        const productsCol = collection(db, "products");
        const q = query(productsCol, where("stock", "<=", stockLimit), orderBy("stock", "asc"));
        const productSnapshot = await getDocs(q);
        return productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
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


export async function getProducts(): Promise<Product[]> {
    try {
        const productsCol = collection(db, "products");
        const q = query(productsCol, orderBy("name", "asc"));
        const productSnapshot = await getDocs(q);
        return productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    } catch (error) {
        console.error("Error fetching products:", error);
        return [];
    }
}

export async function addProduct(product: Partial<Omit<Product, 'id'>>): Promise<DocumentReference> {
  try {
    const productsCol = collection(db, "products");
    const docRef = await addDoc(productsCol, product);
    return docRef;
  } catch (error) {
    console.error("Error adding product:", error);
    throw new Error("Failed to add product.");
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
    const q = query(customersCol, orderBy("projectName", "asc"));
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
        const productRef = doc(db, "products", item.productId);
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
