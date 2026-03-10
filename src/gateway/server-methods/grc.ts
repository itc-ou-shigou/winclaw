import fs from "node:fs";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import { GrcClient } from "../../infra/grc-client.js";
import type { GrcConnectionManager } from "../../infra/grc-connection.js";
import { GrcSkillManifestStore } from "../../infra/grc-skill-manifest.js";
import { installGrcSkill, uninstallGrcSkill, updateGrcSkill, getDefaultManagedSkillsDir } from "../../infra/grc-skill-installer.js";
import { GrcSyncService } from "../../infra/grc-sync.js";
import {
  ErrorCodes,
  errorShape,
  validateGrcEvolutionParams,
  validateGrcLoginParams,
  validateGrcLogoutParams,
  validateGrcPairParams,
  validateGrcPairVerifyParams,
  validateGrcSkillsParams,
  validateGrcStatusParams,
  validateGrcSyncParams,
  validateGrcTelemetryParams,
  validateGrcCommunityChannelsParams,
  validateGrcCommunityFeedParams,
  validateGrcCommunityPostParams,
  validateGrcCommunityRepliesParams,
  validateGrcCommunityCreatePostParams,
  validateGrcCommunityReplyParams,
  validateGrcCommunityVoteParams,
  validateGrcCommunityStatsParams,
  validateGrcSkillsSearchParams,
  validateGrcSkillsDetailParams,
  validateGrcSkillsVersionsParams,
  validateGrcSkillsInstallGrcParams,
  validateGrcSkillsUpdateGrcParams,
  validateGrcSkillsUninstallGrcParams,
  validateGrcSkillsInstalledParams,
  validateGrcSkillsRecommendedParams,
  validateGrcSkillsPublishParams,
  validateGrcSkillsRateParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

const GRC_DEFAULT_URL = "https://grc.myaiportal.net";

/** Lazy singleton for the skill manifest store. */
let _manifestInstance: GrcSkillManifestStore | null = null;
function getOrCreateManifest(getter?: () => GrcSkillManifestStore): GrcSkillManifestStore {
  if (getter) return getter();
  if (!_manifestInstance) _manifestInstance = new GrcSkillManifestStore();
  return _manifestInstance;
}

export function createGrcHandlers(
  getGrcConnection: () => GrcConnectionManager | null,
  getSkillManifest?: () => GrcSkillManifestStore,
): GatewayRequestHandlers {
  return {
    "grc.status": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcStatusParams, "grc.status", respond)) {
        return;
      }
      const connection = getGrcConnection();
      if (connection) {
        const status = connection.getStatus();
        respond(true, {
          connected: status.connected,
          enabled: true,
          url: status.url,
          authMode: status.tier,
          nodeId: status.nodeId,
          userId: status.userId,
          email: status.email,
          lastSyncAt: status.lastSyncAt,
          syncRunning: status.syncRunning,
          telemetry: loadConfig().grc?.sync?.telemetry ?? false,
        });
        return;
      }
      // Fallback: no connection manager
      const config = loadConfig();
      const grc = config.grc;
      const enabled = grc?.enabled !== false;
      const url = grc?.url ?? GRC_DEFAULT_URL;
      const authMode = grc?.auth?.mode ?? "anonymous";
      const lastSyncAt = grc?.lastSyncAt ?? null;
      const syncInterval = grc?.sync?.interval ?? 14400;
      respond(true, {
        connected: enabled && authMode !== "anonymous",
        enabled,
        url,
        authMode,
        lastSyncAt,
        syncInterval,
        telemetry: grc?.sync?.telemetry ?? false,
      });
    },

    "grc.login": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcLoginParams, "grc.login", respond)) {
        return;
      }
      const config = loadConfig();
      const url = config.grc?.url ?? GRC_DEFAULT_URL;
      const provider = params.provider ?? "github";
      respond(true, {
        authUrl: `${url}/auth/${provider}`,
        provider,
      });
    },

    "grc.logout": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcLogoutParams, "grc.logout", respond)) {
        return;
      }
      // Clear stored auth tokens from config.
      const config = loadConfig();
      if (config.grc?.auth) {
        const nextConfig = {
          ...config,
          grc: {
            ...config.grc,
            auth: {
              ...config.grc.auth,
              token: undefined,
              refreshToken: undefined,
            },
          },
        };
        await writeConfigFile(nextConfig);
      }
      respond(true, { loggedOut: true });
    },

    "grc.sync": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcSyncParams, "grc.sync", respond)) {
        return;
      }
      const force = params.force ?? false;
      const connection = getGrcConnection();
      if (connection) {
        const syncService = connection.getSyncService();
        if (syncService) {
          try {
            const result = await syncService.triggerSync();
            respond(true, {
              triggered: true,
              force,
              lastSyncAt: result.timestamp,
              updateAvailable: result.updateAvailable,
              errors: result.errors,
            });
          } catch (err) {
            respond(true, {
              triggered: false,
              force,
              message: `Sync failed: ${(err as Error).message}`,
            });
          }
          return;
        }
      }
      // Fallback: create one-shot sync
      const config = loadConfig();
      const grc = config.grc;
      try {
        const syncService = new GrcSyncService({
          enabled: grc?.enabled !== false,
          url: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc?.auth?.token,
          nodeId: connection?.getNodeId() ?? "unknown",
          syncInterval: grc?.sync?.interval ?? 14400,
          autoUpdate: grc?.sync?.autoUpdate !== false,
          shareEvolution: grc?.sync?.shareEvolution !== false,
          telemetry: grc?.sync?.telemetry ?? false,
        });
        const result = await syncService.triggerSync();
        respond(true, {
          triggered: true,
          force,
          lastSyncAt: result.timestamp,
          updateAvailable: result.updateAvailable,
          errors: result.errors,
        });
      } catch (_err) {
        respond(true, {
          triggered: true,
          force,
          message: "GRC sync triggered",
        });
      }
    },

    "grc.skills": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcSkillsParams, "grc.skills", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc?.auth?.token,
        });
        // Use search endpoint if q or tags are provided, otherwise trending
        if (params.q || params.tags) {
          const result = await client.searchSkills({
            q: params.q,
            tags: params.tags?.join(","),
            sort: params.sort,
            page: params.page,
            limit: params.limit,
          });
          respond(true, {
            skills: result.data,
            ...result.pagination,
          });
        } else {
          const limit = params.limit ?? 20;
          const result = await client.getTrendingSkills(limit);
          const skills = result.data ?? [];
          respond(true, {
            skills,
            total: skills.length,
            page: params.page ?? 1,
            limit,
          });
        }
      } catch (_err) {
        // Fallback when GRC is unreachable
        respond(true, {
          skills: [],
          total: 0,
          page: params.page ?? 1,
          limit: params.limit ?? 20,
          message: "GRC connection required",
        });
      }
    },

    "grc.evolution": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcEvolutionParams, "grc.evolution", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc?.auth?.token,
        });
        const limit = params.limit ?? 20;
        const result = await client.getPromotedAssets(limit);
        const assets = result.assets ?? [];
        respond(true, {
          assets,
          total: result.total ?? assets.length,
          limit,
        });
      } catch (_err) {
        // Fallback when GRC is unreachable
        respond(true, {
          assets: [],
          total: 0,
          limit: params.limit ?? 20,
          message: "GRC connection required",
        });
      }
    },

    "grc.telemetry": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcTelemetryParams, "grc.telemetry", respond)) {
        return;
      }
      const enabled = params.enabled ?? false;
      // Persist the telemetry toggle to config.
      const config = loadConfig();
      const nextConfig = {
        ...config,
        grc: {
          ...config.grc,
          sync: {
            ...config.grc?.sync,
            telemetry: enabled,
          },
        },
      };
      await writeConfigFile(nextConfig);
      respond(true, {
        telemetry: enabled,
        message: enabled ? "Telemetry enabled" : "Telemetry disabled",
      });
    },

    "grc.pair": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcPairParams, "grc.pair", respond)) {
        return;
      }
      const connection = getGrcConnection();
      if (!connection) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "GRC connection not available"));
        return;
      }
      try {
        const result = await connection.pairWithEmail(params.email);
        respond(true, result);
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Pairing failed: ${(err as Error).message}`));
      }
    },

    "grc.pairVerify": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcPairVerifyParams, "grc.pairVerify", respond)) {
        return;
      }
      const connection = getGrcConnection();
      if (!connection) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "GRC connection not available"));
        return;
      }
      try {
        const result = await connection.verifyPairing(params.email, params.code);
        respond(true, result);
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Verification failed: ${(err as Error).message}`));
      }
    },

    // ---- Skill Marketplace handlers -----------------------------------------

    "grc.skills.search": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcSkillsSearchParams, "grc.skills.search", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc?.auth?.token,
        });
        const result = await client.searchSkills({
          q: params.q,
          tags: params.tags?.join(","),
          sort: params.sort,
          page: params.page,
          limit: params.limit,
        });
        respond(true, {
          skills: result.data,
          ...result.pagination,
        });
      } catch (_err) {
        respond(true, {
          skills: [],
          total: 0,
          page: params.page ?? 1,
          limit: params.limit ?? 20,
          totalPages: 0,
          message: "GRC connection required",
        });
      }
    },

    "grc.skills.detail": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcSkillsDetailParams, "grc.skills.detail", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc?.auth?.token,
        });
        const detail = await client.getSkillBySlug(params.slug);
        const manifest = getOrCreateManifest(getSkillManifest);
        const installed = manifest.getInstalled(params.slug);
        respond(true, {
          ...detail,
          installed: installed !== null,
          installedVersion: installed?.installedVersion ?? null,
          autoUpdate: installed?.autoUpdate ?? null,
        });
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Failed to get skill detail: ${(err as Error).message}`));
      }
    },

    "grc.skills.versions": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcSkillsVersionsParams, "grc.skills.versions", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc?.auth?.token,
        });
        const result = await client.getSkillVersions(params.slug);
        respond(true, { versions: result.data ?? [] });
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Failed to get versions: ${(err as Error).message}`));
      }
    },

    "grc.skills.install": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcSkillsInstallGrcParams, "grc.skills.install", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc?.auth?.token,
        });
        const manifest = getOrCreateManifest(getSkillManifest);

        // If version not specified, fetch latest from GRC
        let version = params.version;
        let name = params.slug;
        let expectedChecksum: string | undefined;
        if (!version) {
          const detail = await client.getSkillBySlug(params.slug);
          version = detail.latestVersionInfo?.version ?? detail.latestVersion ?? "";
          name = detail.name;
          expectedChecksum = detail.latestVersionInfo?.checksumSha256;
          if (!version) {
            respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "No version available for this skill"));
            return;
          }
        }

        const result = await installGrcSkill({
          client,
          manifest,
          slug: params.slug,
          version,
          name,
          expectedChecksum,
        });
        respond(result.ok, result.ok ? result : undefined,
          result.ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, result.message));
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Install failed: ${(err as Error).message}`));
      }
    },

    "grc.skills.update": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcSkillsUpdateGrcParams, "grc.skills.update", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc?.auth?.token,
        });
        const manifest = getOrCreateManifest(getSkillManifest);

        // Determine which skills to update
        const slugsToUpdate: string[] = [];
        if (params.slug) {
          slugsToUpdate.push(params.slug);
        } else {
          // Update all outdated skills
          const outdated = manifest.listOutdated();
          for (const s of outdated) slugsToUpdate.push(s.slug);
        }

        if (slugsToUpdate.length === 0) {
          respond(true, { updated: 0, message: "All skills are up to date" });
          return;
        }

        const results: { slug: string; ok: boolean; message: string }[] = [];
        for (const slug of slugsToUpdate) {
          const detail = await client.getSkillBySlug(slug);
          const targetVersion = params.version ?? detail.latestVersionInfo?.version ?? detail.latestVersion ?? "";
          if (!targetVersion) {
            results.push({ slug, ok: false, message: "No version available" });
            continue;
          }
          const installResult = await updateGrcSkill({
            client,
            manifest,
            slug,
            version: targetVersion,
            name: detail.name,
            expectedChecksum: detail.latestVersionInfo?.checksumSha256,
          });
          results.push({ slug, ok: installResult.ok, message: installResult.message });
        }

        const updated = results.filter((r) => r.ok).length;
        respond(true, { updated, total: results.length, results });
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Update failed: ${(err as Error).message}`));
      }
    },

    "grc.skills.uninstall": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcSkillsUninstallGrcParams, "grc.skills.uninstall", respond)) {
        return;
      }
      try {
        const manifest = getOrCreateManifest(getSkillManifest);
        const result = uninstallGrcSkill(manifest, params.slug);
        respond(result.ok, result.ok ? result : undefined,
          result.ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, result.message));
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Uninstall failed: ${(err as Error).message}`));
      }
    },

    "grc.skills.installed": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcSkillsInstalledParams, "grc.skills.installed", respond)) {
        return;
      }
      try {
        const manifest = getOrCreateManifest(getSkillManifest);
        const skills = manifest.listInstalled();
        const outdated = manifest.listOutdated();
        respond(true, {
          skills,
          total: skills.length,
          outdatedCount: outdated.length,
          managedSkillsDir: getDefaultManagedSkillsDir(),
        });
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Failed to list installed skills: ${(err as Error).message}`));
      }
    },

    "grc.skills.recommended": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcSkillsRecommendedParams, "grc.skills.recommended", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc?.auth?.token,
        });
        const result = await client.getRecommendedSkills({
          limit: params.limit,
          strategy: params.strategy,
          platform: params.platform,
        });
        respond(true, { skills: result.data ?? [], total: (result.data ?? []).length });
      } catch (_err) {
        respond(true, {
          skills: [],
          total: 0,
          message: "GRC connection required",
        });
      }
    },

    // ---- Publish & Rate handlers -------------------------------------------

    "grc.skills.publish": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcSkillsPublishParams, "grc.skills.publish", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      if (!grc?.auth?.token) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "GRC authentication required to publish skills"));
        return;
      }
      // Read tarball from disk
      let tarball: Buffer;
      try {
        tarball = fs.readFileSync(params.tarballPath);
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `Failed to read tarball: ${(err as Error).message}`));
        return;
      }
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc.auth.token,
        });
        const result = await client.publishSkill({
          slug: params.slug,
          name: params.name,
          description: params.description,
          version: params.version,
          tags: params.tags,
          changelog: params.changelog,
          tarball,
        });
        respond(true, result);
      } catch (err) {
        const msg = (err as Error).message ?? "Failed to publish skill";
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, msg));
      }
    },

    "grc.skills.rate": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcSkillsRateParams, "grc.skills.rate", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      if (!grc?.auth?.token) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "GRC authentication required to rate skills"));
        return;
      }
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc.auth.token,
        });
        const result = await client.rateSkill({
          slug: params.slug,
          rating: params.rating,
          review: params.review,
        });
        respond(true, result);
      } catch (err) {
        const msg = (err as Error).message ?? "Failed to rate skill";
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, msg));
      }
    },

    // ---- Community handlers ------------------------------------------------

    "grc.community.channels": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcCommunityChannelsParams, "grc.community.channels", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc?.auth?.token,
        });
        const result = await client.getCommunityChannels(params.page ?? 1, params.limit ?? 20);
        respond(true, result);
      } catch (_err) {
        respond(true, { channels: [], total: 0, page: 1, totalPages: 0, message: "GRC connection required" });
      }
    },

    "grc.community.feed": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcCommunityFeedParams, "grc.community.feed", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc?.auth?.token,
        });
        const result = await client.getCommunityFeed({
          sort: params.sort,
          channelId: params.channelId,
          page: params.page,
          limit: params.limit,
        });
        respond(true, result);
      } catch (_err) {
        respond(true, { posts: [], total: 0, page: 1, totalPages: 0, message: "GRC connection required" });
      }
    },

    "grc.community.post": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcCommunityPostParams, "grc.community.post", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc?.auth?.token,
        });
        const result = await client.getCommunityPost(params.id);
        respond(true, result);
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Failed to get post: ${(err as Error).message}`));
      }
    },

    "grc.community.replies": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcCommunityRepliesParams, "grc.community.replies", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc?.auth?.token,
        });
        const result = await client.getCommunityReplies(params.postId, params.page ?? 1, params.limit ?? 20);
        respond(true, result);
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Failed to get replies: ${(err as Error).message}`));
      }
    },

    "grc.community.createPost": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcCommunityCreatePostParams, "grc.community.createPost", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      if (!grc?.auth?.token) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "Authentication required to create posts"));
        return;
      }
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc.auth.token,
        });
        const result = await client.createCommunityPost({
          channelId: params.channelId,
          postType: params.postType,
          title: params.title,
          body: params.body,
          tags: params.tags,
          contextData: params.contextData,
          codeSnippets: params.codeSnippets,
          relatedAssets: params.relatedAssets,
        });
        respond(true, result);
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Failed to create post: ${(err as Error).message}`));
      }
    },

    "grc.community.reply": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcCommunityReplyParams, "grc.community.reply", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      if (!grc?.auth?.token) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "Authentication required to reply"));
        return;
      }
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc.auth.token,
        });
        const result = await client.createCommunityReply(params.postId, {
          content: params.content,
          parentReplyId: params.parentReplyId,
        });
        respond(true, result);
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Failed to reply: ${(err as Error).message}`));
      }
    },

    "grc.community.vote": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcCommunityVoteParams, "grc.community.vote", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      if (!grc?.auth?.token) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "Authentication required to vote"));
        return;
      }
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc.auth.token,
        });
        const result = await client.voteCommunityPost(params.postId, params.direction);
        respond(true, result);
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Failed to vote: ${(err as Error).message}`));
      }
    },

    "grc.community.stats": async ({ params, respond }) => {
      if (!assertValidParams(params, validateGrcCommunityStatsParams, "grc.community.stats", respond)) {
        return;
      }
      const config = loadConfig();
      const grc = config.grc;
      try {
        const client = new GrcClient({
          baseUrl: grc?.url ?? GRC_DEFAULT_URL,
          authToken: grc?.auth?.token,
        });
        const result = await client.getCommunityStats();
        respond(true, result);
      } catch (_err) {
        respond(true, { stats: {}, message: "GRC connection required" });
      }
    },

    "grc.community.autoStatus": async ({ respond }) => {
      const connection = getGrcConnection();
      const autoPost = connection?.getAutoPostService();
      const replyWorker = connection?.getReplyWorker();
      const config = loadConfig();
      const community = config.grc?.community;

      respond(true, {
        autoPost: {
          enabled: community?.autoPost ?? false,
          running: autoPost?.isRunning() ?? false,
          recentPosts: autoPost?.getPostLog() ?? [],
        },
        autoReply: {
          enabled: community?.autoReply ?? false,
          cronSchedule: community?.replyCronSchedule ?? "0 3 * * *",
          lastResult: replyWorker?.getLastResult() ?? null,
        },
        autoVote: {
          enabled: community?.autoVote ?? false,
        },
      });
    },

    "grc.community.triggerReply": async ({ respond }) => {
      const connection = getGrcConnection();
      if (!connection) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "GRC connection not available"));
        return;
      }
      try {
        const result = await connection.triggerReplyCycle();
        if (!result) {
          respond(true, { message: "Reply worker not enabled. Set grc.community.autoReply = true." });
          return;
        }
        respond(true, result);
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Reply cycle failed: ${(err as Error).message}`));
      }
    },
  };
}
