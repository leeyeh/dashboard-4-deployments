const fetch = require("node-fetch");
const memo = require("memoizee");

const ENGINE_ENVS = process.env.ENGINE_ENVS;
const LC_ACCESS_TOKEN = process.env.LC_ACCESS_TOKEN;
const GHP_ACCESS_TOKEN = process.env.GHP_ACCESS_TOKEN;
const GH_REPO = process.env.GH_REPO;

const envs = ENGINE_ENVS.split(",").map((env) => env.split("/"));

console.log(envs);

const LC_API_DOMAINS = {
  "cn-n1": "cn-n1-console-api.leancloud.cn",
  "cn-e1": "cn-e1-console-api.leancloud.cn",
  "us-w1": "us-w1-console-api.leancloud.app",
};
const LC_CONSOLE_DOMAINS = {
  "cn-n1": "console.leancloud.cn",
  "cn-e1": "e1-console.leancloud.cn",
  "us-w1": "console.leancloud.app",
};

const fetchGroups = memo(
  async (region, appId) => {
    console.log(`request: ${region}/${appId}`);
    return (
      await fetch(`https://${LC_API_DOMAINS[region]}/1.1/engine/groups`, {
        headers: {
          Authorization: `Bearer ${LC_ACCESS_TOKEN}`,
          "X-LC-ID": appId,
        },
      })
    ).json();
  },
  {
    maxAge: 10000,
  }
);

const ENV_MAP = {
  stg: "staging",
  prod: "production",
};

export default async (req, res) => {
  const deployments = await Promise.all(
    envs.map(
      async ([
        region,
        appId,
        groupName,
        envName,
        alias = `${region}/${appId.slice(0, 8)}/${groupName}/${envName}`,
      ]) => {
        const groups = await fetchGroups(region, appId);
        const matchedGroup = groups.find(
          (group) => group.groupName === groupName
        );
        if (!matchedGroup)
          return {
            name: alias,
            error: `Group not found`,
          };
        const env = matchedGroup[ENV_MAP[envName]];
        if (!env)
          return {
            name: alias,
            error: `Enviroment not found`,
          };
        if (!env?.version) {
          return {
            name: alias,
            error: `Not deployed`,
          };
        }
        return {
          name: alias,
          deployedAt: env.deployedAt,
          commit: env.version?.version,
        };
      }
    )
  );
  res.status(200).json(deployments);
};
