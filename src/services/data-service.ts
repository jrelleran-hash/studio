

import { db, storage } from "@/lib/firebase";
import { collection, getDocs, getDoc, doc, orderBy, query, limit, Timestamp, where, DocumentReference, addDoc, updateDoc, deleteDoc, arrayUnion, runTransaction } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { Activity, Notification, Order, Product, Client, Issuance, Supplier, PurchaseOrder } from "@/types";
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

async function resolveDocFromTransaction<T>(transaction: any, docRef: DocumentReference): Promise<T> {
    const docSnap = await transaction.get(docRef);
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
        const lowStockProducts = allProducts.filter(p => p.stock > 0 && p.stock <= p.reorderLimit);
        
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
                ...orderData,
                date: (orderData.date as Timestamp).toDate(),
                client,
                items,
            } as Order;
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

async function checkStockAndCreateNotification(product: Omit<Product, 'id' | 'history'>, productId: string) {
  if (product.stock > 0 && product.stock <= product.reorderLimit) {
    const status = "Low Stock";
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

export async function addProduct(product: Omit<Product, 'id' | 'lastUpdated' | 'history'>): Promise<DocumentReference> {
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

export async function updateProduct(productId: string, productData: Partial<Omit<Product, 'id' | 'sku'>>): Promise<void> {
  try {
    const productRef = doc(db, "inventory", productId);
    const originalDoc = await getDoc(productRef);
    if (!originalDoc.exists()) throw new Error("Product not found");
    const originalData = originalDoc.data() as Product;

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
                ...orderData,
                date: (orderData.date as Timestamp).toDate(),
                client,
                items,
            } as Order;
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
  reorderedFrom?: string;
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
    const newOrder: any = {
      clientRef: doc(db, "clients", orderData.clientId),
      date: Timestamp.now(),
      items: resolvedItems,
      status: orderData.status,
      total: total,
    };
    
    if (orderData.reorderedFrom) {
        newOrder.reorderedFrom = orderData.reorderedFrom;
    }


    // 3. Add the order to Firestore
    const ordersCol = collection(db, "orders");
    const docRef = await addDoc(ordersCol, newOrder);
    return docRef;

  } catch (error) {
    console.error("Error adding order:", error);
    throw new Error("Failed to add order.");
  }
}

export async function getIssuances(): Promise<Issuance[]> {
    try {
        const issuancesCol = collection(db, "issuances");
        const q = query(issuancesCol, orderBy("date", "desc"));
        const issuanceSnapshot = await getDocs(q);
        
        const issuances: Issuance[] = await Promise.all(issuanceSnapshot.docs.map(async (issuanceDoc) => {
            const issuanceData = issuanceDoc.data();
            const client = await resolveDoc<Client>(issuanceData.clientRef);
            
            const items = await Promise.all(issuanceData.items.map(async (item: any) => {
                const product = await resolveDoc<Product>(item.productRef);
                return {
                    quantity: item.quantity,
                    product: product,
                };
            }));
            
            return {
                id: issuanceDoc.id,
                issuanceNumber: issuanceData.issuanceNumber,
                date: (issuanceData.date as Timestamp).toDate(),
                client,
                items,
                remarks: issuanceData.remarks,
                issuedBy: issuanceData.issuedBy,
            };
        }));

        return issuances;
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
};

export async function addIssuance(issuanceData: NewIssuanceData): Promise<DocumentReference> {
  const issuanceNumber = `IS-${Date.now()}`;
  const issuanceDate = Timestamp.now();

  try {
    return await runTransaction(db, async (transaction) => {
      // 1. Resolve product references and prepare item data
      const resolvedItems = await Promise.all(
        issuanceData.items.map(async (item) => {
          const productRef = doc(db, "inventory", item.productId);
          const productDoc = await transaction.get(productRef);
          if (!productDoc.exists()) {
            throw new Error(`Product with ID ${item.productId} not found.`);
          }
          const productData = productDoc.data() as Product;

          // Check for sufficient stock
          if (productData.stock < item.quantity) {
            throw new Error(`Insufficient stock for ${productData.name}. Available: ${productData.stock}, Requested: ${item.quantity}`);
          }

          // 2. Update stock in inventory
          const newStock = productData.stock - item.quantity;
          const newHistoryEntry = {
              date: format(issuanceDate.toDate(), 'yyyy-MM-dd'),
              stock: newStock,
              dateUpdated: issuanceDate
          };
          transaction.update(productRef, { 
              stock: newStock,
              lastUpdated: issuanceDate,
              history: arrayUnion(newHistoryEntry)
          });
          
          // Check for notification after transaction
          checkStockAndCreateNotification({ ...productData, stock: newStock }, productDoc.id);

          return {
            productRef: productRef,
            quantity: item.quantity,
          };
        })
      );

      // 3. Create the new issuance object
      const newIssuance = {
        issuanceNumber: issuanceNumber,
        clientRef: doc(db, "clients", issuanceData.clientId),
        date: issuanceDate,
        items: resolvedItems,
        remarks: issuanceData.remarks || "",
        issuedBy: issuanceData.issuedBy,
      };

      // 4. Add the issuance to Firestore
      const issuancesCol = collection(db, "issuances");
      const docRef = doc(issuancesCol); // Create a new doc ref with an auto-generated ID
      transaction.set(docRef, newIssuance);
      
      return docRef;
    });
  } catch (error) {
    console.error("Error adding issuance and updating stock:", error);
    throw new Error("Failed to create issuance. " + (error as Error).message);
  }
}

export async function deleteIssuance(issuanceId: string): Promise<void> {
  const issuanceRef = doc(db, "issuances", issuanceId);
  const now = Timestamp.now();

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Get the issuance document
      const issuanceDoc = await transaction.get(issuanceRef);
      if (!issuanceDoc.exists()) {
        throw new Error("Issuance not found.");
      }
      const issuanceData = issuanceDoc.data();

      // 2. Iterate over items, get each product, and restore stock
      for (const item of issuanceData.items) {
        const productRef = item.productRef as DocumentReference;
        const productDoc = await transaction.get(productRef);
        if (productDoc.exists()) {
          const productData = productDoc.data();
          const newStock = productData.stock + item.quantity;
          const newHistoryEntry = {
            date: format(now.toDate(), 'yyyy-MM-dd'),
            stock: newStock,
            changeReason: `Deletion of issuance #${issuanceData.issuanceNumber}`,
            dateUpdated: now,
          };
          transaction.update(productRef, {
            stock: newStock,
            lastUpdated: now,
            history: arrayUnion(newHistoryEntry),
          });
        } else {
          // If the product was deleted, we can't restore stock, but we can log it.
          console.warn(`Product with ID ${productRef.id} not found while deleting issuance. Stock not restored for this item.`);
        }
      }

      // 3. Delete the issuance document
      transaction.delete(issuanceRef);
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
            
            const items = await Promise.all(poData.items.map(async (item: any) => {
                const product = await resolveDoc<Product>(item.productRef);
                return {
                    quantity: item.quantity,
                    product: product,
                };
            }));
            
            return {
                id: poDoc.id,
                ...poData,
                orderDate: (poData.orderDate as Timestamp).toDate(),
                expectedDate: poData.expectedDate ? (poData.expectedDate as Timestamp).toDate() : undefined,
                receivedDate: poData.receivedDate ? (poData.receivedDate as Timestamp).toDate() : undefined,
                supplier,
                items,
            } as PurchaseOrder;
        }));

        return purchaseOrders;
    } catch (error) {
        console.error("Error fetching purchase orders:", error);
        return [];
    }
}

