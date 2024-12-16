import {
  Card,
  CardTitle,
  CardLoader,
  SiteConfigurationSurface,
  Form,
  FormField,
  FormFieldSecret,
  Button,
  Select,
  CardFooter,
  DecorativeIcon,
  CodeBlock,
} from "@netlify/sdk/ui/react/components";
import { trpc } from "../trpc";
import { siteSettingsSchema } from "../../schema/site-configuration";
import { addInstanceSchema } from "../../schema/falkordb-instance";
import type { FalkorDBInstance } from "../../schema/falkordb-instance";
import { useState } from "react";
import { generateClientCode } from "../../utils";

export const Loading = () => {
  return (
    <SiteConfigurationSurface>
      <CardLoader />
    </SiteConfigurationSurface>
  );
};

export const Error = ({ message }: { message: string }) => {
  return (
    <SiteConfigurationSurface>
      <Card>{message}</Card>
    </SiteConfigurationSurface>
  );
};

export const ConnectAccount = ({
  onSubmitted,
}: {
  onSubmitted?: () => any;
}) => {
  const siteSettingsMutation = trpc.siteSettings.setAccount.useMutation({
    onSettled: () => {
      onSubmitted?.();
    },
  });

  return (
    <SiteConfigurationSurface>
      <Card>
        <CardTitle>Connect to your FalkorDB Cloud Account</CardTitle>
        <p>
          To get started, connect your FalkorDB Cloud account to Netlify. This
          will allow you to manage your site configuration.
        </p>
        <br />
        <Form
          schema={siteSettingsSchema}
          onSubmit={siteSettingsMutation.mutateAsync}
        >
          <FormField
            label="Email"
            name="email"
            type="text"
            helpText="Your FalkorDB Cloud email"
            required
          />
          <FormFieldSecret
            label="Password"
            name="password"
            type="password"
            helpText="Your FalkorDB Cloud password"
            required
          />
        </Form>
      </Card>
    </SiteConfigurationSurface>
  );
};

export const InstanceCard = ({
  instance,
  removeInstanceCallback,
}: {
  instance: FalkorDBInstance;
  removeInstanceCallback: any;
}) => {
  const [showSnippet, setShowSnippet] = useState(false);

  const deleteInstanceMutation = trpc.instances.remove.useMutation({
    onSettled: () => {
      removeInstanceCallback();
    },
  });

  return (
    <Card>
      <CardTitle>{instance.name}</CardTitle>
      <p>
        <b>Instance ID: </b>
        {instance.id}
      </p>
      <p>
        <b>Cloud Provider: </b>
        {instance.cloudProvider}
      </p>
      <p>
        <b>Region: </b>
        {instance.region}
      </p>
      <div className="tw-mt-4">
        <label
          onClick={() => setShowSnippet(!showSnippet)}
          className="tw-cursor-pointer"
        >
          <DecorativeIcon
            name="caret-down"
            className={showSnippet ? "tw-rotate-180" : ""}
          ></DecorativeIcon>{" "}
          {showSnippet ? "Hide" : "Show"} snippet
        </label>
        {showSnippet && (
          <CodeBlock content={generateClientCode(instance.idx)} language="ts"></CodeBlock>
        )}
      </div>
      <CardFooter>
        <Button
          variant="danger"
          loading={deleteInstanceMutation.isPending}
          onClick={() =>
            deleteInstanceMutation.mutateAsync({
              instanceId: instance.id,
            })
          }
        >
          Remove
        </Button>
      </CardFooter>
    </Card>
  );
};

export const InstancesList = ({
  instances,
  addInstanceButtonCallback,
  removeInstanceCallback,
}: {
  instances: FalkorDBInstance[];
  addInstanceButtonCallback: any;
  removeInstanceCallback: any;
}) => {
  if (!instances.length) {
    return (
      <div className="tw-text-center tw-my-4">
        <h3 className="tw-mb-4">No instances connected</h3>
        <AddInstanceButton
          addInstanceButtonCallback={() => addInstanceButtonCallback()}
        ></AddInstanceButton>
      </div>
    );
  }
  return (
    <div>
      {instances.map((instance) => {
        return (
          <InstanceCard
            key={instance.id}
            instance={instance}
            removeInstanceCallback={() => removeInstanceCallback()}
          ></InstanceCard>
        );
      })}
    </div>
  );
};

