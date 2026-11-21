import https from "https";

export default class IceServer {
  private cachedServers: any = null;
  private cacheExpiresAt = 0;
  private refreshPromise: Promise<any> | null = null;

  async getIceServers(): Promise<any> {
    const now = Date.now();

    // Reuse credentials until 5 minutes before expiration.
    if (this.cachedServers && now < this.cacheExpiresAt) {
      return this.cachedServers;
    }

    // Avoid simultaneous requests to Turnix.
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.fetchIceServers();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private fetchIceServers(): Promise<any> {
    const token = process.env.TURNIX_API_TOKEN;

    if (!token) {
      return Promise.reject(
        new Error("TURNIX_API_TOKEN is not configured")
      );
    }

    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ ttl: 3600 });

      const req = https.request(
        "https://turnix.io/api/v1/credentials/ice",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            if (res.statusCode !== 200) {
              reject(new Error(`Turnix API returned ${res.statusCode}`));
              return;
            }

            try {
              const result = JSON.parse(data);

              if (!result.iceServers) {
                reject(new Error("Invalid Turnix response"));
                return;
              }

              this.cachedServers = result.iceServers;
              this.cacheExpiresAt = Date.now() + 55 * 60 * 1000;

              resolve(this.cachedServers);
            } catch (error) {
              reject(error);
            }
          });
        }
      );

      req.setTimeout(10000, () => {
        req.destroy(new Error("Turnix API request timed out"));
      });

      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }
}
