import { z } from "zod";
import { falkordbInstanceSchema } from "./falkordb-instance.js";

export const siteSettingsSchema = z.object({
  email: z.string().email(),
  password: z.string().nonempty(),
  instances: z.array(falkordbInstanceSchema).default([]),
});
