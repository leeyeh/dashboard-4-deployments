const fetch = require("node-fetch");
const memo = require("memoizee");
const { Octokit } = require("octokit");

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

const fetchGroups = memo(
  async (region, appId) => {
    console.log(`Fetching groups: ${region}/${appId}`);
    const data = (
      await fetch(`https://${LC_API_DOMAINS[region]}/1.1/engine/groups`, {
        headers: {
          Authorization: `Bearer ${LC_TOKENS[region]}`,
          "X-LC-ID": appId,
        },
      })
    ).json();
    console.log(`Fetched: ${region}/${appId}`);
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
    console.log(`Fetched: ${sha} (${data.data.commit.message.split('\n')[0]})`);
    return data;
  },
  {
    max: 1000,
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
        const version = env.version?.version || "";
        let sha, commit;
        if (version.indexOf("git:") === 0) {
          sha = version.slice(4);
          const { data } = await fetchCommit(sha);
          commit = {
            committedAt: data.commit.committer.date,
            sha,
            message: data.commit.message.slice(0, 16) + "...",
          };
        }
        return {
          name: alias,
          deployedAt: env.deployedAt,
          url: `https://${LC_CONSOLE_DOMAINS[region]}/apps/${appId}/engine/groups/${groupName}/deploy`,
          commit,
        };
      }
    )
  );
  res.status(200).json(deployments);
};
