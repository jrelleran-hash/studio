

"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getProducts, getClients, getOrders, getIssuances, getSuppliers, getPurchaseOrders, getShipments, getUnshippedIssuances, getReturns, getOutboundReturns, getBackorders } from "@/services/data-service";
import type { Product, Client, Order, Issuance, Supplier, PurchaseOrder, Shipment, Return, OutboundReturn, Backorder } from "@/types";

interface DataContextType {
  products: Product[];
  clients: Client[];
  orders: Order[];
  issuances: Issuance[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  shipments: Shipment[];
  unshippedIssuances: Issuance[];
  returns: Return[];
  outboundReturns: OutboundReturn[];
  backorders: Backorder[];
  loading: boolean;
  refetchData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [unshippedIssuances, setUnshippedIssuances] = useState<Issuance[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [outboundReturns, setOutboundReturns] = useState<OutboundReturn[]>([]);
  const [backorders, setBackorders] = useState<Backorder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);


  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      // Clear data if user logs out
      setProducts([]);
      setClients([]);
      setOrders([]);
      setIssuances([]);
      setSuppliers([]);
      setPurchaseOrders([]);
      setShipments([]);
      setUnshippedIssuances([]);
      setReturns([]);
      setOutboundReturns([]);
      setBackorders([]);
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
        fetchedSuppliers,
        fetchedPurchaseOrders,
        fetchedShipments,
        fetchedUnshippedIssuances,
        fetchedReturns,
        fetchedOutboundReturns,
        fetchedBackorders,
      ] = await Promise.all([
        getProducts(),
        getClients(),
        getOrders(),
        getIssuances(),
        getSuppliers(),
        getPurchaseOrders(),
        getShipments(),
        getUnshippedIssuances(),
        getReturns(),
        getOutboundReturns(),
        getBackorders(),
      ]);
      setProducts(fetchedProducts);
      setClients(fetchedClients);
      setOrders(fetchedOrders);
      setIssuances(fetchedIssuances);
      setSuppliers(fetchedSuppliers);
      setPurchaseOrders(fetchedPurchaseOrders);
      setShipments(fetchedShipments);
      setUnshippedIssuances(fetchedUnshippedIssuances);
      setReturns(fetchedReturns);
      setOutboundReturns(fetchedOutboundReturns);
      setBackorders(fetchedBackorders);
    } catch (error) {
      console.error("Failed to fetch global data", error);
      // Optionally, set an error state here
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const value = useMemo(() => ({
    products,
    clients,
    orders,
    issuances,
    suppliers,
    purchaseOrders,
    shipments,
    unshippedIssuances,
    returns,
    outboundReturns,
    backorders,
    loading,
    refetchData: fetchData,
  }), [products, clients, orders, issuances, suppliers, purchaseOrders, shipments, unshippedIssuances, returns, outboundReturns, backorders, loading, fetchData]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};
