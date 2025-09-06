import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ActivityPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Activity</CardTitle>
        <CardDescription>A complete log of all events.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Full activity log will be displayed here.</p>
      </CardContent>
    </Card>
  );
}
