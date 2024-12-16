import { TRPCError } from "@trpc/server";
import { procedure, router } from "./trpc.js";
import z from "zod";
import { siteSettingsSchema } from "../schema/site-configuration.js";
import {
  addInstanceSchema,
  type FalkorDBInstance,
} from "../schema/falkordb-instance.js";
import {
  getFalkorDBAdminToken,
  getFalkorDBUserToken,
  getAllUserInstances,
  getUserInstancesInSubscription,
  getUserSubscriptions,
} from "../utils.js";

export const appRouter = router({
  siteSettings: {
    query: procedure.query(async ({ ctx: { teamId, siteId, client } }) => {
      if (!teamId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "teamId is required",
        });
      }
      if (!siteId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "siteId is required",
        });
      }
      const siteConfig = await client.getSiteConfiguration(teamId, siteId);
      if (!siteConfig) {
        return {
          email: null,
        };
      }
      const result = siteSettingsSchema.safeParse(siteConfig.config);
      if (!result.success) {
        console.warn(
          "Failed to parse team settings",
          JSON.stringify(result.error, null, 2)
        );
      }
      return result.data;
    }),

    setAccount: procedure
      .input(siteSettingsSchema)
      .mutation(async ({ ctx: { teamId, siteId, client }, input }) => {
        if (!teamId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "teamId is required",
          });
        }
        if (!siteId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "siteId is required",
          });
        }

        try {
          // Validate the FalkorDB credentials
          const token = await getFalkorDBAdminToken();

          await getFalkorDBUserToken(token, input.email, input.password);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid FalkorDB credentials",
            cause: error,
          });
        }

        try {
          const existingConfig = await client.getSiteConfiguration(
            teamId,
            siteId
          );
          if (!existingConfig) {
            await client.createSiteConfiguration(teamId, siteId, input);
          } else {
            await client.updateSiteConfiguration(teamId, siteId, {
              ...(existingConfig?.config || {}),
              ...input,
            });
          }
        } catch (e) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to save site configuration",
            cause: e,
          });
        }
      }),

    delete: procedure.mutation(async ({ ctx: { teamId, siteId, client } }) => {
      if (!teamId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "teamId is required",
        });
      }
      if (!siteId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "siteId is required",
        });
      }
      await client.deleteSiteConfiguration(teamId, siteId);
    }),
  },

  listFalkorDBInstances: procedure.query(
    async ({ ctx: { teamId, siteId, client } }) => {
      if (!teamId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "teamId is required",
        });
      }
      if (!siteId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "siteId is required",
        });
      }

      // get configuration
      const siteConfig = await client.getSiteConfiguration(teamId, siteId);

      if (!siteConfig) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Site configuration not found",
        });
      }
      const result = siteSettingsSchema.safeParse(siteConfig.config);

      if (!result.success || !result.data?.email || !result.data?.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid site configuration",
        });
      }

      // get user credentials
      let adminToken: string;
      try {
        adminToken = await getFalkorDBAdminToken();
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid FalkorDB credentials",
          cause: error,
        });
      }

      let userToken: string;
      try {
        userToken = await getFalkorDBUserToken(
          adminToken,
          result.data?.email!,
          result.data?.password!
        );
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid FalkorDB credentials",
          cause: error,
        });
      }

      let instances: FalkorDBInstance[] = [];
      try {
        instances = await getAllUserInstances(adminToken, userToken);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to get user instances",
          cause: error,
        });
      }

      return instances;
    }
  ),

  instances: {
    add: procedure
      .input(addInstanceSchema)
      .mutation(
        async ({
          ctx: { teamId, siteId, client,  },
          input: { instanceId, username, password },
        }) => {
          if (!teamId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "teamId is required",
            });
          }
          if (!siteId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "siteId is required",
            });
          }

          // get configuration
          const siteConfig = await client.getSiteConfiguration(teamId, siteId);

          if (!siteConfig) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Site configuration not found",
            });
          }
          const result = siteSettingsSchema.safeParse(siteConfig.config);

          if (
            !result.success ||
            !result.data?.email ||
            !result.data?.password
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid site configuration",
            });
          }

          if (result.data.instances.some((i) => i.id === instanceId)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Instance already added",
            });
          }

          // get user credentials
          let adminToken: string;
          try {
            adminToken = await getFalkorDBAdminToken();
          } catch (error) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid FalkorDB credentials",
              cause: error,
            });
          }

          let userToken: string;
          try {
            userToken = await getFalkorDBUserToken(
              adminToken,
              result.data?.email!,
              result.data?.password!
            );
          } catch (error) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid FalkorDB credentials",
              cause: error,
            });
          }

          let instances: FalkorDBInstance[] = [];
          try {
            instances = await getAllUserInstances(adminToken, userToken);
          } catch (error) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Failed to get user instances",
              cause: error,
            });
          }

          const instance = instances.find((i) => i.id === instanceId);

          if (!instance) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Instance not found",
            });
          }

          // save instance
          const i = result.data.instances.length;
          const newInstances = [
            ...result.data.instances,
            {
              ...instance,
              username,
              password,
              idx: i,
            },
          ];

          await client.updateSiteConfiguration(teamId, siteId, {
            ...result.data,
            instances: newInstances,
          });

          const envVarPrefix = i === 0 ? "FALKORDB_" : `FALKORDB_${i}_`;

          // set variables
          try {
            await client.createOrUpdateVariables({
              accountId: teamId,
              siteId,
              variables: {
                [`${envVarPrefix}HOSTNAME`]: instance.hostname || "",
                [`${envVarPrefix}PORT`]: `${instance.port || ""}`,
                [`${envVarPrefix}USERNAME`]: username,
                [`${envVarPrefix}PASSWORD`]: password,
              },
              isSecret: true,
            });
          } catch (error) {
            console.error("Failed to set environment variables", error);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to set environment variables",
              cause: error,
            });
          }
        }
      ),

    remove: procedure
      .input(z.object({ instanceId: z.string() }))
      .mutation(async ({ ctx: { teamId, siteId, client }, input }) => {
        if (!teamId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "teamId is required",
          });
        }
        if (!siteId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "siteId is required",
          });
        }

        // get configuration
        const siteConfig = await client.getSiteConfiguration(teamId, siteId);

        if (!siteConfig) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Site configuration not found",
          });
        }
        const result = siteSettingsSchema.safeParse(siteConfig.config);

        if (!result.success || !result.data?.email || !result.data?.password) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid site configuration",
          });
        }

        const instance = result.data.instances.find(
          (i) => i.id === input.instanceId
        );
        if (!instance) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Instance not found",
          });
        }

        const newInstances = result.data.instances.filter(
          (i) => i.id !== input.instanceId
        );

        await client.updateSiteConfiguration(teamId, siteId, {
          ...result.data,
          instances: newInstances,
        });

        const envVarPrefix =
          instance.idx > 0 ? `FALKORDB_${instance.idx}_` : "FALKORDB_";

        // remove variables
        try {
          await client.deleteEnvironmentVariables({
            accountId: teamId,
            siteId,
            variables: [
              `${envVarPrefix}HOSTNAME`,
              `${envVarPrefix}PORT`,
              `${envVarPrefix}USERNAME`,
              `${envVarPrefix}PASSWORD`,
            ],
          });
        } catch (error) {
          console.error("Failed to delete environment variables", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete environment variables",
            cause: error,
          });
        }
      }),
  },
});

export type AppRouter = typeof appRouter;
