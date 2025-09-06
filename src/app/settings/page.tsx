
"use client";

import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const profileFormSchema = z.object({
  name: z.string().min(1, "Name is required."),
  photoURL: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  phone: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

  // We can use the user's current display name for the form default value
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    values: {
      name: user?.displayName || "",
      photoURL: user?.photoURL || "",
      phone: user?.phoneNumber || "",
    },
  });

  const onProfileSubmit = (data: ProfileFormValues) => {
    // Here you would typically update the user's profile in your backend
    // For example: updateProfile(user, { displayName: data.name, photoURL: data.photoURL, phoneNumber: data.phone });
    console.log(data);
    toast({
      title: "Profile Updated",
      description: "Your profile information has been saved.",
    });
    setIsProfileDialogOpen(false); // Close the dialog on successful submission
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
            <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                 <Avatar className="h-16 w-16">
                    <AvatarImage src={user?.photoURL || "https://picsum.photos/100"} alt={user?.email || '@user'} data-ai-hint="person face" />
                    <AvatarFallback>{user?.email?.[0].toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>
                    Your personal details.
                  </CardDescription>
                </div>
              </div>
               <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">Edit Profile</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>
                      Update your personal details here.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" {...profileForm.register("name")} />
                      {profileForm.formState.errors.name && <p className="text-sm text-destructive">{profileForm.formState.errors.name.message}</p>}
                    </div>
                     <div className="space-y-2">
                      <Label htmlFor="photoURL">Photo URL</Label>
                      <Input id="photoURL" {...profileForm.register("photoURL")} />
                      {profileForm.formState.errors.photoURL && <p className="text-sm text-destructive">{profileForm.formState.errors.photoURL.message}</p>}
                    </div>
                     <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" {...profileForm.register("phone")} />
                      {profileForm.formState.errors.phone && <p className="text-sm text-destructive">{profileForm.formState.errors.phone.message}</p>}
                    </div>
                     <DialogFooter>
                      <Button variant="ghost" type="button" onClick={() => setIsProfileDialogOpen(false)}>Cancel</Button>
                      <Button type="submit">Save Changes</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
               <div className="space-y-2">
                  <Label>Full Name</Label>
                  <p className="text-muted-foreground">{user?.displayName || "Not set"}</p>
                </div>
                 <div className="space-y-2">
                  <Label>Email</Label>
                  <p className="text-muted-foreground">{user?.email}</p>
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <p className="text-muted-foreground">{user?.phoneNumber || "Not set"}</p>
                </div>
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 rounded-lg border">
                      <div className="space-y-1">
                          <Label htmlFor="order-emails">New Orders</Label>
                          <p className="text-sm text-muted-foreground">Receive an email for every new order.</p>
                      </div>
                      <Switch id="order-emails" defaultChecked />
                  </div>
                   <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 rounded-lg border">
                      <div className="space-y-1">
                          <Label htmlFor="stock-emails">Low Stock Alerts</Label>
                          <p className="text-sm text-muted-foreground">Get notified when product stock is low.</p>
                      </div>
                      <Switch id="stock-emails" defaultChecked />
                  </div>
                   <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 rounded-lg border">
                      <div className="space-y-1">
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
