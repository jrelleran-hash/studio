
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useZxing } from 'react-zxing';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, CameraOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ScannerProps {
  onResult: (text: string) => void;
  onClose: () => void;
}

interface QrDecoderProps {
  stream: MediaStream;
  onResult: (text: string) => void;
}

// This child component is only rendered once the stream is ready.
// It initializes the zxing hook which starts the decoding process.
function QrDecoder({ stream, onResult }: QrDecoderProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Attach the guaranteed-to-be-ready stream to the video element
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);
    
    const { ref } = useZxing({
        onDecodeResult(result) {
            onResult(result.getText());
        },
        paused: !stream, // Ensure it's paused until the stream is active
    });

    // This assigns the ref from the hook to our video element ref
    useEffect(() => {
        if (videoRef.current) {
            (ref as React.MutableRefObject<HTMLVideoElement>).current = videoRef.current;
        }
    }, [ref]);

    return (
        <video 
            ref={videoRef} 
            className="w-full aspect-video rounded-md"
            autoPlay
            muted
            playsInline
        />
    );
}


export function Scanner({ onResult, onClose }: ScannerProps) {
  const { toast } = useToast();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const getCamera = async () => {
        setLoading(true);
        setError(null);
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment" } 
            });
            if (active) {
                setStream(mediaStream);
            }
        } catch (err) {
            console.error('Error accessing camera:', err);
             if (active) {
                if ((err as Error).name === 'NotAllowedError') {
                    setError('Camera permission was denied. Please allow camera access in your browser settings.');
                } else if ((err as Error).name === 'NotFoundError' || (err as Error).name === 'DevicesNotFoundError') {
                     setError('No camera found on this device.');
                }
                else {
                    setError('An error occurred while accessing the camera.');
                }
                 toast({
                    variant: 'destructive',
                    title: 'Camera Error',
                    description: (err as Error).message
                });
            }
        } finally {
            if (active) {
                setLoading(false);
            }
        }
    };
    
    getCamera();
    
    // Cleanup function
    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md light bg-background">
        <DialogHeader>
          <DialogTitle>Scan Product QR Code</DialogTitle>
          <DialogDescription>Point your rear camera at the QR code.</DialogDescription>
        </DialogHeader>
        
        <div className="w-full aspect-video rounded-md bg-black flex items-center justify-center">
            {loading && (
                <div className="text-white text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p>Requesting Camera...</p>
                </div>
            )}
            {error && (
                <Alert variant="destructive" className="m-4">
                    <CameraOff className="h-4 w-4" />
                    <AlertTitle>Camera Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {stream && !error && <QrDecoder stream={stream} onResult={onResult} />}
        </div>

      </DialogContent>
    </Dialog>
  );
}
