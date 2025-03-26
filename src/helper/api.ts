import { config } from '../config';
import { LicenseInfo } from '../typeFixes';

const baseOptions = {
  method: 'POST',
  headers: {
    authorization: 'Bearer ' + config.API_KEY,
    aceept: 'application/json',
    'Content-Type': 'application/json',
  },
};

export async function fetchLicenseInfo(
  key: string
): Promise<LicenseInfo | null> {
  const url = config.API_BASE_URL + 'license_info';
  const options = {
    ...baseOptions,
    body: JSON.stringify({
      licenseString: key,
      productPublicKey: config.PUBLIC_KEY,
    }),
  };
  const data = await fetch(url, options)
    .then((res) => res.json())
    .then((res: LicenseInfo) => res)
    .catch((err: Error) => {
      console.error(err);
      return null;
    });
  return data;
}

export async function editLicense(key: string, days: number) {
  const url = config.API_BASE_URL + 'license_addTime';
  const options = {
    ...baseOptions,
    body: JSON.stringify({
      licenseString: key,
      productPublicKey: config.PUBLIC_KEY,
      daysToAdd: days,
    }),
  };
  console.log(`Editing license with key: ${key}, days: ${days}`);
  const data = await fetch(url, options)
    .then((res) => res.json())
    .then((res: boolean) => res)
    .catch((err: Error) => {
      console.error(err);
      return false;
    });
  return data;
}
