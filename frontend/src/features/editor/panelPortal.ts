let mqttPanelTarget: HTMLElement | null = null;
const listeners = new Set<() => void>();

export const setMqttPanelPortalTarget = (target: HTMLElement | null): void => {
  if (mqttPanelTarget === target) return;
  mqttPanelTarget = target;
  listeners.forEach((listener) => listener());
};

export const subscribeMqttPanelPortal = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getMqttPanelPortalTarget = (): HTMLElement | null => mqttPanelTarget;
