export const MADRID_TIME_ZONE = 'Europe/Madrid';

const validDate = (value?: string | number | Date) => {
  if (value === undefined || value === null || value === '') return undefined;
  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const dateKey = (
  value?: string | number | Date,
  timeZone = MADRID_TIME_ZONE,
) => {
  const date = validDate(value);
  if (!date) return undefined;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  return year && month && day ? `${year}-${month}-${day}` : undefined;
};

export const isToday = (value?: string, now = new Date()) => {
  const valueKey = dateKey(value);
  const nowKey = dateKey(now);
  return Boolean(valueKey && nowKey && valueKey === nowKey);
};

export const relativeTime = (value?: string, now = new Date()) => {
  const date = validDate(value);
  if (!date) return undefined;
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < 0) return 'ahora';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && dateKey(date) === dateKey(now)) return `hace ${hours} h`;
  const valueKey = dateKey(date);
  const currentKey = dateKey(now);
  const calendarDays =
    valueKey && currentKey
      ? Math.round(
          (Date.parse(`${currentKey}T00:00:00Z`) -
            Date.parse(`${valueKey}T00:00:00Z`)) /
            86_400_000,
        )
      : 0;
  if (calendarDays === 1) return 'ayer';
  const days = Math.floor(hours / 24);
  return days < 7
    ? `hace ${days} d`
    : new Intl.DateTimeFormat('es-ES', {
        timeZone: MADRID_TIME_ZONE,
        day: 'numeric',
        month: 'short',
      }).format(date);
};

export const updatedAgo = (value?: string, now = new Date()) => {
  const elapsed = millisecondsSince(value, now);
  if (elapsed === undefined) return 'Actualizado recientemente';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Actualizado hace unos segundos';
  if (minutes === 1) return 'Actualizado hace 1 minuto';
  if (minutes < 60) return `Actualizado hace ${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'Actualizado hace 1 hora';
  if (hours < 24) return `Actualizado hace ${hours} horas`;
  return `Actualizado ${relativeTime(value, now) ?? 'recientemente'}`;
};

export const madridTime = (value?: string) => {
  const date = validDate(value);
  return date
    ? new Intl.DateTimeFormat('es-ES', {
        timeZone: MADRID_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    : undefined;
};

export const elapsedDuration = (value?: string, now = new Date()) => {
  const date = validDate(value);
  if (!date) return undefined;
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / 60_000),
  );
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
};

export const isValidTimestamp = (value?: string) => Boolean(validDate(value));

export const millisecondsSince = (value?: string, now = new Date()) => {
  const date = validDate(value);
  return date ? Math.max(0, now.getTime() - date.getTime()) : undefined;
};
