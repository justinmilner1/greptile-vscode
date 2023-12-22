import React, { useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { VSCodeDropdown, VSCodeOption, VSCodeTextField, VSCodeButton } from "@vscode/webview-ui-toolkit/react";

import { SAMPLE_REPOS } from "../data/constants";
import { vscode } from "../lib/vscode-utils";
import { parseIdentifier } from "../lib/onboard-utils";
import type { Session, Membership } from "../types/session";
import { SessionContext } from "../providers/session-provider";

import "../App.css";
import mixpanel from "mixpanel-browser";
import { usePostHog } from "posthog-js/react";

interface NewChatProps {
  setDialogOpen?: React.Dispatch<React.SetStateAction<boolean>>;
}

export const NewChat = ({ setDialogOpen }: NewChatProps) => {

  console.log("Starting NewChat")

  const { session, setSession } = useContext(SessionContext);
  const posthog = usePostHog();

  // console.log("session", session);

  const navigate = useNavigate();

  useEffect(() => {
    // This effect runs when the component mounts and whenever session.state.repoUrl changes
    const repoUrl = session?.state?.repoUrl;
    if (repoUrl) {
      // Parse the repo URL to get the repo identifier
      const parsedRepo = parseIdentifier(repoUrl);
      if (parsedRepo) {
        // If the repo is parsed successfully, update the session state
        setSession({
          ...session,
          state: {
            ...session?.state,
            repo: parsedRepo
          }
        });
        // Automatically navigate to the chat page for the parsed repo
        navigate(`/chat/${parsedRepo}`);
      }
    }
  }, [session?.state?.repoUrl, navigate, setSession]);

  const handleClone = async () => {

    posthog.capture("Repository cloned", { source: "onboard-vscode", repo: session?.state?.repo || "" });
    mixpanel.track("Repository cloned", { source: "onboard-vscode", repo: session?.state?.repo || "" });
    console.log("Checking membership");

    // checking membership
    const checkMembership = async () => {
      if (!session?.user) return;

      const response = await fetch(`https://dprnu1tro5.execute-api.us-east-1.amazonaws.com/prod/v1/membership`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + session?.user?.token
        },
      })
      .then(async (res) => {
        return res.json();
      });

      if (response['membership'] !== session?.user?.membership) {

        // update session
        setSession({
          ...session,
          user: {
            ...session?.user,
            token: session?.user?.token,
            membership: response['membership']
          }
        } as Session);
      }
    };

    checkMembership();
    console.log("Handling clone");

    const submitJob = async () => {
      return fetch('https://dprnu1tro5.execute-api.us-east-1.amazonaws.com/prod/v1/repositories', {
        method: "POST",
        body: JSON.stringify({
          repository: session?.state?.repo || "",
        }),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + session?.user?.token
        },
      })
      .then(async (res) => {
        if (res.ok) {
          // console.log('yay');
          return res; // don't think is needed? probably needed tho
        } else if (res.status === 404) { // && session?.user?.refreshToken) {
          console.log("Error: Needs refresh token or unauthorized");
          vscode.postMessage({
            command: "error",
            text: "This repository was not found, or you do not have access to it. If this is your repo, please try logging in again. Reach out to us on Discord for support."
          });
          // todo: get refresh token
        } else {
          return res;
        }
      });
    };

    if (session?.state?.repo) {
      // if session user token exists, set repoUrl to include token before github.com and after https:// with user session token + '@'

      submitJob().then(async (res) => {
        if (res.ok) {
          console.log("Cloned repo and moving to:", session?.state?.repo || "");
          navigate(`/chat/${session?.state?.repo || ""}`);
        } else {
          if (res.status === 402) {
            vscode.postMessage({
              command: "upgrade",
              text: "Upgrade to Onboard Pro to process private repos! 🔐"
            });
          } else if (res.status === 426) {
            vscode.postMessage({
              command: "upgrade",
              text: "Upgrade to Onboard Pro to process large repos! 🐘"
            });
          } else if (res.status === 404) {
            vscode.postMessage({
              command: "error",
              text: "This repository was not found, or you do not have access to it. If this is your repo, please try logging in again. Reach out to us on Discord for support."
            });
          } else {
            vscode.postMessage({
              command: "error",
              text: "Unknown Error"
            });
            console.log("Unknown Error");
          }
        }
      });
    } else {
      console.log("Invalid GitHub URL");
      vscode.postMessage({
        command: "error",
        text: "Please enter a valid GitHub repository URL, like https://github.com/onboardai/onboard."
      });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleClone();
    }
  };

  return (
    <div>
      {session ? (
        <div>
          <div className="dropdown-container">
            <label htmlFor="my-dropdown">Try a Popular Repo: </label>
            <VSCodeDropdown id="my-dropdown">
            {SAMPLE_REPOS.map((repo, index) => (
                  <VSCodeOption
                  key={index}
                  onClick={() => {
                    posthog.capture("Sample repo clicked", { source: "onboard-vscode", repo: repo.repo });
                    mixpanel.track("Sample repo clicked", { source: "onboard-vscode", repo: repo.repo });
                    navigate(`/chat/${repo.repo}`);
                    if (setDialogOpen) {
                      setDialogOpen(false);
                    }
                  }}
                  >
                      {repo.displayName}
                  </VSCodeOption>
            ))}
            </VSCodeDropdown>
          </div>
          or
          <div>
            <p>Enter a Repo:</p>
              <div className="flex-row">
                <VSCodeTextField
                  placeholder=""
                  value={session?.state?.repoUrl || ""}
                  onKeyDown={handleKeyDown}
                  onChange={(e) => {
                    setSession({
                      ...session,
                      state: {
                        ...session?.state,
                        repoUrl: e.target.value
                      }
                    } as Session)
                  }}
                >
                  Github URL
                </VSCodeTextField>
                <VSCodeButton
                  appearance="primary"
                  aria-label="Submit repo"
                  onClick={handleClone}
                  className="submit"
                >
                  Submit
                </VSCodeButton>
              </div>
            {/* or
            <p>Recent Repos:</p> */}
          </div>
        </div>
      ) : (
        <div className="centered-container">
          <VSCodeButton
            onClick={() => {
              posthog.capture("Github Login Clicked", { source: "onboard-vscode" });
              mixpanel.track("Github Login Clicked", { source: "onboard-vscode" });
              vscode.postMessage({command: "login", text: "github login"});
            }}
          >
            Login
          </VSCodeButton>
        </div>
      )}
    </div>
  );
};
