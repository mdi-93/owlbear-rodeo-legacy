import https from "https";

export default class IceServer {
  async getIceServers(): Promise<any> {
    const token = process.env.TURNIX_API_TOKEN;

    if (!token) {
      throw new Error("TURNIX_API_TOKEN is not configured");
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
              resolve(result.iceServers);
            } catch (error) {
              reject(error);
            }
          });
        }
      );

      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }
}
