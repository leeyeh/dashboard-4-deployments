import Head from "next/head";
import styles from "../styles/Home.module.css";
import useSWR, { SWRConfig } from "swr";
import { DateTime } from "luxon";

export async function getStaticProps() {
  return {
    props: {
      repo: process.env.NEXT_PUBLIC_GH_REPO,
    },
  };
}

const MAX_HOURS = (24 * 30) / 0.64;
const getOpacity = (ISOTime) => {
  const dateTime = DateTime.fromISO(ISOTime);
  const diffHours = dateTime.diffNow(["hours"]).toObject().hours;
  return Math.max(0.2, 1 - Math.pow(-diffHours / MAX_HOURS, 0.5));
};

const formatTime = (ISOTime) => {
  const dateTime = DateTime.fromISO(ISOTime);
  const diffDays = dateTime.diffNow(["days", "hours"]).toObject().days;
  const format =
    diffDays === 0 ? DateTime.TIME_SIMPLE : DateTime.DATETIME_SHORT;
  return `${dateTime.toLocaleString(format)} (${dateTime.toRelative()})`;
};

export default function Home({ repo }) {
  const { data: deployments, error } = useSWR("/api/deployments");

  return (
    <SWRConfig
      value={{
        refreshInterval: 10000,
        fetcher: (...args) => fetch(...args).then((res) => res.json()),
      }}
    >
      <div className={styles.container}>
        <Head>
          <title>Create Next App</title>
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <main className={styles.main}>
          {deployments ? (
            <div className={styles.grid}>
              {deployments.map((deployment) => {
                const {
                  name,
                  deployedAt,
                  url,
                  author,
                  commit,
                  commit: {
                    committedAt,
                    sha,
                    message,
                    author: commitAuthor,
                  } = {},
                } = deployment;
                return (
                  <div className={styles.item} key={name}>
                    <div className={styles.card}>
                      <a href={url} target="_blank">
                        <h3
                          style={{ opacity: getOpacity(deployedAt) }}
                          className={styles.line}
                        >
                          {name}
                          <span className={styles.fill} />
                          <span className={styles.meta}>
                            {deployedAt ? (
                              <>
                                {author && (
                                  <Gravatar
                                    hash={author.gravatarhash}
                                    alt={author.name}
                                  />
                                )}{" "}
                                deployed at {`${formatTime(deployedAt)}`}
                              </>
                            ) : (
                              "not deployed"
                            )}
                          </span>
                          &nbsp;&rarr;
                        </h3>
                      </a>
                      {commit && (
                        <a
                          href={`https://github.com/${repo}/commits/${sha}`}
                          target="_blank"
                        >
                          <p
                            style={{ opacity: getOpacity(committedAt) }}
                            className={styles.line}
                          >
                            <span
                              className={styles.shaVisaulized}
                              style={{ background: `#${sha.slice(0, 6)}` }}
                            ></span>
                            <span className={styles.sha}>
                              {sha.slice(0, 7)}
                            </span>{" "}
                            <span>{message}</span>
                            <span className={styles.fill} />
                            <span className={styles.meta}>
                              {commitAuthor && (
                                <Gravatar
                                  hash={commitAuthor.gravatarhash}
                                  alt={commitAuthor.name}
                                />
                              )}{" "}
                              {`committed at ${formatTime(committedAt)}`}
                            </span>
                            &nbsp;&rarr;
                          </p>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            "loading..."
          )}
        </main>

        <footer className={styles.footer}>
          dashboard 4{" "}
          <a href={`https://github.com/${repo}`} target="_blank">
            {repo}
          </a>
          |
          <a
            href="https://github.com/leeyeh/dashboard-4-deployments"
            target="_blank"
          >
            source code
          </a>
        </footer>
      </div>
    </SWRConfig>
  );
}

const Gravatar = ({ hash, alt }) => {
  return (
    <img
      className={styles.gravatar}
      height={24}
      width={24}
      src={`https://www.gravatar.com/avatar/${hash}?d=retro`}
      alt={alt}
      title={alt}
    />
  );
};
