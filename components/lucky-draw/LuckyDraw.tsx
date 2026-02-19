// ============================================
// Galeria - Main Lucky Draw Component
// ============================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { playSound, playDrumRoll, playRevealSound, stopDrumRoll } from '@/lib/sounds';

// ============================================
// TYPES
// ============================================

interface LuckyDrawProps {
  isOrganizer: boolean;
  onStart?: () => void;
  onWinnerAnnounced?: (winner: Winner) => void;
}

interface Winner {
  participant_name: string;
  selfie_url: string;
  prize_tier: number;
}

interface AnimationConfig {
  style: 'slot_machine' | 'spinning_wheel' | 'card_shuffle' | 'drum_roll' | 'random_fade';
  duration: number;
  showSelfie: boolean;
  showName: boolean;
  playSound: boolean;
  confetti: boolean;
  numberOfWinners: number;
}

// ============================================
// ANIMATION COMPONENTS
// ============================================

// Slot Machine Animation
function SlotMachineAnimation({
  duration = 5,
  onComplete,
}: {
  duration?: number;
  onComplete?: () => void;
}) {
  const [reels, setReels] = useState<string[]>(['?', '?', '?']);
  const [isSpinning, setIsSpinning] = useState(true);

  useEffect(() => {
    if (!isSpinning) return;

    const interval = setInterval(() => {
      setReels((prev) =>
        prev.map(() => {
          const symbols = ['?', '?', '?', '?', '?', '?'];
          return symbols[Math.floor(Math.random() * symbols.length)];
        })
      );
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setIsSpinning(false);
      onComplete?.();
    }, duration * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isSpinning, duration, onComplete]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex gap-8">
        {reels.map((reel, index) => (
          <div
            key={index}
            className={cn(
              'w-32 h-48 flex items-center justify-center text-6xl',
              isSpinning && 'animate-spin'
            )}
          >
            {reel}
          </div>
        ))}
      </div>
    </div>
  );
}

// Spinning Wheel Animation
function SpinningWheelAnimation({
  duration = 8,
  onComplete,
}: {
  duration?: number;
  onComplete?: () => void;
}) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(true);

  useEffect(() => {
    if (!isSpinning) return;

    const spinDuration = duration * 1000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;

      if (elapsed >= spinDuration) {
        setIsSpinning(false);
        onComplete?.();
        return;
      }

      const progress = elapsed / spinDuration;
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const totalRotation = 360 * 5;
      const currentRotation = easeOut * totalRotation;

      setRotation(currentRotation);
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [isSpinning, duration, onComplete]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div
        className="w-96 h-96 rounded-full relative"
        style={{
          background: 'conic-gradient(from 0deg, #8B5CF6, #EC4899, #F59E0B, #8B5CF6)',
          transform: `rotate(${rotation}deg)`,
          transition: 'transform 0.1s ease-out',
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 bg-white rounded-full shadow-xl flex items-center justify-center">
            {isSpinning ? (
              <span className="text-2xl font-bold">?</span>
            ) : (
              <span className="text-2xl font-bold">!</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Card Shuffle Animation
function CardShuffleAnimation({
  duration = 6,
  onComplete,
}: {
  duration?: number;
  onComplete?: () => void;
}) {
  const [isShuffling, setIsShuffling] = useState(true);
  const [showReveal, setShowReveal] = useState(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!isShuffling) return;

    const shuffleDuration = (duration - 1) * 1000;

    const timeout = setTimeout(() => {
      setIsShuffling(false);
      setTimeout(() => {
        setShowReveal(true);
        onCompleteRef.current?.();
      }, 1000);
    }, shuffleDuration);

    return () => {
      clearTimeout(timeout);
    };
  }, [isShuffling, duration]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="relative w-64 h-96">
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              'w-24 h-32 bg-white rounded-lg shadow-xl border-4 border-purple-500 flex items-center justify-center transition-all duration-500',
              showReveal && 'scale-150'
            )}
          >
            <span className="text-4xl">{showReveal ? '?' : '?'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Drum Roll Animation
function DrumRollAnimation({
  duration = 10,
  onComplete,
}: {
  duration?: number;
  onComplete?: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRolling, setIsRolling] = useState(true);
  const [showReveal, setShowReveal] = useState(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const entries = ['?', '?', '?', '?', '?'];

  useEffect(() => {
    if (!isRolling) return;

    const rollDuration = duration * 1000;
    const interval = 50;

    const intervalId = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % entries.length);
    }, interval);

    const timeout = setTimeout(() => {
      clearInterval(intervalId);
      setIsRolling(false);
      setTimeout(() => {
        setShowReveal(true);
        onCompleteRef.current?.();
      }, 2000);
    }, rollDuration);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeout);
    };
  }, [isRolling, duration, entries.length]);

  const entry = entries[currentIndex];

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="relative">
        <div className="flex items-center justify-center">
          <div className="relative w-80 h-80 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg shadow-2xl">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={cn(
                  'text-4xl font-bold text-white transition-all duration-100',
                  showReveal && 'scale-125'
                )}
              >
                {entry}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Random Fade Animation
function RandomFadeAnimation({
  duration = 3,
  onComplete,
}: {
  duration?: number;
  onComplete?: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRolling, setIsRolling] = useState(true);
  const [showReveal, setShowReveal] = useState(false);

  const entries = ['?', '?', '?', '?', '?'];

  useEffect(() => {
    if (!isRolling) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % entries.length);
    }, 200);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setIsRolling(false);
      setShowReveal(true);
      onComplete?.();
    }, duration * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isRolling, duration, entries.length]);

  const entry = entries[currentIndex];

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div
          className={cn(
            'text-6xl font-bold mb-4 transition-all duration-300',
            showReveal && 'scale-150'
          )}
        >
          {entry}
        </div>
      </div>
    </div>
  );
}