export const AddInstanceButton = ({
  addInstanceButtonCallback,
}: {
  addInstanceButtonCallback: any;
}) => {
  return (
    <Button onClick={() => addInstanceButtonCallback()}>Add instance</Button>
  );
};

export const AddInstanceForm = ({
  instanceAddedCallback,
}: {
  instanceAddedCallback: any;
}) => {
  const listFalkorDBInstancesQuery = trpc.listFalkorDBInstances.useQuery();
  const addInstanceMutation = trpc.instances.add.useMutation({
    onSuccess: () => {
      instanceAddedCallback();
    },
  });

  if (listFalkorDBInstancesQuery.isLoading || addInstanceMutation.isPending) {
    return <Loading />;
  }

  if (listFalkorDBInstancesQuery.error) {
    return <Error message={listFalkorDBInstancesQuery.error.message} />;
  }

  if (addInstanceMutation.error) {
    return <Error message={addInstanceMutation.error.message} />;
  }

  return (
    <Card>
      <CardTitle>Add Instance</CardTitle>
      <Form
        onSubmit={addInstanceMutation.mutateAsync}
        schema={addInstanceSchema}
        submitButtonLabel="Connect instance"
        className="tw-mt-4"
      >
        <Select
          label="Instance"
          name="instanceId"
          required
          options={listFalkorDBInstancesQuery.data?.map((instance) => ({
            label: `${instance.id} - ${instance.name}`,
            value: instance.id,
          }))}
        ></Select>
        <div className="tw-flex tw-gap-4">
          <FormField label="Username" name="username" type="text" required />
          <FormFieldSecret
            label="Password"
            name="password"
            type="password"
            required
          />
        </div>
      </Form>
    </Card>
  );
};

export const SiteConfiguration = () => {
  const [showAddInstanceForm, setShowAddInstanceForm] = useState(false);

  const siteSettingsQuery = trpc.siteSettings.query.useQuery();
  const deleteSiteSettingsMutation = trpc.siteSettings.delete.useMutation({
    onSettled: () => {
      siteSettingsQuery.refetch();
    },
  });

  if (siteSettingsQuery.isLoading || deleteSiteSettingsMutation.isPending) {
    return <Loading />;
  }

  if (siteSettingsQuery.error) {
    return <Error message={siteSettingsQuery.error.message} />;
  }

  if (!siteSettingsQuery.data?.email) {
    return <ConnectAccount onSubmitted={siteSettingsQuery.refetch} />;
  }

  return (
    <SiteConfigurationSurface>
      <Card>
        <CardTitle>
          Connected Instances
          <div>
            <Button
              className="tw-mr-2"
              variant="danger"
              onClick={() => deleteSiteSettingsMutation.mutateAsync()}
            >
              Remove account
            </Button>
            <AddInstanceButton
              addInstanceButtonCallback={() => setShowAddInstanceForm(true)}
            ></AddInstanceButton>
          </div>
        </CardTitle>
        <div className="tw-mt-4">
          {!showAddInstanceForm ? (
            <InstancesList
              instances={siteSettingsQuery.data.instances}
              addInstanceButtonCallback={() => setShowAddInstanceForm(true)}
              removeInstanceCallback={() => siteSettingsQuery.refetch()}
            ></InstancesList>
          ) : (
            <AddInstanceForm
              instanceAddedCallback={() => {
                setShowAddInstanceForm(false);
                siteSettingsQuery.refetch();
              }}
            ></AddInstanceForm>
          )}
        </div>
      </Card>
    </SiteConfigurationSurface>
  );
};
