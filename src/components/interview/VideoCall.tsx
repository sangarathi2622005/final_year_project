import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  MonitorOff,
  Phone,
  Maximize2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface VideoCallProps {
  roomCode: string;
  onLeave?: () => void;
}

export function VideoCall({ roomCode, onLeave }: VideoCallProps) {
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isAudioOn, setIsAudioOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      // Cleanup streams on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream, screenStream]);

  const toggleVideo = async () => {
    try {
      if (isVideoOn) {
        // Turn off video
        if (stream) {
          stream.getVideoTracks().forEach(track => {
            track.stop();
            stream.removeTrack(track);
          });
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
        setIsVideoOn(false);
      } else {
        // Turn on video
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: isAudioOn,
        });
        
        setStream(mediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }
        setIsVideoOn(true);
        if (!isAudioOn && mediaStream.getAudioTracks().length > 0) {
          setIsAudioOn(true);
        }
      }
    } catch (error) {
      console.error('Error toggling video:', error);
      toast({
        title: 'Camera Error',
        description: 'Unable to access camera. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const toggleAudio = async () => {
    try {
      if (isAudioOn) {
        if (stream) {
          stream.getAudioTracks().forEach(track => {
            track.enabled = false;
          });
        }
        setIsAudioOn(false);
      } else {
        if (stream && stream.getAudioTracks().length > 0) {
          stream.getAudioTracks().forEach(track => {
            track.enabled = true;
          });
        } else {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          if (stream) {
            mediaStream.getAudioTracks().forEach(track => {
              stream.addTrack(track);
            });
          } else {
            setStream(mediaStream);
          }
        }
        setIsAudioOn(true);
      }
    } catch (error) {
      console.error('Error toggling audio:', error);
      toast({
        title: 'Microphone Error',
        description: 'Unable to access microphone. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        if (screenStream) {
          screenStream.getTracks().forEach(track => track.stop());
          setScreenStream(null);
        }
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = null;
        }
        setIsScreenSharing(false);
      } else {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        
        setScreenStream(displayStream);
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = displayStream;
        }
        setIsScreenSharing(true);

        // Handle when user stops sharing via browser UI
        displayStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setScreenStream(null);
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = null;
          }
        };
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      toast({
        title: 'Screen Share Error',
        description: 'Unable to share screen. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    
    try {
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const handleLeave = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }
    onLeave?.();
  };

  return (
    <div 
      ref={containerRef}
      className="h-full flex flex-col bg-card rounded-xl overflow-hidden"
    >
      {/* Video Grid */}
      <div className="flex-1 p-4 grid grid-cols-1 gap-4 min-h-0">
        {/* Screen Share (if active) */}
        {isScreenSharing && (
          <div className="video-container">
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain bg-black"
            />
            <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded-full text-sm text-white flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Screen Share
            </div>
          </div>
        )}

        {/* Local Video */}
        <div className={cn(
          "video-container",
          isScreenSharing && "absolute bottom-20 right-8 w-48 h-36 rounded-lg shadow-xl z-10"
        )}>
          {isVideoOn ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="video-overlay">
              <div className="text-center">
                <Avatar className="w-20 h-20 mx-auto mb-3">
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    You
                  </AvatarFallback>
                </Avatar>
                <p className="text-white/80 text-sm">Camera off</p>
              </div>
            </div>
          )}
          <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-sm text-white">
            You {!isAudioOn && '(muted)'}
          </div>
        </div>

        {/* Remote Participant Placeholder */}
        {!isScreenSharing && (
          <div className="video-container">
            <div className="video-overlay">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                  <Users className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-white/80 mb-2">Waiting for others to join...</p>
                <p className="text-white/60 text-sm">
                  Room code: <span className="font-mono font-semibold">{roomCode}</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-3 bg-card border-t border-border flex items-center justify-center gap-3">
        <Button
          variant={isAudioOn ? 'secondary' : 'destructive'}
          size="icon-lg"
          onClick={toggleAudio}
          className="rounded-full"
        >
          {isAudioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        
        <Button
          variant={isVideoOn ? 'secondary' : 'destructive'}
          size="icon-lg"
          onClick={toggleVideo}
          className="rounded-full"
        >
          {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
        
        <Button
          variant={isScreenSharing ? 'success' : 'secondary'}
          size="icon-lg"
          onClick={toggleScreenShare}
          className="rounded-full"
        >
          {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
        </Button>
        
        <Button
          variant="secondary"
          size="icon-lg"
          onClick={toggleFullscreen}
          className="rounded-full"
        >
          <Maximize2 className="h-5 w-5" />
        </Button>
        
        <Button
          variant="video"
          size="icon-lg"
          onClick={handleLeave}
          className="rounded-full ml-4"
        >
          <Phone className="h-5 w-5 rotate-[135deg]" />
        </Button>
      </div>
    </div>
  );
}
