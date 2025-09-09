
"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getProducts, getClients, getOrders, getIssuances, getSuppliers } from "@/services/data-service";
import type { Product, Client, Order, Issuance, Supplier } from "@/types";

interface DataContextType {
  products: Product[];
  clients: Client[];
  orders: Order[];
  issuances: Issuance[];
  suppliers: Supplier[];
  loading: boolean;
  refetchData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) {
      // Clear data if user logs out
      setProducts([]);
      setClients([]);
      setOrders([]);
      setIssuances([]);
      setSuppliers([]);
      setLoading(false);
      return;
    };
    
    setLoading(true);
    try {
      const [
        fetchedProducts,
        fetchedClients,
        fetchedOrders,
        fetchedIssuances,
        fetchedSuppliers
      ] = await Promise.all([
        getProducts(),
        getClients(),
        getOrders(),
        getIssuances(),
        getSuppliers()
      ]);
      setProducts(fetchedProducts);
      setClients(fetchedClients);
      setOrders(fetchedOrders);
      setIssuances(fetchedIssuances);
      setSuppliers(fetchedSuppliers);
    } catch (error) {
      console.error("Failed to fetch global data", error);
      // Optionally, set an error state here
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const value = {
    products,
    clients,
    orders,
    issuances,
    suppliers,
    loading,
    refetchData: fetchData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};

