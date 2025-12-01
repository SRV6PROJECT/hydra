import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type {
  Community,
  CommunityMember,
  CommunityPost,
  CommunityEvent,
  UserDetails,
  GameShop,
} from "@types";
import { useTranslation } from "react-i18next";
import { Badge, Modal, Button, Avatar, TextField } from "@renderer/components";
import languageResources from "@locales";
import {
  CheckCircleFillIcon,
  QuestionIcon,
  PencilIcon,
  TrashIcon,
  CalendarIcon,
  ClockIcon,
  PlusIcon,
  LockIcon,
  PersonIcon,
} from "@primer/octicons-react";
import {
  Home,
  CalendarDays,
  Users,
  Settings as SettingsIcon,
  UserPlus,
  LogOut,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { sanitizeHtml, stripHtml } from "@shared";
import { motion } from "framer-motion";
import InfiniteScroll from "react-infinite-scroll-component";
import "./community-details.scss";
import CommunitySettingsModal from "./community-settings-modal";
import CommunityCreatePostModal from "./community-create-post-modal";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { buildGameDetailsPath, getSteamLanguage } from "@renderer/helpers";
import HydraIcon from "@renderer/assets/icons/hydra.svg?react";
import { useUserDetails, useToast } from "@renderer/hooks";
import { useSubscription } from "@renderer/hooks/use-subscription";

type CommunityTab = "home" | "members";
type ExtendedCommunityTab = CommunityTab | "events";

type ExtendedCommunityEvent = CommunityEvent & {
  createdAt?: string;
  content?: string;
  authorId?: string;
  authorDisplayName?: string;
  authorProfileImageUrl?: string | null;
  upvotes?: number;
  downvotes?: number;
  hasUpvoted?: boolean;
  hasDownvoted?: boolean;
};

export default function CommunityDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("communities");
  const [community, setCommunity] = useState<Community | null>(null);
  const [activeTab, setActiveTab] = useState<ExtendedCommunityTab>("home");
  const { userDetails: me } = useUserDetails();
  const { showSuccessToast } = useToast();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEventsDate, setSelectedEventsDate] = useState<Date | null>(
    null
  );
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>(
    {}
  );
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>(
    {}
  );
  const [visiblePostsCount, setVisiblePostsCount] = useState<number>(10);
  const [visibleScheduledEventsCount, setVisibleScheduledEventsCount] =
    useState<number>(10);
  const [visiblePastEventsCount, setVisiblePastEventsCount] =
    useState<number>(10);
  const [votingPosts, setVotingPosts] = useState<Set<string>>(new Set());
  const [votingEvents, setVotingEvents] = useState<Set<string>>(new Set());
  const [memberQuery, setMemberQuery] = useState("");
  const [assetsMap, setAssetsMap] = useState<
    Record<
      string,
      {
        libraryImageUrl: string | null;
        coverImageUrl: string | null;
        iconUrl: string | null;
        libraryHeroImageUrl: string | null;
        downloadSources: string[];
      }
    >
  >({});
  const [genresMap, setGenresMap] = useState<Record<string, string[]>>({});
  const genresMapRef = useRef<Record<string, string[]>>({});
  useEffect(() => {
    genresMapRef.current = genresMap;
  }, [genresMap]);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const [now] = useState(new Date());
  const events = useMemo(() => {
    if (!community?.events) return [];
    return (community.events as ExtendedCommunityEvent[])
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [community?.events]);

  const pinned = useMemo(() => {
    if (events.length === 0) return null;

    const ref = selectedEventsDate
      ? new Date(
          selectedEventsDate.getFullYear(),
          selectedEventsDate.getMonth(),
          selectedEventsDate.getDate(),
          0,
          0,
          0
        )
      : now;

    const upcomingFromRef = events.filter(
      (e) => new Date(e.date).getTime() >= ref.getTime()
    );

    const upcomingPinnedDefault = upcomingFromRef[0] || null;

    const selectedDayEvents = selectedEventsDate
      ? events.filter((e) => isSameDay(new Date(e.date), selectedEventsDate))
      : [];

    const selectedMidnight = selectedEventsDate
      ? new Date(
          selectedEventsDate.getFullYear(),
          selectedEventsDate.getMonth(),
          selectedEventsDate.getDate(),
          0,
          0,
          0
        )
      : null;

    let pinned: CommunityEvent | null = null;

    if (selectedEventsDate) {
      if (selectedDayEvents.length > 0) {
        pinned = selectedDayEvents[0];
      } else {
        const upcomingAfterSelected = events.filter(
          (e) =>
            selectedMidnight &&
            new Date(e.date).getTime() > selectedMidnight.getTime()
        );
        const pastBeforeSelected = events
          .filter(
            (e) =>
              selectedMidnight &&
              new Date(e.date).getTime() < selectedMidnight.getTime()
          )
          .reverse();

        if (upcomingAfterSelected.length > 0) {
          pinned = upcomingAfterSelected[0];
        } else if (pastBeforeSelected.length > 0) {
          pinned = pastBeforeSelected[0];
        } else {
          pinned = upcomingPinnedDefault;
        }
      }
    } else {
      // Всегда показываем ближайшее предстоящее событие, а не завершенное
      pinned = upcomingPinnedDefault;
    }

    return pinned;
  }, [events, selectedEventsDate, now]);
  const assetsMapRef = useRef<
    Record<
      string,
      {
        libraryImageUrl: string | null;
        coverImageUrl: string | null;
        iconUrl: string | null;
        libraryHeroImageUrl: string | null;
        downloadSources: string[];
      }
    >
  >({});
  useEffect(() => {
    assetsMapRef.current = assetsMap;
  }, [assetsMap]);

  const formatDateNoSeconds = (d: Date) =>
    d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatRemainingValue = (target: Date, now: Date) => {
    const ms = target.getTime() - now.getTime();
    if (ms <= 0) return "";
    const totalMinutes = Math.floor(ms / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    const isRu = i18n.language && i18n.language.startsWith("ru");
    const dLabel = isRu ? "д." : "d";
    const hLabel = isRu ? "ч." : "h";
    const mLabel = isRu ? "мин." : "min";
    const parts: string[] = [];
    if (days > 0) parts.push(`${days} ${dLabel}`);
    if (hours > 0) parts.push(`${hours} ${hLabel}`);
    parts.push(`${minutes} ${mLabel}`);
    return parts.join(" ");
  };

  const isOwner = useMemo(() => {
    if (!me || !community) return false;
    return community.ownerId === me.id;
  }, [me, community]);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    (async () => {
      const c = await window.electron.getCommunityById(id).catch(() => null);
      if (!c) {
        setCommunity(null);
        setAssetsMap({});
        setGenresMap({});
        setIsLoading(false);
        return;
      }

      const language = getSteamLanguage(i18n.language);

      const baseGames = (c.games ?? []).map((g) => ({
        key: `${g.shop}-${g.objectId}`,
        objectId: g.objectId,
        shop: g.shop,
      }));

      const memberGames = (c.members ?? [])
        .map((m) => m.currentGame)
        .filter((g) => !!g) as {
        title: string;
        objectId: string;
        shop: GameShop;
      }[];

      const memberGameItems = memberGames.map((g) => ({
        key: `${g.shop}-${g.objectId}`,
        objectId: g.objectId,
        shop: g.shop,
      }));

      const unique: Record<string, { objectId: string; shop: GameShop }> = {};
      [...baseGames, ...memberGameItems].forEach((x) => {
        if (!(x.key in unique))
          unique[x.key] = { objectId: x.objectId, shop: x.shop };
      });

      const items = Object.entries(unique).map(([key, v]) => ({ key, ...v }));

      const itemsForAssets = items.filter(
        (it) => !(it.key in assetsMapRef.current)
      );
      const itemsForGenres = items
        .filter((it) => !(it.key in genresMapRef.current))
        .slice(0, 6);

      const mapWithConcurrency = async <T, R>(
        arr: T[],
        limit: number,
        mapper: (t: T) => Promise<R>
      ) => {
        const res: R[] = new Array(arr.length);
        let i = 0;
        const workers = Array.from(
          { length: Math.min(limit, arr.length) },
          async () => {
            while (i < arr.length) {
              const idx = i++;
              res[idx] = await mapper(arr[idx]);
            }
          }
        );
        await Promise.all(workers);
        return res;
      };

      const assetsResults = await mapWithConcurrency(
        itemsForAssets,
        3,
        async (it) => {
          const assets = await window.electron
            .getGameAssets(it.objectId, it.shop)
            .catch(() => null);
          return { key: it.key, assets };
        }
      );

      const initialAssetsMap: Record<string, any> = {};
      for (const r of assetsResults)
        if (r.assets) initialAssetsMap[r.key] = r.assets;
      setAssetsMap(initialAssetsMap);

      (async () => {
        const genresResults = await mapWithConcurrency(
          itemsForGenres,
          3,
          async (it) => {
            const details = await window.electron
              .getGameShopDetails(it.objectId, it.shop as any, language)
              .catch(() => null);
            const genres = (details?.genres ?? [])
              .map((x: { name?: string; description?: string }) =>
                (x?.name ?? x?.description ?? "").trim()
              )
              .filter((v: string) => v.length > 0);
            return { key: it.key, genres };
          }
        );
        const initialGenresMap: Record<string, string[]> = {};
        for (const r of genresResults) initialGenresMap[r.key] = r.genres;
        setGenresMap((prev) => ({ ...prev, ...initialGenresMap }));
      })();

      setCommunity(c);
      setIsLoading(false);
    })();
  }, [id, i18n.language]);

  useEffect(() => {
    setExpandedPosts({});
    setExpandedEvents({});
    setVisiblePostsCount(10);
    setVisibleScheduledEventsCount(10);
    setVisiblePastEventsCount(10);
  }, [community?.id]);

  useEffect(() => {}, []);

  const [runningGame, setRunningGame] = useState<{
    title: string;
    objectId: string;
    shop: GameShop;
    sessionDurationInMillis?: number;
    playTimeInMilliseconds?: number;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = window.electron.onGamesRunning(async (games) => {
      const first = games[0] || null;
      if (!first) {
        setRunningGame(null);
        return;
      }
      const [shop, objectId] = String(first.id).split(":");
      const game = await window.electron
        .getGameByObjectId(shop as GameShop, objectId)
        .catch(() => null);
      if (!game) {
        setRunningGame(null);
        return;
      }
      setRunningGame({
        title: game.title,
        objectId,
        shop: shop as GameShop,
        sessionDurationInMillis: first.sessionDurationInMillis,
        playTimeInMilliseconds: game.playTimeInMilliseconds ?? 0,
      });
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const games = community?.games ?? [];
    if (games.length === 0) {
      setAssetsMap({});
      setGenresMap({});
      return;
    }
    let cancelled = false;
    games.forEach(async (g) => {
      const key = `${g.shop}-${g.objectId}`;
      const assets = await window.electron
        .getGameAssets(g.objectId, g.shop)
        .catch(() => null);
      if (cancelled) return;
      if (assets) {
        setAssetsMap((prev) => ({ ...prev, [key]: assets }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [community]);

  useEffect(() => {
    const games = community?.games ?? [];
    if (games.length === 0) {
      setGenresMap({});
      return;
    }
    const language = getSteamLanguage(i18n.language);
    const missing = games
      .map((g) => ({ key: `${g.shop}-${g.objectId}`, g }))
      .filter(({ key }) => !(key in genresMapRef.current));
    if (missing.length === 0) return;
    let cancelled = false;
    missing.forEach(async ({ key, g }) => {
      const details = await window.electron
        .getGameShopDetails(g.objectId, g.shop as any, language)
        .catch(() => null);
      if (cancelled) return;
      const genres = (details?.genres ?? [])
        .map((x: { name?: string; description?: string }) =>
          (x?.name ?? x?.description ?? "").trim()
        )
        .filter((v: string) => v.length > 0);
      setGenresMap((prev) => ({ ...prev, [key]: genres }));
    });
    return () => {
      cancelled = true;
    };
  }, [community, i18n.language]);

  const baseMembers: CommunityMember[] = useMemo(
    () => community?.members ?? [],
    [community]
  );

  const members: CommunityMember[] = useMemo(() => {
    if (!me) return baseMembers;
    const mapped = (baseMembers ?? []).map((m) => {
      if (m.id !== me.id) return m;
      return {
        ...m,
        isOnline: true,
        currentGame: runningGame
          ? {
              title: runningGame.title,
              objectId: runningGame.objectId,
              shop: runningGame.shop,
            }
          : null,
      } as CommunityMember;
    });
    return mapped;
  }, [baseMembers, me, runningGame]);

  const filteredMembers: CommunityMember[] = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      (m.displayName || "").toLowerCase().includes(q)
    );
  }, [members, memberQuery]);

  useEffect(() => {
    const memberGames = (members ?? [])
      .map((m) => m.currentGame)
      .filter((g) => !!g) as {
      title: string;
      objectId: string;
      shop: GameShop;
    }[];

    if (memberGames.length === 0) return;

    const missingAssetKeys = memberGames
      .map((g) => `${g.shop}-${g.objectId}`)
      .filter((key) => !(key in assetsMap));

    if (missingAssetKeys.length > 0) {
      memberGames
        .filter((g) => missingAssetKeys.includes(`${g.shop}-${g.objectId}`))
        .forEach(async (g) => {
          const key = `${g.shop}-${g.objectId}`;
          const assets = await window.electron
            .getGameAssets(g.objectId, g.shop)
            .catch(() => null);
          if (assets) {
            setAssetsMap((prev) => ({ ...prev, [key]: assets }));
          }
        });
    }
  }, [members, assetsMap]);

  useEffect(() => {
    const language = getSteamLanguage(i18n.language);
    const memberGames = (members ?? [])
      .map((m) => m.currentGame)
      .filter((g) => !!g) as {
      title: string;
      objectId: string;
      shop: GameShop;
    }[];

    const missing = memberGames
      .map((g) => ({ key: `${g.shop}-${g.objectId}`, g }))
      .filter(({ key }) => !(key in genresMapRef.current));

    if (missing.length === 0) return;

    missing.forEach(async ({ key, g }) => {
      const details = await window.electron
        .getGameShopDetails(g.objectId, g.shop as any, language)
        .catch(() => null);
      const genres = (details?.genres ?? [])
        .map((x: { name?: string; description?: string }) =>
          (x?.name ?? x?.description ?? "").trim()
        )
        .filter((v: string) => v.length > 0);
      setGenresMap((prev) => ({ ...prev, [key]: genres }));
    });
  }, [members, i18n.language]);

  const posts: CommunityPost[] = useMemo(
    () => community?.posts ?? [],
    [community]
  );

  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [showEditPostModal, setShowEditPostModal] = useState(false);
  const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(false);
  const [postIdToDelete, setPostIdToDelete] = useState<string | null>(null);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CommunityEvent | null>(null);
  const handlePostVote = async (
    postId: string,
    voteType: "upvote" | "downvote"
  ) => {
    if (!community || !id) return;
    setVotingPosts((prev) => {
      const next = new Set(prev);
      next.add(postId);
      return next;
    });
    const currentPosts = [...(community.posts ?? [])];
    const index = currentPosts.findIndex((p) => p.id === postId);
    if (index < 0) {
      setVotingPosts((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
      return;
    }
    const original = currentPosts[index];
    const updated = { ...original } as CommunityPost & {
      upvotes?: number;
      downvotes?: number;
      hasUpvoted?: boolean;
      hasDownvoted?: boolean;
    };
    if (voteType === "upvote") {
      if (updated.hasUpvoted) {
        updated.hasUpvoted = false;
        updated.upvotes = Math.max(0, (updated.upvotes || 0) - 1);
      } else {
        updated.hasUpvoted = true;
        updated.upvotes = (updated.upvotes || 0) + 1;
        if (updated.hasDownvoted) {
          updated.hasDownvoted = false;
          updated.downvotes = Math.max(0, (updated.downvotes || 0) - 1);
        }
      }
    } else {
      if (updated.hasDownvoted) {
        updated.hasDownvoted = false;
        updated.downvotes = Math.max(0, (updated.downvotes || 0) - 1);
      } else {
        updated.hasDownvoted = true;
        updated.downvotes = (updated.downvotes || 0) + 1;
        if (updated.hasUpvoted) {
          updated.hasUpvoted = false;
          updated.upvotes = Math.max(0, (updated.upvotes || 0) - 1);
        }
      }
    }
    currentPosts[index] = updated as CommunityPost;
    setCommunity({ ...community, posts: currentPosts });
    try {
      await window.electron.updateCommunity(id, { posts: currentPosts });
    } catch (_e) {
      const rolledBack = [...(community.posts ?? [])];
      setCommunity({ ...community, posts: rolledBack });
    } finally {
      setVotingPosts((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  const handleEventVote = async (
    eventId: string,
    voteType: "upvote" | "downvote"
  ) => {
    if (!community || !id) return;
    setVotingEvents((prev) => {
      const next = new Set(prev);
      next.add(eventId);
      return next;
    });
    const currentEvents = [...((community.events as CommunityEvent[]) ?? [])];
    const index = currentEvents.findIndex((e) => e.id === eventId);
    if (index < 0) {
      setVotingEvents((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
      return;
    }
    const original = currentEvents[index];
    const updated = { ...original } as CommunityEvent & {
      upvotes?: number;
      downvotes?: number;
      hasUpvoted?: boolean;
      hasDownvoted?: boolean;
    };
    if (voteType === "upvote") {
      if (updated.hasUpvoted) {
        updated.hasUpvoted = false;
        updated.upvotes = Math.max(0, (updated.upvotes || 0) - 1);
      } else {
        updated.hasUpvoted = true;
        updated.upvotes = (updated.upvotes || 0) + 1;
        if (updated.hasDownvoted) {
          updated.hasDownvoted = false;
          updated.downvotes = Math.max(0, (updated.downvotes || 0) - 1);
        }
      }
    } else {
      if (updated.hasDownvoted) {
        updated.hasDownvoted = false;
        updated.downvotes = Math.max(0, (updated.downvotes || 0) - 1);
      } else {
        updated.hasDownvoted = true;
        updated.downvotes = (updated.downvotes || 0) + 1;
        if (updated.hasUpvoted) {
          updated.hasUpvoted = false;
          updated.upvotes = Math.max(0, (updated.upvotes || 0) - 1);
        }
      }
    }
    currentEvents[index] = updated as CommunityEvent;
    setCommunity({ ...community, events: currentEvents });
    try {
      await window.electron.updateCommunity(id, { events: currentEvents });
    } catch (_e) {
      const rolledBack = [...((community.events as CommunityEvent[]) ?? [])];
      setCommunity({ ...community, events: rolledBack });
    } finally {
      setVotingEvents((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [showDeleteEventConfirm, setShowDeleteEventConfirm] = useState(false);
  const [eventIdToDelete, setEventIdToDelete] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = members.length;
    const online = members.filter((m) => m.isOnline).length;
    const inGame = members.filter(
      (m) => m.isOnline && m.currentGame?.title
    ).length;
    const onlineByGame: Record<string, number> = {};
    members
      .filter((m) => m.isOnline && m.currentGame?.title)
      .forEach((m) => {
        const key = m.currentGame!.title;
        onlineByGame[key] = (onlineByGame[key] ?? 0) + 1;
      });
    const onlineByGameList = Object.entries(onlineByGame)
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count);
    return { total, online, inGame, onlineByGameList };
  }, [members]);

  const isMember = useMemo(() => {
    if (!me) return false;
    return members.some((m) => m.id === me.id);
  }, [members, me]);

  if (isLoading) {
    return <div className="community-details__loading">{t("loading")}</div>;
  }

  if (!community) {
    return <div className="community-details__empty">{t("not_found")}</div>;
  }

  return (
    <div className="community-details">
      <div
        className={`community-details__hero ${
          community.coverImageUrl ? "" : "community-details__hero--empty"
        }`}
      >
        {community.coverImageUrl ? (
          <img
            src={community.coverImageUrl}
            alt={community.name}
            className="community-details__hero-image"
          />
        ) : (
          <div className="community-details__hero-placeholder" />
        )}
        <div className="community-details__hero-overlay">
          <div className="community-details__hero-left">
            <div
              className={`community-details__avatar ${community.avatarUrl ? "" : "community-details__avatar--no-rounded"}`}
            >
              {community.avatarUrl ? (
                <img
                  src={community.avatarUrl}
                  alt={community.name}
                  className="community-details__avatar-image"
                />
              ) : (
                (() => {
                  let s = 0 >>> 0;
                  const key = community.id || community.name || "?";
                  for (let i = 0; i < key.length; i++)
                    s = (s * 31 + key.charCodeAt(i)) >>> 0;
                  const next = () => (s = (s * 1664525 + 1013904223) >>> 0);
                  void next();
                  void next();
                  const cells: number[][] = [];
                  for (let r = 0; r < 5; r++) {
                    const row: number[] = [];
                    for (let c = 0; c < 3; c++)
                      row.push(next() % 3 === 0 ? 1 : 0);
                    cells.push(row);
                  }
                  return (
                    <svg
                      className="community-details__avatar--generated"
                      width={30}
                      height={30}
                      viewBox="0 0 5 5"
                      preserveAspectRatio="none"
                    >
                      {cells.map((row, r) =>
                        row.map((v, cIdx) => {
                          if (!v) return null;
                          const x1 = cIdx;
                          const x2 = 4 - cIdx;
                          const cls =
                            (cIdx + r) % 2
                              ? "community-details__identicon-cell--a"
                              : "community-details__identicon-cell--b";
                          return (
                            <g key={`r${r}c${cIdx}`}>
                              <rect
                                x={x1}
                                y={r}
                                width={1}
                                height={1}
                                className={cls}
                              />
                              <rect
                                x={x2}
                                y={r}
                                width={1}
                                height={1}
                                className={cls}
                              />
                            </g>
                          );
                        })
                      )}
                    </svg>
                  );
                })()
              )}
            </div>
            <div className="community-details__title">
              <div className="community-details__title-row">
                <h2>{community.name}</h2>
                {community.isOfficial && (
                  <Badge className="community-details__official-badge">
                    <CheckCircleFillIcon size={12} />
                    {t("official_badge")}
                  </Badge>
                )}
              </div>
              {community.description && (
                <p className="community-details__description">
                  {community.description}
                </p>
              )}
            </div>
          </div>

          {(() => {
            const isCompact = stats.total <= 4;
            return (
              <div
                className={`community-details__stats ${
                  isCompact ? "community-details__stats--compact" : ""
                }`}
              >
                {isCompact ? (
                  <>
                    <div className="community-details__stat-compact">
                      <span className="community-details__stat-compact-label">
                        {t("members_total")}
                      </span>
                      <span className="community-details__stat-compact-value">
                        {stats.total}
                      </span>
                    </div>
                    <div className="community-details__stat-compact">
                      <span className="community-details__stat-compact-label">
                        {t("members_online")}
                      </span>
                      <span className="community-details__stat-compact-value">
                        {stats.online}
                      </span>
                    </div>
                    <div className="community-details__stat-compact">
                      <span className="community-details__stat-compact-label">
                        {t("in_game")}
                      </span>
                      <span className="community-details__stat-compact-value">
                        {stats.inGame}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="community-details__stat">
                      <span className="community-details__stat-label">
                        {t("members_total")}
                      </span>
                      <span className="community-details__stat-value">
                        {stats.total}
                      </span>
                    </div>
                    <div className="community-details__stat">
                      <span className="community-details__stat-label">
                        {t("members_online")}
                      </span>
                      <span className="community-details__stat-value">
                        {stats.online}
                      </span>
                    </div>
                    <div className="community-details__stat community-details__stat--games">
                      <span className="community-details__stat-label">
                        {t("in_game")}
                      </span>
                      <span className="community-details__stat-value">
                        {stats.inGame}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          <div className="community-details__hero-actions">
            {!isMember ? (
              community.isClosed && !isOwner ? (
                <Badge>
                  <LockIcon size={12} /> {t("closed_community")}
                </Badge>
              ) : (
                <button
                  className="community-details__hero-button"
                  onClick={async () => {
                    if (!id) return;
                    const updated = await window.electron
                      .joinCommunity(id)
                      .catch(() => null);
                    setCommunity(updated);
                    if (updated) {
                      showSuccessToast("Вы вступили в сообщество");
                    }
                  }}
                >
                  <span className="community-details__section-title-text">
                    <UserPlus size={14} /> {t("join")}
                  </span>
                </button>
              )
            ) : (
              !isOwner && (
                <button
                  className="community-details__hero-button"
                  onClick={async () => {
                    if (!id) return;
                    const updated = await window.electron
                      .leaveCommunity(id)
                      .catch(() => null);
                    if (updated) {
                      setCommunity(updated);
                      showSuccessToast("Вы покинули сообщество");
                    }
                  }}
                >
                  <span className="community-details__section-title-text">
                    <LogOut size={14} /> {t("leave")}
                  </span>
                </button>
              )
            )}

            {isOwner && (
              <button
                className="community-details__hero-button"
                onClick={() => setShowSettingsModal(true)}
              >
                <span className="community-details__section-title-text">
                  <SettingsIcon size={14} /> {t("settings")}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="community-details__content">
        <div className="community-details__main">
          <div className="community-details__header">
            <div className="community-details__header-left">
              <div className="community-details__filters">
                <div className="community-details__filters-tab-wrapper">
                  <button
                    type="button"
                    className={`community-details__filters-tab ${
                      activeTab === "home"
                        ? "community-details__filters-tab--active"
                        : ""
                    }`}
                    onClick={() => setActiveTab("home")}
                  >
                    <Home size={14} /> {t("home")}
                  </button>
                  {activeTab === "home" && (
                    <motion.div
                      className="community-details__filters-tab-underline"
                      layoutId="community-details-tab-underline"
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                    />
                  )}
                </div>
                <div className="community-details__filters-tab-wrapper">
                  <button
                    type="button"
                    className={`community-details__filters-tab ${
                      activeTab === "events"
                        ? "community-details__filters-tab--active"
                        : ""
                    }`}
                    onClick={() => setActiveTab("events")}
                  >
                    <CalendarDays size={14} /> {t("events")}
                  </button>
                  {activeTab === "events" && (
                    <motion.div
                      className="community-details__filters-tab-underline"
                      layoutId="community-details-tab-underline"
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                    />
                  )}
                </div>
                <div className="community-details__filters-tab-wrapper">
                  <button
                    type="button"
                    className={`community-details__filters-tab ${
                      activeTab === "members"
                        ? "community-details__filters-tab--active"
                        : ""
                    }`}
                    onClick={() => setActiveTab("members")}
                  >
                    <Users size={14} /> {t("members")}
                  </button>
                  {activeTab === "members" && (
                    <motion.div
                      className="community-details__filters-tab-underline"
                      layoutId="community-details-tab-underline"
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
            {isOwner && activeTab === "home" && (
              <Button
                className="community-details__create-post-button"
                theme="outline"
                onClick={() => setShowCreatePostModal(true)}
                title={t("create_post")}
              >
                <PlusIcon size={14} /> {t("create_post")}
              </Button>
            )}
            {isOwner && activeTab === "events" && (
              <Button
                className="community-details__create-event-button"
                theme="outline"
                onClick={() => setShowCreateEventModal(true)}
                title={t("create_event")}
              >
                <PlusIcon size={14} /> {t("create_event")}
              </Button>
            )}
          </div>

          {activeTab === "home" && (
            <div className="community-details__posts">
              {posts.length === 0 ? (
                <div className="community-details__empty-posts">
                  {t("no_posts")}
                </div>
              ) : (
                <InfiniteScroll
                  dataLength={Math.min(posts.length, visiblePostsCount)}
                  next={() =>
                    setVisiblePostsCount((c) => Math.min(c + 10, posts.length))
                  }
                  hasMore={visiblePostsCount < posts.length}
                  loader={null}
                  scrollThreshold={0.9}
                  style={{ overflow: "visible" }}
                  scrollableTarget="scrollableDiv"
                >
                  <ul className="community-details__posts-list">
                    {posts.slice(0, visiblePostsCount).map((post) => {
                      const isLong = stripHtml(post.content).length > 1000;
                      const isExpanded = expandedPosts[post.id];
                      return (
                        <li
                          key={post.id}
                          className="community-details__post-item"
                        >
                          <div className="community-details__post-header">
                            <button
                              className="community-details__post-author"
                              onClick={() =>
                                navigate(`/profile/${post.authorId}`)
                              }
                            >
                              {post.authorProfileImageUrl ? (
                                <img
                                  src={post.authorProfileImageUrl}
                                  alt={post.authorDisplayName}
                                />
                              ) : (
                                <div className="community-details__post-author-placeholder" />
                              )}
                              <span className="community-details__post-author-name">
                                {post.authorDisplayName}
                              </span>
                            </button>
                            <div className="community-details__post-dates">
                              <div className="community-details__post-date-row">
                                <CalendarIcon size={12} />
                                <span className="community-details__post-date-label">
                                  {t("published_at")}
                                </span>
                                <span className="community-details__post-date-value">
                                  {formatDateNoSeconds(
                                    new Date(post.createdAt)
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div
                            className={`community-details__collapse ${
                              isLong && !isExpanded
                                ? "community-details__collapse--collapsed"
                                : ""
                            }`}
                          >
                            <div
                              className="community-details__post-content"
                              dangerouslySetInnerHTML={{
                                __html: sanitizeHtml(post.content),
                              }}
                            />
                          </div>
                          {isLong && !isExpanded && (
                            <div className="community-details__read-more">
                              <button
                                className="game-details__description-toggle"
                                onClick={() =>
                                  setExpandedPosts((m) => ({
                                    ...m,
                                    [post.id]: true,
                                  }))
                                }
                              >
                                Читать полностью
                              </button>
                            </div>
                          )}
                          <div className="community-details__post-footer">
                            <div className="community-details__post-votes">
                              <button
                                className={`community-details__vote-button community-details__vote-button--upvote ${post.hasUpvoted ? "community-details__vote-button--active" : ""}`}
                                onClick={() =>
                                  handlePostVote(post.id, "upvote")
                                }
                                disabled={votingPosts.has(post.id)}
                                style={{
                                  opacity: votingPosts.has(post.id) ? 0.5 : 1,
                                }}
                              >
                                <ThumbsUp size={16} />
                                <span className="community-details__vote-count">
                                  {post.upvotes || 0}
                                </span>
                              </button>
                              <button
                                className={`community-details__vote-button community-details__vote-button--downvote ${post.hasDownvoted ? "community-details__vote-button--active" : ""}`}
                                onClick={() =>
                                  handlePostVote(post.id, "downvote")
                                }
                                disabled={votingPosts.has(post.id)}
                                style={{
                                  opacity: votingPosts.has(post.id) ? 0.5 : 1,
                                }}
                              >
                                <ThumbsDown size={16} />
                                <span className="community-details__vote-count">
                                  {post.downvotes || 0}
                                </span>
                              </button>
                            </div>
                            {isOwner && (
                              <div className="community-details__post-right">
                                <span className="community-details__footer-separator" />
                                <div className="community-details__post-actions community-details__post-actions--right">
                                  <Button
                                    theme="outline"
                                    onClick={() => {
                                      setEditingPost(post);
                                      setShowEditPostModal(true);
                                    }}
                                  >
                                    <PencilIcon size={12} /> {t("edit_post")}
                                  </Button>
                                  <Button
                                    theme="danger"
                                    onClick={() => {
                                      setPostIdToDelete(post.id);
                                      setShowDeletePostConfirm(true);
                                    }}
                                  >
                                    <TrashIcon size={12} /> {t("delete")}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </InfiniteScroll>
              )}
            </div>
          )}

          {activeTab === "members" && (
            <div className="community-details__members">
              {members.length === 0 ? (
                <div className="community-details__empty-members">
                  {t("no_members")}
                </div>
              ) : (
                <>
                  <div className="community-details__member-search">
                    <TextField
                      value={memberQuery}
                      onChange={(e) => setMemberQuery(e.target.value)}
                      placeholder={"Поиск участника"}
                    />
                  </div>
                  <ul className="community-details__members-list">
                    {filteredMembers.map((m) => (
                      <li key={m.id} className="community-details__member-item">
                        <div className="community-details__member-row">
                          <button
                            className="community-details__member"
                            onClick={() => navigate(`/profile/${m.id}`)}
                          >
                            <div
                              className="community-details__member-avatar"
                              style={{ width: 32, height: 32 }}
                            >
                              {m.profileImageUrl ? (
                                <img
                                  className="community-details__member-avatar-image"
                                  alt={m.displayName}
                                  src={m.profileImageUrl}
                                  width={32}
                                  height={32}
                                />
                              ) : (
                                <PersonIcon size={22} />
                              )}
                            </div>

                            <div className="community-details__member-info">
                              <span className="community-details__member-name">
                                {m.displayName}
                              </span>
                            </div>
                          </button>
                          <div className="community-details__member-badges">
                            {community.ownerId === m.id && (
                              <span className="community-details__member-role">
                                {t("owner")}
                              </span>
                            )}
                            <span
                              className={`community-details__member-status ${m.isOnline ? "online" : "offline"}`}
                            >
                              {m.isOnline ? t("online") : t("offline")}
                            </span>
                          </div>
                        </div>
                        {m.currentGame &&
                          (() => {
                            const cg = m.currentGame!;
                            const key = `${cg.shop}-${cg.objectId}`;
                            const assets = assetsMap[key] ?? null;
                            const cover = (
                              assets?.libraryImageUrl ??
                              assets?.coverImageUrl ??
                              assets?.iconUrl ??
                              assets?.libraryHeroImageUrl ??
                              ""
                            )?.replaceAll("\\", "/");
                            const genres = (genresMap[key] ?? []).slice(0, 3);

                            const isMe = me && m.id === me.id;
                            const showSession =
                              isMe &&
                              runningGame &&
                              runningGame.objectId === cg.objectId &&
                              runningGame.shop === cg.shop &&
                              typeof runningGame.sessionDurationInMillis ===
                                "number";
                            const sessionMinutes = showSession
                              ? Math.floor(
                                  (runningGame!
                                    .sessionDurationInMillis as number) / 60000
                                )
                              : 0;
                            const sessionLabel =
                              sessionMinutes < 60
                                ? `${sessionMinutes} мин`
                                : `${Math.floor(sessionMinutes / 60)} ч`;

                            return (
                              <div className="community-details__member-game-card">
                                <button
                                  type="button"
                                  className="community-details__member-game-button"
                                  onClick={() =>
                                    navigate(
                                      buildGameDetailsPath({
                                        shop: cg.shop,
                                        objectId: cg.objectId,
                                        title: cg.title,
                                      })
                                    )
                                  }
                                >
                                  <div className="community-details__member-game-cover">
                                    {cover ? (
                                      <img src={cover} alt={cg.title} />
                                    ) : (
                                      <div className="community-details__member-game-cover-placeholder">
                                        <QuestionIcon size={20} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="community-details__member-game-details">
                                    <span className="community-details__member-game-title">
                                      {cg.title}
                                    </span>
                                    <div className="community-details__member-game-meta">
                                      {showSession && (
                                        <span className="community-details__chip">
                                          <ClockIcon size={12} /> {sessionLabel}
                                        </span>
                                      )}
                                      {isMe && (
                                        <span className="community-details__chip">
                                          Всего:{" "}
                                          {(() => {
                                            const ms =
                                              runningGame?.playTimeInMilliseconds ||
                                              0;
                                            const minutes = Math.floor(
                                              ms / 60000
                                            );
                                            return minutes < 60
                                              ? `${minutes} мин`
                                              : `${Math.floor(minutes / 60)} ч`;
                                          })()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="community-details__member-game-genres">
                                    {genres.map((genre) => (
                                      <Badge key={genre}>{genre}</Badge>
                                    ))}
                                  </div>
                                </button>
                              </div>
                            );
                          })()}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {activeTab === "events" && (
            <div className="community-details__events">
              {(!community.events || community.events.length === 0) && (
                <div className="community-details__empty-events">
                  {t("no_events")}
                </div>
              )}
              {community.events &&
                community.events.length > 0 &&
                (() => {
                  const ref = selectedEventsDate
                    ? new Date(
                        selectedEventsDate.getFullYear(),
                        selectedEventsDate.getMonth(),
                        selectedEventsDate.getDate(),
                        0,
                        0,
                        0
                      )
                    : now;
                  const upcomingFromRef = events.filter(
                    (e) => new Date(e.date).getTime() >= ref.getTime()
                  );
                  const upcomingPinnedDefault = upcomingFromRef[0] || null;
                  const remainingUpcomingDefault = upcomingFromRef.filter(
                    (e) =>
                      !upcomingPinnedDefault ||
                      e.id !== upcomingPinnedDefault.id
                  );
                  const selectedDayEvents = selectedEventsDate
                    ? events.filter((e) =>
                        isSameDay(new Date(e.date), selectedEventsDate)
                      )
                    : [];
                  const selectedMidnight = selectedEventsDate
                    ? new Date(
                        selectedEventsDate.getFullYear(),
                        selectedEventsDate.getMonth(),
                        selectedEventsDate.getDate(),
                        0,
                        0,
                        0
                      )
                    : null;
                  const isSelectedFuture = selectedMidnight
                    ? selectedMidnight.getTime() >=
                      new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        now.getDate()
                      ).getTime()
                    : null;

                  let listItems: CommunityEvent[] = [];
                  let headerLabel = t("upcoming_event");
                  let listLabel = t("scheduled_events");

                  if (selectedEventsDate) {
                    if (selectedDayEvents.length > 0) {
                      if (isSelectedFuture) {
                        listItems = selectedDayEvents.slice(1);
                        headerLabel = t("scheduled_events");
                        listLabel = t("scheduled_events");
                      } else {
                        listItems = selectedDayEvents.slice(0, -1).reverse();
                        headerLabel = t("past_events");
                        listLabel = t("past_events");
                      }
                    } else {
                      if (isSelectedFuture) {
                        listItems = remainingUpcomingDefault;
                        headerLabel = t("scheduled_events");
                        listLabel = t("scheduled_events");
                      } else {
                        const before = events.filter(
                          (e) =>
                            new Date(e.date).getTime() <=
                            (selectedMidnight as Date).getTime()
                        );
                        listItems = before
                          .slice(0, Math.max(0, before.length - 1))
                          .reverse();
                        headerLabel = t("past_events");
                        listLabel = t("past_events");
                      }
                    }
                  } else {
                    listItems = remainingUpcomingDefault;
                    headerLabel = t("upcoming_event");
                    listLabel = t("scheduled_events");
                  }
                  const past = events
                    .filter((e) => new Date(e.date).getTime() < now.getTime())
                    .sort(
                      (a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    );

                  const renderCard = (ev: ExtendedCommunityEvent) => {
                    const member = (community.members || []).find(
                      (m) => m.id === ev.authorId
                    );
                    const authorName =
                      ev.authorDisplayName || member?.displayName || "—";
                    const avatarUrl =
                      ev.authorProfileImageUrl ||
                      member?.profileImageUrl ||
                      null;
                    const created = ev.createdAt
                      ? new Date(ev.createdAt)
                      : null;
                    const eventDate = new Date(ev.date);
                    const isPast = eventDate.getTime() < now.getTime();
                    const remainingValue = formatRemainingValue(eventDate, now);
                    const lessThanDay =
                      !isPast &&
                      eventDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000;
                    const html = sanitizeHtml(ev.content ?? ev.title ?? "");
                    const isLong =
                      stripHtml(ev.content ?? ev.title ?? "").length > 1000;
                    const isExpanded = expandedEvents[ev.id];
                    return (
                      <div className="community-details__post-item">
                        <div className="community-details__post-header">
                          <button
                            className="community-details__post-author"
                            onClick={() => {
                              if (ev.authorId)
                                navigate(`/profile/${ev.authorId}`);
                            }}
                          >
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={authorName} />
                            ) : (
                              <div className="community-details__post-author-placeholder" />
                            )}
                            <span className="community-details__post-author-name">
                              {authorName}
                            </span>
                          </button>
                          <div className="community-details__post-dates">
                            {isPast ? (
                              <span className="community-details__badge community-details__badge--muted">
                                <CheckCircleFillIcon size={12} />{" "}
                                {t("event_completed")}
                              </span>
                            ) : lessThanDay ? (
                              <span className="community-details__badge community-details__badge--primary">
                                {t("remaining")} — {remainingValue}
                              </span>
                            ) : null}
                            {!isPast && !lessThanDay && (
                              <span className="community-details__badge community-details__badge--primary">
                                {formatDateNoSeconds(eventDate)}
                              </span>
                            )}
                            {isPast && (
                              <div className="community-details__post-date-row">
                                <span className="community-details__post-date-value">
                                  {formatDateNoSeconds(eventDate)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div
                          className={`community-details__collapse ${
                            isLong && !isExpanded
                              ? "community-details__collapse--collapsed"
                              : ""
                          }`}
                        >
                          <div
                            className="community-details__post-content"
                            dangerouslySetInnerHTML={{ __html: html }}
                          />
                        </div>
                        {isLong && !isExpanded && (
                          <div className="community-details__read-more">
                            <button
                              className="game-details__description-toggle"
                              onClick={() =>
                                setExpandedEvents((m) => ({
                                  ...m,
                                  [ev.id]: true,
                                }))
                              }
                            >
                              Читать полностью
                            </button>
                          </div>
                        )}
                        {created && (
                          <div className="community-details__post-published">
                            <CalendarIcon size={12} />
                            <span className="community-details__post-published-label">
                              {t("published_at")}
                            </span>
                            <span className="community-details__post-published-value">
                              {formatDateNoSeconds(created)}
                            </span>
                          </div>
                        )}
                        <div className="community-details__event-footer">
                          <div className="community-details__post-votes">
                            <button
                              className={`community-details__vote-button community-details__vote-button--upvote ${ev.hasUpvoted ? "community-details__vote-button--active" : ""}`}
                              onClick={() => handleEventVote(ev.id, "upvote")}
                              disabled={votingEvents.has(ev.id)}
                              style={{
                                opacity: votingEvents.has(ev.id) ? 0.5 : 1,
                              }}
                            >
                              <ThumbsUp size={16} />
                              <span className="community-details__vote-count">
                                {ev.upvotes || 0}
                              </span>
                            </button>
                            <button
                              className={`community-details__vote-button community-details__vote-button--downvote ${ev.hasDownvoted ? "community-details__vote-button--active" : ""}`}
                              onClick={() => handleEventVote(ev.id, "downvote")}
                              disabled={votingEvents.has(ev.id)}
                              style={{
                                opacity: votingEvents.has(ev.id) ? 0.5 : 1,
                              }}
                            >
                              <ThumbsDown size={16} />
                              <span className="community-details__vote-count">
                                {ev.downvotes || 0}
                              </span>
                            </button>
                          </div>
                          {isOwner && (
                            <div className="community-details__event-right">
                              <span className="community-details__footer-separator" />
                              <div className="community-details__event-actions community-details__event-actions--right">
                                <button
                                  className="community-details__hero-button"
                                  onClick={() => {
                                    setEditingEvent(ev);
                                    setShowEditEventModal(true);
                                  }}
                                >
                                  <PencilIcon size={12} /> {t("edit_event")}
                                </button>
                                <Button
                                  theme="danger"
                                  onClick={() => {
                                    setEventIdToDelete(ev.id);
                                    setShowDeleteEventConfirm(true);
                                  }}
                                >
                                  <TrashIcon size={12} /> {t("delete")}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        {false && null}
                      </div>
                    );
                  };

                  return (
                    <>
                      {pinned && (
                        <>
                          <div className="community-details__section-title">
                            <span className="community-details__section-title-text">
                              {headerLabel}
                            </span>
                            {selectedEventsDate && (
                              <span className="community-details__date-badge">
                                {selectedEventsDate.toLocaleDateString(
                                  i18n.language &&
                                    i18n.language.startsWith("ru")
                                    ? "ru-RU"
                                    : "en-US"
                                )}
                              </span>
                            )}
                          </div>
                          {renderCard(pinned)}
                        </>
                      )}
                      {listItems.length > 0 && (
                        <div className="community-events__list">
                          {!selectedEventsDate && (
                            <div className="community-details__section-title">
                              {listLabel}
                            </div>
                          )}
                          <InfiniteScroll
                            dataLength={Math.min(
                              listItems.length,
                              visibleScheduledEventsCount
                            )}
                            next={() =>
                              setVisibleScheduledEventsCount((c) =>
                                Math.min(c + 10, listItems.length)
                              )
                            }
                            hasMore={
                              visibleScheduledEventsCount < listItems.length
                            }
                            loader={null}
                            scrollThreshold={0.9}
                            style={{ overflow: "visible" }}
                            scrollableTarget="scrollableDiv"
                          >
                            <ul className="community-details__events-list">
                              {listItems
                                .slice(0, visibleScheduledEventsCount)
                                .map((ev) => (
                                  <li key={ev.id}>{renderCard(ev)}</li>
                                ))}
                            </ul>
                          </InfiniteScroll>
                        </div>
                      )}
                      {!selectedEventsDate && past.length > 0 && (
                        <div className="community-events__list">
                          <div className="community-details__section-title">
                            {t("past_events")}
                          </div>
                          <InfiniteScroll
                            dataLength={Math.min(
                              past.length,
                              visiblePastEventsCount
                            )}
                            next={() =>
                              setVisiblePastEventsCount((c) =>
                                Math.min(c + 10, past.length)
                              )
                            }
                            hasMore={visiblePastEventsCount < past.length}
                            loader={null}
                            scrollThreshold={0.9}
                            style={{ overflow: "visible" }}
                            scrollableTarget="scrollableDiv"
                          >
                            <ul className="community-details__events-list">
                              {past
                                .slice(0, visiblePastEventsCount)
                                .map((ev) => (
                                  <li key={ev.id}>{renderCard(ev)}</li>
                                ))}
                            </ul>
                          </InfiniteScroll>
                        </div>
                      )}
                    </>
                  );
                })()}
            </div>
          )}
        </div>
        <aside className="community-details__sidebar">
          {activeTab === "events" ? (
            <div className="community-details__sidebar-card">
              <div className="community-details__sidebar-card-title">
                Календарь событий
              </div>
              <MiniCalendar
                monthDate={
                  selectedEventsDate
                    ? selectedEventsDate
                    : pinned
                      ? new Date(pinned.date)
                      : now
                }
                marksFuture={events
                  .filter((e) => new Date(e.date).getTime() >= now.getTime())
                  .map((e) => new Date(e.date))}
                marksPast={events
                  .filter((e) => new Date(e.date).getTime() < now.getTime())
                  .map((e) => new Date(e.date))}
                selectedDate={selectedEventsDate ?? undefined}
                onSelectDate={(d) => {
                  const hasEvents = events.some((e) =>
                    isSameDay(new Date(e.date), d)
                  );
                  if (!hasEvents) {
                    setSelectedEventsDate(null);
                    return;
                  }
                  if (selectedEventsDate && isSameDay(selectedEventsDate, d)) {
                    setSelectedEventsDate(null);
                  } else {
                    setSelectedEventsDate(
                      new Date(d.getFullYear(), d.getMonth(), d.getDate())
                    );
                  }
                }}
              />
            </div>
          ) : (
            <>
              {activeTab === "members" && (
                <div className="community-details__sidebar-card">
                  <div className="community-details__sidebar-card-title">
                    {t("online_games")}
                  </div>
                  <ul className="community-details__sidebar-list">
                    {stats.onlineByGameList.length === 0 && (
                      <li className="community-details__sidebar-list-item">
                        {t("none")}
                      </li>
                    )}
                    {stats.onlineByGameList.map((g) => (
                      <li
                        key={g.title}
                        className="community-details__sidebar-list-item"
                      >
                        <span className="community-details__sidebar-game-title">
                          {g.title}
                        </span>
                        <span className="community-details__sidebar-game-count">
                          {g.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeTab === "home" && (
                <div className="community-details__sidebar-card">
                  <div className="community-details__sidebar-card-title">
                    В сети
                  </div>
                  <ul className="community-details__sidebar-members">
                    {members.filter((m) => m.isOnline).length === 0 && (
                      <li className="community-details__muted">{t("none")}</li>
                    )}
                    {members
                      .filter((m) => m.isOnline)
                      .slice(0, 10)
                      .map((m) => (
                        <li
                          key={m.id}
                          className="community-details__sidebar-member-item"
                        >
                          <button
                            type="button"
                            className="community-details__sidebar-member-button"
                            onClick={() => navigate(`/profile/${m.id}`)}
                          >
                            <Avatar
                              size={38}
                              src={m.profileImageUrl || undefined}
                              alt={m.displayName}
                            />
                            <div className="community-details__sidebar-member-details">
                              <span className="community-details__sidebar-member-name">
                                {m.displayName}
                              </span>
                              {m.currentGame?.title && (
                                <div className="community-details__sidebar-member-game">
                                  {m.currentGame.title}
                                </div>
                              )}
                            </div>
                          </button>
                        </li>
                      ))}
                  </ul>
                  {members.filter((m) => m.isOnline).length > 10 && (
                    <button
                      type="button"
                      className="community-details__sidebar-view-all"
                      onClick={() => setActiveTab("members")}
                    >
                      Посмотреть всех
                    </button>
                  )}
                </div>
              )}

              {activeTab === "home" && (
                <div className="community-details__sidebar-card">
                  <div className="community-details__sidebar-card-title">
                    {t("languages")}
                  </div>
                  <ul className="community-details__chips">
                    {(community.languages ?? []).length === 0 && (
                      <li className="community-details__muted">{t("none")}</li>
                    )}
                    {(community.languages ?? []).map((lang) => (
                      <li key={lang} className="community-details__chip">
                        {(
                          languageResources as Record<
                            string,
                            { language_name?: string }
                          >
                        )[lang]?.language_name ?? lang}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeTab === "members" && (
                <div className="community-details__sidebar-card">
                  <div className="community-details__sidebar-card-title">
                    {t("games")}
                  </div>
                  <ul className="community-details__sidebar-games">
                    {(community.games ?? []).length === 0 && (
                      <li className="community-details__muted">{t("none")}</li>
                    )}
                    {(community.games ?? []).map((g) => {
                      const key = `${g.shop}-${g.objectId}`;
                      const assets = assetsMap[key] ?? null;
                      const cover = (
                        assets?.libraryImageUrl ??
                        assets?.coverImageUrl ??
                        assets?.iconUrl ??
                        assets?.libraryHeroImageUrl ??
                        ""
                      )?.replaceAll("\\", "/");

                      return (
                        <li
                          key={key}
                          className="community-details__sidebar-game-card"
                        >
                          <button
                            type="button"
                            className="community-details__sidebar-game-button"
                            onClick={() =>
                              navigate(
                                buildGameDetailsPath({
                                  shop: g.shop,
                                  objectId: g.objectId,
                                  title: g.title,
                                })
                              )
                            }
                          >
                            <div className="community-details__sidebar-game-cover">
                              {cover ? (
                                <img src={cover} alt={g.title} />
                              ) : (
                                <div className="community-details__sidebar-game-cover-placeholder">
                                  <QuestionIcon size={20} />
                                </div>
                              )}
                            </div>
                            <div className="community-details__sidebar-game-details">
                              <span className="community-details__sidebar-game-title">
                                {g.title}
                              </span>
                              <div className="community-details__sidebar-game-genres">
                                {(genresMap[key] ?? []).slice(0, 3).join(", ")}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      <CommunitySettingsModal
        visible={showSettingsModal && !!community}
        community={community}
        me={me}
        onClose={() => setShowSettingsModal(false)}
        onSaved={(updated) => setCommunity(updated)}
        onDeleted={() => navigate("/communities")}
      />

      <CommunityCreatePostModal
        visible={showCreatePostModal && !!community}
        community={community}
        me={me}
        onClose={() => setShowCreatePostModal(false)}
        onCreated={(updated) => setCommunity(updated)}
      />

      {showEditPostModal && editingPost && community && (
        <EditPostModal
          visible={showEditPostModal}
          communityId={community.id}
          post={editingPost}
          onClose={() => {
            setShowEditPostModal(false);
            setEditingPost(null);
          }}
          onSaved={(updated) => {
            setCommunity(updated);
            setShowEditPostModal(false);
            setEditingPost(null);
          }}
        />
      )}

      <Modal
        visible={showDeletePostConfirm}
        title={t("delete_post")}
        onClose={() => setShowDeletePostConfirm(false)}
      >
        <div className="community-details__delete-confirm">
          <p>{t("delete_confirm_message")}</p>
          <div className="community-details__delete-actions">
            <Button
              theme="outline"
              onClick={() => setShowDeletePostConfirm(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              theme="danger"
              onClick={async () => {
                if (!community || !postIdToDelete) return;
                await window.electron.removeCommunityPost(
                  community.id,
                  postIdToDelete
                );
                const updated = await window.electron.getCommunityById(
                  community.id
                );
                setCommunity(updated);
                setShowDeletePostConfirm(false);
                setPostIdToDelete(null);
                showSuccessToast("Пост удалён");
              }}
            >
              {t("delete")}
            </Button>
          </div>
        </div>
      </Modal>

      {community && (
        <CreateEventModal
          visible={showCreateEventModal}
          community={community}
          me={me}
          onClose={() => setShowCreateEventModal(false)}
          onCreated={(updated) => {
            setCommunity(updated);
            setShowCreateEventModal(false);
          }}
        />
      )}

      {community && editingEvent && (
        <EditEventModal
          visible={showEditEventModal}
          communityId={community.id}
          event={editingEvent}
          onClose={() => {
            setShowEditEventModal(false);
            setEditingEvent(null);
          }}
          onSaved={(updated) => {
            setCommunity(updated);
            setShowEditEventModal(false);
            setEditingEvent(null);
          }}
        />
      )}

      <Modal
        visible={showDeleteEventConfirm}
        title={t("delete_event")}
        onClose={() => setShowDeleteEventConfirm(false)}
      >
        <div className="community-details__delete-confirm">
          <p>{t("delete_confirm_message")}</p>
          <div className="community-details__delete-actions">
            <Button
              theme="outline"
              onClick={() => setShowDeleteEventConfirm(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              theme="danger"
              onClick={async () => {
                if (!community || !eventIdToDelete) return;
                const current = await window.electron.getCommunityById(
                  community.id
                );
                if (!current) return;
                const events = (current.events ?? []).filter(
                  (e: CommunityEvent) => e.id !== eventIdToDelete
                );
                const updated = await window.electron.updateCommunity(
                  community.id,
                  { events }
                );
                setCommunity(updated);
                setShowDeleteEventConfirm(false);
                setEventIdToDelete(null);
                showSuccessToast("Событие удалено");
              }}
            >
              {t("delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface EditPostModalProps {
  visible: boolean;
  communityId: string;
  post: CommunityPost;
  onClose: () => void;
  onSaved: (community: Community) => void;
}

function EditPostModal({
  visible,
  communityId,
  post,
  onClose,
  onSaved,
}: Readonly<EditPostModalProps>) {
  const { t } = useTranslation("communities");
  const { showSuccessToast } = useToast();
  const [charCount, setCharCount] = useState(0);
  const { hasActiveSubscription } = useUserDetails();
  const { showHydraCloudModal } = useSubscription();
  const devUnlockCloud = (() => {
    try {
      const key = `hydra_dev_unlock_cloud_${communityId}`;
      return window.localStorage.getItem(key) === "1";
    } catch (_e) {
      return false;
    }
  })();
  const blockCloudFeatures = (() => {
    try {
      const key = `hydra_block_cloud_features_${communityId}`;
      return window.localStorage.getItem(key) === "1";
    } catch (_e) {
      return false;
    }
  })();
  const cloudEnabled =
    (hasActiveSubscription && !blockCloudFeatures) || devUnlockCloud;
  const MAX_POST_CHARS = cloudEnabled ? 5000 : 1000;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
      }),
    ],
    content: post.content,
    editorProps: {
      attributes: {
        class: "game-details__review-editor",
        "data-placeholder": t("write_post_placeholder"),
      },
      handlePaste: (view, event) => {
        const htmlContent = event.clipboardData?.getData("text/html") || "";
        const plainText = event.clipboardData?.getData("text/plain") || "";

        const currentText = view.state.doc.textContent;
        const remainingChars = MAX_POST_CHARS - currentText.length;

        if ((htmlContent || plainText) && remainingChars > 0) {
          event.preventDefault();

          if (htmlContent) {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = htmlContent;
            const textLength = tempDiv.textContent?.length || 0;

            if (textLength <= remainingChars) {
              return false;
            }
          }

          const truncatedText = plainText.slice(0, remainingChars);
          view.dispatch(view.state.tr.insertText(truncatedText));
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      setCharCount(text.length);

      if (text.length > MAX_POST_CHARS) {
        const truncatedContent = text.slice(0, MAX_POST_CHARS);
        editor.commands.setContent(truncatedContent);
        setCharCount(MAX_POST_CHARS);
      }
    },
  });

  useEffect(() => {
    setCharCount((editor?.getText() || "").length);
  }, [visible, editor]);

  const handleSave = async () => {
    const plain = editor?.getText().trim() || "";
    if (!plain) return;
    const html = editor?.getHTML() || "";
    const existing = await window.electron.getCommunityById(communityId);
    if (!existing) return;
    const posts = (existing.posts ?? []).map((p) =>
      p.id === post.id ? { ...p, content: html } : p
    );
    const updated = await window.electron.updateCommunity(communityId, {
      posts,
    });
    onSaved(updated);
    showSuccessToast("Пост обновлён");
  };

  return (
    <Modal visible={visible} title={t("edit_post")} onClose={onClose} large>
      <div className="community-details__editor-form">
        <div className="community-details__editor-input-container">
          <div className="community-details__editor-input-header">
            <div className="community-details__editor-toolbar">
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                className={`community-details__editor-button ${editor?.isActive("bold") ? "is-active" : ""}`}
                disabled={!editor}
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                className={`community-details__editor-button ${editor?.isActive("italic") ? "is-active" : ""}`}
                disabled={!editor}
              >
                <em>I</em>
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                className={`community-details__editor-button ${editor?.isActive("underline") ? "is-active" : ""}`}
                disabled={!editor}
              >
                <u>U</u>
              </button>
            </div>
            <div className="community-details__char-counter">
              <span className={charCount > MAX_POST_CHARS ? "over-limit" : ""}>
                {charCount}/{MAX_POST_CHARS}
              </span>
              {!cloudEnabled && (
                <button
                  type="button"
                  className="community-details__cloud-badge"
                  onClick={() => showHydraCloudModal("backup")}
                >
                  <Badge>
                    <HydraIcon width={12} height={12} />{" "}
                    {t("hydra_cloud_limit")}
                  </Badge>
                </button>
              )}
            </div>
          </div>
          <div className="community-details__editor-input">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
      <div className="community-create-post-modal__actions">
        <Button theme="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button theme="primary" onClick={handleSave}>
          {t("save")}
        </Button>
      </div>
    </Modal>
  );
}

interface CreateEventModalProps {
  visible: boolean;
  community: Community;
  me: UserDetails | null;
  onClose: () => void;
  onCreated: (updated: Community) => void;
}

function CreateEventModal({
  visible,
  community,
  me,
  onClose,
  onCreated,
}: Readonly<CreateEventModalProps>) {
  const { t } = useTranslation("communities");
  const { showSuccessToast } = useToast();
  const [charCount, setCharCount] = useState(0);
  const { hasActiveSubscription } = useUserDetails();
  const { showHydraCloudModal } = useSubscription();
  const devUnlockCloud = (() => {
    try {
      const key = `hydra_dev_unlock_cloud_${community.id}`;
      return window.localStorage.getItem(key) === "1";
    } catch (_e) {
      return false;
    }
  })();
  const blockCloudFeatures = (() => {
    try {
      const key = `hydra_block_cloud_features_${community.id}`;
      return window.localStorage.getItem(key) === "1";
    } catch (_e) {
      return false;
    }
  })();
  const cloudEnabled =
    (hasActiveSubscription && !blockCloudFeatures) || devUnlockCloud;
  const MAX_EVENT_CHARS = cloudEnabled ? 5000 : 1000;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "community-details__editor-content",
        "data-placeholder": t("write_post_placeholder"),
      },
      handlePaste: (view, event) => {
        const htmlContent = event.clipboardData?.getData("text/html") || "";
        const plainText = event.clipboardData?.getData("text/plain") || "";

        const currentText = view.state.doc.textContent;
        const remainingChars = MAX_EVENT_CHARS - currentText.length;

        if ((htmlContent || plainText) && remainingChars > 0) {
          event.preventDefault();

          if (htmlContent) {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = htmlContent;
            const textLength = tempDiv.textContent?.length || 0;

            if (textLength <= remainingChars) {
              return false;
            }
          }

          const truncatedText = plainText.slice(0, remainingChars);
          view.dispatch(view.state.tr.insertText(truncatedText));
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      setCharCount(text.length);

      if (text.length > MAX_EVENT_CHARS) {
        const truncatedContent = text.slice(0, MAX_EVENT_CHARS);
        editor.commands.setContent(truncatedContent);
        setCharCount(MAX_EVENT_CHARS);
      }
    },
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [hour, setHour] = useState<number>(new Date().getHours());
  const [minute, setMinute] = useState<number>(0);

  useEffect(() => {
    if (!visible) {
      editor?.commands.setContent("");
      setCharCount(0);
      setSelectedDate(new Date());
      setHour(new Date().getHours());
      setMinute(0);
    }
  }, [visible, editor]);

  const handleCreate = async () => {
    const plain = editor?.getText().trim() || "";
    if (plain.length < 10) return;
    const dt = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      hour,
      minute,
      0,
      0
    );
    const newEvent: ExtendedCommunityEvent = {
      id: globalThis.crypto.randomUUID(),
      content: editor?.getHTML() || "",
      title: plain,
      date: dt.toISOString(),
      createdAt: new Date().toISOString(),
      authorId: me?.id ?? "local",
      authorDisplayName: me?.displayName ?? "",
      authorProfileImageUrl: me?.profileImageUrl ?? null,
    };
    const updated = await window.electron.updateCommunity(community.id, {
      events: [newEvent, ...(community.events ?? [])],
    });
    onCreated(updated);
    showSuccessToast("Событие создано");
  };

  return (
    <Modal visible={visible} title={t("create_event")} onClose={onClose} large>
      <div className="community-create-post-modal__container">
        <div className="community-details__editor-form">
          <label>{t("event_description")}</label>
          <div className="community-details__editor-input-container">
            <div className="community-details__editor-input-header">
              <div className="community-details__editor-toolbar">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={`community-details__editor-button ${editor?.isActive("bold") ? "is-active" : ""}`}
                  disabled={!editor}
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={`community-details__editor-button ${editor?.isActive("italic") ? "is-active" : ""}`}
                  disabled={!editor}
                >
                  <em>I</em>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    editor?.chain().focus().toggleUnderline().run()
                  }
                  className={`community-details__editor-button ${editor?.isActive("underline") ? "is-active" : ""}`}
                  disabled={!editor}
                >
                  <u>U</u>
                </button>
              </div>
              <div className="community-details__char-counter">
                <span
                  className={charCount > MAX_EVENT_CHARS ? "over-limit" : ""}
                >
                  {charCount}/{MAX_EVENT_CHARS}
                </span>
                {!cloudEnabled && (
                  <button
                    type="button"
                    className="community-details__cloud-badge"
                    onClick={() => showHydraCloudModal("backup")}
                  >
                    <Badge>
                      <HydraIcon width={12} height={12} />{" "}
                      {t("hydra_cloud_limit")}
                    </Badge>
                  </button>
                )}
              </div>
            </div>
            <div className="community-details__editor-input">
              <EditorContent editor={editor} />
            </div>
          </div>
          <Calendar
            value={selectedDate}
            hour={hour}
            minute={minute}
            onChangeDate={(d) => setSelectedDate(d)}
            onChangeHour={(h) => setHour(h)}
            onChangeMinute={(m) => setMinute(m)}
          />
        </div>
        <div className="community-create-post-modal__actions">
          <Button theme="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            theme="primary"
            onClick={handleCreate}
            disabled={(editor?.getText().trim().length || 0) < 10}
          >
            {t("create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface CalendarProps {
  value: Date;
  hour: number;
  minute: number;
  onChangeDate: (d: Date) => void;
  onChangeHour: (h: number) => void;
  onChangeMinute: (m: number) => void;
}

function Calendar({
  value,
  hour,
  minute,
  onChangeDate,
  onChangeHour,
  onChangeMinute,
}: Readonly<CalendarProps>) {
  const { t, i18n } = useTranslation("communities");
  const locale =
    i18n.language && i18n.language.startsWith("ru") ? "ru-RU" : "en-US";
  const [currentMonth, setCurrentMonth] = useState<number>(value.getMonth());
  const [currentYear, setCurrentYear] = useState<number>(value.getFullYear());

  useEffect(() => {
    setCurrentMonth(value.getMonth());
    setCurrentYear(value.getFullYear());
  }, [value]);

  const startOfMonth = new Date(currentYear, currentMonth, 1);
  const startDay = startOfMonth.getDay() === 0 ? 7 : startOfMonth.getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const weeks: Array<Array<{ date: Date; inMonth: boolean }>> = [];
  let cursor = 1 - (startDay - 1);
  for (let w = 0; w < 6; w++) {
    const row: Array<{ date: Date; inMonth: boolean }> = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(currentYear, currentMonth, cursor);
      const inMonth = cursor >= 1 && cursor <= daysInMonth;
      row.push({ date, inMonth });
      cursor++;
    }
    weeks.push(row);
  }

  const monthLabel = new Date(currentYear, currentMonth, 1).toLocaleString(
    locale,
    {
      month: "long",
      year: "numeric",
    }
  );

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  return (
    <div className="community-calendar__wrapper">
      <div className="community-calendar">
        <div className="community-calendar__header">
          <button
            className="community-calendar__nav"
            onClick={() => setCurrentYear(currentYear - 1)}
          >
            «
          </button>
          <button
            className="community-calendar__nav"
            onClick={() => setCurrentMonth(currentMonth - 1)}
          >
            ‹
          </button>
          <div className="community-calendar__label">{monthLabel}</div>
          <button
            className="community-calendar__nav"
            onClick={() => setCurrentMonth(currentMonth + 1)}
          >
            ›
          </button>
          <button
            className="community-calendar__nav"
            onClick={() => setCurrentYear(currentYear + 1)}
          >
            »
          </button>
        </div>
        <div className="community-calendar__grid">
          {(locale === "ru-RU"
            ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
            : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
          ).map((wd) => (
            <div key={wd} className="community-calendar__weekday">
              {wd}
            </div>
          ))}
          {weeks.flat().map(({ date, inMonth }, idx) => {
            const isSelected =
              date.getFullYear() === value.getFullYear() &&
              date.getMonth() === value.getMonth() &&
              date.getDate() === value.getDate();
            return (
              <button
                key={idx}
                className={`community-calendar__day ${inMonth ? "" : "out"} ${isSelected ? "selected" : ""}`}
                onClick={() =>
                  onChangeDate(
                    new Date(
                      date.getFullYear(),
                      date.getMonth(),
                      date.getDate()
                    )
                  )
                }
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
      <div className="community-calendar__time">
        <div className="community-calendar__time-section">
          <div className="community-calendar__time-label">{t("hours")}</div>
          <div className="community-calendar__time-list">
            {hours.map((h) => (
              <button
                key={h}
                className={`community-calendar__time-item ${hour === h ? "selected" : ""}`}
                onClick={() => onChangeHour(h)}
              >
                {String(h).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
        <div className="community-calendar__time-section">
          <div className="community-calendar__time-label">{t("minutes")}</div>
          <div className="community-calendar__time-list">
            {minutes.map((m) => (
              <button
                key={m}
                className={`community-calendar__time-item ${minute === m ? "selected" : ""}`}
                onClick={() => onChangeMinute(m)}
              >
                {String(m).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface EditEventModalProps {
  visible: boolean;
  communityId: string;
  event: { id: string; title?: string; content?: string; date: string };
  onClose: () => void;
  onSaved: (community: Community) => void;
}

function EditEventModal({
  visible,
  communityId,
  event,
  onClose,
  onSaved,
}: Readonly<EditEventModalProps>) {
  const { t } = useTranslation("communities");
  const { showSuccessToast } = useToast();
  const initialHtml = (event.content ?? event.title ?? "") as string;
  const [charCount, setCharCount] = useState(0);
  const initDate = new Date(event.date);
  const [selectedDate, setSelectedDate] = useState<Date>(initDate);
  const [hour, setHour] = useState<number>(initDate.getHours());
  const [minute, setMinute] = useState<number>(initDate.getMinutes());
  const { hasActiveSubscription } = useUserDetails();
  const { showHydraCloudModal } = useSubscription();
  const devUnlockCloud = (() => {
    try {
      const key = `hydra_dev_unlock_cloud_${communityId}`;
      return window.localStorage.getItem(key) === "1";
    } catch (_e) {
      return false;
    }
  })();
  const blockCloudFeatures = (() => {
    try {
      const key = `hydra_block_cloud_features_${communityId}`;
      return window.localStorage.getItem(key) === "1";
    } catch (_e) {
      return false;
    }
  })();
  const cloudEnabled =
    (hasActiveSubscription && !blockCloudFeatures) || devUnlockCloud;
  const MAX_EVENT_CHARS = cloudEnabled ? 5000 : 1000;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
      }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: "community-details__editor-content",
        "data-placeholder": t("write_post_placeholder"),
      },
      handlePaste: (view, event) => {
        const htmlContent = event.clipboardData?.getData("text/html") || "";
        const plainText = event.clipboardData?.getData("text/plain") || "";
        const currentText = view.state.doc.textContent;
        const remainingChars = MAX_EVENT_CHARS - currentText.length;
        if ((htmlContent || plainText) && remainingChars > 0) {
          event.preventDefault();
          if (htmlContent) {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = htmlContent;
            const textLength = tempDiv.textContent?.length || 0;
            if (textLength <= remainingChars) {
              return false;
            }
          }
          const truncatedText = plainText.slice(0, remainingChars);
          view.dispatch(view.state.tr.insertText(truncatedText));
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      setCharCount(text.length);
      if (text.length > MAX_EVENT_CHARS) {
        const truncatedContent = text.slice(0, MAX_EVENT_CHARS);
        editor.commands.setContent(truncatedContent);
        setCharCount(MAX_EVENT_CHARS);
      }
    },
  });

  useEffect(() => {
    if (!visible) return;
    const d = new Date(event.date);
    setSelectedDate(d);
    setHour(d.getHours());
    setMinute(d.getMinutes());
    editor?.commands.setContent(initialHtml || "");
    setCharCount((editor?.getText() || "").length);
  }, [visible, event, editor, initialHtml]);

  const handleSave = async () => {
    const plain = editor?.getText().trim() || "";
    if (!plain) return;
    const dt = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      hour,
      minute,
      0,
      0
    );
    const existing = await window.electron.getCommunityById(communityId);
    if (!existing) return;
    const html = editor?.getHTML() || "";
    const events = (existing.events ?? []).map((e: ExtendedCommunityEvent) =>
      e.id === event.id
        ? { ...e, content: html, title: plain, date: dt.toISOString() }
        : e
    );
    const updated = await window.electron.updateCommunity(communityId, {
      events,
    });
    onSaved(updated);
    showSuccessToast("Событие обновлено");
  };

  return (
    <Modal visible={visible} title={t("edit_event")} onClose={onClose} large>
      <div className="community-create-post-modal__container">
        <div className="community-details__editor-form">
          <label>{t("event_description")}</label>
          <div className="community-details__editor-input-container">
            <div className="community-details__editor-input-header">
              <div className="community-details__editor-toolbar">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={`community-details__editor-button ${editor?.isActive("bold") ? "is-active" : ""}`}
                  disabled={!editor}
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={`community-details__editor-button ${editor?.isActive("italic") ? "is-active" : ""}`}
                  disabled={!editor}
                >
                  <em>I</em>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    editor?.chain().focus().toggleUnderline().run()
                  }
                  className={`community-details__editor-button ${editor?.isActive("underline") ? "is-active" : ""}`}
                  disabled={!editor}
                >
                  <u>U</u>
                </button>
              </div>
              <div className="community-details__char-counter">
                <span
                  className={charCount > MAX_EVENT_CHARS ? "over-limit" : ""}
                >
                  {charCount}/{MAX_EVENT_CHARS}
                </span>
                {!cloudEnabled && (
                  <button
                    type="button"
                    className="community-details__cloud-badge"
                    onClick={() => showHydraCloudModal("backup")}
                  >
                    <Badge>
                      <HydraIcon width={12} height={12} />{" "}
                      {t("hydra_cloud_limit")}
                    </Badge>
                  </button>
                )}
              </div>
            </div>
            <div className="community-details__editor-input">
              <EditorContent editor={editor} />
            </div>
          </div>
          <Calendar
            value={selectedDate}
            hour={hour}
            minute={minute}
            onChangeDate={(d) => setSelectedDate(d)}
            onChangeHour={(h) => setHour(h)}
            onChangeMinute={(m) => setMinute(m)}
          />
        </div>
        <div className="community-create-post-modal__actions">
          <Button theme="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button theme="primary" onClick={handleSave}>
            {t("save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface MiniCalendarProps {
  monthDate: Date;
  marksFuture: Date[];
  marksPast: Date[];
  selectedDate?: Date;
  onSelectDate?: (d: Date) => void;
}

function MiniCalendar({
  monthDate,
  marksFuture,
  marksPast,
  selectedDate,
  onSelectDate,
}: Readonly<MiniCalendarProps>) {
  const { i18n } = useTranslation("communities");
  const locale =
    i18n.language && i18n.language.startsWith("ru") ? "ru-RU" : "en-US";
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const startOfMonth = new Date(year, month, 1);
  const startDay = startOfMonth.getDay() === 0 ? 7 : startOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Array<{
    d: number;
    date: Date;
    inMonth: boolean;
    marked: boolean;
  }> = [];
  const markFutureSet = new Set(
    marksFuture.map((m) =>
      new Date(m.getFullYear(), m.getMonth(), m.getDate()).getTime()
    )
  );
  const markPastSet = new Set(
    marksPast.map((m) =>
      new Date(m.getFullYear(), m.getMonth(), m.getDate()).getTime()
    )
  );
  let cursor = 1 - (startDay - 1);
  for (let i = 0; i < 42; i++) {
    const date = new Date(year, month, cursor);
    const inMonth = cursor >= 1 && cursor <= daysInMonth;
    const key = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ).getTime();
    const markedFuture = inMonth && markFutureSet.has(key);
    const markedPast = inMonth && markPastSet.has(key);
    const marked = markedFuture || markedPast;
    const today = new Date();
    const isToday =
      inMonth &&
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
    days.push({
      d: date.getDate(),
      date,
      inMonth,
      marked,
      markedFuture,
      markedPast,
      isToday,
    } as any);
    cursor++;
  }
  const label = new Date(year, month, 1).toLocaleString(locale, {
    month: "long",
    year: "numeric",
  });
  return (
    <div className="community-mini-calendar">
      <div className="community-mini-calendar__label">{label}</div>
      <div className="community-mini-calendar__grid">
        {(locale === "ru-RU"
          ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
          : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        ).map((wd) => (
          <div key={wd} className="community-mini-calendar__weekday">
            {wd}
          </div>
        ))}
        {days.map((x: any, idx) => {
          const sel =
            selectedDate &&
            selectedDate.getFullYear() === x.date.getFullYear() &&
            selectedDate.getMonth() === x.date.getMonth() &&
            selectedDate.getDate() === x.date.getDate();
          return (
            <button
              key={idx}
              type="button"
              className={`community-mini-calendar__cell ${x.inMonth ? "" : "out"} ${sel ? "selected" : ""} ${x.markedFuture ? "has-events" : ""} ${x.markedPast ? "has-events-past" : ""}`}
              onClick={() => {
                if (!x.inMonth) return;
                onSelectDate?.(
                  new Date(
                    x.date.getFullYear(),
                    x.date.getMonth(),
                    x.date.getDate()
                  )
                );
              }}
            >
              <span
                className={`community-mini-calendar__day ${x.isToday ? "today" : ""}`}
              >
                {x.d}
              </span>
              {x.marked && <span className="community-mini-calendar__dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
