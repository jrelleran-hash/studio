
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { Switch } from "@/components/ui/switch";

const profileFormSchema = z.object({
  name: z.string().min(1, "Name is required."),
  email: z.string().email(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user?.displayName || "",
      email: user?.email || "",
    },
  });

  const onProfileSubmit = (data: ProfileFormValues) => {
    // Here you would typically update the user's profile in your backend
    console.log(data);
    toast({
      title: "Profile Updated",
      description: "Your profile information has been saved.",
    });
  };
  
  const onNotificationsSubmit = (data: any) => {
    console.log(data);
    toast({
      title: "Notifications Updated",
      description: "Your notification settings have been saved.",
    });
  };

  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and application settings.</p>
      </div>
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">My Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" {...profileForm.register("name")} />
                  {profileForm.formState.errors.name && <p className="text-sm text-destructive">{profileForm.formState.errors.name.message}</p>}
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" {...profileForm.register("email")} disabled />
                   <p className="text-xs text-muted-foreground">Your email address is used for logging in and cannot be changed.</p>
                </div>
                <Button type="submit">Save Changes</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="appearance" className="space-y-4">
           <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize the look and feel of the application.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor="theme">Theme</Label>
                        <p className="text-sm text-muted-foreground">Select the theme for the dashboard.</p>
                    </div>
                    <ThemeToggle />
                </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
           <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Manage how you receive notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <form onSubmit={onNotificationsSubmit} className="space-y-6 max-w-lg">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                          <Label htmlFor="order-emails">New Orders</Label>
                          <p className="text-sm text-muted-foreground">Receive an email for every new order.</p>
                      </div>
                      <Switch id="order-emails" defaultChecked />
                  </div>
                   <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                          <Label htmlFor="stock-emails">Low Stock Alerts</Label>
                          <p className="text-sm text-muted-foreground">Get notified when product stock is low.</p>
                      </div>
                      <Switch id="stock-emails" defaultChecked />
                  </div>
                   <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                          <Label htmlFor="activity-digest">Weekly Activity Digest</Label>
                          <p className="text-sm text-muted-foreground">Receive a weekly summary of all activity.</p>
                      </div>
                      <Switch id="activity-digest" />
                  </div>
                  <Button type="submit">Save Preferences</Button>
               </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
