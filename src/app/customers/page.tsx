import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CustomersPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Customers</CardTitle>
        <CardDescription>Manage your customer database.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Customer management interface will be displayed here.</p>
      </CardContent>
    </Card>
  );
}
