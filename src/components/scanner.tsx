
"use client";

import React, { useRef, useState } from 'react';
import { useZxing } from 'react-zxing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ScannerProps {
    onResult: (text: string) => void;
    onClose: () => void;
}

export function Scanner({ onResult, onClose }: ScannerProps) {
    const { toast } = useToast();
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    const { ref } = useZxing({
        onDecodeResult(result) {
            onResult(result.getText());
        },
        onDecodeError(error) {
            if (error && error.name === 'NotAllowedError') {
                if (hasPermission !== false) { // Prevents multiple toasts
                    toast({
                        variant: 'destructive',
                        title: 'Camera Access Denied',
                        description: 'Please enable camera permissions in your browser settings to use this feature.',
                    });
                    setHasPermission(false);
                }
            } else if (error && hasPermission !== false) {
                 // Ignore other errors like not found, which happen continuously
            }
        },
        onMediaStream(stream) {
            if (stream) {
                setHasPermission(true);
            }
        },
    });

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="bg-white">
                <DialogHeader>
                    <DialogTitle>Scan Product QR Code</DialogTitle>
                </DialogHeader>
                <div className="relative">
                    <video ref={ref} className="w-full aspect-video rounded-md bg-black" />
                    {hasPermission === false && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-md">
                            <Alert variant="destructive" className="w-auto">
                                <AlertTitle>Camera Access Required</AlertTitle>
                                <AlertDescription>
                                    Please allow camera access to use this feature.
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
