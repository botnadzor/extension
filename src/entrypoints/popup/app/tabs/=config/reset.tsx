import { delay, isEqual } from "es-toolkit";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { useUserConfig } from "@/hooks/user-service";
import { userService } from "@/lib/proxy-services";
import { defaultUserConfig, type UserConfig } from "@/services/user-service";

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

export function Reset() {
  const userConfig = useUserConfig();
  const actionButtonRef = React.useRef<HTMLButtonElement>(null);

  const [userConfigToRestore, setUserConfigToRestore] = React.useState<
    UserConfig | undefined
  >(undefined);

  const [timeRemaining, setTimeRemaining] =
    React.useState<number>(timeToRestore);

  const configIsDefault = isEqual(userConfig, defaultUserConfig);

  const resetUserConfig = React.useCallback(async () => {
    await userService.setConfig(defaultUserConfig);
    setUserConfigToRestore(userConfig);
    await delay(100);
    actionButtonRef.current?.focus();
  }, [userConfig]);

  const restoreUserConfig = React.useCallback(async () => {
    setUserConfigToRestore(undefined);
    setTimeRemaining(timeToRestore);
    await userService.setConfig(userConfigToRestore ?? defaultUserConfig);
    await delay(100);
    actionButtonRef.current?.focus();
  }, [userConfigToRestore]);

  React.useEffect(() => {
    if (!userConfigToRestore) {
      return;
    }

    let ticksElapsed = 0;

    const interval = setInterval(() => {
      ticksElapsed += 1;
      const newTimeRemaining = timeToRestore - ticksElapsed * (1000 / fps);
      setTimeRemaining(newTimeRemaining);

      if (newTimeRemaining <= 0) {
        void userService.setConfig(defaultUserConfig);
        setUserConfigToRestore(undefined);
        clearInterval(interval);
      }
    }, 1000 / fps);
    return () => {
      clearInterval(interval);
    };
  }, [userConfigToRestore]);

  if (configIsDefault && !userConfigToRestore) {
    return;
  }

  if (userConfigToRestore && !isEqual(userConfig, defaultUserConfig)) {
    setUserConfigToRestore(undefined);
    setTimeRemaining(timeToRestore);
  }

  if (userConfigToRestore) {
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
          value={timeRemaining / timeToRestore}
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
