
"use client";

import React, { useRef, useState, useEffect } from 'react';
import { useZxing } from 'react-zxing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Button } from './ui/button';

interface ScannerProps {
    onResult: (text: string) => void;
    onClose: () => void;
}

export function Scanner({ onResult, onClose }: ScannerProps) {
    const { toast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);

    useZxing({
        videoRef,
        onDecodeResult(result) {
            onResult(result.getText());
        },
    });

    useEffect(() => {
        const getCameraPermission = async () => {
            setError(null);
            try {
                // Request rear camera first
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: "environment" } 
                });
                
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setHasCameraPermission(true);

            } catch (err: any) {
                console.error("Camera permission error:", err);
                // Fallback to any camera if rear is not available
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                     if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                    setHasCameraPermission(true);
                } catch (fallbackErr: any) {
                    console.error("Fallback camera error:", fallbackErr);
                    let errorMessage = "An unknown error occurred while accessing the camera.";
                    if (fallbackErr.name === "NotAllowedError") {
                        errorMessage = "Camera access was denied. Please enable it in your browser settings.";
                    } else if (fallbackErr.name === "NotFoundError") {
                         errorMessage = "No camera was found on this device.";
                    }
                    setError(errorMessage);
                    setHasCameraPermission(false);
                    toast({
                        variant: 'destructive',
                        title: 'Camera Error',
                        description: errorMessage,
                    });
                }
            }
        };

        getCameraPermission();
        
        // Cleanup function to stop the stream
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [toast]);

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <div className="light">
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Scan Product QR Code</DialogTitle>
                    </DialogHeader>
                    <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
                        <video 
                            ref={videoRef} 
                            className="h-full w-full object-cover" 
                            autoPlay 
                            muted 
                            playsInline
                        />
                        {hasCameraPermission === false && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-4">
                                <Alert variant="destructive">
                                      <AlertTitle>Camera Access Required</AlertTitle>
                                      <AlertDescription>
                                        {error || 'Please allow camera access to use this feature.'}
                                      </AlertDescription>
                              </Alert>
                            </div>
                        )}
                         {hasCameraPermission === null && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                                <p className="text-muted-foreground">Requesting camera access...</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </div>
        </Dialog>
    );
}
