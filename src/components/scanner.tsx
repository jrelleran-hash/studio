"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useZxing } from 'react-zxing';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface ScannerProps {
  onResult: (text: string) => void;
  onClose: () => void;
}

export function Scanner({ onResult, onClose }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { ref } = useZxing({
    videoRef,
    onDecodeResult(result) {
      onResult(result.getText());
    },
    paused: !stream, // Pause scanning until the stream is ready
  });

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const getCameraPermission = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' } // Prioritize rear camera
        });
        activeStream = mediaStream;
        setStream(mediaStream);
        setHasPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        setHasPermission(false);
        if (err instanceof DOMException) {
            if (err.name === 'NotAllowedError') {
                setError('Camera access was denied. Please enable it in your browser settings.');
            } else if (err.name === 'NotFoundError') {
                setError('No rear camera found on your device.');
            } else {
                setError('An error occurred while accessing the camera: ' + err.message);
            }
        } else {
            setError('An unknown camera error occurred.');
        }
      }
    };

    getCameraPermission();

    return () => {
      // Cleanup: stop all tracks on the stream when the component unmounts
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const renderContent = () => {
    if (hasPermission === null) {
      return (
        <div className="flex flex-col items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Requesting camera access...</p>
        </div>
      );
    }

    if (hasPermission === false || error) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Camera Error</AlertTitle>
          <AlertDescription>
            {error || 'Camera permission has been denied.'}
          </AlertDescription>
           <Button onClick={onClose} className="mt-4">Close</Button>
        </Alert>
      );
    }
    
    return (
      <div className="relative w-full">
        <video ref={videoRef} className="w-full aspect-video rounded-md bg-black" autoPlay muted playsInline />
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-4 border-primary/50 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
        </div>
      </div>
    );
  };
  
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md light bg-background">
        <DialogHeader>
          <DialogTitle>Scan Product QR Code</DialogTitle>
           {hasPermission && !error && <DialogDescription>Point your camera at the QR code.</DialogDescription>}
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}