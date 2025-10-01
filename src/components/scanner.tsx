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

interface ZxingScannerProps {
    videoRef: React.RefObject<HTMLVideoElement>;
    onResult: (text: string) => void;
}

// Child component that contains the hook.
// This will only be rendered when the video stream is ready.
function ZxingScanner({ videoRef, onResult }: ZxingScannerProps) {
    useZxing({
        videoRef,
        onDecodeResult(result) {
            onResult(result.getText());
        },
    });
    return null; // This component does not render anything itself
}

export function Scanner({ onResult, onClose }: ScannerProps) {
    const { toast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [isStreamReady, setIsStreamReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const getCameraPermission = async () => {
            setError(null);
            setIsStreamReady(false);
            try {
                // Request rear camera first
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" }
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    // The 'oncanplay' event ensures the video stream is ready before we try to scan.
                    videoRef.current.oncanplay = () => {
                        setIsStreamReady(true);
                    };
                }
                setHasCameraPermission(true);

            } catch (err: any) {
                console.error("Camera permission error:", err);
                let errorMessage = "An unknown error occurred while accessing the camera.";
                if (err.name === "NotAllowedError") {
                    errorMessage = "Camera access was denied. Please enable it in your browser settings.";
                } else if (err.name === "NotFoundError") {
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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Scan Product QR Code</DialogTitle>
                </DialogHeader>
                <div className="relative aspect-square w-full overflow-hidden rounded-md bg-black">
                    <video
                        ref={videoRef}
                        className="h-full w-full object-cover"
                        autoPlay
                        muted
                        playsInline
                    />
                    {isStreamReady && <ZxingScanner videoRef={videoRef} onResult={onResult} />}
                    
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
        </Dialog>
    );
}
