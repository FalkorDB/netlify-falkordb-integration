import { z } from "zod";

export const falkordbInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  cloudProvider: z.string(),
  region: z.string(),
  username: z.string(),
  hostname: z.string().optional(),
  port: z.number().optional(),
  idx: z.number(),
});

export type FalkorDBInstance = z.infer<typeof falkordbInstanceSchema>;

export const addInstanceSchema = z.object({
  instanceId: z.string(),
  username: z.string(),
  password: z.string(),
});
