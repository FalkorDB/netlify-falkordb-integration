import axios from "axios";
import z from "zod";
import { falkordbInstanceSchema, type FalkorDBInstance } from "./schema/falkordb-instance.js";

export const getFalkorDBAdminToken = async () => {
  try {
    const response = await axios.get(
      "https://auth-425012726186.europe-west1.run.app/omnistrate/token",
      {
        headers: {
          Authorization: `${process.env.FALKORDB_AUTH_API_KEY}`,
        },
      }
    );
    console.log("response", response);

    return response.data;
  } catch (error) {
    console.error("error", error);

    throw (error as any).response.data;
  }
};

export const getFalkorDBUserToken = async (
  token: string,
  email: string,
  password: string
) => {
  try {
    const response = await axios.post(
      "https://api.omnistrate.cloud/2022-09-01-00/customer-user-signin",
      {
        email,
        password,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("response", response);

    return response.data.jwtToken;
  } catch (error) {
    console.error("error", error);
    throw (error as any).response.data;
  }
};

export const getUserSubscriptions = async (
  userToken: string
): Promise<string[]> => {
  try {
    const response = await axios.post(
      "https://app.falkordb.cloud/api/action?endpoint=%2Fsubscription",
      {
        endpoint: "/subscription",
        method: "GET",
        queryParams: {
          environmentType: "PROD",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("response", response);

    return response.data.ids;
  } catch (error) {
    console.error("error", error);
    throw (error as any).response.data;
  }
};

export const getUserInstancesInSubscription = async (
  adminToken: string,
  subscriptionId: string
): Promise<FalkorDBInstance[]> => {
  try {
    const response = await axios.get(
      `https://api.omnistrate.cloud/2022-09-01-00/fleet/service/${process.env.FALKORDB_SERVICE_ID}/environment/${process.env.FALKORDB_ENVIRONMENT_ID}/instances?SubscriptionId=${subscriptionId}`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    console.log("response", response.data);
    

    return (
      response.data?.resourceInstances
        ?.map((instance: any) => ({
          id: instance["consumptionResourceInstanceResult"].id,
          name:
            instance["consumptionResourceInstanceResult"]?.["result_params"]
              ?.name ?? "",
          cloudProvider:
            instance["consumptionResourceInstanceResult"].cloud_provider,
          region: instance["consumptionResourceInstanceResult"].region,
          status: instance["consumptionResourceInstanceResult"].status,
        }))
        .filter((instance: any) => instance.status === "RUNNING") ?? []
    );
  } catch (error) {
    console.error("error", error);
    throw (error as any).response.data;
  }
};


export const getAllUserInstances = async (
  adminToken: string,
  userToken: string
): Promise<FalkorDBInstance[]> => {
  try {
    const subscriptions = await getUserSubscriptions(userToken);

    const instances = await Promise.all(
      subscriptions.map((subscriptionId) =>
        getUserInstancesInSubscription(adminToken, subscriptionId)
      )
    );

    return instances.flat();
  } catch (error) {
    console.error("error", error);
    throw (error as any).response.data;
  }
}

export const getInstance = async (
  adminToken: string,
  instanceId: string
): Promise<{
  id: string;
  name: string;
  cloudProvider: string;
  region: string;
  hostname: string;
  port: number;
  username: string;
}> => {
  try {
    const response = await axios.get(
      `https://api.omnistrate.cloud/2022-09-01-00/fleet/service/${process.env.FALKORDB_SERVICE_ID}/environment/${process.env.FALKORDB_ENVIRONMENT_ID}/instance/${instanceId}`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    const data = response.data;

    const resourceKey = Object.entries(
      data["consumptionResourceInstanceResult"]?.["detailedNetworkTopology"] ??
        {}
    ).filter(
      ([_, value]) =>
        (value as any)?.["clusterEndpoint"] &&
        !(value as any)?.["resourceName"]?.startsWith("Omnistrate")
    )[0][0] as string;

    return {
      id: data["consumptionResourceInstanceResult"].id,
      name:
        data["consumptionResourceInstanceResult"]?.["result_params"]?.name ??
        "",
      cloudProvider: data["consumptionResourceInstanceResult"].cloud_provider,
      region: data["consumptionResourceInstanceResult"].region,
      username:
        data["consumptionResourceInstanceResult"]?.["result_params"]
          ?.username ?? "",
      hostname:
        data["consumptionResourceInstanceResult"]?.[
          "detailedNetworkTopology"
        ]?.[resourceKey]?.["clusterEndpoint"] ?? "",
      port:
        data["consumptionResourceInstanceResult"]?.[
          "detailedNetworkTopology"
        ]?.[resourceKey]?.["clusterPorts"]?.[0] ?? 0,
    };
  } catch (error) {
    console.error("error", error);
    throw (error as any).response.data;
  }
};
