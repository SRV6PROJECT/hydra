import { registerEvent } from "../register-event";
import { communitiesSublevel } from "@main/level";
import { getUserData } from "@main/services/user/get-user-data";
import fs from "node:fs";
import type { Community } from "@types";
import { CommunityApi, logger } from "@main/services";

const updateCommunity = async (
  _event: Electron.IpcMainInvokeEvent,
  id: string,
  partial: Record<string, unknown>
) => {
  const existing = await communitiesSublevel.get(id);
  if (!existing) throw new Error("community_not_found");
  const me = await getUserData();
  if (!me) throw new Error("user_not_logged_in");
  if (existing.ownerId && existing.ownerId !== me.id)
    throw new Error("not_owner");
  const payload: Record<string, unknown> = { ...partial };
  const avatarUrl = String(partial["avatarUrl"] || "");
  const coverImageUrl = String(partial["coverImageUrl"] || "");
  if (avatarUrl.startsWith("local:")) {
    const p = avatarUrl.replace("local:", "");
    try {
      const buf = fs.readFileSync(p);
      const low = p.toLowerCase();
      const mime = low.endsWith(".svg")
        ? "image/svg+xml"
        : low.endsWith(".jpg") || low.endsWith(".jpeg")
          ? "image/jpeg"
          : low.endsWith(".webp")
            ? "image/webp"
            : low.endsWith(".gif")
              ? "image/gif"
              : "image/png";
      payload["avatarBase64"] = `data:${mime};base64,${buf.toString("base64")}`;
      delete payload["avatarUrl"];
    } catch (error) {
      logger.error("Failed to read community avatar file", error);
    }
  }
  if (coverImageUrl.startsWith("local:")) {
    const p = coverImageUrl.replace("local:", "");
    try {
      const buf = fs.readFileSync(p);
      const low = p.toLowerCase();
      const mime = low.endsWith(".svg")
        ? "image/svg+xml"
        : low.endsWith(".jpg") || low.endsWith(".jpeg")
          ? "image/jpeg"
          : low.endsWith(".webp")
            ? "image/webp"
            : low.endsWith(".gif")
              ? "image/gif"
              : "image/png";
      payload["coverBase64"] = `data:${mime};base64,${buf.toString("base64")}`;
      delete payload["coverImageUrl"];
    } catch (error) {
      logger.error("Failed to read community cover file", error);
    }
  }
  const remoteUpdated = await CommunityApi.patch<Community>(
    `/communities/${id}`,
    payload
  ).catch(() => null);
  if (!remoteUpdated) throw new Error("api_unavailable");
  await communitiesSublevel.put(id, remoteUpdated);
  return remoteUpdated;
};

registerEvent("updateCommunity", updateCommunity);
