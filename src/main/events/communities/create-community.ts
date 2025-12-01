import { registerEvent } from "../register-event";
import { communitiesSublevel } from "@main/level";
import crypto from "node:crypto";
import { getUserData } from "@main/services/user/get-user-data";
import type { Community, CommunityMember } from "@types";
import { CommunityApi } from "@main/services";

const createCommunity = async (
  _event: Electron.IpcMainInvokeEvent,
  name: string,
  description: string
) => {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const me = await getUserData().catch(() => null);
  const creatorMember: CommunityMember | null = me
    ? {
        id: me.id,
        displayName: me.displayName,
        profileImageUrl: me.profileImageUrl,
        isOnline: false,
        currentGame: null,
      }
    : null;

  const community: Community = {
    id,
    name,
    description,
    createdAt,
    ownerId: me?.id,
    avatarUrl: null,
    coverImageUrl: null,
    membersCount: creatorMember ? 1 : 0,
    members: creatorMember ? [creatorMember] : [],
    posts: [],
  };
  const remote = await CommunityApi.post<Community>(
    "/communities",
    community
  ).catch(() => null);
  if (!remote) throw new Error("api_unavailable");
  await communitiesSublevel.put(remote.id, remote);
  return remote;
};

registerEvent("createCommunity", createCommunity);
