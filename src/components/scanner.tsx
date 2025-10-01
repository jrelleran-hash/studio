"use client";

import React from 'react';
import { useZxing } from 'react-zxing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface ScannerProps {
    onResult: (text: string) => void;
    onClose: () => void;
}

export function Scanner({ onResult, onClose }: ScannerProps) {
    const { toast } = useToast();

    const { ref } = useZxing({
        onDecodeResult(result) {
            onResult(result.getText());
        },
        onError(error) {
            console.error("QR Scanner Error:", error);
            let errorMessage = "An unknown error occurred with the scanner."
            if (error.name === "NotAllowedError") {
                errorMessage = "Camera access was denied. Please enable it in your browser settings to use the scanner."
            } else if (error.name === "NotFoundError") {
                errorMessage = "No camera was found on this device."
            } else if (error.name === "NotReadableError") {
                errorMessage = "The camera is already in use by another application."
            }
            
            toast({
                variant: 'destructive',
                title: 'Scanner Error',
                description: errorMessage,
            });
        }
    });

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Scan Product QR Code</DialogTitle>
                </DialogHeader>
                <div className="relative aspect-square w-full overflow-hidden rounded-md bg-black">
                     <video 
                        ref={ref} 
                        className="h-full w-full object-cover"
                     />
                </div>
            </DialogContent>
        </Dialog>
    );
}
