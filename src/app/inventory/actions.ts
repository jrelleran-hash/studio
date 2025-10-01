
"use server";

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Product } from "@/types";

export async function getProductByIdAction(productId: string): Promise<Product | null> {
    try {
        const productRef = doc(db, "inventory", productId);
        const productDoc = await getDoc(productRef);

        if (productDoc.exists()) {
            const data = productDoc.data();
            return {
                id: productDoc.id,
                ...data,
                lastUpdated: data.lastUpdated,
                history: data.history?.map((h: any) => ({...h, dateUpdated: h.dateUpdated}))
            } as Product;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching product by ID:", error);
        return null;
    }
}
