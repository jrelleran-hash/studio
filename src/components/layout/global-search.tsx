
"use client"

import * as React from "react"
import {
  File,
  Package,
  ShoppingCart,
  User,
  Search,
  Building,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useData } from "@/context/data-context"
import { useAuth } from "@/hooks/use-auth"
import type { PagePermission } from "@/types"

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const { products, clients, orders, suppliers } = useData()
  const { userProfile } = useAuth()

  const userPermissions = React.useMemo(() => {
    if (!userProfile) return [];
    if (userProfile.role === 'Admin' || userProfile.role === 'Manager') {
        return ["/inventory", "/clients", "/orders", "/suppliers"] as PagePermission[];
    }
    return userProfile.permissions || [];
  }, [userProfile]);

  const canAccess = (path: PagePermission) => userPermissions.includes(path);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const handleSelect = (path: string) => {
    router.push(path)
    setOpen(false)
  }

  return (
    <>
      <Button
        variant="outline"
        className={cn(
          "relative h-10 w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
        )}
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2" />
        <span className="hidden lg:inline-flex">Search...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-2.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          {canAccess('/inventory') && (
            <CommandGroup heading="Products">
              {products.slice(0, 5).map((product) => (
                <CommandItem
                  key={product.id}
                  value={`Product ${product.name} ${product.sku}`}
                  onSelect={() => handleSelect(`/inventory?edit=${product.id}`)}
                >
                  <Package className="mr-2 h-4 w-4" />
                  <span>{product.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {canAccess('/clients') && (
            <CommandGroup heading="Clients">
              {clients.slice(0, 5).map((client) => (
                <CommandItem
                  key={client.id}
                  value={`Client ${client.clientName} ${client.projectName}`}
                  onSelect={() => handleSelect(`/clients`)}
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>{client.clientName} - <span className="text-muted-foreground">{client.projectName}</span></span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {canAccess('/orders') && (
            <CommandGroup heading="Orders">
              {orders.slice(0, 5).map((order) => (
                <CommandItem
                  key={order.id}
                  value={`Order ${order.id} ${order.client.clientName}`}
                  onSelect={() => handleSelect(`/orders`)}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  <span>Order {order.id.substring(0, 7)} - <span className="text-muted-foreground">{order.client.clientName}</span></span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          
          {canAccess('/suppliers') && (
            <CommandGroup heading="Suppliers">
              {suppliers.slice(0, 5).map((supplier) => (
                <CommandItem
                  key={supplier.id}
                  value={`Supplier ${supplier.name}`}
                  onSelect={() => handleSelect(`/suppliers`)}
                >
                  <Building className="mr-2 h-4 w-4" />
                  <span>{supplier.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

        </CommandList>
      </CommandDialog>
    </>
  )
}
