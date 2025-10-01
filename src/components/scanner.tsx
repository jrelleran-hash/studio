"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useZxing } from 'react-zxing';

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
            if (error?.name === 'NotAllowedError') {
                 toast({
                    variant: 'destructive',
                    title: 'Camera Access Denied',
                    description: 'Please enable camera permissions in your browser settings.',
                });
            } else if (error) {
                 toast({
                    variant: 'destructive',
                    title: 'Camera Error',
                    description: 'Could not initialize camera. Please try again.',
                });
            }
        },
    });

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md light bg-background">
                <DialogHeader>
                    <DialogTitle>Scan Product QR Code</DialogTitle>
                </DialogHeader>
                <video ref={ref} className="w-full aspect-video rounded-md bg-black" />
            </DialogContent>
        </Dialog>
    );
}
