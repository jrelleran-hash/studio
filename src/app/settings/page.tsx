

"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";


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
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  photoURL: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  phone: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const toTitleCase = (str: string) => {
  if (!str) return "";
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  
  const getInitialNames = (displayName: string | null | undefined) => {
    const name = displayName || "";
    const nameParts = name.split(" ").filter(Boolean);
    const lastName = nameParts.length > 1 ? nameParts.pop() || "" : "";
    const firstName = nameParts.join(" ");
    return { firstName, lastName };
  }
  
  const { firstName: initialFirstName, lastName: initialLastName } = getInitialNames(user?.displayName);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: initialFirstName,
      lastName: initialLastName,
      photoURL: user?.photoURL || "",
      phone: user?.phoneNumber || "",
    },
  });
  
  useEffect(() => {
    if (user) {
        const { firstName, lastName } = getInitialNames(user.displayName);
        profileForm.reset({
            firstName: firstName,
            lastName: lastName,
            photoURL: user.photoURL || "",
            phone: user.phoneNumber || ""
        });
    }
  }, [user, profileForm]);


  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to update your profile.",
      });
      return;
    }
    try {
      const displayName = `${data.firstName} ${data.lastName}`.trim();
      await updateProfile(user, {
        displayName: displayName,
        photoURL: data.photoURL,
      });

      // Note: Updating phone number requires more complex verification and is not handled here.

      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved.",
      });
      setIsProfileDialogOpen(false);
      // The user object in useAuth should update automatically via onAuthStateChanged,
      // but a manual refresh/refetch might be needed in some state management setups.
      // Forcing a reload is a simple way to ensure the UI updates.
      window.location.reload();

    } catch (error) {
      console.error("Profile update error:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not save your profile changes.",
      });
    }
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
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input id="firstName" {...profileForm.register("firstName")} onChange={(e) => {
                            const { value } = e.target;
                            e.target.value = toTitleCase(value);
                            profileForm.setValue("firstName", e.target.value);
                          }}/>
                          {profileForm.formState.errors.firstName && <p className="text-sm text-destructive">{profileForm.formState.errors.firstName.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input id="lastName" {...profileForm.register("lastName")} onChange={(e) => {
                            const { value } = e.target;
                            e.target.value = toTitleCase(value);
                            profileForm.setValue("lastName", e.target.value);
                          }}/>
                          {profileForm.formState.errors.lastName && <p className="text-sm text-destructive">{profileForm.formState.errors.lastName.message}</p>}
                        </div>
                     </div>
                     <div className="space-y-2">
                      <Label htmlFor="photoURL">Photo URL</Label>
                      <Input id="photoURL" {...profileForm.register("photoURL")} />
                      {profileForm.formState.errors.photoURL && <p className="text-sm text-destructive">{profileForm.formState.errors.photoURL.message}</p>}
                    </div>
                     <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" {...profileForm.register("phone")} placeholder="Verification required" disabled />
                      {profileForm.formState.errors.phone && <p className="text-sm text-destructive">{profileForm.formState.errors.phone.message}</p>}
                    </div>
                     <DialogFooter>
                      <Button variant="ghost" type="button" onClick={() => setIsProfileDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                        {profileForm.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                      </Button>
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
