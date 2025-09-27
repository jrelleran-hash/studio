
"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ChevronsUpDown, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CoreFlowLogo } from "@/components/icons";
import { createUserProfile } from "@/services/data-service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserRole, PagePermission } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { FirebaseError } from "firebase/app";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const allPermissions: { group: string; permissions: { value: PagePermission; label: string }[] }[] = [
    { group: "Core", permissions: [
        { value: "/", label: "Dashboard" },
        { value: "/clients", label: "Clients" },
        { value: "/logistics", label: "Logistics" },
        { value: "/analytics", label: "Analytics" },
    ]},
    { group: "Procurement", permissions: [
        { value: "/orders", label: "Orders" },
        { value: "/purchase-orders", label: "Purchase Orders" },
        { value: "/suppliers", label: "Suppliers" },
    ]},
    { group: "Inventory", permissions: [
        { value: "/inventory", label: "Products" },
        { value: "/issuance", label: "Issuance" },
    ]},
    { group: "Assurance", permissions: [
        { value: "/returns", label: "Returns" },
        { value: "/quality-control", label: "Quality Control" },
    ]},
];

const signupSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  role: z.enum(["Admin", "Manager", "Staff"]),
  permissions: z.array(z.string()).min(1, "At least one permission is required."),
});

type SignupFormValues = z.infer<typeof signupSchema>;

const toTitleCase = (str: string) => {
  if (!str) return "";
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};


export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { userProfile } = useAuth();
  
  const isAdmin = userProfile?.role === "Admin";
  const [isPermissionPopoverOpen, setIsPermissionPopoverOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    control,
    watch,
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      role: "Staff",
      permissions: ["/"],
    },
  });

  const selectedPermissions = watch('permissions') || [];

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      const displayName = `${data.firstName} ${data.lastName}`.trim();

      await updateProfile(user, { displayName });
      
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      };
      await sendEmailVerification(user, actionCodeSettings);

      await createUserProfile(user.uid, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: data.role as UserRole,
        permissions: data.permissions as PagePermission[],
      });

      if (isAdmin) {
        toast({ title: "User Created", description: "New user has been created successfully."});
        router.push("/settings?tab=users"); 
      } else {
        toast({
          title: "Account Created",
          description: "Please check your email to verify your account before logging in.",
        });
        router.push(`/verify-email?email=${data.email}`);
      }

    } catch (error: any) {
      let errorMessage = "An unexpected error occurred.";
      if (error instanceof FirebaseError) {
          if (error.code === 'auth/email-already-in-use') {
            errorMessage = "This email address is already in use.";
          } else {
            errorMessage = error.message;
          }
      }
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
           <div className="flex justify-center mb-4">
            <CoreFlowLogo className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline">Create an Account</CardTitle>
          <CardDescription>Enter the details to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  {...register("firstName")}
                  disabled={isLoading}
                   onChange={(e) => {
                    const { value } = e.target;
                    setValue("firstName", toTitleCase(value), { shouldValidate: true });
                  }}
                />
                {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  {...register("lastName")}
                  disabled={isLoading}
                   onChange={(e) => {
                    const { value } = e.target;
                    setValue("lastName", toTitleCase(value), { shouldValidate: true });
                  }}
                />
                {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                {...register("email")}
                disabled={isLoading}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  disabled={isLoading}
                  className="pr-10"
                />
                 <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </Button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
             {isAdmin && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select onValueChange={(value) => setValue('role', value as UserRole)} defaultValue="Staff">
                            <SelectTrigger id="role" disabled={isLoading}>
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Admin">Admin</SelectItem>
                                <SelectItem value="Manager">Manager</SelectItem>
                                <SelectItem value="Staff">Staff</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label>Permissions</Label>
                        <Controller
                            control={control}
                            name="permissions"
                            render={({ field }) => (
                                <Popover open={isPermissionPopoverOpen} onOpenChange={setIsPermissionPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={isPermissionPopoverOpen}
                                            className="w-full justify-between"
                                            disabled={isLoading}
                                        >
                                            <span className="truncate">
                                                {selectedPermissions.length > 0 ? `${selectedPermissions.length} selected` : "Select permissions..."}
                                            </span>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command>
                                            <CommandInput placeholder="Search permissions..." />
                                            <CommandEmpty>No permission found.</CommandEmpty>
                                            <CommandList>
                                                {allPermissions.map((group) => (
                                                <CommandGroup key={group.group} heading={group.group}>
                                                    {group.permissions.map((permission) => (
                                                        <CommandItem
                                                            key={permission.value}
                                                            value={permission.label}
                                                            onSelect={() => {
                                                                const newSelection = selectedPermissions.includes(permission.value)
                                                                    ? selectedPermissions.filter(p => p !== permission.value)
                                                                    : [...selectedPermissions, permission.value];
                                                                field.onChange(newSelection);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedPermissions.includes(permission.value) ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {permission.label}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                                ))}
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            )}
                        />
                        {errors.permissions && <p className="text-sm text-destructive">{errors.permissions.message}</p>}
                    </div>
                </div>
             )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
          {!isAdmin && (
            <div className="mt-4 text-center text-sm">
                Already have an account?{" "}
                <Link href="/login" className="underline">
                Sign in
                </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
