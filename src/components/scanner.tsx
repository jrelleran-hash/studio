
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
    
    const { ref, error } = useZxing({
        onDecodeResult(result) {
            onResult(result.getText());
        },
        onError(err) {
            // This will catch all errors, including NotAllowedError
            console.error(err);
             if (err?.name === 'NotAllowedError') {
                toast({
                    variant: 'destructive',
                    title: 'Camera Access Denied',
                    description: 'Please enable camera permissions in your browser settings to use this feature.',
                });
            } else {
                 toast({
                    variant: 'destructive',
                    title: 'Scanner Error',
                    description: err?.message || 'An unknown error occurred with the scanner.',
                });
            }
        }
    });

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <div className="light">
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Scan Product QR Code</DialogTitle>
                    </DialogHeader>
                    <div className="relative">
                        <video ref={ref} className="w-full aspect-video rounded-md bg-black" />
                        {error && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-md">
                                <Alert variant="destructive">
                                      <AlertTitle>Camera Error</AlertTitle>
                                      <AlertDescription>
                                        {error.message === 'Permission denied' 
                                            ? 'Please allow camera access to use this feature.'
                                            : 'Could not start camera. Please check permissions.'
                                        }
                                      </AlertDescription>
                              </Alert>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </div>
        </Dialog>
    );
}
