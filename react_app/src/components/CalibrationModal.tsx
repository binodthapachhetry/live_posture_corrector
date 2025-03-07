import React, { useState, useRef, useEffect } from 'react';
import postureDetectionService from '../services/PostureDetectionService';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCalibrationComplete: () => void;
}

const CalibrationModal: React.FC<CalibrationModalProps> = ({ 
  isOpen, 
  onClose,
  onCalibrationComplete 
}) => {
  const [step, setStep] = useState<number>(1);
  const [countdown, setCountdown] = useState<number>(5);
  const [calibrating, setCalibrating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Initialize camera when modal opens
  useEffect(() => {
    if (isOpen) {
      initCamera();
    } else {
      // Clean up when modal closes
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);
  
  // Handle countdown for calibration
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (step === 2 && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (step === 2 && countdown === 0) {
      performCalibration();
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [step, countdown]);
  
  const initCamera = async () => {
    try {
      // Make sure model is loaded
      if (!postureDetectionService.isModelReady()) {
        await postureDetectionService.loadModel();
      }
      
      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error initializing camera:', err);
      setError('Could not access camera. Please check permissions and try again.');
    }
  };
  
  const startCalibration = () => {
    setStep(2);
    setCountdown(5);
  };
  
  const performCalibration = async () => {
    setCalibrating(true);
    setError(null);
    
    try {
      if (!videoRef.current || !canvasRef.current) {
        throw new Error('Video or canvas reference not available');
      }
      
      // Capture current frame
      const context = canvasRef.current.getContext('2d');
      if (!context) throw new Error('Could not get canvas context');
      
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      
      context.drawImage(
        videoRef.current, 
        0, 0, 
        videoRef.current.videoWidth, 
        videoRef.current.videoHeight
      );
      
      const imageData = context.getImageData(
        0, 0, 
        canvasRef.current.width, 
        canvasRef.current.height
      );
      
      // Perform calibration
      const success = await postureDetectionService.calibrate(imageData);
      
      if (success) {
        setStep(3); // Success step
      } else {
        throw new Error('Calibration failed. Please try again.');
      }
    } catch (err) {
      console.error('Calibration error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error during calibration');
      setStep(1); // Back to first step
    } finally {
      setCalibrating(false);
    }
  };
  
  const handleComplete = () => {
    onCalibrationComplete();
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full">
        <h2 className="text-xl font-bold mb-4">Posture Calibration</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {step === 1 && (
          <div>
            <p className="mb-4">
              Let's calibrate your posture detection. Please:
            </p>
            <ul className="list-disc pl-5 mb-4">
              <li>Sit up straight with good posture</li>
              <li>Face the camera directly</li>
              <li>Make sure your upper body is visible</li>
              <li>Ensure you're in a well-lit environment</li>
            </ul>
            <div className="relative aspect-video bg-gray-100 mb-4">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="absolute inset-0 w-full h-full object-cover"
              />
              <canvas 
                ref={canvasRef} 
                className="absolute inset-0 w-full h-full object-cover opacity-0"
              />
            </div>
            <div className="flex justify-between">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Cancel
              </button>
              <button
                onClick={startCalibration}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                Start Calibration
              </button>
            </div>
          </div>
        )}
        
        {step === 2 && (
          <div>
            <p className="mb-4">
              Maintain your best posture. Calibrating in {countdown} seconds...
            </p>
            <div className="relative aspect-video bg-gray-100 mb-4">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl">
                {countdown}
              </div>
            </div>
          </div>
        )}
        
        {step === 3 && (
          <div>
            <p className="mb-4 text-green-600 font-bold">
              Calibration successful!
            </p>
            <p className="mb-4">
              Your posture settings have been personalized based on your current posture.
              The system will now use this as a reference for detecting poor posture.
            </p>
            <div className="flex justify-end">
              <button
                onClick={handleComplete}
                className="px-4 py-2 bg-green-500 text-white rounded"
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalibrationModal;
