// Display formatting. Dates are calendar dates stored at UTC midnight, so they are always
// formatted in UTC; formatting in the viewer's time zone could show the previous day.

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function formatDate(date: Date): string {
  return dateFormat.format(date);
}

/** "YYYY-MM-DD" for <input type="date">. */
export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatSalaryRange(
  min: number | null,
  max: number | null,
  currency: string | null,
): string | null {
  if (currency === null) return null;
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  if (min !== null && max !== null) {
    return min === max
      ? money.format(min)
      : `${money.format(min)} – ${money.format(max)}`;
  }
  if (min !== null) return `from ${money.format(min)}`;
  if (max !== null) return `up to ${money.format(max)}`;
  return null;
}
