
"use client";

import React, { useRef, useState, useEffect } from 'react';
import { useZxing } from 'react-zxing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface ScannerProps {
    onResult: (text: string) => void;
    onClose: () => void;
}

export function Scanner({ onResult, onClose }: ScannerProps) {
    const { toast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

    const { ref } = useZxing({
        onDecodeResult(result) {
            onResult(result.getText());
        },
        paused: !hasCameraPermission, // Pause decoding if we don't have permission
    });
    
    // Combine refs
    const setRefs = React.useCallback((node: HTMLVideoElement) => {
        videoRef.current = node;
        ref(node);
    }, [ref]);

    useEffect(() => {
        const getCameraPermission = async () => {
          try {
            // Ensure we have a navigator object
            if (!navigator?.mediaDevices) {
                 throw new Error("Media devices not supported.");
            }
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
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
              description: 'Please enable camera permissions in your browser settings to use this feature.',
            });
          }
        };

        getCameraPermission();
    }, []);

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <div className="light">
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Scan Product QR Code</DialogTitle>
                    </DialogHeader>
                    <div className="relative">
                        <video ref={setRefs} className="w-full aspect-video rounded-md" autoPlay muted playsInline />
                        {hasCameraPermission === false && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-md">
                                <Alert variant="destructive">
                                      <AlertTitle>Camera Access Required</AlertTitle>
                                      <AlertDescription>
                                        Please allow camera access to use this feature.
                                      </AlertDescription>
                              </Alert>
                            </div>
                        )}
                         {hasCameraPermission === null && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-md">
                                <p>Requesting camera permission...</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </div>
        </Dialog>
    );
}
