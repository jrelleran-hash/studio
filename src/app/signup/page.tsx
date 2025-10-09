

"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CoreFlowLogo } from "@/components/icons";
import { createUserProfile } from "@/services/data-service";
import type { UserRole, PagePermission } from "@/types";
import { FirebaseError } from "firebase/app";
import { useAuth } from "@/hooks/use-auth";
import { useData } from "@/context/data-context";

const signupSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type SignupFormValues = z.infer<typeof signupSchema>;


export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { userProfile, loading: authLoading } = useAuth();
  const { refetchData } = useData();
  
  useEffect(() => {
    // Only check for authorization once the loading is complete.
    if (!authLoading) {
      // If loading is done and there's no user profile or the role is not Admin, then redirect.
      if (!userProfile || userProfile.role !== 'Admin') {
        toast({
          variant: "destructive",
          title: "Unauthorized",
          description: "You do not have permission to create new users.",
        });
        router.push('/settings?tab=users'); // Redirect back to a safe page
      }
    }
  }, [userProfile, authLoading, router, toast]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      const displayName = `${data.firstName} ${data.lastName}`.trim();

      await updateProfile(user, { displayName });

      await createUserProfile(user.uid, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: "Worker", // Default role
        permissions: ["/"], // Default permissions
      });
      
      await refetchData();

      toast({ title: "User Created", description: `User ${data.email} has been successfully created.`});
      router.push(`/settings?tab=users`); 

    } catch (error: any) {
      let errorMessage = "An unexpected error occurred.";
      if (error instanceof FirebaseError) {
          if (error.code === 'auth/email-already-in-use') {
            errorMessage = "This email address is already in use.";
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
  
  if (authLoading || (userProfile && userProfile.role !== 'Admin')) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <p>Loading...</p>
        </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
           <div className="flex justify-center mb-4">
            <CoreFlowLogo className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline">Create New User</CardTitle>
          <CardDescription>Enter the new user's details. They will be able to log in immediately.</CardDescription>
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
                />
                {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  {...register("lastName")}
                  disabled={isLoading}
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating user..." : "Create User"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <Link href="/settings?tab=users" className="underline">
              Cancel and return to settings
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
