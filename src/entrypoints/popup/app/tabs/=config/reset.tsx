import { delay, isEqual } from "es-toolkit";
import * as React from "react";

import {
  defaultUserConfig,
  type UserConfig,
} from "@/shared/@model/user-config";
import { useUserConfig } from "@/shared/@ui-helpers/data-hooks";
import { Button } from "@/shared/@ui-primitives/button";
import { userConfigService } from "@/shared/proxy-services";

function CircleProgress({
  className,
  value,
}: {
  className?: string | undefined;
  value: number;
}) {
  let pathData: string | undefined;

  if (value >= 1) {
    pathData = "M 5 5 L 5 0 A 5 5 0 1 0 5 10 A 5 5 0 1 0 5 0 Z";
  } else if (value > 0) {
    const angle = value * 2 * Math.PI;
    const largeArcFlag = value > 0.5 ? 1 : 0;

    const endX = 5 - 5 * Math.sin(angle);
    const endY = 5 - 5 * Math.cos(angle);

    pathData = `M 5 5 L 5 0 A 5 5 0 ${largeArcFlag} 0 ${endX} ${endY} Z`;
  }

  return (
    <svg width="10" height="10" viewBox="0 0 10 10" className={className}>
      {pathData && <path d={pathData} fill="currentColor" />}
    </svg>
  );
}

const fps = 20;
const timeToRestore = 10_000;

type ResetState =
  | { status: "idle" }
  | {
      status: "resetting";
      timeRemaining: number;
      configToRestore: UserConfig;
      seenDefaults: boolean;
    };

export function Reset() {
  const userConfig = useUserConfig();
  const actionButtonRef = React.useRef<HTMLButtonElement>(null);

  const [resetState, setResetState] = React.useState<ResetState>({
    status: "idle",
  });

  const configIsDefault = isEqual(userConfig, defaultUserConfig);

  async function resetUserConfig() {
    // Capture current config in state before any async operations
    setResetState({
      status: "resetting",
      timeRemaining: timeToRestore,
      configToRestore: userConfig,
      seenDefaults: false,
    });
    await userConfigService.set(defaultUserConfig);
    await delay(100);
    actionButtonRef.current?.focus();
  }

  async function restoreUserConfig() {
    if (resetState.status !== "resetting") {
      return;
    }

    const configToRestore = resetState.configToRestore;
    setResetState({ status: "idle" });
    await userConfigService.set(configToRestore);
    await delay(100);
    actionButtonRef.current?.focus();
  }

  // Timer countdown and cancellation effect
  React.useEffect(() => {
    if (resetState.status !== "resetting") {
      return;
    }

    const configIsAtDefaults = isEqual(userConfig, defaultUserConfig);
    const configMatchesSavedConfig = isEqual(
      userConfig,
      resetState.configToRestore,
    );

    // Update seenDefaults flag if we've seen the config at defaults
    const updatedSeenDefaults = resetState.seenDefaults || configIsAtDefaults;

    // If user manually restored after seeing defaults, exit resetting state
    if (
      updatedSeenDefaults &&
      configMatchesSavedConfig &&
      !configIsAtDefaults
    ) {
      const timeoutId = setTimeout(() => {
        setResetState({ status: "idle" });
      }, 0);
      return () => {
        clearTimeout(timeoutId);
      };
    }

    // If user changed config to something else entirely, cancel the restore
    const configChangedExternally =
      !configIsAtDefaults && !configMatchesSavedConfig;

    if (configChangedExternally) {
      const timeoutId = setTimeout(() => {
        setResetState({ status: "idle" });
      }, 0);
      return () => {
        clearTimeout(timeoutId);
      };
    }

    // Update seenDefaults in state if it changed
    if (updatedSeenDefaults !== resetState.seenDefaults) {
      const timeoutId = setTimeout(() => {
        setResetState({
          ...resetState,
          seenDefaults: updatedSeenDefaults,
        });
      }, 0);
      return () => {
        clearTimeout(timeoutId);
      };
    }

    const interval = setInterval(() => {
      const newTimeRemaining = resetState.timeRemaining - 1000 / fps;

      if (newTimeRemaining <= 0) {
        void userConfigService.set(defaultUserConfig);
        setResetState({ status: "idle" });
      } else {
        setResetState({
          ...resetState,
          timeRemaining: newTimeRemaining,
        });
      }
    }, 1000 / fps);

    return () => {
      clearInterval(interval);
    };
  }, [resetState, userConfig]);

  if (configIsDefault && resetState.status === "idle") {
    return;
  }

  if (resetState.status === "resetting") {
    return (
      <Button
        key="restore"
        ref={actionButtonRef}
        onClick={() => {
          void restoreUserConfig();
        }}
        className="flex items-center gap-2.5"
      >
        Отменить сброс настроек
        <CircleProgress
          className="-mr-0.5 size-5"
          value={resetState.timeRemaining / timeToRestore}
        />
      </Button>
    );
  }

  return (
    <Button
      key="reset"
      ref={actionButtonRef}
      onClick={() => {
        void resetUserConfig();
      }}
    >
      Сбросить настройки
    </Button>
  );
}
