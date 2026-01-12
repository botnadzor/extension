import * as React from "react";

import { cn } from "@/lib/utils";

const bounceClassName = cn("animate-bounce");
const bounceDuration = 800;
const shakeClassName = cn("animate-shake");
const shakeDuration = 800;

type AnimationVariant = "bounce" | "shake";

export function useAnimate(): {
  animationClassName: string;
  animate: (variant: AnimationVariant) => void;
} {
  const [animationVariant, setAnimationVariant] = React.useState<
    AnimationVariant | undefined
  >(undefined);

  React.useEffect(() => {
    if (!animationVariant) {
      return;
    }

    const timeout = setTimeout(
      () => {
        setAnimationVariant(undefined);
      },
      animationVariant === "bounce" ? bounceDuration : shakeDuration,
    );

    return () => {
      clearTimeout(timeout);
    };
  }, [animationVariant]);

  const animate = React.useCallback((variant: AnimationVariant) => {
    setAnimationVariant(variant);
  }, []);

  return {
    animationClassName: animationVariant
      ? animationVariant === "bounce"
        ? bounceClassName
        : shakeClassName
      : "",
    animate,
  };
}
