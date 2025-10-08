
import * as z from "zod";

// Order Schemas
export const orderItemSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: z.number().min(1, "Quantity must be at least 1."),
});

export const orderSchema = z.object({
  clientId: z.string().min(1, "Client is required."),
  items: z.array(orderItemSchema).min(1, "At least one item is required."),
  purpose: z.string().optional(),
});

export type OrderFormValues = z.infer<typeof orderSchema>;


// Product Schema
export const createProductSchema = (isSkuAuto: boolean) => z.object({
  name: z.string().min(1, "Product name is required."),
  sku: z.string().optional(),
  price: z.coerce.number().nonnegative("Price must be a non-negative number.").optional(),
  stock: z.coerce.number().int().nonnegative("Stock must be a non-negative integer.").optional(),
  reorderLimit: z.coerce.number().int().nonnegative("Reorder limit must be a non-negative integer.").optional(),
  maxStockLevel: z.coerce.number().int().nonnegative("Max stock must be a non-negative integer.").optional(),
  location: z.string().optional(),
  supplier: z.string().optional(),
}).refine(data => isSkuAuto || (data.sku && data.sku.length > 0), {
    message: "SKU is required when not auto-generated.",
    path: ["sku"],
});

export type ProductFormValues = z.infer<ReturnType<typeof createProductSchema>>;


// Supplier Schema
export const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required."),
  contactPerson: z.string().min(1, "Contact person is required."),
  email: z.string().email("Invalid email address.").optional().or(z.literal('')),
  phone: z.string().optional(),
  cellphoneNumber: z.string().optional(),
  address: z.string().min(1, "Address is required."),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;


// Client Schema
export const clientSchema = z.object({
  projectName: z.string().min(1, "Project name is required."),
  clientName: z.string().min(1, "Client name is required."),
  boqNumber: z.string().min(1, "BOQ number is required."),
  address: z.string().min(1, "Address is required."),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

// Tool Schemas
const toolCategories = ["Hand Tool", "Power Tool", "Measuring Tool", "Safety Equipment", "Other"];

const locationSchema = z.object({
  zone: z.string().optional(),
  aisle: z.string().optional(),
  rack: z.string().optional(),
  level: z.string().optional(),
  bin: z.string().optional(),
}).optional();

export const toolSchema = z.object({
  name: z.string().min(1, "Tool name is required."),
  serialNumber: z.string().min(1, "Serial number is required."),
  category: z.string().min(1, "Category is required."),
  purchaseDate: z.date().optional(),
  purchaseCost: z.coerce.number().nonnegative("Cost must be a positive number.").optional(),
  borrowDuration: z.coerce.number().int().positive("Duration must be a positive number.").optional(),
  condition: z.enum(["Good", "Needs Repair", "Damaged"]),
  location: locationSchema,
});

export type ToolFormValues = z.infer<typeof toolSchema>;
