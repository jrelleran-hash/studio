
"use client";

import { useState, useEffect, useRef } from "react";
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
import { uploadProfilePicture, getAllUsers, updateUserRole, type UserProfile } from "@/services/data-service";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import type { UserRole } from "@/types";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];


const profileFormSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  photoFile: z
    .any()
    .optional()
    .refine((files) => !files?.[0] || files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (files) => !files || (files?.[0] && ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type)),
      ".jpg, .jpeg, .png and .webp files are accepted."
    ),
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

const getInitialNames = (displayName: string | null | undefined) => {
    const name = displayName || "";
    const nameParts = name.split(" ").filter(Boolean);
    if (nameParts.length === 0) return { firstName: "", lastName: ""};
    if (nameParts.length === 1) return { firstName: nameParts[0], lastName: ""};
    const lastName = nameParts.pop() || "";
    const firstName = nameParts.join(" ");
    return { firstName, lastName };
}

export default function SettingsPage() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedUserForRoleChange, setSelectedUserForRoleChange] = useState<UserProfile | null>(null);
  const [newRole, setNewRole] = useState<UserRole>("Staff");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "profile");

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
  });
  
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === "users" && userProfile?.role === "Admin") {
      setLoadingUsers(true);
      getAllUsers()
        .then(setAllUsers)
        .catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to load users." }))
        .finally(() => setLoadingUsers(false));
    }
  }, [activeTab, userProfile?.role, toast]);
  
  useEffect(() => {
    if (isProfileDialogOpen && user) {
        const { firstName, lastName } = getInitialNames(user.displayName);
        profileForm.reset({
            firstName: firstName,
            lastName: lastName,
            phone: user.phoneNumber || "",
            photoFile: undefined,
        });
        setPreviewImage(user.photoURL);
    }
  }, [user, profileForm, isProfileDialogOpen]);


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
      let photoURL = user.photoURL;
      
      const file = data.photoFile?.[0];
      if (file) {
        photoURL = await uploadProfilePicture(file, user.uid);
      }

      const displayName = `${data.firstName} ${data.lastName}`.trim();
      
      await updateProfile(user, {
        displayName: displayName,
        photoURL: photoURL,
      });

      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved.",
      });
      
    } catch (error) {
      console.error("Profile update error:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not save your profile changes.",
      });
    } finally {
        setIsProfileDialogOpen(false);
    }
  };

  const handleRoleChange = async () => {
    if (!selectedUserForRoleChange) return;

    try {
        await updateUserRole(selectedUserForRoleChange.uid, newRole);
        toast({ title: "Role Updated", description: `Role for ${selectedUserForRoleChange.email} has been changed to ${newRole}.` });
        // Refetch users to show the change
        const updatedUsers = await getAllUsers();
        setAllUsers(updatedUsers);
    } catch(error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to update user role." });
    } finally {
        setIsRoleDialogOpen(false);
        setSelectedUserForRoleChange(null);
    }
  };
  
  const onNotificationsSubmit = (data: any) => {
    console.log(data);
    toast({
      title: "Notifications Updated",
      description: "Your notification settings have been saved.",
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/settings?tab=${value}`, { scroll: false });
  };


  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-2xl font-bold font-headline tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and application settings.</p>
      </div>
      <Tabs defaultValue="profile" value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">My Profile</TabsTrigger>
          {userProfile?.role === "Admin" && <TabsTrigger value="users">Users</TabsTrigger>}
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                 <Avatar className="h-16 w-16">
                    <AvatarImage src={user?.photoURL || undefined} alt={user?.email || '@user'} />
                    <AvatarFallback>{user?.displayName?.[0].toUpperCase() || user?.email?.[0].toUpperCase() || "U"}</AvatarFallback>
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
                    <div className="space-y-2 text-center">
                        <div className="relative w-24 h-24 mx-auto">
                            <Avatar className="w-24 h-24 text-4xl">
                                {previewImage ? (
                                    <Image
                                        src={previewImage}
                                        alt="Profile preview"
                                        width={96}
                                        height={96}
                                        className="rounded-full object-cover aspect-square"
                                    />
                                ) : (
                                    <AvatarImage src={undefined} alt="User preview" />
                                )}
                                <AvatarFallback>
                                    {profileForm.getValues('firstName')?.[0]?.toUpperCase() || user?.email?.[0].toUpperCase() || 'U'}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                         <Button type="button" variant="link" onClick={() => fileInputRef.current?.click()}>
                           Change Photo
                         </Button>
                         <Input
                           type="file"
                           className="hidden"
                           {...profileForm.register("photoFile")}
                           ref={fileInputRef}
                           onChange={(e) => {
                            handleFileChange(e);
                            profileForm.trigger("photoFile");
                           }}
                           accept="image/png, image/jpeg, image/webp"
                         />
                         {profileForm.formState.errors.photoFile && <p className="text-sm text-destructive">{profileForm.formState.errors.photoFile.message as string}</p>}
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input id="firstName" {...profileForm.register("firstName")} onChange={(e) => {
                            const { value } = e.target;
                            profileForm.setValue("firstName", toTitleCase(value), { shouldValidate: true });
                          }}/>
                          {profileForm.formState.errors.firstName && <p className="text-sm text-destructive">{profileForm.formState.errors.firstName.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input id="lastName" {...profileForm.register("lastName")} onChange={(e) => {
                            const { value } = e.target;
                            profileForm.setValue("lastName", toTitleCase(value), { shouldValidate: true });
                          }}/>
                          {profileForm.formState.errors.lastName && <p className="text-sm text-destructive">{profileForm.formState.errors.lastName.message}</p>}
                        </div>
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
        
        {userProfile?.role === "Admin" && (
            <TabsContent value="users" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>User Management</CardTitle>
                        <CardDescription>Manage user roles and access.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingUsers ? (
                                    <TableRow><TableCell colSpan={4}>Loading users...</TableCell></TableRow>
                                ) : (
                                    allUsers.map(u => (
                                        <TableRow key={u.uid}>
                                            <TableCell>{u.firstName} {u.lastName}</TableCell>
                                            <TableCell>{u.email}</TableCell>
                                            <TableCell>{u.role}</TableCell>
                                            <TableCell className="text-right">
                                                 <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" disabled={u.uid === user.uid}>
                                                            <MoreHorizontal />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => { setSelectedUserForRoleChange(u); setNewRole(u.role); setIsRoleDialogOpen(true); }}>
                                                            Change Role
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                 </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
        )}

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
      
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Change User Role</DialogTitle>
                <DialogDescription>
                    Change the role for {selectedUserForRoleChange?.email}.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
                <Label htmlFor="role-select">New Role</Label>
                <Select value={newRole} onValueChange={(value: UserRole) => setNewRole(value)}>
                    <SelectTrigger id="role-select">
                        <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Manager">Manager</SelectItem>
                        <SelectItem value="Staff">Staff</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsRoleDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleRoleChange}>Save Role</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
