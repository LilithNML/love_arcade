export type ActiveEvent = {
  id: string;
  type: 'interactive_hunt' | 'personal_milestone' | 'gacha_flash' | 'daily_missions' | string;
  startDate: string;
  endDate: string;
  config: Record<string, unknown>;
  ui: {
    title: string;
    subtitle: string;
    description: string;
    accentColor: string;
    icon: string;
  };
};

export type EventsPayload = {
  activeEvents: ActiveEvent[];
};
