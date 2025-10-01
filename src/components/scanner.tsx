"use client";

import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Html5QrcodeScanner } from 'html5-qrcode';
import type { Html5QrcodeError, QrCodeSuccessCallback } from 'html5-qrcode/esm/core';

interface ScannerProps {
    onResult: (text: string) => void;
    onClose: () => void;
}

const qrcodeRegionId = "html5qr-code-full-region";

export function Scanner({ onResult, onClose }: ScannerProps) {
    useEffect(() => {
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [],
            aspectRatio: 1.0,
        };

        const html5QrcodeScanner = new Html5QrcodeScanner(qrcodeRegionId, config, false);

        const qrCodeSuccessCallback: QrCodeSuccessCallback = (decodedText, decodedResult) => {
            onResult(decodedText);
            html5QrcodeScanner.clear();
        };
        const qrCodeErrorCallback: Html5QrcodeError = (errorMessage) => {
           // This callback can be very noisy.
           // console.error(`QR Code no longer in front of camera.`, errorMessage);
        };

        html5QrcodeScanner.render(qrCodeSuccessCallback, qrCodeErrorCallback);
        
        // Cleanup function to stop the scanner
        return () => {
             html5QrcodeScanner.clear().catch(error => {
                console.error("Failed to clear html5QrcodeScanner. ", error);
            });
        };
    }, [onResult]);

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Scan Product QR Code</DialogTitle>
                </DialogHeader>
                <div id={qrcodeRegionId} className="w-full" />
            </DialogContent>
        </Dialog>
    );
}
