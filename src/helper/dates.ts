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
    if (remainingMonths === 0) {
      return `${years} years`;
    }
    return `${years} years and ${remainingMonths} months`;
  } else if (months > 0) {
    const remainingDays = days % 30;
    if (remainingDays === 0) {
      return `${months} months`;
    }
    return `${months} months and ${remainingDays} days`;
  } else if (days > 0) {
    const remainingHours = hours % 24;
    if (remainingHours === 0) {
      return `${days} days`;
    }
    return `${days} days and ${remainingHours} hours`;
  } else if (hours > 0) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} hours`;
    }
    return `${hours} hours and ${remainingMinutes} minutes`;
  } else {
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes} minutes`;
    }
    return `${minutes} minutes and ${remainingSeconds} seconds`;
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
