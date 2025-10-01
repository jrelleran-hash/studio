
"use client";

import React from 'react';
import { useZxing } from 'react-zxing';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { CameraOff } from 'lucide-react';

interface ScannerProps {
  onResult: (text: string) => void;
  onClose: () => void;
}

export function Scanner({ onResult, onClose }: ScannerProps) {
  const { toast } = useToast();
  const { ref, error } = useZxing({
    onDecodeResult: (result) => {
      onResult(result.getText());
    },
    onError: (err) => {
      if (err) {
        if (err.name === 'NotAllowedError') {
            toast({
              variant: 'destructive',
              title: 'Camera Access Denied',
              description: 'Please enable camera permissions in your browser settings.',
            });
        } else if (err.name === "NotFoundException") {
            // This can happen if the device has no camera
        } else {
            console.error(err);
             toast({
              variant: 'destructive',
              title: 'Scanner Error',
              description: 'An unexpected error occurred with the camera.',
            });
        }
      }
    },
    constraints: { video: { facingMode: 'environment' } },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn("sm:max-w-md", "light bg-background")}>
        <DialogHeader>
          <DialogTitle>Scan Product QR Code</DialogTitle>
          <DialogDescription>Point your camera at the QR code.</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-md aspect-video bg-muted flex items-center justify-center">
            {error && (
                <Alert variant="destructive" className="w-auto">
                    <CameraOff className="h-4 w-4" />
                    <AlertTitle>Camera Error</AlertTitle>
                    <AlertDescription>
                        {error.message === 'Permission denied' 
                            ? "Camera permission denied. Please allow camera access in your browser settings."
                            : "Could not start camera. Please check permissions or try another device."
                        }
                    </AlertDescription>
                </Alert>
            )}
            <video ref={ref} className={cn("w-full h-full object-cover", error && "hidden")} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
