import { Type } from "@sinclair/typebox";

// ---------- grc.status ----------
export const GrcStatusParamsSchema = Type.Object({}, { additionalProperties: false });

// ---------- grc.login ----------
export const GrcLoginParamsSchema = Type.Object(
  {
    provider: Type.Optional(
      Type.Union([Type.Literal("github"), Type.Literal("google")], {
        default: "github",
      }),
    ),
  },
  { additionalProperties: false },
);

// ---------- grc.logout ----------
export const GrcLogoutParamsSchema = Type.Object({}, { additionalProperties: false });

// ---------- grc.sync ----------
export const GrcSyncParamsSchema = Type.Object(
  {
    force: Type.Optional(Type.Boolean({ default: false })),
  },
  { additionalProperties: false },
);

// ---------- grc.skills ----------
export const GrcSkillsParamsSchema = Type.Object(
  {
    q: Type.Optional(Type.String()),
    tags: Type.Optional(Type.Array(Type.String())),
    sort: Type.Optional(Type.String()),
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);

// ---------- grc.evolution ----------
export const GrcEvolutionParamsSchema = Type.Object(
  {
    signals: Type.Optional(Type.Array(Type.String())),
    status: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);

// ---------- grc.telemetry ----------
export const GrcTelemetryParamsSchema = Type.Object(
  {
    enabled: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

// ---------- grc.pair ----------
export const GrcPairParamsSchema = Type.Object(
  {
    email: Type.String(),
  },
  { additionalProperties: false },
);

// ---------- grc.pairVerify ----------
export const GrcPairVerifyParamsSchema = Type.Object(
  {
    email: Type.String(),
    code: Type.String({ minLength: 6, maxLength: 6, pattern: "^\\d{6}$" }),
  },
  { additionalProperties: false },
);

// ---------- grc.community.channels ----------
export const GrcCommunityChannelsParamsSchema = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);

// ---------- grc.community.feed ----------
export const GrcCommunityFeedParamsSchema = Type.Object(
  {
    sort: Type.Optional(
      Type.Union([
        Type.Literal("hot"),
        Type.Literal("new"),
        Type.Literal("top"),
        Type.Literal("relevant"),
      ]),
    ),
    channelId: Type.Optional(Type.String()),
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);

// ---------- grc.community.post ----------
export const GrcCommunityPostParamsSchema = Type.Object(
  {
    id: Type.String(),
  },
  { additionalProperties: false },
);

// ---------- grc.community.replies ----------
export const GrcCommunityRepliesParamsSchema = Type.Object(
  {
    postId: Type.String(),
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);

// ---------- grc.community.createPost ----------
export const GrcCommunityCreatePostParamsSchema = Type.Object(
  {
    channelId: Type.String(),
    postType: Type.Union([
      Type.Literal("problem"),
      Type.Literal("solution"),
      Type.Literal("evolution"),
      Type.Literal("experience"),
      Type.Literal("alert"),
      Type.Literal("discussion"),
    ]),
    title: Type.String({ minLength: 1, maxLength: 200 }),
    body: Type.String({ minLength: 1, maxLength: 10000 }),
    tags: Type.Optional(Type.Array(Type.String(), { maxItems: 10 })),
    contextData: Type.Optional(Type.Unknown()),
    codeSnippets: Type.Optional(Type.Array(Type.Unknown())),
    relatedAssets: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

// ---------- grc.community.reply ----------
export const GrcCommunityReplyParamsSchema = Type.Object(
  {
    postId: Type.String(),
    content: Type.String({ minLength: 1, maxLength: 5000 }),
    parentReplyId: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

// ---------- grc.community.vote ----------
export const GrcCommunityVoteParamsSchema = Type.Object(
  {
    postId: Type.String(),
    direction: Type.Union([Type.Literal("up"), Type.Literal("down")]),
  },
  { additionalProperties: false },
);

// ---------- grc.community.stats ----------
export const GrcCommunityStatsParamsSchema = Type.Object({}, { additionalProperties: false });

// =====================================================================
// GRC Skill Marketplace methods
// =====================================================================

// ---------- grc.skills.search ----------
export const GrcSkillsSearchParamsSchema = Type.Object(
  {
    q: Type.Optional(Type.String()),
    tags: Type.Optional(Type.Array(Type.String())),
    sort: Type.Optional(Type.String()),
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);

// ---------- grc.skills.detail ----------
export const GrcSkillsDetailParamsSchema = Type.Object(
  {
    slug: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

// ---------- grc.skills.versions ----------
export const GrcSkillsVersionsParamsSchema = Type.Object(
  {
    slug: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

// ---------- grc.skills.install ----------
export const GrcSkillsInstallGrcParamsSchema = Type.Object(
  {
    slug: Type.String({ minLength: 1 }),
    version: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

// ---------- grc.skills.update ----------
export const GrcSkillsUpdateGrcParamsSchema = Type.Object(
  {
    slug: Type.Optional(Type.String()),
    version: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

// ---------- grc.skills.uninstall ----------
export const GrcSkillsUninstallGrcParamsSchema = Type.Object(
  {
    slug: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

// ---------- grc.skills.installed ----------
export const GrcSkillsInstalledParamsSchema = Type.Object({}, { additionalProperties: false });

// ---------- grc.skills.recommended ----------
export const GrcSkillsRecommendedParamsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
    strategy: Type.Optional(
      Type.Union([
        Type.Literal("collaborative"),
        Type.Literal("content"),
        Type.Literal("trending"),
        Type.Literal("cold_start"),
        Type.Literal("auto"),
      ]),
    ),
    platform: Type.Optional(
      Type.Union([
        Type.Literal("win32"),
        Type.Literal("darwin"),
        Type.Literal("linux"),
      ]),
    ),
  },
  { additionalProperties: false },
);

// ---------- grc.skills.publish ----------
export const GrcSkillsPublishParamsSchema = Type.Object(
  {
    slug: Type.String({ minLength: 1, maxLength: 255, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
    name: Type.String({ minLength: 1, maxLength: 255 }),
    description: Type.String({ minLength: 1, maxLength: 10000 }),
    version: Type.String({ minLength: 1, maxLength: 50 }),
    tags: Type.Array(Type.String(), { maxItems: 20 }),
    changelog: Type.Optional(Type.String({ maxLength: 10000 })),
    tarballPath: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

// ---------- grc.skills.rate ----------
export const GrcSkillsRateParamsSchema = Type.Object(
  {
    slug: Type.String({ minLength: 1 }),
    rating: Type.Integer({ minimum: 1, maximum: 5 }),
    review: Type.Optional(Type.String({ maxLength: 5000 })),
  },
  { additionalProperties: false },
);
