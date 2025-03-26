export function diffTime(date1: Date, date2: Date): number {
  return date1.getTime() - date2.getTime();
}

export function diffYears(date1: Date, date2: Date): number {
  return diffTime(date1, date2) / (1000 * 60 * 60 * 24 * 365);
}

export function diffMonths(date1: Date, date2: Date): number {
  return diffTime(date1, date2) / (1000 * 60 * 60 * 24 * 30);
}

export function diffDays(date1: Date, date2: Date): number {
  return diffTime(date1, date2) / (1000 * 60 * 60 * 24);
}

export function diffHours(date1: Date, date2: Date): number {
  return diffTime(date1, date2) / (1000 * 60 * 60);
}

export function diffMinutes(date1: Date, date2: Date): number {
  return diffTime(date1, date2) / (1000 * 60);
}

/**
 *  const licenseEndDate = new Date(license.dateActivated);
 *  licenseEndDate.setDate(licenseEndDate.getDate() + license.daysValid);
 *  const today = new Date();
 *
 *  console.log(diffText(licenseEndDate, today));
 */
export function diffText(date1: Date, date2: Date): string {
  const diff = Math.abs(diffTime(date1, date2));
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);

  if (years > 0) {
    const remainingMonths = months % 12;
    const yearText = years === 1 ? 'year' : 'years';
    const monthText = remainingMonths === 1 ? 'month' : 'months';
    if (remainingMonths === 0) {
      return `${years} ${yearText}`;
    }
    return `${years} ${yearText} and ${remainingMonths} ${monthText}`;
  } else if (months > 0) {
    const remainingDays = days % 30;
    const monthText = months === 1 ? 'month' : 'months';
    const dayText = remainingDays === 1 ? 'day' : 'days';
    if (remainingDays === 0) {
      return `${months} ${monthText}`;
    }
    return `${months} ${monthText} and ${remainingDays} ${dayText}`;
  } else if (days > 0) {
    const remainingHours = hours % 24;
    const dayText = days === 1 ? 'day' : 'days';
    const hourText = remainingHours === 1 ? 'hour' : 'hours';
    if (remainingHours === 0) {
      return `${days} ${dayText}`;
    }
    return `${days} ${dayText} and ${remainingHours} ${hourText}`;
  } else if (hours > 0) {
    const remainingMinutes = minutes % 60;
    const hourText = hours === 1 ? 'hour' : 'hours';
    const minuteText = remainingMinutes === 1 ? 'minute' : 'minutes';
    if (remainingMinutes === 0) {
      return `${hours} ${hourText}`;
    }
    return `${hours} ${hourText} and ${remainingMinutes} ${minuteText}`;
  } else {
    const remainingSeconds = seconds % 60;
    const minuteText = minutes === 1 ? 'minute' : 'minutes';
    const secondText = remainingSeconds === 1 ? 'second' : 'seconds';
    if (remainingSeconds === 0) {
      return `${minutes} ${minuteText}`;
    }
    return `${minutes} ${minuteText} and ${remainingSeconds} ${secondText}`;
  }
}

export function getLicenseEndDate(
  dateActivated: string,
  daysValid: number
): Date {
  const licenseEndDate = new Date(dateActivated);
  licenseEndDate.setDate(licenseEndDate.getDate() + daysValid);
  return licenseEndDate;
}
