
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useZxing } from 'react-zxing';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ScannerProps {
  onResult: (text: string) => void;
  onClose: () => void;
}

export function Scanner({ onResult, onClose }: ScannerProps) {
  const { toast } = useToast();
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { ref } = useZxing({
    onDecodeResult(result) {
      onResult(result.getText());
    },
    onError(error) {
        if (error.name === 'NotAllowedError') {
             toast({
                variant: "destructive",
                title: "Camera Access Denied",
                description: "Please enable camera permissions in your browser settings.",
            });
        }
    }
  });

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true});
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this app.',
        });
      }
    };

    getCameraPermission();
  }, [toast]);
  

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md light bg-background">
        <DialogHeader>
          <DialogTitle>Scan Product QR Code</DialogTitle>
          <DialogDescription>Point your camera at the QR code.</DialogDescription>
        </DialogHeader>
        
        <video ref={ref} className="w-full aspect-video rounded-md" autoPlay muted />

        { !(hasCameraPermission) && (
            <Alert variant="destructive">
                      <AlertTitle>Camera Access Required</AlertTitle>
                      <AlertDescription>
                        Please allow camera access to use this feature.
                      </AlertDescription>
              </Alert>
        )
        }
      </DialogContent>
    </Dialog>
  );
}
