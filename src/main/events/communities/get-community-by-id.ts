import { registerEvent } from "../register-event";
import { communitiesSublevel } from "@main/level";
import { HydraApi, CommunityApi } from "@main/services";
import type { Community, CommunityMember, UserProfile } from "@types";

const getCommunityById = async (
  _event: Electron.IpcMainInvokeEvent,
  id: string
) => {
  const remote = await CommunityApi.get<Community>(`/communities/${id}`).catch(
    () => null
  );
  if (!remote) throw new Error("api_unavailable");
  const community = remote as Community;
  await communitiesSublevel.put(id, community);

  let updated: Community | null = null;

  if (!community.ownerId) {
    const firstMember = (community.members ?? [])[0] || null;
    if (firstMember) {
      updated = { ...community, ownerId: firstMember.id };
    }
  }

  const members = community.members ?? [];

  const needsEnrichment = members.some(
    (m) => !m.displayName || m.displayName === m.id || !m.profileImageUrl
  );

  if (needsEnrichment) {
    const enrichedMembers: CommunityMember[] = await Promise.all(
      members.map(async (m) => {
        try {
          const user = await HydraApi.get<UserProfile>(
            `/users/${m.id}`,
            undefined,
            { needsAuth: false }
          );
          return {
            ...m,
            displayName: user.displayName || m.displayName,
            profileImageUrl:
              user.profileImageUrl != null
                ? user.profileImageUrl
                : (m.profileImageUrl ?? null),
            isOnline: !!user.currentGame || m.isOnline,
            currentGame: user.currentGame
              ? {
                  title: user.currentGame.title,
                  objectId: user.currentGame.objectId,
                  shop: user.currentGame.shop,
                }
              : (m.currentGame ?? null),
          } as CommunityMember;
        } catch {
          return m as CommunityMember;
        }
      })
    );

    updated = { ...community, members: enrichedMembers } as Community;
  }

  if (updated) {
    await communitiesSublevel.put(id, updated);
    return updated;
  }

  return community;
};

registerEvent("getCommunityById", getCommunityById);
