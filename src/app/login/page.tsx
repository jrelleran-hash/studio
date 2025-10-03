
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Fingerprint } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CoreFlowLogo } from "@/components/icons";
import { FirebaseError } from "firebase/app";
import { Separator } from "@/components/ui/separator";
import { registerPasskey, signInWithPasskey } from "@/lib/webauthn";
import { useAuth } from "@/hooks/use-auth";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const [isPasskeyReady, setIsPasskeyReady] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });
  
  const handlePasskeySignIn = async () => {
      setIsLoading(true);
      try {
          const success = await signInWithPasskey();
          if (success) {
              toast({ title: "Signed in with passkey!" });
              router.push("/");
          } else {
              toast({ variant: "destructive", title: "Passkey sign-in failed", description: "Could not verify passkey. Please try again or use your password." });
          }
      } catch (error) {
           const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
           toast({ variant: "destructive", title: "Passkey Error", description: errorMessage });
      } finally {
          setIsLoading(false);
      }
  }
  
  const handleRegisterPasskey = async () => {
    if (!user) {
        toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to register a passkey." });
        return;
    }
    setIsLoading(true);
    try {
        const success = await registerPasskey(user.uid, user.email || 'user');
        if (success) {
            toast({ title: "Passkey Registered!", description: "You can now use this device to sign in with your fingerprint or face." });
        } else {
            toast({ variant: "destructive", title: "Registration Failed", description: "Could not register passkey. Your browser may not support it." });
        }
    } catch(error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ variant: "destructive", title: "Passkey Registration Error", description: errorMessage });
    } finally {
        setIsLoading(false);
    }
  }

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
       if (!userCredential.user.emailVerified) {
        toast({
          variant: "destructive",
          title: "Email Not Verified",
          description: "Please verify your email address before signing in.",
        });
        router.push(`/verify-email?email=${data.email}`);
        return;
      }
      setIsPasskeyReady(true); // Show passkey registration option after login
      // Don't redirect immediately, let them register a passkey
      toast({ title: "Login Successful", description: "You can now proceed to the dashboard or register a passkey for faster login." });

    } catch (error: any) {
      let errorMessage = "An unexpected error occurred.";
      if (error instanceof FirebaseError) {
          if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = "Invalid email or password.";
          } else {
            errorMessage = error.message;
          }
      }
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isPasskeyReady) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle>Login Successful!</CardTitle>
                    <CardDescription>What would you like to do next?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={() => router.push("/")} className="w-full">Go to Dashboard</Button>
                    <Button variant="outline" onClick={handleRegisterPasskey} className="w-full">
                        <Fingerprint className="mr-2 h-4 w-4" />
                        Register Passkey for this Device
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CoreFlowLogo className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline">Welcome</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
           <div className="relative my-4">
            <Separator />
            <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-background px-2 text-xs text-muted-foreground">OR</span>
          </div>
          <Button variant="outline" className="w-full" onClick={handlePasskeySignIn} disabled={isLoading}>
             <Fingerprint className="mr-2 h-4 w-4" />
             Sign in with a Passkey
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
