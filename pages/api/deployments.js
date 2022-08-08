import fetch from "node-fetch";
const memo = require("memoizee");
const { Octokit } = require("octokit");
const md5 = require("md5");

const LC_ACCESS_TOKEN = process.env.LC_ACCESS_TOKEN;
const LC_ACCESS_TOKEN_US = process.env.LC_ACCESS_TOKEN_US;
const ENGINE_ENVS = process.env.ENGINE_ENVS;
const envs = ENGINE_ENVS.split(",").map((env) => env.split("/"));
console.log(envs);

const GHP_ACCESS_TOKEN = process.env.GHP_ACCESS_TOKEN;
const GH_REPO = process.env.NEXT_PUBLIC_GH_REPO;
const octokit = new Octokit({ auth: GHP_ACCESS_TOKEN });
const [owner, repo] = GH_REPO.split("/");

const LC_API_DOMAINS = {
  "cn-n1": "cn-n1-console-api.leancloud.cn",
  "cn-e1": "cn-e1-console-api.leancloud.cn",
  "us-w1": "us-w1-console-api.leancloud.app",
};
const LC_CONSOLE_DOMAINS = {
  "cn-n1": "console.leancloud.cn",
  "cn-e1": "console-e1.leancloud.cn",
  "us-w1": "console.leancloud.app",
};

const LC_TOKENS = {
  "cn-n1": LC_ACCESS_TOKEN,
  "cn-e1": LC_ACCESS_TOKEN,
  "us-w1": LC_ACCESS_TOKEN_US,
};

const fetchDeployments = memo(
  async (region, appId, groupName) => {
    console.log(`Fetching deployment: ${region}/${appId}/${groupName}`);
    const response = await fetch(
      `https://${LC_API_DOMAINS[region]}/1.1/engine/groups/${groupName}/deployments`,
      {
        headers: {
          Authorization: `Bearer ${LC_TOKENS[region]}`,
          "X-LC-ID": appId,
        },
      }
    );
    const data = await response.json();
    if (response.status > 400) {
      throw new Error(data.error ?? response.statusText);
    }
    console.log(`Fetched: ${region}/${appId}/${groupName}`);
    return data;
  },
  {
    maxAge: 10000,
  }
);

const fetchCommit = memo(
  async (sha) => {
    console.log(`Fetching commit: ${sha}`);
    const data = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: sha,
    });
    console.log(`Fetched: ${sha} (${data.data.commit.message.split("\n")[0]})`);
    return data;
  },
  {
    max: 1000,
  }
);

const ENV_MAP = {
  stg: 0,
  prod: 1,
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
        const deployments = await fetchDeployments(region, appId, groupName);

        const matchedDeployment = deployments.find(
          (deployment) =>
            deployment.prod === ENV_MAP[envName] &&
            deployment.status === "success"
        );
        if (!matchedDeployment)
          return {
            name: alias,
            error: `Deployment not found`,
          };
        if (!matchedDeployment.version) {
          return {
            name: alias,
            error: `Not deployed`,
          };
        }
        const version = matchedDeployment.version?.version || "";
        let sha, commit;
        if (version.indexOf("git:") === 0) {
          sha = version.slice(4);
          const { data } = await fetchCommit(sha);
          commit = {
            committedAt: data.commit.committer.date,
            sha,
            message: data.commit.message.slice(0, 18) + "...",
            author: {
              gravatarhash: md5(data.commit.author.email),
              name: data.commit.author.name,
            },
          };
        }
        return {
          name: alias,
          deployedAt: matchedDeployment.deployedAt,
          author: matchedDeployment.deployedBy
            ? {
                gravatarhash: matchedDeployment.deployedBy.emailMd5,
                name: matchedDeployment.deployedBy.username,
              }
            : undefined,
          url: `https://${LC_CONSOLE_DOMAINS[region]}/apps/${appId}/engine/groups/${groupName}/deploy`,
          commit,
        };
      }
    )
  );
  res.status(200).json(deployments);
};
