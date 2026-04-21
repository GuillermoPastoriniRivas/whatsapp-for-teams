import type { BusinessHours, WeekDay } from '../../../../domain/entities/ai-agent-config.entity.js';

export interface BusinessStatus {
  isOpen: boolean;
  timezone: string | null;
  currentDay: WeekDay;
  todayRange: { open: string; close: string } | null;
  nextOpen: { day: 'today' | 'tomorrow' | WeekDay; at: string } | null;
}

const DAYS: WeekDay[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

function parseHHmm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function getNowInTz(now: Date, tz: string | null): { dayIdx: number; minutes: number } {
  const opts: Intl.DateTimeFormatOptions = {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
  };
  if (tz) opts.timeZone = tz;
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;

  const weekday = (map.weekday ?? '').toLowerCase();
  const dayIdx = DAYS.indexOf(weekday as WeekDay);
  const h = Number(map.hour === '24' ? '00' : (map.hour ?? '0'));
  const min = Number(map.minute ?? '0');
  return {
    dayIdx: dayIdx >= 0 ? dayIdx : now.getDay(),
    minutes: h * 60 + min,
  };
}

export function computeBusinessStatus(
  businessHours: BusinessHours | null | undefined,
  timezone: string | null | undefined,
  now: Date,
): BusinessStatus | null {
  if (!businessHours) return null;
  const hasAny = Object.values(businessHours).some((v) => v != null);
  if (!hasAny) return null;

  const tz = timezone ?? null;
  const { dayIdx, minutes } = getNowInTz(now, tz);
  const todayKey = DAYS[dayIdx];
  const today = businessHours[todayKey] ?? null;

  let isOpen = false;
  if (today) {
    const openMin = parseHHmm(today.open);
    const closeMin = parseHHmm(today.close);
    if (openMin !== null && closeMin !== null) {
      if (closeMin > openMin) {
        isOpen = minutes >= openMin && minutes < closeMin;
      } else {
        isOpen = minutes >= openMin;
      }
    }
  }

  if (!isOpen) {
    const yIdx = (dayIdx + 6) % 7;
    const yesterday = businessHours[DAYS[yIdx]] ?? null;
    if (yesterday) {
      const yOpen = parseHHmm(yesterday.open);
      const yClose = parseHHmm(yesterday.close);
      if (yOpen !== null && yClose !== null && yClose <= yOpen && minutes < yClose) {
        isOpen = true;
      }
    }
  }

  let nextOpen: BusinessStatus['nextOpen'] = null;
  if (!isOpen) {
    if (today) {
      const openMin = parseHHmm(today.open);
      if (openMin !== null && minutes < openMin) {
        nextOpen = { day: 'today', at: today.open };
      }
    }
    if (!nextOpen) {
      for (let i = 1; i <= 7; i++) {
        const idx = (dayIdx + i) % 7;
        const d = businessHours[DAYS[idx]] ?? null;
        if (d) {
          nextOpen = { day: i === 1 ? 'tomorrow' : DAYS[idx], at: d.open };
          break;
        }
      }
    }
  }

  return {
    isOpen,
    timezone: tz,
    currentDay: todayKey,
    todayRange: today ?? null,
    nextOpen,
  };
}
