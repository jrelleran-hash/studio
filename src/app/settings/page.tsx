

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";


import { Button, buttonVariants } from "@/components/ui/button";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { uploadProfilePicture, type UserProfile, getAllUsers, updateUserProfile, deleteUser } from "@/services/data-service";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserRole, Department } from "@/types";
import { cn } from "@/lib/utils";
import { Check, MoreHorizontal } from "lucide-react";


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

function UserManagementTable({ isAdmin }: { isAdmin: boolean }) {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
    const { toast } = useToast();

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const userList = await getAllUsers();
            setUsers(userList);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not fetch user list." });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (isAdmin) {
            fetchUsers();
        }
    }, [isAdmin, fetchUsers]);

    const handleProfileUpdate = async (uid: string, data: Partial<UserProfile>) => {
        try {
            await updateUserProfile(uid, data);
            toast({ title: "Success", description: "User profile updated." });
            fetchUsers(); // Refresh the list
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to update user profile." });
        }
    };
    
    const handleDeleteClick = (user: UserProfile) => {
        setDeletingUser(user);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deletingUser) return;
        try {
            await deleteUser(deletingUser.uid);
            toast({ title: "Success", description: "User profile deleted. The user's login must be deleted from the Firebase Authentication console manually." });
            fetchUsers(); // Refresh the list
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to delete user profile." });
        } finally {
            setIsDeleteDialogOpen(false);
            setDeletingUser(null);
        }
    };

    if (!isAdmin) {
        return null;
    }

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                        <CardTitle>User Management</CardTitle>
                        <CardDescription>Manage user roles and access.</CardDescription>
                    </div>
                     <Button asChild size="sm">
                        <Link href="/signup">Add User</Link>
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                users.map((u) => (
                                    <TableRow key={u.uid}>
                                        <TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell>
                                        <TableCell>{u.email}</TableCell>
                                        <TableCell>{u.role}</TableCell>
                                        <TableCell>{u.department}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuSub>
                                                        <DropdownMenuSubTrigger>Change Role</DropdownMenuSubTrigger>
                                                        <DropdownMenuSubContent>
                                                            {(["Admin", "Manager", "Staff"] as UserRole[]).map(role => (
                                                                <DropdownMenuItem 
                                                                    key={role}
                                                                    disabled={u.role === role}
                                                                    onSelect={() => handleProfileUpdate(u.uid, { role })}
                                                                >
                                                                    {role}
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuSub>
                                                    <DropdownMenuSub>
                                                        <DropdownMenuSubTrigger>Change Department</DropdownMenuSubTrigger>
                                                        <DropdownMenuSubContent>
                                                            {(["Procurement", "Inventory", "Assurance", "Logistics", "Analytics", "Clients", "All"] as Department[]).map(dep => (
                                                                <DropdownMenuItem 
                                                                    key={dep}
                                                                    disabled={u.department === dep}
                                                                    onSelect={() => handleProfileUpdate(u.uid, { department: dep })}
                                                                >
                                                                    {dep}
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuSub>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onSelect={() => handleDeleteClick(u)}
                                                    >
                                                        Delete User
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
             <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will delete the user's profile document. It will **not** delete them from Firebase Authentication. You must do that manually in the Firebase Console.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className={buttonVariants({ variant: "destructive" })}>
                            Delete Profile
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

// Function to convert HEX to HSL
const hexToHsl = (hex: string): string => {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex[1] + hex[2], 16);
    g = parseInt(hex[3] + hex[4], 16);
    b = parseInt(hex[5] + hex[6], 16);
  }
  r /= 255; g /= 255; b /= 255;
  let cmin = Math.min(r,g,b),
      cmax = Math.max(r,g,b),
      delta = cmax - cmin,
      h = 0, s = 0, l = 0;

  if (delta === 0) h = 0;
  else if (cmax === r) h = ((g - b) / delta) % 6;
  else if (cmax === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  l = (cmax + cmin) / 2;
  s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  s = +(s * 100).toFixed(1);
  l = +(l * 100).toFixed(1);

  return `${h} ${s}% ${l}%`;
}


function AppearanceTab() {
  const [selectedColor, setSelectedColor] = useState('#B3FF70'); // Default to green in hex

  useEffect(() => {
    const storedColor = localStorage.getItem('app-accent-color') || '#B3FF70';
    setSelectedColor(storedColor);
    document.documentElement.style.setProperty('--primary', hexToHsl(storedColor));
  }, []);

  const handleColorChange = (hex: string) => {
    setSelectedColor(hex);
    localStorage.setItem('app-accent-color', hex);
    document.documentElement.style.setProperty('--primary', hexToHsl(hex));
  };

  const resetColor = () => {
    handleColorChange('#B3FF70'); // Default color
  };

  return (
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
           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                  <Label>Accent Color</Label>
                  <p className="text-sm text-muted-foreground">Select the primary accent color.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                   <Input 
                      type="color" 
                      value={selectedColor}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="p-0 h-8 w-14 border-none bg-transparent cursor-pointer"
                   />
                </div>
                <Input 
                  value={selectedColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="h-8 w-24"
                />
                <Button variant="ghost" size="sm" onClick={resetColor}>Reset</Button>
              </div>
          </div>
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "profile");

  const isAdmin = userProfile?.role === 'Admin';

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
      
      await updateUserProfile(user.uid, {
        firstName: data.firstName,
        lastName: data.lastName,
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
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          {isAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
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
        

        <TabsContent value="appearance" className="space-y-4">
          <AppearanceTab />
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

        <TabsContent value="users" className="space-y-4">
            <UserManagementTable isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}