type NewPurchaseOrderData = {
  supplierId: string;
  items: { productId: string; quantity: number }[];
};

export async function addPurchaseOrder(poData: NewPurchaseOrderData): Promise<DocumentReference> {
  try {
    const resolvedItems = await Promise.all(
      poData.items.map(async (item) => {
        const productRef = doc(db, "inventory", item.productId);
        // We don't need the full product data here, just the reference
        return {
          productRef: productRef,
          quantity: item.quantity,
        };
      })
    );

    const newPurchaseOrder = {
      supplierRef: doc(db, "suppliers", poData.supplierId),
      orderDate: Timestamp.now(),
      status: "Pending",
      items: resolvedItems,
      poNumber: `PO-${Date.now()}`,
    };

    const poCol = collection(db, "purchaseOrders");
    const docRef = await addDoc(poCol, newPurchaseOrder);
    return docRef;

  } catch (error) {
    console.error("Error adding purchase order:", error);
    throw new Error("Failed to add purchase order.");
  }
}

export async function updatePurchaseOrderStatus(poId: string, status: PurchaseOrder['status']): Promise<void> {
  const poRef = doc(db, "purchaseOrders", poId);

  try {
    await runTransaction(db, async (transaction) => {
      const poDoc = await transaction.get(poRef);
      if (!poDoc.exists()) {
        throw new Error("Purchase Order not found.");
      }
      
      const poData = poDoc.data();
      
      // If status is already 'Received', do nothing.
      if (poData.status === 'Received') {
          console.warn(`Purchase Order ${poId} is already marked as Received.`);
          return;
      }

      const updatePayload: any = { status };
      
      if (status === 'Received') {
        updatePayload.receivedDate = Timestamp.now();

        // Update stock for each item in the purchase order
        for (const item of poData.items) {
          const productRef = item.productRef as DocumentReference;
          const productDoc = await transaction.get(productRef);

          if (productDoc.exists()) {
            const productData = productDoc.data();
            const newStock = productData.stock + item.quantity;
            const newHistoryEntry = {
                date: format(updatePayload.receivedDate.toDate(), 'yyyy-MM-dd'),
                stock: newStock,
                changeReason: `Received PO #${poData.poNumber}`,
                dateUpdated: updatePayload.receivedDate,
            };

            transaction.update(productRef, {
              stock: newStock,
              lastUpdated: updatePayload.receivedDate,
              history: arrayUnion(newHistoryEntry)
            });
          } else {
             console.warn(`Product with ID ${productRef.id} not found while receiving PO. Stock not updated for this item.`);
          }
        }
      }
      
      transaction.update(poRef, updatePayload);
    });
  } catch (error) {
    console.error("Error updating purchase order status:", error);
    throw new Error(`Failed to update purchase order status. ${(error as Error).message}`);
  }
}
