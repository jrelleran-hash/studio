
"use client";

import React, { useState } from 'react';
import QrReader from 'react-qr-scanner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { CameraOff } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

interface ScannerProps {
  onResult: (text: string | null) => void;
  onClose: () => void;
}

export function Scanner({ onResult, onClose }: ScannerProps) {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handleResult = (result: any) => {
    // The library can return the string directly or in a `text` property.
    const scannedText = result?.text || (typeof result === 'string' ? result : null);
    if (scannedText) {
      onResult(scannedText);
    }
  };

  const handleError = (err: any) => {
    console.error(err);
    let errorMessage = 'An unexpected error occurred with the camera.';
    if (err?.name === 'NotAllowedError') {
      errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
    } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera found. Please connect a camera and try again.';
    }
    
    setError(errorMessage);
    setLoading(false);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn("sm:max-w-md", "light bg-background")}>
        <DialogHeader>
          <DialogTitle>Scan Product QR Code</DialogTitle>
          <DialogDescription>Point your camera at the QR code.</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-md aspect-video bg-muted flex items-center justify-center relative">
          {loading && !error && <Skeleton className="absolute inset-0" />}
          {error && (
            <Alert variant="destructive" className="w-auto">
              <CameraOff className="h-4 w-4" />
              <AlertTitle>Camera Error</AlertTitle>
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}
          {!error && (
             <QrReader
                onLoad={() => setLoading(false)}
                onError={handleError}
                onScan={handleResult}
                constraints={{
                    video: { facingMode: 'environment' },
                }}
                className={cn("w-full h-full object-cover", loading && "opacity-0")}
                style={{ width: '100%', height: '100%'}}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
