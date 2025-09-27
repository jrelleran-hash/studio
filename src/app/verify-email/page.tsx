
'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const handleResend = async () => {
    if (auth.currentUser) {
      setIsSending(true);
      try {
        await sendEmailVerification(auth.currentUser);
        toast({
          title: "Verification Email Sent",
          description: "A new verification link has been sent to your email address.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error Sending Email",
          description: "Could not send verification email. Please try again.",
        });
      } finally {
        setIsSending(false);
      }
    } else {
       toast({
          variant: "destructive",
          title: "Not Logged In",
          description: "No active user session found. Please log in again.",
        });
        router.push('/login');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="mt-4">Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a verification link to <span className="font-semibold text-foreground">{email || 'your email address'}</span>. Please check your inbox and click the link to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => router.push('/login')} className="w-full">
            I've Verified, Sign In
          </Button>
          <div className="text-sm text-muted-foreground">
            Didn't receive an email?{' '}
            <Button variant="link" className="p-0 h-auto" onClick={handleResend} disabled={isSending}>
              {isSending ? 'Sending...' : 'Resend link'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <VerifyEmailContent />
        </Suspense>
    )
}
