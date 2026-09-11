import React, { useRef, useEffect } from 'react';

interface HeroVideoPlayerProps {
  videoSrc?: string;
}

export const HeroVideoPlayer: React.FC<HeroVideoPlayerProps> = ({
  videoSrc = '/Video_Production_Blueprint_.mp4',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Explicitly set DOM properties to satisfy Chromium/Safari strict autoplay policy
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const playVideo = () => {
      if (video.paused) {
        video.play().catch((err) => {
          console.warn('Autoplay waiting for interaction:', err);
        });
      }
    };

    playVideo();

    // Interaction fallback in case browser policy pauses initially
    const handleInteraction = () => {
      playVideo();
    };

    window.addEventListener('click', handleInteraction, { once: true, passive: true });
    window.addEventListener('touchstart', handleInteraction, { once: true, passive: true });
    window.addEventListener('scroll', handleInteraction, { once: true, passive: true });

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('scroll', handleInteraction);
    };
  }, [videoSrc]);

  return (
    <div className="relative w-full h-full aspect-[16/10] sm:aspect-[16/9] flex items-center justify-center bg-[#060b17] overflow-hidden rounded-3xl sm:rounded-[36px] select-none">
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover rounded-3xl sm:rounded-[36px] pointer-events-none"
      >
        <source src={videoSrc} type="video/mp4" />
        <source src="/Video_Production_Blueprint_1.mp4" type="video/mp4" />
        <source src="/Video_Production_Blueprint_.mp4" type="video/mp4" />
      </video>
    </div>
  );
};
