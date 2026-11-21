
import https from "https";

export default class IceServer {
  private cachedServers: any = null;
  private cacheExpiresAt = 0;
  private refreshPromise: Promise<any> | null = null;

  async getIceServers(clientIp?: string): Promise<any> {
    const now = Date.now();

    if (this.cachedServers && now < this.cacheExpiresAt) {
      return this.cachedServers;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.fetchIceServers(clientIp);

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private fetchIceServers(clientIp?: string): Promise<any> {
    const token = process.env.TURNIX_API_TOKEN;

    if (!token) {
      return Promise.reject(
        new Error("TURNIX_API_TOKEN is not configured")
      );
    }
//    if (!token) {
//      return Promise.resolve({
//        iceServers: [
//          { urls: "stun:stun.l.google.com:19302" }
//        ]
//      });
//    }

    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ ttl: 3600 });

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(body)),
      };

      if (clientIp) {
        headers["X-TURN-CLIENT-IP"] = clientIp;
      }

      const req = https.request(
        "https://turnix.io/api/v1/credentials/ice",
        {
          method: "POST",
          headers,
        },
        (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            if (res.statusCode !== 200) {
              reject(
                new Error(`Turnix API returned ${res.statusCode}: ${data}`)
              );
              return;
            }

            try {
              const result = JSON.parse(data);

              if (!result.iceServers) {
                reject(new Error("Invalid Turnix response"));
                return;
              }

              const expiresAt = new Date(result.expiresAt).getTime();

              if (!Number.isFinite(expiresAt)) {
                reject(new Error("Invalid Turnix credential expiration"));
                return;
              }

              this.cachedServers = {
                iceServers: result.iceServers,
              };

              this.cacheExpiresAt = expiresAt - 5 * 60 * 1000;

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
