import { z } from 'zod';

export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[^\d]/g, '').replace(/^86(?=1\d{10}$)/, ''))
  .refine((value) => /^1[3-9]\d{9}$/.test(value), '请输入有效的中国大陆手机号');

export const codeSchema = z.string().trim().regex(/^\d{6}$/, '验证码必须是 6 位数字');

export const passwordSchema = z
  .string()
  .min(8, '密码至少 8 位')
  .max(72, '密码过长')
  .regex(/[A-Za-z]/, '密码需要包含字母')
  .regex(/\d/, '密码需要包含数字');

export const requestCodeSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(['register', 'login', 'reset']).default('login'),
});

export const registerSchema = z.object({
  phone: phoneSchema,
  code: codeSchema,
  name: z.string().trim().min(1, '请填写称呼').max(60),
  password: passwordSchema.optional(),
});

export const loginCodeSchema = z.object({
  phone: phoneSchema,
  code: codeSchema,
});

export const loginPasswordSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1).max(72),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  avatarAssetId: z.string().uuid().nullable().optional(),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(72).optional(),
  confirm: z.literal('DELETE'),
});

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(1000).optional(),
});

export const projectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
});

const nodeSchema = z
  .object({
    id: z.string().min(1).max(80),
    type: z.enum(['prompt', 'text', 'image', 'video', 'audio', 'model']),
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().min(80).max(1000),
    ratio: z.number().positive().max(10).optional(),
    title: z.string().max(120).optional(),
    text: z.string().max(20_000).optional(),
    src: z.string().max(3_000_000).optional(),
    assetId: z.string().max(80).nullable().optional(),
    mediaType: z.enum(['image', 'video', 'audio']).optional(),
    modelId: z.string().max(80).optional(),
    status: z.enum(['idle', 'queued', 'running', 'succeeded', 'error']).optional(),
    progress: z.number().min(0).max(100).optional(),
    error: z.string().max(2000).optional(),
    isDemo: z.boolean().optional(),
  })
  .passthrough();

const edgeSchema = z
  .object({
    id: z.string().min(1).max(80),
    from: z.string().min(1).max(80),
    to: z.string().min(1).max(80),
  })
  .passthrough();

const groupSchema = z
  .object({
    id: z.string().min(1).max(80),
    title: z.string().max(80).optional(),
    nodeIds: z.array(z.string().min(1).max(80)).max(500),
  })
  .passthrough();

export const graphSchema = z.object({
  nodes: z.array(nodeSchema).max(500),
  edges: z.array(edgeSchema).max(1000),
  groups: z.array(groupSchema).max(100),
  view: z.object({ x: z.number(), y: z.number(), k: z.number().min(0.05).max(5) }).optional(),
  name: z.string().max(120).optional(),
  version: z.number().optional(),
});

export const saveCanvasSchema = z.object({
  baseVersion: z.number().int().min(1),
  graph: graphSchema,
  snapshot: z.boolean().optional(),
  label: z.string().max(80).optional(),
});

export const restoreVersionSchema = z.object({
  baseVersion: z.number().int().min(1),
  label: z.string().max(80).optional(),
});

export const assetPresignSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  size: z.number().int().positive().max(60 * 1024 * 1024),
  projectId: z.string().uuid().optional().nullable(),
});

export const assetCompleteSchema = z.object({
  assetId: z.string().uuid(),
});

export const jobCreateSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  canvasId: z.string().uuid().optional().nullable(),
  nodeId: z.string().max(80).optional().nullable(),
  model: z.string().min(1).max(80),
  kind: z.enum(['text_to_video', 'image_to_video', 'text_to_image']),
  prompt: z.string().trim().min(1).max(5000),
  params: z
    .object({
      ratio: z.string().max(20).optional(),
      duration: z.number().min(1).max(30).optional(),
      resolution: z.string().max(20).optional(),
      imageAssetId: z.string().uuid().optional().nullable(),
    })
    .passthrough()
    .optional(),
  idempotencyKey: z.string().max(120).optional(),
});
