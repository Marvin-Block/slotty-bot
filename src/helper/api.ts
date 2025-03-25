import { config } from "../config";
import { LicenseInfo } from "../typeFixes";

export async function fetchLicenseInfo(
  key: string
): Promise<LicenseInfo | null> {
  const url = config.API_BASE_URL + "license_info";
  const options = {
    method: "POST",
    headers: {
      authorization: "Bearer " + config.API_KEY,
      aceept: "application/json",
      "Content-Type": "application/json",
    },
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
