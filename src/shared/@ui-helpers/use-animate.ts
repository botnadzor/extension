import * as React from "react";

import { cn } from "../tailwindcss-helpers";

const bounceClassName = cn("animate-bounce");
const bounceDuration = 800;
const blinkClassName = cn("animate-blink");
const blinkDuration = 1200;
const shakeClassName = cn("animate-shake");
const shakeDuration = 800;

type AnimationVariant = "blink" | "bounce" | "shake";

export function useAnimate(): {
  animationClassName: string;
  animate: (variant: AnimationVariant) => void;
} {
  const [animation, setAnimation] = React.useState<
    { variant: AnimationVariant; seq: number } | undefined
  >(undefined);

  const seqRef = React.useRef(0);

  React.useEffect(() => {
    if (!animation) {
      return;
    }

    const timeout = setTimeout(
      () => {
        setAnimation(undefined);
      },
      animation.variant === "blink"
        ? blinkDuration
        : animation.variant === "bounce"
          ? bounceDuration
          : shakeDuration,
    );

    return () => {
      clearTimeout(timeout);
    };
  }, [animation]);

  const animate = React.useCallback((variant: AnimationVariant) => {
    seqRef.current += 1;
    setAnimation({ variant, seq: seqRef.current });
  }, []);

  return {
    animationClassName: animation
      ? animation.variant === "blink"
        ? blinkClassName
        : animation.variant === "bounce"
          ? bounceClassName
          : shakeClassName
      : "",
    animate,
  };
}
