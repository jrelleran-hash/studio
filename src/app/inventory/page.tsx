import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function InventoryPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory</CardTitle>
        <CardDescription>Manage your product inventory.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Inventory management interface will be displayed here.</p>
      </CardContent>
    </Card>
  );
}