// ============================================
// LUCKY DRAW COMPONENT
// ============================================

export function LuckyDraw({
  isOrganizer = false,
  winners = [],
  onStart,
  onWinnerAnnounced,
  onComplete,
  config,
}: {
  isOrganizer?: boolean;
  winners?: Winner[];
  onStart?: () => void;
  onWinnerAnnounced?: (winner: Winner) => void;
  onComplete?: () => void;
  config?: AnimationConfig;
}) {
  const [showDraw, setShowDraw] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Queue State
  const [displayQueue, setDisplayQueue] = useState<Winner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentWinner, setCurrentWinner] = useState<Winner | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [revealPhase, setRevealPhase] = useState<'idle' | 'animating' | 'revealed' | 'complete'>('idle');

  // Config State - use props or fallback to defaults
  const animationConfig = config || {
    style: 'spinning_wheel' as AnimationConfig['style'],
    duration: 8,
    showSelfie: true,
    showName: true,
    playSound: false,
    confetti: true,
    numberOfWinners: 1,
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (winners.length > 0 && revealPhase === 'idle') {
      // Sort winners: Lowest Prize (Consolation) -> Highest Prize (Grand)
      // Assuming input 'winners' is typically ordered Grand -> Consolation by the API
      // We reverse it to build suspense
      setDisplayQueue([...winners].reverse());
    }
  }, [winners, revealPhase]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleStartDraw = () => {
    setShowDraw(true);
    setRevealPhase('idle');
    setCurrentIndex(0);
    setCurrentWinner(null);
    onStart?.();
  };

  const startNextReveal = () => {
    if (currentIndex >= displayQueue.length) {
      setRevealPhase('complete');
      onComplete?.();
      return;
    }

    const nextWinner = displayQueue[currentIndex];
    setCurrentWinner(nextWinner);
    setIsAnimating(true);
    setShowConfetti(false);
    setRevealPhase('animating');

    // Play drum roll during animation
    if (animationConfig.playSound) {
      playDrumRoll(animationConfig.duration);
    }
  };

  const handleAnimationComplete = () => {
    setIsAnimating(false);
    setShowConfetti(true);
    setRevealPhase('revealed');

    // Stop drum roll
    if (animationConfig.playSound) {
      stopDrumRoll();
    }

    // Trigger confetti if enabled
    if (animationConfig.confetti) {
      triggerConfetti();
    }

    // Play reveal sound
    if (animationConfig.playSound) {
      playRevealSound();
    }

    if (currentWinner) {
      onWinnerAnnounced?.(currentWinner);
    }
  };

  // Confetti effect
  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 9999,
    };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50;
      const colors = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366f1'];

      confetti({
        ...defaults,
        particleCount,
        colors,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() * 0.5 + 0.1 },
        angle: randomInRange(0, 360),
        spread: randomInRange(50, 70),
      });

      confetti({
        ...defaults,
        particleCount,
        colors,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() * 0.5 + 0.1 },
        angle: randomInRange(0, 360),
        spread: randomInRange(50, 70),
      });
    }, 250);

    setTimeout(() => clearInterval(interval), duration);
  };

  const advanceQueue = () => {
    setCurrentIndex((prev) => prev + 1);
    // If we have more winners, go back to idle/ready state for next spin
    // Or auto-start next spin? Let's make it manual for now (Wait for Next)
    if (currentIndex + 1 < displayQueue.length) {
      startNextReveal(); // Auto-continue? Or wait? 
      // For a projector view, usually we want "Next" button or auto. 
      // Let's implement a manual "Reveal Next" flow pattern.
      // Actually, let's keep it simple: Click to start next.
    } else {
      setRevealPhase('complete');
      onComplete?.();
    }
  };

  // Auto-advance logic could go here if requested, but manual is safer for events.

  if (!showDraw) {
    return (
      <button
        onClick={handleStartDraw}
        className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      >
        <Sparkles className="h-5 w-5" />
        Start Lucky Draw
      </button>
    );
  }

  const AnimationComponent = {
    slot_machine: SlotMachineAnimation,
    spinning_wheel: SpinningWheelAnimation,
    card_shuffle: CardShuffleAnimation,
    drum_roll: DrumRollAnimation,
    random_fade: RandomFadeAnimation,
  }[animationConfig.style];

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {isOrganizer ? 'Control Panel' : '🎉 Lucky Draw'}
          </h2>
          {isOrganizer && (
            <button
              onClick={() => setShowDraw(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Content Area */}
        {revealPhase === 'idle' && displayQueue.length > 0 && (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">Ready to reveal:</p>
            <h3 className="text-2xl font-bold text-purple-600 mb-6">
              {displayQueue[currentIndex]?.prize_tier === 1 ? 'Grand Prize' :
                displayQueue[currentIndex]?.prize_tier === 2 ? '1st Prize' :
                  `Prize #${displayQueue[currentIndex]?.prize_tier || 'Bonus'}`}
            </h3>
            <button
              onClick={startNextReveal}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
            >
              Roll the Drum! 🥁
            </button>
          </div>
        )}

        {revealPhase === 'animating' && (
          <div className="flex items-center justify-center mb-8">
            <AnimationComponent
              duration={animationConfig.duration}
              onComplete={handleAnimationComplete}
            />
          </div>
        )}

        {revealPhase === 'revealed' && currentWinner && (
          <div className="mt-8 text-center animate-in fade-in zoom-in duration-500">
            <p className="text-sm text-gray-600 mb-2">Winner of {currentWinner.prize_tier}:</p>
            {animationConfig.showSelfie && currentWinner.selfie_url && (
              <img src={currentWinner.selfie_url} alt="Winner" className="w-32 h-32 rounded-full mx-auto mb-4 object-cover border-4 border-yellow-400 shadow-xl" />
            )}
            {animationConfig.showName && (
              <h3 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-4">
                {currentWinner.participant_name}
              </h3>
            )}

            <button
              onClick={advanceQueue}
              className="mt-6 px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors"
            >
              {currentIndex < displayQueue.length - 1 ? 'Reveal Next Winner →' : 'Finish Draw'}
            </button>
          </div>
        )}

        {revealPhase === 'complete' && (
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900">All Winners Revealed!</h2>
            <button onClick={() => setShowDraw(false)} className="mt-6 text-purple-600 hover:underline">
              Close Window
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
