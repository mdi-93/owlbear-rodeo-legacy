
import { Request, Response } from "express";
import IceServer from "../entities/IceServer";
import Controller, { Methods } from "./Controller";

export default class IceServerController extends Controller {
  iceServer: IceServer;

  path = "/";

  private requests = new Map<string, { count: number; resetAt: number }>();

  routes = [
    {
      path: "/iceservers",
      method: Methods.GET,
      handler: this.handleIceServerConnection.bind(this),
      localMiddleware: [],
    },
  ];

  constructor(iceServer: IceServer) {
    super();
    this.iceServer = iceServer;
  }

  async handleIceServerConnection(
    req: Request,
    res: Response
  ): Promise<void> {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const limit = 30;
    const windowMs = 60 * 1000;

    let record = this.requests.get(ip);

    if (!record || now >= record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      this.requests.set(ip, record);
    }

    record.count++;

    if (record.count > limit) {
      res.status(429).send({ error: "Too many requests" });
      return;
    }

    try {
      const servers = await this.iceServer.getIceServers(ip);
      res.json(servers);
    } catch (error) {
      console.error("ICE server error:", error);
      res.status(500).send({
        error: "Unable to retrieve ICE servers",
      });
    }
  }
}
