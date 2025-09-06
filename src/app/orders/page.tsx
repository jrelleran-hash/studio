import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrdersPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders</CardTitle>
        <CardDescription>Manage all customer orders.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Order management interface will be displayed here.</p>
      </CardContent>
    </Card>
  );
}
